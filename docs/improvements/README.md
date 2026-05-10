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
| **Observability** | /metrics 엔드포인트만 노출 | HTTP RED·비즈니스 카운터, Prometheus 알림, Grafana 프로비저닝·대시보드 JSON, Kafka/gRPC 스팬, SLI/SLO 개념 |

---

## Phase 구성

각 Phase는 **"문제를 먼저 만들고 → 기술로 해결하는"** 흐름으로 설계했습니다.

| Phase | 주제 | 문서 |
|-------|------|------|
| 0 | [Engineering Portfolio + Dev Console](#phase-0-engineering-portfolio--dev-console) | 이 문서 |
| 1 | PostgreSQL 심화 | [phase1-postgresql.md](./phase1-postgresql.md) |
| 2 | Redis 패턴 활용 | [phase2-redis.md](./phase2-redis.md) |
| 3 | Kafka 이벤트 아키텍처 | [phase3-kafka.md](./phase3-kafka.md) |
| 4 | MongoDB 분석 활용 | [phase4-mongodb.md](./phase4-mongodb.md) |
| 5 | Observability 완성 | [phase5-observability.md](./phase5-observability.md) |

---

## Phase 0: Engineering Portfolio + Dev Console

### 왜 만들었나

초기에는 백엔드 4개 서비스 상태를 확인하기 위한 모니터링 대시보드로 시작했습니다. 이후 공개 포트폴리오 목적에 맞춰 첫 화면은 Saga/Outbox/Kubernetes/Observability를 보여주는 **Engineering Portfolio**로 전환하고, API Test와 Phase별 모니터링 기능은 Dev Console로 유지했습니다.

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
    └── pages/              # Engineering Portfolio, API Test, 5개 Phase별 Dev Console
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

- **Engineering Portfolio**: Saga, Outbox, Idempotency, Kubernetes, Observability 검증 자료를 공개 포트폴리오 화면으로 표현
- **API Test**: Postman 같은 인터페이스로 모든 엔드포인트 직접 호출 가능
- **Phase별 탭**: 각 기술 모니터링/디버깅 페이지
