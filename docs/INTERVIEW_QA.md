# Go Commerce Interview Q&A

이 문서는 `go-commerce`를 면접에서 설명하기 위한 예상 질문과 답변입니다.

## 1. 프로젝트를 한 문장으로 설명해주세요.

> Go 기반 커머스 MSA에서 주문, 재고, 결제 흐름을 Kafka Saga로 분리하고, Transactional Outbox와 idempotency로 신뢰성을 보강한 뒤, kind Kubernetes와 Prometheus/Grafana로 배포와 관측성까지 검증한 프로젝트입니다.

## 2. 왜 MSA로 나눴나요?

> 사용자, 상품, 주문, 결제는 변경 이유와 데이터 소유권이 다릅니다. 그래서 USERFC, PRODUCTFC, ORDERFC, PAYMENTFC로 나누고 각 서비스가 자기 DB를 소유하도록 했습니다. 목적은 단순히 서비스를 많이 만드는 것이 아니라, 도메인 경계를 기준으로 결합도를 낮추고 이벤트 기반 통합을 실험하는 것이었습니다.

## 3. Saga를 왜 사용했나요?

> 주문, 재고, 결제는 서로 다른 서비스와 DB에 걸쳐 있습니다. 하나의 DB transaction으로 묶을 수 없기 때문에, 각 서비스가 자기 local transaction을 처리하고 Kafka 이벤트로 다음 단계를 진행하는 Saga choreography를 사용했습니다.

## 4. 왜 ORDERFC가 바로 재고를 차감하지 않나요?

> 재고는 PRODUCTFC의 소유 데이터입니다. ORDERFC가 직접 재고를 차감하면 서비스 경계가 깨지고, PRODUCTFC의 재고 정책을 우회하게 됩니다. 그래서 ORDERFC는 `order.created`만 발행하고, PRODUCTFC가 재고 예약 성공/실패를 판단해 `stock.reserved` 또는 `stock.rejected`를 발행하도록 했습니다.

## 5. Transactional Outbox를 왜 적용했나요?

> 주문 DB commit과 Kafka publish는 하나의 transaction으로 묶을 수 없습니다. 주문 저장 후 Kafka 발행이 실패하면 주문은 존재하지만 Saga가 시작되지 않는 문제가 생깁니다. 그래서 주문 저장과 outbox insert를 같은 DB transaction에 넣고, worker가 pending 이벤트를 Kafka로 발행하게 했습니다.

## 6. Outbox가 exactly-once를 보장하나요?

> 아닙니다. Outbox는 DB 저장과 이벤트 발행 사이의 유실 가능성을 줄이는 패턴이지, 전체 시스템 exactly-once를 보장하지는 않습니다. worker retry로 같은 이벤트가 두 번 발행될 수 있으므로 consumer는 event key나 business key 기준으로 멱등성을 가져야 합니다.

## 7. Idempotency token reservation은 무엇인가요?

> 요청이 끝난 뒤 token을 저장하면 동시 요청 둘 다 token 없음으로 판단할 수 있습니다. 그래서 주문 생성 전에 unique token을 먼저 `PROCESSING` 상태로 예약하고, 주문 생성 성공 후 `SUCCEEDED + order_id`로 갱신합니다. 같은 token 재요청은 새 주문을 만들지 않고 기존 결과를 반환합니다.

## 8. 낙관적 락과 비슷한가요?

> 느낌은 비슷하지만 목적이 다릅니다. 낙관적 락은 같은 row의 동시 수정을 version으로 감지하는 방식이고, idempotency reservation은 같은 API 요청의 중복 실행을 unique token으로 막는 방식입니다. 둘 다 "먼저 확인 후 나중에 저장"의 race condition을 피한다는 점에서는 닮았습니다.

## 9. Kafka에서 at-least-once면 중복 처리는 어떻게 하나요?

> Kafka consumer는 장애나 retry 상황에서 같은 메시지를 다시 받을 수 있습니다. 그래서 이벤트에는 `order_id`, `event_key` 같은 business key가 있어야 하고, consumer는 이미 처리한 이벤트인지 확인하거나, DB update를 멱등적으로 설계해야 합니다. 예를 들어 주문 상태 갱신은 현재 상태와 이벤트 상태를 확인하고 중복 변경을 피해야 합니다.

## 10. 결제 성공 이벤트 발행 실패를 결제 실패로 바꾸면 왜 위험한가요?

