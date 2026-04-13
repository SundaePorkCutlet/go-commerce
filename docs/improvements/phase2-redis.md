# Phase 2: Redis 패턴 활용

> Redis의 다양한 데이터 구조와 패턴을 실제 문제 해결에 적용

---

## 핵심 키워드

- **Cache Invalidation** → 데이터 수정 시 캐시를 즉시 삭제하여 stale data 방지
- **Sorted Set (ZINCRBY, ZREVRANGE)** → 점수 기반 실시간 랭킹, O(log N) 성능
- **Sliding Window Rate Limiter** → Sorted Set으로 정확한 시간 윈도우 기반 요청 제한
- **Token Blacklist** → 로그아웃 시 JWT를 SHA256 해시로 Redis에 저장, TTL로 자동 정리

---

## 개선 전 문제점

| 문제 | 설명 |
|------|------|
| 캐시만 사용 | String GET/SET + 5분 TTL이 전부 |
| 캐시 무효화 없음 | 상품 수정 후에도 5분간 stale 데이터 반환 |
| 3개 서비스 미사용 | USERFC, ORDERFC, PAYMENTFC는 Redis 클라이언트만 생성하고 사용 안 함 |
| 데이터 구조 미활용 | Hash, Sorted Set, Set 등 Redis 강점인 다양한 자료구조 미사용 |

---

## 2-1. 캐시 무효화 (PRODUCTFC)

### 문제: Stale Data

```
1. GET /products/1 → 캐시에 저장 (TTL: 5분, 가격: 10000원)
2. PUT /products/1 (가격 → 15000원으로 변경)
3. GET /products/1 → 캐시에서 읽음 → 10000원 반환 (5분 동안 잘못된 가격!)
```

### 해결: Cache-Aside 패턴 — 수정/삭제 시 캐시 즉시 삭제

```go
func (r *ProductRepository) InvalidateProductCache(ctx context.Context, productID int64) error {
    cacheKey := fmt.Sprintf("product:%d", productID)
    return r.Redis.Del(ctx, cacheKey).Err()
}
```

캐시가 삭제되는 시점:

| 작업 | 시점 | 동기/비동기 | 이유 |
|------|------|------------|------|
| `EditProduct` | DB 업데이트 후 | goroutine (비동기) | 캐시 삭제 실패해도 API 응답에 영향 없도록 |
| `DeleteProduct` | DB 삭제 **전** | 동기 | 삭제 후 캐시가 남으면 "없는 상품"이 반환됨 |
| `UpdateProductStock` | 재고 차감 후 | goroutine (비동기) | 위와 동일 |
| `AddProductStock` | 재고 추가 후 | goroutine (비동기) | 위와 동일 |

```go
// EditProduct — goroutine으로 비동기 삭제
go func(id int64) {  // product.ID를 값 복사로 넘김 (클로저 안전)
    if err := s.ProductRepo.InvalidateProductCache(context.Background(), id); err != nil {
        log.Logger.Error().Err(err).Msg("Failed to invalidate product cache")
    }
}(product.ID)

// DeleteProduct — 동기로 먼저 삭제
if err := s.ProductRepo.InvalidateProductCache(ctx, id); err != nil {
    log.Logger.Error().Err(err).Msg("Failed to invalidate product cache before delete")
}
err := s.ProductRepo.DeleteProduct(ctx, id)
```

> **context.Background()를 쓰는 이유**: 원래 요청의 ctx가 취소(클라이언트 연결 끊김 등)되어도 Redis 작업은 완료시키기 위해서.

삭제 후 다음 조회 시 **Cache Miss → DB 조회 → 새로운 캐시 저장** 흐름으로 최신 데이터가 반환됩니다. 현재 캐시 TTL은 **5분** (`time.Minute*5`).

---

## 2-2. Redis Monitor + Cache Hit/Miss 통계

### 구현: `infrastructure/redismonitor/monitor.go`

Phase 1의 `dbmonitor`와 같은 패턴으로, Redis 작업 통계를 수집합니다.

```go
type Monitor struct {
    mu       sync.RWMutex
    hits     int64       // 캐시 히트
    misses   int64       // 캐시 미스
    totalOps int64       // 전체 Redis 작업 수
    errors   int64       // 에러 수
    redis    *redis.Client
}
```

