# Phase 1: PostgreSQL 심화

> ORM 뒤에 숨은 SQL을 직접 보고, 성능을 측정하고, 최적화하는 경험

---

## 핵심 키워드 (면접용 한줄 요약)

- **GORM Plugin/Callback** → 쿼리 실행 전후에 코드를 끼워넣는 확장 포인트
- **Connection Pool** → DB 연결을 미리 만들어두고 재사용하여 성능 향상
- **Composite Index** → 자주 함께 쓰이는 WHERE 컬럼을 하나의 B-Tree로 묶어 탐색 최적화
- **FOR UPDATE (Pessimistic Lock)** → 행을 잠가서 동시 수정을 차단, 재고처럼 충돌이 빈번한 곳에 적합
- **CTE + Window Function** → SQL 안에서 임시 테이블을 만들고, 행을 유지하면서 누적/순위 계산

---

## 개선 전 문제점

| 문제 | 설명 |
|------|------|
| SQL이 안 보임 | GORM이 모든 쿼리를 자동 생성해서, 실제로 어떤 SQL이 나가는지 모름 |
| 인덱스 없음 | 모든 조회가 Full Table Scan — 데이터 많아지면 급격히 느려짐 |
| 커넥션 관리 없음 | `gorm.Open()` 한 줄로 끝, 동시 접속 제어 불가 |
| Race Condition | 재고 차감 시 동시 주문이 들어오면 재고가 음수가 될 수 있음 |
| 분석 쿼리 없음 | 단순 CRUD만 사용, PostgreSQL의 분석 기능(CTE, Window Function) 미활용 |

---

## 1-1. 쿼리 성능 모니터링 시스템

### 원리: GORM Plugin + Callback

GORM은 쿼리 실행 전/후에 **콜백(Callback)** 을 등록할 수 있습니다. 이를 이용해 모든 쿼리의 실행 시간을 자동으로 측정합니다.

```
애플리케이션 코드                    GORM 내부                         PostgreSQL
      │                              │                                 │
      │  db.Find(&products)          │                                 │
      ├────────────────────────────→ │                                 │
      │                              │ [Before 콜백] 시작 시간 기록      │
      │                              │                                 │
      │                              │  SELECT * FROM products ...      │
      │                              ├────────────────────────────────→│
      │                              │                                 │
      │                              │←────────────── 결과 반환 ───────│
      │                              │                                 │
      │                              │ [After 콜백]                     │
      │                              │  ├ 소요 시간 = now() - 시작 시간  │
      │                              │  ├ 쿼리 텍스트 기록               │
      │                              │  └ 링버퍼에 저장 (최근 100개)     │
      │                              │                                 │
      │←───────────── 결과 반환 ──────│                                 │
```

### 구현 파일

**`infrastructure/dbmonitor/monitor.go`** (4개 서비스 공통)

핵심 코드:

```go
// GORM Plugin 인터페이스 구현
func (m *Monitor) Initialize(db *gorm.DB) error {
    // 모든 CRUD 작업의 전/후에 콜백 등록
    db.Callback().Query().Before("gorm:query").Register("monitor:before_query", m.before)
    db.Callback().Query().After("gorm:query").Register("monitor:after_query", m.after)
    // Create, Update, Delete, Raw도 동일하게 등록
}

// Before: 시작 시간을 GORM 인스턴스에 저장
func (m *Monitor) before(db *gorm.DB) {
    db.InstanceSet("monitor:start", time.Now())
}

// After: 소요 시간 계산 + 기록
func (m *Monitor) after(db *gorm.DB) {
    start := db.InstanceGet("monitor:start")
    duration := time.Since(start)
    // 쿼리 텍스트, 소요 시간, 영향 행 수를 링버퍼에 저장
}
```

### API 응답 예시

`GET /debug/queries` →