> 실제 결제는 성공했는데 Kafka publish만 실패한 상황일 수 있습니다. 이때 `payment.failed`를 발행하면 ORDERFC는 주문을 취소하고 PRODUCTFC는 재고를 롤백할 수 있습니다. 돈은 받았지만 주문은 실패 처리되는 치명적인 불일치가 생기므로, 발행 실패는 failed event나 outbox retry 대상으로 남겨야 합니다.

## 11. Kubernetes는 왜 도입했나요?

> 클라우드 비용을 쓰기보다 kind로 로컬 Kubernetes 환경을 만들고, MSA가 실제 Deployment/Service/ConfigMap/Secret 단위로 어떻게 배포되는지 검증하고 싶었습니다. 단순 배포보다 Service DNS, readiness/liveness, Kafka advertised listener, Prometheus scrape target 같은 운영 관점을 학습하는 것이 목적이었습니다.

## 12. Kubernetes 도입이 쉬웠는데 왜 러닝커브가 높다고 하나요?

> Pod를 띄우는 것 자체는 어렵지 않습니다. 어려운 부분은 장애가 났을 때 원인을 좁히는 것입니다. `ImagePullBackOff`, `CrashLoopBackOff`, readiness 실패, Service selector/targetPort 문제, Kafka advertised listener 문제처럼 같은 "안 된다"도 원인이 다양합니다. Kubernetes는 배포 도구라기보다 분산 시스템 운영 인터페이스에 가깝다고 이해했습니다.

## 13. readiness와 liveness는 왜 나누나요?

> liveness는 프로세스가 살아 있는지, readiness는 트래픽을 받아도 되는지 판단합니다. 예를 들어 HTTP 서버는 살아 있어도 DB나 Redis 연결이 안 되면 readiness는 실패해야 합니다. 그래야 Kubernetes가 해당 Pod로 트래픽을 보내지 않습니다.

## 14. `enableServiceLinks: false`는 왜 썼나요?

> Kubernetes는 같은 namespace의 Service 정보를 환경변수로 자동 주입할 수 있습니다. 그런데 Kafka 이미지처럼 `KAFKA_` prefix를 자기 설정으로 해석하는 컨테이너에서는 `KAFKA_PORT` 같은 자동 환경변수가 설정 충돌을 만들 수 있습니다. 그래서 Kafka Pod에는 `enableServiceLinks: false`를 적용하고, 서비스 발견은 DNS 이름으로 처리했습니다.

## 15. Prometheus/Grafana로 무엇을 확인했나요?

> 각 서비스의 `/metrics`를 Prometheus가 scrape하도록 구성했고, `up{job="userfc"}`, `up{job="productfc"}`, `up{job="orderfc"}`, `up{job="paymentfc"}`가 모두 1인지 확인했습니다. Grafana에는 RED metric, 즉 요청량, 에러율, p95 latency를 보는 대시보드를 프로비저닝했습니다.

## 16. RAG Q&A Assistant는 AI 백엔드 경험이라고 말할 수 있나요?

> LLM 모델을 직접 학습한 프로젝트는 아니지만, 코드/문서 기반 retrieval, Chroma vector store, FastAPI API, React UI, OpenAI synthesis를 연결한 AI application backend 경험이라고 설명할 수 있습니다. 특히 답변에 evidence path와 confidence를 포함해 근거 기반 응답을 만들려 한 점을 강조할 수 있습니다.

## 17. 이 프로젝트의 가장 큰 한계는 무엇인가요?

> 운영 환경이 아니라 로컬 kind와 Docker Compose 중심이라는 점입니다. 실제 운영에서는 managed DB/Kafka, PVC, backup, HPA, Secret 관리, Ingress, TLS, alert routing이 추가되어야 합니다. 다만 이 프로젝트의 목적은 운영급 인프라 전체를 구축하는 것이 아니라, 백엔드 개발자로서 분산 시스템의 주요 실패 지점과 보완 패턴을 직접 구현하고 설명할 수 있게 만드는 것이었습니다.

## 18. 가장 자신 있게 설명할 수 있는 부분은 무엇인가요?

> 주문 생성의 신뢰성 개선입니다. 주문 저장 후 Kafka 발행 유실 문제를 Transactional Outbox로 해결했고, 중복 주문 문제를 idempotency token reservation으로 막았습니다. 이 두 가지는 단순 기능 구현이 아니라 장애와 동시성 상황을 전제로 설계한 부분이라 가장 자신 있게 설명할 수 있습니다.