서비스 레이어에서 Redis 조회 결과에 따라 `RecordHit()` 또는 `RecordMiss()`를 호출합니다.

### API 응답 (`GET /debug/redis`)

```json
{
  "hits": 1523,
  "misses": 234,
  "hit_rate_pct": 86.69,
  "total_ops": 1757,
  "errors": 0,
  "db_size": 42
}
```

---

## 2-3. 실시간 인기 상품 랭킹 (PRODUCTFC)

### Redis 자료구조: Sorted Set

Sorted Set은 각 요소에 **점수(score)**가 부여된 집합입니다. 점수 기준 정렬이 O(log N)으로 매우 빠릅니다.

### 동작 흐름

```
상품 조회 시:
  ZINCRBY ranking:product_views 1 "product_id"
  → 해당 상품의 점수를 +1 (없으면 자동 생성)

랭킹 조회 시:
  ZREVRANGE ranking:product_views 0 9 WITHSCORES
  → 점수가 높은 순으로 상위 10개 반환
```

### 코드

```go
func (r *ProductRepository) IncrementProductView(ctx context.Context, productID int64) error {
    return r.Redis.ZIncrBy(ctx, "ranking:product_views",
        1, fmt.Sprintf("%d", productID)).Err()
}

func (r *ProductRepository) GetTopProducts(ctx context.Context, limit int) ([]models.ProductRankingItem, error) {
    results, err := r.Redis.ZRevRangeWithScores(ctx,
        "ranking:product_views", 0, int64(limit-1)).Result()
    // ... parse results
}
```

### API

```
GET /v1/products/ranking?limit=10
```

```json
[
  { "product_id": 5, "view_count": 142 },
  { "product_id": 12, "view_count": 98 },
  { "product_id": 3, "view_count": 67 }
]
```

---

## 2-4. Sliding Window Rate Limiter (USERFC)

### 왜 슬라이딩 윈도우인가?

#### 고정 윈도우의 문제

```
윈도우: 60초, 제한: 10 req

|-------- 분 1 --------|-------- 분 2 --------|
                   10 req  10 req
                    ↑ 59초   ↑ 61초
                    
→ 2초 사이에 20 req 허용됨 (제한의 2배!)
```

#### 슬라이딩 윈도우

```
현재 시점에서 뒤로 60초를 항상 체크
→ 어떤 시점이든 60초 내 최대 10 req 보장
```

### 구현: Redis Sorted Set

```
Redis Key: rate_limit:{client_ip}  (예: rate_limit:192.168.1.100)
Type: Sorted Set

score(타임스탬프)       member(유니크ID)
1711929600000          "1711929600000:839201"
1711929601500          "1711929601500:129384"
1711929603200          "1711929603200:582917"
```

**횟수를 직접 저장하지 않는다.** 각 요청의 타임스탬프를 기록하고, `ZCARD`로 윈도우 내 몇 개 있는지 센다.

```go
func (rl *RateLimiter) Allow(ctx context.Context, key string) (bool, int, error) {
    now := time.Now().UnixMilli()
    windowStart := now - int64(rl.windowSec)*1000

    // Pipeline 1 (읽기): 2개 명령을 한 번의 네트워크 왕복으로 처리
    pipe := rl.redis.Pipeline()
    pipe.ZRemRangeByScore(ctx, key, "-inf", strconv.FormatInt(windowStart, 10))  // 60초 이전 삭제
    cardCmd := pipe.ZCard(ctx, key)    // 남은 개수 = 60초 내 요청 수
    pipe.Exec(ctx)

    if count >= maxReqs {
        return false, 0, nil  // 거부 — ZADD 실행 안 함!
    }

    // Pipeline 2 (쓰기): 허용된 경우에만 기록
    member := fmt.Sprintf("%d:%d", now, rand.Int63())  // 같은 밀리초 충돌 방지
    pipe2 := rl.redis.Pipeline()
    pipe2.ZAdd(ctx, key, redis.Z{Score: float64(now), Member: member})
    pipe2.Expire(ctx, key, time.Duration(rl.windowSec+1)*time.Second)  // 안전장치 TTL
    pipe2.Exec(ctx)

    return true, remaining - 1, nil
}
```

### 핵심 설계 포인트