```json
{
  "stats": {
    "total_queries": 1523,
    "slow_queries": 3,
    "avg_duration_ms": 2.34,
    "max_duration_ms": 156.78
  },
  "pool": {
    "max_open_conns": 25,
    "open_conns": 8,
    "in_use": 3,
    "idle": 5
  },
  "slow_queries": [...],
  "recent": [...]
}
```

---

## 1-2. 인덱스 전략

### 인덱스란?

책의 **목차** 와 같습니다. 목차 없이 특정 단어를 찾으려면 책 전체를 넘겨야 합니다(Full Table Scan). 목차가 있으면 바로 해당 페이지로 갈 수 있습니다.

### 적용한 인덱스

#### ORDERFC — `orders` 테이블

```
인덱스: idx_orders_user_status (user_id, status)
```

```
Before (인덱스 없음):
  SELECT * FROM orders WHERE user_id = 5 AND status = 2
  → 전체 orders 테이블 스캔 (10만 행이면 10만 행 모두 확인)

After (복합 인덱스):
  → B-tree에서 user_id=5 위치로 점프 → 그 안에서 status=2만 필터
  → 수십 행만 읽음
```

**왜 (user_id, status) 순서인가?**
- "이 유저의 주문 목록" 쿼리가 가장 빈번
- `user_id`가 첫 번째여야 `WHERE user_id = ?` 에서 인덱스를 탈 수 있음
- `status`가 두 번째여서 `WHERE user_id = ? AND status = ?` 도 커버

#### PRODUCTFC — `products` 테이블

```
인덱스: idx_products_name, idx_products_price, idx_products_category
```

- `name`: 상품 검색(`ILIKE`)에 사용
- `price`: 가격 범위 필터(`price >= ? AND price <= ?`)에 사용
- `category_id`: 카테고리별 조회에 사용

#### PAYMENTFC — `payments` + `payment_requests` 테이블

```
인덱스: idx_payments_status_time (status, create_time)
인덱스: idx_payments_order (order_id)
인덱스: idx_payreq_status_time (status, create_time)
```

- 스케줄러가 `WHERE status = 'pending' AND create_time >= ...` 을 주기적으로 실행
- 복합 인덱스로 이 패턴을 최적화

---

## 1-3. FOR UPDATE 비관적 락 (재고 동시성 제어)

### 문제 상황: Race Condition

```
시간순서    트랜잭션 A (주문 1)          트랜잭션 B (주문 2)          DB의 재고
─────────────────────────────────────────────────────────────────
  t1       SELECT stock → 1                                       stock = 1
  t2                                  SELECT stock → 1             stock = 1
  t3       UPDATE stock = 1 - 1 = 0                                stock = 0
  t4                                  UPDATE stock = 1 - 1 = 0     stock = 0 ← 이미 0인데?!

결과: 재고 1개인 상품을 2명이 모두 주문 성공 → 재고 부족 문제
```

### 해결: SELECT ... FOR UPDATE

```
시간순서    트랜잭션 A (주문 1)          트랜잭션 B (주문 2)          DB의 재고
─────────────────────────────────────────────────────────────────
  t1       BEGIN                                                    stock = 1
  t2       SELECT ... FOR UPDATE → 1   (이 행에 잠금 설정)          stock = 1
  t3                                  BEGIN
  t4                                  SELECT ... FOR UPDATE
  t5                                  → 대기 (A가 잠금 해제할 때까지)
  t6       UPDATE stock = 0
  t7       COMMIT (잠금 해제)                                       stock = 0
  t8                                  → 잠금 획득, stock = 0 읽음
  t9                                  stock < qty → 에러 반환!
  t10                                 ROLLBACK

결과: 2번째 주문은 "재고 부족" 에러로 정상 거절
```

### 구현 코드 (PRODUCTFC)

