# Phase 4: MongoDB 분석 활용

> PAYMENTFC 감사 로그를 Insert-only에서 조회/집계/실시간 스트림까지 확장

---

## 개선 전 문제점

| 문제 | 설명 |
|------|------|
| InsertOne만 사용 | 감사 로그 저장만 가능, 조회/분석 불가 |
| 인덱스 없음 | event/order_id/user_id 필터가 커질수록 느려짐 |
| Aggregation 미사용 | 일별/이벤트별 추세 파악 불가 |
| Change Stream 미사용 | 실시간 모니터 화면 불가 |
| 데이터 정리 없음 | 로그 무제한 증가 |

---

## 4-1. 감사 로그 조회 API (필터 + 커서 페이지네이션)

### 엔드포인트

- `GET /debug/mongo/audit-logs`
- (인증 라우트) `GET /api/v1/audit-logs`

### 지원 쿼리

- `event`, `actor`, `order_id`, `user_id`
- `from`, `to` (`RFC3339` 또는 `YYYY-MM-DD`)
- `limit` (기본 20, 최대 100)
- `cursor` (`ObjectID` 기반 다음 페이지)

### 커서 방식

- 정렬: `_id DESC`
- 다음 페이지: `filter _id < cursor`
- 응답: `logs[]`, `next_cursor`

---

## 4-2. Aggregation Pipeline 리포트

### 엔드포인트

- `GET /debug/mongo/audit-report/daily`
- (인증 라우트) `GET /api/v1/audit-report/daily`

### 집계 내용

- `create_time` 기간 필터
- `date`(`YYYY-MM-DD`) + `event` 기준 `count` 집계
- 결과를 날짜 역순으로 반환

프론트 `MongoPage`에서는 위 결과를 일별 총량 Bar 차트로 시각화.

---

## 4-3. Change Stream → SSE

### 엔드포인트

- `GET /debug/mongo/stream`

### 동작

1. Mongo `payment_audit_logs` 컬렉션 `Watch()` 시작
2. `operationType=insert`만 수신
3. Gin SSE(`text/event-stream`)로 프론트에 push

### 주의

Mongo Change Stream은 **Replica Set**에서만 동작.  
단일 standalone 환경에서는 스트림 에러를 SSE 이벤트로 전달하고 종료.

---

## 4-4. 인덱스 + TTL(90일)

리포지토리 초기화 시 `CreateMany`:

- `(event, create_time DESC)`
- `(order_id, create_time DESC)`
- `(user_id, create_time DESC)`
- TTL: `create_time` + `expireAfterSeconds=90d`

TTL은 Mongo 백그라운드 만료 작업으로 자동 삭제됨.

---

## 변경 파일 요약

| 파일 | 변경 |
|------|------|
| `PAYMENTFC/models/audit_log.go` | JSON/BSON 필드 정리, 필터/페이지/리포트 모델 추가 |
| `PAYMENTFC/cmd/payment/repository/audit_log.go` | 조회/집계/Watch + 인덱스/TTL |
| `PAYMENTFC/cmd/payment/service/service.go` | 감사 로그 조회/리포트/스트림 메서드 추가 |
| `PAYMENTFC/cmd/payment/usecase/usecase.go` | 서비스 메서드 전달 |
| `PAYMENTFC/cmd/payment/handler/handler.go` | `/audit-logs`, `/audit-report`, `/stream` 핸들러 |
| `PAYMENTFC/routes/routes.go` | debug + 인증 라우트 연결 |
| `frontend/src/pages/MongoPage.jsx` | 조회 UI, 리포트 차트, Change Stream SSE 표시 |

---

## 면접 포인트

1. **왜 커서 페이지네이션?**  
   로그성 데이터는 offset 성능이 나빠지므로 `_id` 기반 커서가 안정적.
2. **왜 TTL 인덱스?**  
   운영 보존기간 정책(예: 90일) 자동화로 저장소 비용·관리 부담 감소.
3. **Change Stream 한계?**  
   Replica Set 필수. 로컬 단일 Mongo에서는 fallback 설계 필요.