| 포인트 | 설명 |
|--------|------|
| **거부된 요청은 기록하지 않음** | 10번 채운 후 100번 더 시도해도 Sorted Set에는 10개만. 가장 오래된 기록이 만료되면 자동 복구 |
| **Pipeline 사용 이유** | 명령을 하나씩 보내면 RTT가 2~3번 발생. Pipeline은 한 번에 묶어서 1번의 RTT로 처리 |
| **rand.Int63() 사용 이유** | 같은 밀리초에 여러 요청이 오면 member가 같아져 덮어씌워짐. 랜덤 값으로 유니크 보장 |
| **Expire 안전장치** | 유저가 영영 안 오면 키가 영구 남을 수 있음. TTL(61초)로 Redis가 자동 삭제 |

### Redis의 TTL 만료 처리 방식

`EXPIRE`를 설정하면 Redis는 2가지 방식으로 키를 삭제한다:

1. **Lazy Deletion**: 키에 접근할 때 만료 여부 확인 → 만료됐으면 그때 삭제
2. **Active Expiry**: Redis가 1초에 10번, 랜덤으로 만료된 키 20개를 샘플링해서 삭제 (이벤트 루프 내 경량 작업)

→ 별도 cron이 아닌, Redis 내부 이벤트 루프에서 처리된다.

### 적용

```
POST /v1/login    → 같은 IP에서 60초당 최대 10회
POST /v1/register → 같은 IP에서 60초당 최대 10회
```

왜 이 API에만?
- **로그인**: Brute force 공격 (비밀번호 무차별 대입) 방지
- **회원가입**: 봇의 대량 가짜 계정 생성 방지
- **상품 조회 등 읽기 API**: 제한 불필요. 공격 피해가 적고, 제한하면 정상 유저가 불편

초과 시 응답:

```
HTTP 429 Too Many Requests
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 0

{"error": "too many requests", "retry_after_seconds": 60}
```

영구 차단이 아닌 **시간이 지나면 자동으로 풀리는 구조**다.

---

## 2-5. JWT 토큰 블랙리스트 (USERFC)

### 문제: JWT는 Stateless라서 로그아웃이 없다

JWT는 서버에 상태를 저장하지 않기 때문에, 토큰이 만료되기 전까지 **무효화할 방법이 없습니다**. 토큰이 탈취되면 만료까지 대응 불가.

### 해결: Redis에 블랙리스트 저장

```
로그아웃 시:
  1. 토큰의 남은 만료 시간 계산 (예: 45분)
  2. SHA256(token) → Redis에 저장, TTL = 45분
  3. 토큰 만료 시 Redis에서 자동 삭제 (메모리 절약)

API 호출 시 (미들웨어):
  1. SHA256(token) 계산
  2. Redis에서 EXISTS 체크
  3. 존재하면 → 401 "token has been revoked"
```

### 코드

```go
func (tb *TokenBlacklist) Add(ctx context.Context, token string, exp time.Duration) error {
    hash := sha256.Sum256([]byte(token))
    key := "blacklist:" + hex.EncodeToString(hash[:])
    return tb.redis.Set(ctx, key, "1", exp).Err()
}

func (tb *TokenBlacklist) IsBlacklisted(ctx context.Context, token string) (bool, error) {
    hash := sha256.Sum256([]byte(token))
    key := "blacklist:" + hex.EncodeToString(hash[:])
    n, err := tb.redis.Exists(ctx, key).Result()
    return n > 0, err
}
```

### 왜 SHA256?

JWT 토큰 원문은 수백 바이트입니다. Redis 키로 직접 쓰면 메모리 낭비. SHA256은 **32바이트 고정 길이**로, 충돌 확률은 2^128분의 1로 사실상 0입니다.

---

## 사용된 Redis 자료구조 요약

| 자료구조 | 명령어 | 용도 | 서비스 |
|---------|--------|------|--------|
| **String** | GET, SET, DEL | 상품 캐시, 토큰 블랙리스트 | PRODUCTFC, USERFC |
| **Sorted Set** | ZINCRBY, ZREVRANGE | 인기 상품 랭킹 | PRODUCTFC |
| **Sorted Set** | ZADD, ZREMRANGEBYSCORE, ZCARD | 슬라이딩 윈도우 Rate Limiter | USERFC |

---

## Docker·운영: 영속성과 기본값 (이미지 기준)