```go
func (r *ProductRepository) UpdateProductStockByProductID(ctx context.Context, productID int64, qty int) error {
    return r.Database.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
        var product models.Product

        // FOR UPDATE: 이 행을 잠그고 읽기
        if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
            Where("id = ?", productID).First(&product).Error; err != nil {
            return err
        }

        // 잠근 상태에서 재고 확인
        if product.Stock < qty {
            return fmt.Errorf("insufficient stock: available=%d, requested=%d",
                product.Stock, qty)
        }

        // 안전하게 차감
        return tx.Model(&product).Update("stock", gorm.Expr("stock - ?", qty)).Error
    })
}
```

---

## 1-4. CTE + Window Function 매출 리포트

### CTE (Common Table Expression) 란?

SQL 안에서 **임시 테이블** 을 만드는 것입니다. 복잡한 쿼리를 단계별로 나눠서 읽기 쉽게 만듭니다.

### Window Function 이란?

일반 집계 함수(`SUM`, `COUNT`)는 결과를 **하나의 행** 으로 압축합니다.
Window Function은 **각 행을 유지하면서** 그 위에 계산을 얹습니다.

```
일반 집계:
  SELECT SUM(amount) FROM orders  →  결과: 1행 (총합만)

Window Function:
  SELECT amount, SUM(amount) OVER (ORDER BY date)
  →  결과: 각 행마다 누적합이 붙음
     date       | amount | cumulative
     2024-01-01 | 100    | 100
     2024-01-02 | 200    | 300
     2024-01-03 | 150    | 450
```

### 구현된 쿼리

```sql
WITH daily_sales AS (
    -- 1단계: 일별로 묶어서 기본 통계 계산
    SELECT
        DATE(create_time) as sale_date,
        COUNT(*) as order_count,
        SUM(amount) as total_revenue,
        AVG(amount) as avg_order_value,
        SUM(total_qty) as total_items
    FROM orders
    WHERE create_time >= NOW() - INTERVAL '1 day' * $1
    GROUP BY DATE(create_time)
)
SELECT
    sale_date,
    order_count,
    total_revenue,
    avg_order_value,
    total_items,
    -- 2단계: Window Function으로 누적 매출 계산
    SUM(total_revenue) OVER (ORDER BY sale_date) as cumulative_revenue,
    -- 3단계: 매출 순위 (1위 = 가장 매출 높은 날)
    ROW_NUMBER() OVER (ORDER BY total_revenue DESC) as revenue_rank
FROM daily_sales
ORDER BY sale_date DESC
```

### API 호출

```
GET /api/v1/orders/sales-report?days=30
```

---

## 1-5. 커넥션 풀 설정

### 커넥션 풀이란?

PostgreSQL에 연결을 맺는 것은 **비용이 큽니다** (TCP 핸드셰이크 + 인증). 매 요청마다 연결을 만들면 성능이 나빠집니다.

커넥션 풀은 **미리 연결을 여러 개 만들어두고 재사용** 하는 것입니다.

```
풀 없이:
  요청 1 → 연결 생성 → 쿼리 → 연결 닫기
  요청 2 → 연결 생성 → 쿼리 → 연결 닫기  (매번 100ms+ 낭비)

풀 있으면:
  시작 시 연결 10개 미리 생성
  요청 1 → 풀에서 연결 빌림 → 쿼리 → 풀에 반환
  요청 2 → 풀에서 연결 빌림 → 쿼리 → 풀에 반환  (0ms 대기)
```

### 설정값

```go
sqlDB.SetMaxOpenConns(25)       // 최대 25개까지 동시 연결
sqlDB.SetMaxIdleConns(10)       // 안 쓸 때도 10개는 유지 (빠른 재사용)
sqlDB.SetConnMaxLifetime(5*time.Minute)  // 5분마다 연결 갱신 (stale 방지)
sqlDB.SetConnMaxIdleTime(5*time.Minute)  // 5분간 안 쓰면 닫기 (자원 절약)
```

### /debug/queries에서 확인 가능

