# Go Commerce — 기술 심화 개선 기록

> 이 문서는 Go Commerce 프로젝트를 **"기술을 연결만 한 상태"** 에서 **"실무 수준으로 활용하는 상태"** 로 개선한 과정을 기록합니다.

---

## 개선 배경

초기 프로젝트는 PostgreSQL, Redis, Kafka, MongoDB를 모두 연결했지만, 각 기술의 **5%** 정도만 사용하고 있었습니다.

| 기술 | 개선 전 | 개선 후 |
|------|--------|--------|
| **PostgreSQL** | GORM AutoMigrate + 기본 CRUD | 커넥션 풀, 인덱스 전략, FOR UPDATE 락, CTE + Window Function |
| **Redis** | 상품 단건 캐시 (GET/SET) | 캐시 무효화, 분산 락, Rate Limiting, 실시간 랭킹, 토큰 블랙리스트 |
| **Kafka** | 기본 Producer/Consumer | DLQ, 멱등성, 파티션 전략, 스키마 버전 관리 |
| **MongoDB** | InsertOne (감사 로그 저장만) | Aggregation Pipeline, Change Stream, TTL 인덱스, 조회 API |
| **Observability** | /metrics 엔드포인트만 노출 | 커스텀 RED 메트릭, Grafana as Code, 알림 규칙, SLI/SLO |

---

## Phase 구성

각 Phase는 **"문제를 먼저 만들고 → 기술로 해결하는"** 흐름으로 설계했습니다.

| Phase | 주제 | 문서 |
|-------|------|------|
| 0 | [모니터링 대시보드](#phase-0-모니터링-대시보드) | 이 문서 |
| 1 | PostgreSQL 심화 | [phase1-postgresql.md](./phase1-postgresql.md) |
| 2 | Redis 패턴 활용 | [phase2-redis.md](./phase2-redis.md) |
| 3 | Kafka 이벤트 아키텍처 | [phase3-kafka.md](./phase3-kafka.md) |
| 4 | MongoDB 분석 활용 | [phase4-mongodb.md](./phase4-mongodb.md) |
| 5 | Observability 완성 | [phase5-observability.md](./phase5-observability.md) |

---

## Phase 0: 모니터링 대시보드

### 왜 만들었나

백엔드 4개 서비스가 각각 다른 포트에서 돌아가는데, 상태를 확인하려면 매번 `curl`을 쳐야 했습니다. 이후 Phase에서 추가할 DB 쿼리 모니터링, Redis 캐시 통계, Kafka 이벤트 스트림도 시각적으로 보여줄 공간이 필요했습니다.

### 기술 스택

```
React 19 + Vite + TailwindCSS v4 + React Router v7
```

### 구조

```
frontend/
├── vite.config.js          # Vite 프록시 (CORS 우회의 핵심)
├── Dockerfile + nginx.conf # 프로덕션 배포용
└── src/
    ├── api/services.js     # 4개 백엔드 서비스 API 호출 레이어
    ├── components/         # 재사용 UI 컴포넌트
    └── pages/              # 7개 페이지 (Dashboard, API Test, 5개 Phase별)
```

### 핵심 개념: Vite Proxy로 CORS 해결

```
브라우저 (localhost:3000)
    │
    ├─ /api/userfc/ping
    │     └─ Vite Proxy ──→ localhost:28080/ping (USERFC)
    │
    ├─ /api/productfc/v1/products/1
    │     └─ Vite Proxy ──→ localhost:28081/v1/products/1 (PRODUCTFC)
    │
    ├─ /api/orderfc/health
    │     └─ Vite Proxy ──→ localhost:28082/health (ORDERFC)
    │
    └─ /api/paymentfc/health
          └─ Vite Proxy ──→ localhost:28083/health (PAYMENTFC)
```

프론트엔드는 항상 **같은 도메인(localhost:3000)** 으로 요청을 보내고, Vite 개발 서버가 경로를 보고 적절한 백엔드로 전달합니다. 이렇게 하면 브라우저의 CORS 정책에 걸리지 않습니다.

프로덕션(Docker)에서는 nginx가 같은 역할을 합니다.

### 주요 화면

- **Dashboard**: 4개 서비스 헬스체크 + 응답 시간 측정 + 아키텍처 요약
- **API Test**: Postman 같은 인터페이스로 모든 엔드포인트 직접 호출 가능
- **Phase별 탭**: 각 기술 모니터링 페이지 (Phase 구현 시 채워짐)