Redis는 **실행 시 데이터는 메모리**에 두지만, **디스크에 스냅샷·로그를 남기는 옵션**이 있어서 “메모리 DB = 재부팅 시 항상 초기화”는 아닙니다. 어떤 **설정·이미지·볼륨**을 쓰는지에 따라 달라집니다.

### RDB vs AOF (공식 `redis.conf` 관례)

| 방식 | 기본 경향 | 설명 |
|------|-----------|------|
| **RDB** | 보통 **켜짐** (`save` 규칙 존재) | 일정 조건에서 **메모리 스냅샷**을 파일로 저장 (`dump.rdb` 등) |
| **AOF** | 보통 **꺼짐** (`appendonly no`) | **쓰기 명령 로그**를 파일에 append. 켜려면 `appendonly yes` 등 **명시적 설정** 필요 |

즉, **“주기적 스냅샷(RDB)은 도는데, 명령어 로그(AOF)는 안 쌓는 상태”**가 기본 구성에서 흔합니다.

### 기본 RDB `save` 조건 (Redis 기본 템플릿)

고정 주기가 아니라 **시간 창 + 변경 횟수** 조합입니다. 아래 **어느 하나라도** 만족하면 백그라운드 저장이 시도됩니다.

| 규칙 | 의미 |
|------|------|
| `save 900 1` | **900초(15분)** 안에 키 변경이 **1회 이상** |
| `save 300 10` | **300초(5분)** 안에 키 변경이 **10회 이상** |
| `save 60 10000` | **60초(1분)** 안에 키 변경이 **10000회 이상** |

실제 값은 배포마다 다를 수 있어, 런타임에는 `CONFIG GET save` 로 확인하는 것이 정확합니다.

### 이 레포의 `docker-compose.yml` (Redis 서비스)

- **이미지**: `redis:7-alpine`
- **커맨드**: `redis-server --requirepass admin` → **비밀번호만 지정**하고, 나머지는 이미지에 포함된 **기본 `redis.conf` 동작**을 따르는 형태에 가깝습니다.
- **볼륨**: `redis_data:/data` → RDB(및 AOF를 켠 경우 그 파일)가 **`/data`에 쓰이면** 호스트 볼륨에 남아, **컨테이너를 재생성해도 파일이 유지**되는 한 다시 로드됩니다.

**데이터가 사라지는 대표 케이스**

- `docker compose down -v` 처럼 **볼륨까지 삭제**
- 퍼시스턴스를 끈 구성(예: `save ""`) 또는 **볼륨 없이** ephemeral 컨테이너만 사용
- 스냅샷 사이에 **강제 kill** 등으로 아직 디스크에 안 쓴 변경분

**요약**: 이 프로젝트의 기본 compose는 **메모리 + (기본) RDB 스냅샷 + named volume** 조합에 가깝고, **AOF는 기본적으로 쓰지 않는 경우가 많다**고 보면 됩니다.

---

## 변경된 파일 요약

| 파일 | 변경 내용 |
|------|----------|
| `PRODUCTFC/infrastructure/redismonitor/monitor.go` | **신규** — Redis 작업 통계 모니터 |
| `PRODUCTFC/cmd/product/repository/redis.go` | 캐시 무효화 + 랭킹 (ZINCRBY, ZREVRANGE) |
| `PRODUCTFC/cmd/product/service/service.go` | 캐시 hit/miss 추적, 수정/삭제 시 무효화, 조회 시 랭킹 증가 |
| `PRODUCTFC/cmd/product/handler/handler.go` | GetProductRanking 핸들러 |
| `PRODUCTFC/routes/routes.go` | `/v1/products/ranking`, `/debug/redis` |
| `PRODUCTFC/models/product.go` | ProductRankingItem 모델 |
| `USERFC/infrastructure/ratelimiter/limiter.go` | **신규** — Sorted Set 슬라이딩 윈도우 Rate Limiter |
| `USERFC/infrastructure/tokenblacklist/blacklist.go` | **신규** — SHA256 기반 JWT 블랙리스트 |
| `USERFC/middleware/auth_middleware.go` | AuthMiddlewareWithBlacklist 추가 |
| `USERFC/cmd/user/handler/handler.go` | Logout 핸들러 |
| `USERFC/routes/routes.go` | `/v1/logout`, Rate Limiter 적용, `/debug/redis` |