```json
"pool": {
    "max_open_conns": 25,
    "open_conns": 8,    ← 현재 열린 연결
    "in_use": 3,        ← 쿼리 실행 중인 연결
    "idle": 5,          ← 놀고 있는 연결 (재사용 대기)
    "wait_count": 0     ← 연결을 기다린 횟수 (높으면 max_open 부족)
}
```

---

## 변경된 파일 요약

| 파일 | 변경 내용 |
|------|----------|
| `*/infrastructure/dbmonitor/monitor.go` | **신규** — GORM 콜백 기반 쿼리 모니터 (4개 서비스) |
| `*/cmd/*/resource/db.go` | 커넥션 풀 설정 + 모니터 등록 (4개 서비스) |
| `*/routes/routes.go` | `/debug/queries`, `/health` 엔드포인트 추가 (4개 서비스) |
| `ORDERFC/models/order.go` | 복합 인덱스 태그 + DailySalesReport 모델 |
| `ORDERFC/cmd/order/repository/database.go` | CTE + Window Function 매출 리포트 쿼리 |
| `ORDERFC/cmd/order/{service,usecase,handler}` | 매출 리포트 API 체인 |
| `PRODUCTFC/models/product.go` | name, price, category_id 인덱스 태그 |
| `PRODUCTFC/cmd/product/repository/db.go` | FOR UPDATE 비관적 락 |
| `PAYMENTFC/models/payment.go` | status+create_time 복합 인덱스 태그 |

---

## PostgreSQL 전용 vs SQL 표준 — 다른 DB에서도 쓸 수 있나?

면접에서 "이거 PostgreSQL에서만 되는 거 아닌가요?" 질문이 나올 수 있습니다.

### 표준 SQL (어디서든 동작)

| 기능 | PostgreSQL | MariaDB | MySQL |
|------|-----------|---------|-------|
| `COALESCE(value, default)` | O | O | O |
| `WITH ... AS` (CTE) | O | O (10.2+) | O (8.0+) |
| `SUM() OVER`, `ROW_NUMBER() OVER` (Window Function) | O | O (10.2+) | O (8.0+) |
| `SELECT ... FOR UPDATE` | O | O | O |
| `FOR UPDATE NOWAIT` | O | O (10.3+) | O (8.0+) |
| `FOR UPDATE SKIP LOCKED` | O (9.5+) | O (10.6+) | O (8.0+) |

### 이 프로젝트에서 PostgreSQL 전용인 부분

| 문법 | PostgreSQL 전용 | 대안 (표준 SQL) |
|------|----------------|----------------|
| `::numeric` (타입 캐스팅) | `ROUND(x::numeric, 2)` | `ROUND(CAST(x AS DECIMAL), 2)` |
| `INTERVAL '1 day' * N` | `NOW() - INTERVAL '1 day' * ?` | `NOW() - INTERVAL ? DAY` (MariaDB) |

> **결론**: CTE, Window Function, FOR UPDATE 등 핵심 개념은 SQL 표준이고, 타입 캐스팅과 INTERVAL 표현만 DB별로 다릅니다.

### 비관적 락 vs 낙관적 락 — 왜 비관적 락을 선택했는가?

| | 비관적 (Pessimistic) | 낙관적 (Optimistic) |
|---|---|---|
| **가정** | 충돌이 자주 일어남 | 충돌이 드묾 |
| **방식** | 읽을 때 행을 잠금 (FOR UPDATE) | 쓸 때 버전 번호 비교 |
| **충돌 시** | 대기 후 진행 | 에러 → 재시도 |
| **적합** | 재고 차감, 좌석 예매 | 프로필 수정, 설정 변경 |
| **단점** | 대기 시간, 데드락 위험 | 재시도 로직, 충돌 많으면 비효율 |

재고 차감은 인기 상품에 주문이 동시에 몰릴 수 있으므로 **비관적 락이 적합**합니다.

---

## 면접 예상 질문 & 답변

### Q1. "GORM Callback으로 쿼리 모니터링을 왜 직접 만들었나요?"

