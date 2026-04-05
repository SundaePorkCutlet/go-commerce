# Phase 3: Kafka 이벤트 아키텍처 완성

> 재처리(at-least-once) 환경에서 멱등성·DLQ·파티션 키·스키마 버전을 코드로 고정

---

## 개선 전 문제점

| 문제 | 설명 |
|------|------|
| 컨슈머 그룹 ID 충돌 가능성 | 동일 `GroupID`로 서로 다른 토픽을 읽으면 조직에 따라 리밸런싱 이슈가 생길 수 있음 → **토픽별 전용 GroupID** |
| 실패 시 유실 | 에러만 로그 → **DLQ 토픽**으로 원문 보존 |
| 중복 전달 | Kafka는 at-least-once 기본 → **Redis `SET` 완료 키**로 동일 `order_id` 재처리 스킵 |
| 파티션 키 | `LeastBytes` 밸런서는 메시지 키를 파티션 선택에 쓰지 않음 → **`Hash` 밸런서 + `user-{id}` 키** |
| 스키마 진화 | 필드 추가 시 깨짐 방지 → **`schema_version` 필드** |

---

## 구현 요약

### 3-1. PRODUCTFC `stock.updated` / `stock.rollback` 컨슈머

- **Group ID**: `productfc-stock-updated`, `productfc-stock-rollback` (분리)
- **재시도**: 비즈니스 실패 시 짧은 백오프로 최대 3회
- **성공 후**: `kafka:done:{topic}:{order_id}` Redis 키 설정 (TTL 7일)

### 3-2. Dead Letter Queue

- 토픽: `stock.updated.dlq`, `stock.rollback.dlq`
- 페이로드: `original_topic`, `error`, `body`(원본 JSON)

### 3-3. 멱등성 (Redis)

- 처리 **성공 후**에만 완료 키 기록
- 소비 시작 시 `EXISTS` → 이미 완료면 **duplicate skipped** 카운트만 증가
- 주의: 부분 성공(일부 상품만 차감) 시나리오는 DB 트랜잭션으로 묶는 것이 이상적이며, 본 레포는 학습용으로 루프 단위 처리

### 3-4. 파티션 키 (ORDERFC Producer)

- `kafka.Writer.Balancer`: `LeastBytes` → **`Hash`**
- 메시지 `Key`: `user-{UserID}` (없으면 `order-{OrderID}` 폴백)
- 동일 유저 주문 이벤트가 동일 파티션에 모이도록 하여 **순서 보장 여지** 확보 (단일 파티션 내)

### 3-5. 스키마 버전

- `ProductStockUpdatedEvent` / 롤백 이벤트에 `schema_version: 1` 발행
- 컨슈머는 `schema_version > 1` 이면 거부·카운트 (`schema_version_rejected`)

---

## API (PRODUCTFC)

| Method | Path | 설명 |
|--------|------|------|
| GET | `/debug/kafka` | `messages_consumed`, `dlq_count`, `consumer_stats` |
| GET | `/debug/kafka/stream` | SSE로 2초마다 컨슈머 통계 푸시 |

---

## 면접 예상 질문

### Q. 왜 완료 키를 처리 후에만 쓰나요?

> 처리 전에 잠금만 걸고 실패 시 삭제하는 패턴도 있지만, 여기서는 **성공이 확정된 뒤** `SET`하여 중복 배달 시 같은 작업을 반복하지 않습니다. 실패 시 키가 없으므로 Kafka가 재전달하면 재시도됩니다.

### Q. DLQ에 넣은 메시지는 어떻게 복구하나요?

> 운영에서는 DLQ 전용 **재처리 워커** 또는 수동 스크립트로 토픽에 다시 넣습니다. 이 레포는 DLQ **기록·관측**까지가 범위입니다.

### Q. Hash 밸런서를 쓰면 무엇이 달라지나요?

> 파티션 할당이 메시지 **Key의 해시**에 따라 결정됩니다. 동일 Key → 동일 파티션 → **해당 키에 대한 순서**가 보장됩니다(파티션 수 변경 시에는 깨질 수 있음).

---

## 변경 파일 (요약)

| 위치 | 내용 |
|------|------|
| `ORDERFC/models/product.go` | 이벤트에 `schema_version`, `user_id` |
| `ORDERFC/kafka/producer.go` | `Hash` 밸런서, 파티션 키 헬퍼 |
| `ORDERFC/cmd/order/usecase` | 체크아웃 시 `UserID`·스키마 채움 |
| `ORDERFC/kafka/consumer/payment_failed.go` | 롤백 이벤트에 `UserID` |
| `PRODUCTFC/models/order.go` | 수신 모델 정렬 |
| `PRODUCTFC/kafka/constant.go` | 토픽·DLQ 이름·스키마 상수 |
| `PRODUCTFC/kafka/idempotency/` | Redis 완료 키 |
| `PRODUCTFC/kafka/dlq/` | DLQ 발행 |
| `PRODUCTFC/kafka/consumer/` | 멱등·재시도·DLQ·모니터 |
| `PRODUCTFC/infrastructure/kafkamonitor/` | 카운터 |
| `PRODUCTFC/routes/routes.go` | `/debug/kafka`, SSE |
| `frontend/.../KafkaPage.jsx` | `consumer_stats` 표시 |
