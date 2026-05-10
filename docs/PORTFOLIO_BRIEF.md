# Go Commerce Portfolio Brief

이 문서는 이력서, 포트폴리오, 면접에서 `go-commerce`를 짧고 정확하게 설명하기 위한 요약입니다.

## One Line

> Go 기반 MSA 커머스 시스템에서 주문, 재고, 결제 흐름을 Kafka Saga와 Transactional Outbox로 분리하고, kind Kubernetes 배포와 Prometheus/Grafana 관측성까지 검증한 백엔드 포트폴리오입니다.

## 30초 설명

> USERFC, PRODUCTFC, ORDERFC, PAYMENTFC 4개 서비스를 독립 DB로 분리한 Go MSA 프로젝트입니다. 주문 생성 시 ORDERFC는 주문과 outbox 이벤트를 같은 DB 트랜잭션에 저장하고, worker가 `order.created`를 Kafka로 발행합니다. PRODUCTFC는 재고 도메인 소유자로서 재고 예약 성공/실패 이벤트를 발행하고, PAYMENTFC는 재고 예약 이후 결제를 생성합니다. 로컬에서는 kind Kubernetes에 전체 서비스를 배포하고, Prometheus/Grafana로 HTTP RED metric까지 검증했습니다.

## 이력서용 문장

```text
Go 기반 커머스 MSA에서 주문-재고-결제 Saga를 Kafka choreography로 설계하고, ORDERFC에 Transactional Outbox와 idempotency token reservation을 적용해 주문 생성과 이벤트 발행의 신뢰성을 개선했습니다. kind Kubernetes 환경에 4개 서비스, 서비스별 PostgreSQL, Redis, MongoDB, Kafka/Zookeeper를 배포하고 Prometheus/Grafana로 RED metric 수집을 검증했습니다.
```

## 핵심 기술 포인트

| 영역 | 구현 내용 | 면접에서 강조할 점 |
|------|-----------|-------------------|
| MSA | USERFC, PRODUCTFC, ORDERFC, PAYMENTFC 분리 | 서비스별 책임과 DB ownership |
| Saga | `order.created -> stock.reserved/rejected -> payment` | 중앙 오케스트레이터가 아닌 choreography |
| Outbox | 주문 저장과 이벤트 저장을 같은 DB transaction으로 처리 | DB commit과 Kafka publish 사이의 불일치 완화 |
| Idempotency | token 선점 후 주문 생성 결과 저장 | 중복 요청에서 복수 주문 생성 방지 |
| Kafka | 도메인 이벤트, consumer group, 보상 이벤트 | at-least-once 전제와 consumer 멱등성 필요 |
| Kubernetes | kind 기반 Deployment/Service/ConfigMap/Secret | 배포보다 장애 원인 파악이 핵심 |
| Observability | Prometheus scrape, Grafana RED dashboard | Rate, Errors, Duration으로 운영 질문에 답변 |
| RAG Q&A | Chroma + FastAPI + React + OpenAI | 프로젝트 코드/문서 기반 질의응답 도구 |

## 가장 강하게 말할 수 있는 문제 해결

### 1. 주문 저장 후 Kafka 발행 유실

문제:

```text
orders insert 성공
-> goroutine Kafka publish 실패
-> 주문은 있는데 재고/결제 Saga가 시작되지 않음
```

해결:

```text
orders
order_details
order_outbox_events
```

를 같은 DB 트랜잭션에 저장하고, 별도 worker가 outbox pending 이벤트를 Kafka로 발행하게 했습니다.

면접 답변:

> DB transaction과 Kafka publish는 원자적으로 묶을 수 없기 때문에 Transactional Outbox를 적용했습니다. 주문 저장과 outbox insert를 같은 transaction으로 처리하고, worker가 pending 이벤트를 Kafka에 발행합니다. 이 구조는 exactly-once는 아니지만, at-least-once publish와 consumer idempotency를 조합해 실무적으로 안정적인 구조를 만듭니다.

### 2. 중복 주문 생성

문제:

```text
동일 idempotency token 요청 2개 동시 도착
-> 둘 다 token 없음 확인
-> 둘 다 주문 생성
```

해결:

요청 초기에 idempotency token을 `PROCESSING` 상태로 선점하고, 성공 시 `SUCCEEDED + order_id`로 갱신합니다.

면접 답변:

> 멱등성은 단순히 요청 끝에 token을 저장하는 방식으로는 동시 요청을 막지 못합니다. 그래서 주문 생성 전에 unique token을 먼저 예약하고, 같은 transaction 경계 안에서 주문 결과와 연결했습니다. 동일 token 재요청은 기존 결과를 반환하고, 요청 body hash가 다르면 token 재사용 충돌로 처리합니다.

### 3. Kubernetes에서 Kafka 연결 문제

문제:

Kafka는 클라이언트에게 다시 접속할 broker 주소를 `advertised.listeners`로 알려줍니다. 이 값이 Kubernetes Service/readiness와 어긋나면 broker는 떠 있어도 consumer group이 불안정해질 수 있습니다.

해결:

- 단일 broker 로컬 배포에서는 Pod IP를 advertised listener로 사용
- Kafka Pod에 `enableServiceLinks: false` 적용
- broker id 충돌을 피하기 위해 `Recreate` 전략 사용

면접 답변:

> Kubernetes에서 Kafka는 단순히 `kafka:9092` 포트가 열린 것만으로 충분하지 않았습니다. advertised listener, readiness, service env var 충돌을 확인했고, 단일 broker kind 환경에서는 Pod IP 광고와 `enableServiceLinks: false`로 안정화했습니다.

## 정직하게 말해야 할 한계

| 한계 | 답변 방향 |
|------|-----------|
| 실제 운영 Kubernetes 아님 | kind 로컬 배포이며, 목적은 배포 단위와 운영 개념 검증 |
| exactly-once 아님 | Outbox + at-least-once + consumer idempotency 조합 |
| Kafka/DB가 운영급 HA 아님 | 실무에서는 managed DB/Kafka, PVC, backup, autoscaling 필요 |
| Xendit local key 없음 | Saga가 PAYMENTFC까지 도달하는 것은 검증했고, invoice 생성은 local secret 제한으로 실패 가능 |
| RAG Q&A 사용량 낮음 | 배포 자체보다 코드 기반 검색/답변 아키텍처를 구현한 경험으로 설명 |

## 면접 마무리 문장

> 이 프로젝트는 단순 CRUD를 넘어서, 주문이라는 하나의 비즈니스 흐름을 여러 서비스, DB, Kafka 이벤트, 보상 처리, 배포, 관측성까지 연결해본 프로젝트입니다. 특히 장애 가능성이 있는 지점을 코드와 문서로 드러내고, Outbox와 idempotency, Kubernetes 검증 자료로 보완한 점을 가장 강조하고 싶습니다.