> GORM은 Logger로 쿼리를 콘솔에 출력할 수 있지만, **실시간 통계를 API로 내려주는 기능은 없습니다**. 프론트엔드 대시보드에서 서비스별 쿼리 현황을 시각화하려면, 메모리에 쿼리 기록을 쌓고 JSON으로 응답하는 별도 시스템이 필요했습니다. GORM의 Plugin 인터페이스(`Name()`, `Initialize()`)를 구현하고, Before/After Callback으로 모든 CRUD 작업의 소요 시간을 자동 측정하도록 만들었습니다.

### Q2. "인덱스를 어떤 기준으로 설계했나요?"

> **WHERE, JOIN, ORDER BY에 자주 등장하는 컬럼**을 기준으로 했습니다. 예를 들어 `orders` 테이블에서 가장 빈번한 쿼리가 `WHERE user_id = ? AND status = ?` 패턴이라, `(user_id, status)` 복합 인덱스를 만들었습니다. 개별 인덱스를 두 개 만드는 것보다 복합 인덱스 하나가 효율적인 이유는, **하나의 B-Tree 탐색으로 두 조건을 동시에 필터링**할 수 있기 때문입니다. 반대로 `description`, `shipping_address`처럼 WHERE에 거의 안 쓰이는 컬럼은 인덱스를 만들지 않았습니다 — 불필요한 인덱스는 INSERT/UPDATE 성능을 저하시킵니다.

### Q3. "FOR UPDATE를 Transaction 밖에서 쓰면 어떻게 되나요?"

> **아무 효과가 없습니다.** FOR UPDATE의 락은 트랜잭션이 COMMIT 또는 ROLLBACK될 때 해제되는데, Transaction 없이 쓰면 SELECT 직후 자동 커밋이 되어 락이 즉시 풀립니다. 그래서 반드시 `BEGIN ... COMMIT` 안에서 사용해야 하고, GORM에서는 `db.Transaction(func(tx *gorm.DB) error { ... })` 안에서 `tx.Clauses(clause.Locking{Strength: "UPDATE"})`를 사용합니다.

### Q4. "CTE 대신 서브쿼리를 써도 되지 않나요?"

> 기능적으로는 동일한 결과를 만들 수 있습니다. CTE를 선택한 이유는 **가독성**입니다. 서브쿼리는 중첩이 깊어지면 읽기 어려워지고, CTE는 `WITH step1 AS (...), step2 AS (...)` 형태로 **단계별로 이름을 붙여서** 파이프라인처럼 읽을 수 있습니다. 또한 PostgreSQL에서는 CTE를 여러 개 체이닝해서 복잡한 분석 쿼리를 조립할 수 있어, 실무에서 선호되는 패턴입니다.

### Q5. "커넥션 풀의 MaxOpenConns를 25로 설정한 근거는?"

> PostgreSQL은 기본적으로 `max_connections = 100`입니다. 이 프로젝트에서는 동일 DB에 접근하는 서비스가 1개(service-per-db 구조)이므로, 25개면 충분합니다. 나머지 75개는 관리 도구(psql, pgAdmin), Prometheus exporter, 향후 레플리카 등을 위해 여유를 둔 것입니다. 만약 25개가 부족해지면 `/debug/queries`의 `wait_count`가 올라가므로, 이 수치를 모니터링하면서 조절합니다.

### Q6. "Window Function의 OVER 절에서 ORDER BY를 빼면 어떻게 되나요?"

> `SUM(total_revenue) OVER (ORDER BY sale_date)`에서 ORDER BY를 빼면, **전체 합계가 모든 행에 동일하게** 들어갑니다. ORDER BY가 있어야 "여기까지의 누적합"이라는 **프레임(frame)**이 설정되어 누적 계산이 됩니다. `ROW_NUMBER()`는 ORDER BY가 필수이고, 없으면 에러가 발생합니다.
