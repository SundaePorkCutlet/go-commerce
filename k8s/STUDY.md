# Kubernetes Study Notes for go-commerce

이 문서는 Kubernetes를 외워서 쓰기보다, `go-commerce`에 적용하면서 이해하기 위한 학습 노트입니다.

## 1. Kubernetes를 왜 쓰는가?

Docker Compose는 로컬 개발에 좋습니다.

```text
docker compose up
```

이 명령 하나로 컨테이너를 여러 개 띄우고 네트워크로 연결할 수 있습니다.

하지만 실무 운영에서는 보통 아래 질문이 생깁니다.

- 컨테이너가 죽으면 누가 다시 띄우나?
- 버전을 바꿀 때 무중단으로 교체할 수 있나?
- 설정과 비밀번호를 이미지 밖에서 관리할 수 있나?
- 서비스 인스턴스를 여러 개로 늘릴 수 있나?
- 내부 서비스끼리 안정적으로 찾을 수 있나?
- 상태 확인과 로그 확인을 표준 방식으로 할 수 있나?

Kubernetes는 이 질문들에 대한 표준 도구입니다.

## 2. 가장 중요한 개념

### Pod

Kubernetes에서 실행되는 가장 작은 단위입니다.

보통 백엔드 서비스 하나는 컨테이너 하나를 가진 Pod로 실행됩니다.

```text
ORDERFC container -> ORDERFC Pod
```

Pod는 언제든 죽고 다시 만들어질 수 있습니다. 그래서 Pod IP에 직접 의존하면 안 됩니다.

### Deployment

Pod를 원하는 개수만큼 유지하는 관리자입니다.

```text
Deployment: orderfc replicas=1
-> Pod가 죽으면 새 Pod 생성
-> 이미지 버전이 바뀌면 새 Pod로 교체
```

백엔드 애플리케이션은 보통 Deployment로 배포합니다.

### Service

Pod에 안정적인 네트워크 이름을 붙여주는 객체입니다.

Pod는 바뀌지만 Service 이름은 유지됩니다.

```text
orderfc Service
-> 현재 살아있는 ORDERFC Pod로 트래픽 전달
```

같은 namespace 안에서는 보통 이런 DNS로 접근합니다.

```text
http://orderfc:8083
postgres-order:5432
redis:6379
kafka:9092
```

### ConfigMap

민감하지 않은 설정을 담습니다.

예:

```text
DB_HOST=postgres-order
DB_PORT=5432
KAFKA_BROKERS=kafka:9092
```

### Secret

비밀번호, 토큰, API key 같은 민감 정보를 담습니다.

예:

```text
DB_PASSWORD=admin
XENDIT_SECRET_API_KEY=...
JWT_SECRET=...
```

로컬 학습에서는 값이 단순해도, 개념적으로 ConfigMap과 Secret을 분리하는 습관이 중요합니다.

### Namespace

클러스터 안의 논리적인 작업 공간입니다.

이 프로젝트는 `go-commerce` namespace를 사용합니다.

```bash
kubectl get pods -n go-commerce
```

## 3. Docker Compose와 다른 점

### depends_on이 없다

Compose에서는 `depends_on`으로 시작 순서를 어느 정도 조정합니다.

Kubernetes에서는 시작 순서에 의존하지 않는 애플리케이션이 더 좋은 설계입니다.

대신 다음을 사용합니다.

- 앱 내부 retry
- readinessProbe
- initContainer(초기화 작업이나 제한적인 사전 대기)
- Job

처음에는 앱 내부 retry와 readinessProbe만 이해해도 충분합니다.

### initContainer는 depends_on의 정석 대체가 아니다

initContainer는 메인 컨테이너가 시작되기 전에 반드시 끝나야 하는 작업을 실행합니다.

좋은 사용 예:

- DB migration 또는 schema bootstrap
- 설정 파일 생성
- 권한/디렉토리 준비
- 짧은 사전 점검

주의할 사용 예:

- `nc -z db 5432`로 DB 포트가 열릴 때까지 기다리기
- 브로커/캐시/외부 API가 뜰 때까지 무한 대기하기

이런 방식은 Docker Compose의 `depends_on`을 흉내 내는 것에 가까워질 수 있습니다. 로컬 학습이나 데모를 안정화하는 데는 쓸 수 있지만, 운영에 가까운 구조에서는 애플리케이션 레벨 retry/backoff와 readinessProbe가 더 중요합니다.

이 프로젝트의 Phase 1 initContainer는 “정답 패턴”이라기보다 다음 사실을 보여주기 위한 학습 장치입니다.

- Kubernetes는 시작 순서를 보장하지 않는다.
- Service DNS로 의존성을 찾는다.
- 앱이 retry를 갖지 않으면 의존성 준비 전 기동 시 CrashLoopBackOff가 날 수 있다.
- 장기적으로는 앱 retry와 `/ready`를 구현하는 것이 더 낫다.

### Service env var보다 DNS를 우선한다

Kubernetes는 기본적으로 같은 namespace의 Service 정보를 컨테이너 환경변수로 주입합니다.

예를 들어 `kafka`라는 Service가 있으면 아래와 비슷한 값이 자동으로 생길 수 있습니다.

```text
KAFKA_SERVICE_HOST=...
KAFKA_SERVICE_PORT=9092
KAFKA_PORT=...
```

일반 애플리케이션에서는 별문제가 없을 수 있지만, Kafka처럼 `KAFKA_` prefix를 자기 설정으로 해석하는 이미지에서는 충돌할 수 있습니다.

그래서 이 프로젝트의 Kafka Pod에는 아래 설정을 넣었습니다.

```yaml
enableServiceLinks: false
```

서비스 발견은 환경변수보다 DNS를 기준으로 생각하는 것이 더 명확합니다.

```text
kafka:9092
postgres-order:5432
redis:6379
```

### Kafka advertised listener와 readiness

Kafka broker는 클라이언트에게 “나에게 다시 붙을 주소”를 알려줍니다. 이 값이 `advertised.listeners`입니다.

처음에는 아래처럼 Service DNS를 광고했습니다.

```text
KAFKA_ADVERTISED_LISTENERS=PLAINTEXT://kafka:9092
```

하지만 단일 broker가 시작되는 동안 Kafka controller가 자기 자신에게 다시 연결하려 할 때 문제가 생겼습니다.

```text
Kafka Pod readiness 통과 전
-> Service endpoint가 아직 비어 있을 수 있음
-> kafka:9092로 자기 자신에게 연결 실패
-> topic 생성 시 available brokers: 0
-> consumer group coordinator가 준비되지 않음
```

그래서 로컬 kind 단일 broker 배포에서는 Pod IP를 Downward API로 주입하고, broker가 자기 Pod IP를 광고하게 했습니다.

```yaml
env:
  - name: POD_IP
    valueFrom:
      fieldRef:
        fieldPath: status.podIP
  - name: KAFKA_ADVERTISED_LISTENERS
    value: PLAINTEXT://$(POD_IP):9092
```

이 설정은 클러스터 내부 Pod들이 Pod IP로 Kafka에 접근할 수 있다는 전제에서 동작합니다. 운영 환경이나 여러 broker 구성에서는 보통 StatefulSet, headless Service, broker별 stable DNS를 함께 설계합니다.

### 단일 Kafka broker는 RollingUpdate와 맞지 않는다

현재 로컬 배포는 `broker.id=1`인 단일 Kafka broker입니다.

Deployment의 기본 전략인 RollingUpdate는 새 Pod를 먼저 띄운 뒤 기존 Pod를 내릴 수 있습니다. 이때 같은 `broker.id=1`을 가진 Kafka가 동시에 Zookeeper에 등록하려고 하면 아래 에러가 납니다.

```text
NodeExistsException: /brokers/ids/1 already exists
```

그래서 Kafka Deployment는 다음처럼 설정했습니다.

```yaml
strategy:
  type: Recreate
```

이 선택은 “Kafka 운영의 정답”이라기보다, 로컬 kind에서 단일 broker를 안정적으로 학습하기 위한 선택입니다. 운영에 가까운 Kafka는 보통 StatefulSet과 영속 볼륨, broker별 DNS, replication factor를 함께 봅니다.

### 컨테이너 이름으로 접근하지 않는다

Compose에서는 서비스 이름이 곧 DNS 이름입니다.

Kubernetes도 Service 이름이 DNS 이름이지만, Pod 이름이 아니라 Service 이름을 사용해야 합니다.

```text
좋음: postgres-order:5432
나쁨: orderfc-7df9bdc...:8083
```

### 이미지는 클러스터 안에 있어야 한다

kind는 Docker 안에 Kubernetes node를 띄웁니다.

그래서 로컬 Docker에 이미지를 빌드한 뒤 kind cluster로 로드해야 합니다.

```bash
docker build -t go-commerce-orderfc:local ./ORDERFC
kind load docker-image go-commerce-orderfc:local --name go-commerce
```

## 4. go-commerce를 Kubernetes로 옮길 때의 생각법

### ORDERFC

역할:

- 주문 생성 API
- 상품 검증을 위해 PRODUCTFC HTTP 호출
- 주문 저장
- outbox event 저장
- outbox worker가 `order.created` Kafka 발행
- `stock.rejected`, `payment.success`, `payment.failed` 소비

필요 의존성:

- PostgreSQL order DB
- Redis
- Kafka
- PRODUCTFC Service
- Jaeger

처음에는 모든 의존성을 붙이지 않고, ORDERFC Pod가 뜨는 것부터 확인합니다.

### PRODUCTFC

역할:

- 상품/카테고리 CRUD
- Redis cache
- `order.created` 소비
- 재고 예약 성공 시 `stock.reserved` 발행
- 재고 부족 시 `stock.rejected` 발행

필요 의존성:

- PostgreSQL product DB
- Redis
- Kafka
- Jaeger

### PAYMENTFC

역할:

- `stock.reserved` 이후 결제 생성
- Xendit invoice/webhook
- MongoDB audit log
- USERFC gRPC 호출
- `payment.success`, `payment.failed` 발행

필요 의존성:

- PostgreSQL payment DB
- MongoDB
- Kafka
- USERFC gRPC Service
- Jaeger
- Xendit Secret

### USERFC

역할:

- 회원가입/로그인
- JWT 발급
- Redis rate limit/JWT blacklist
- gRPC user info 제공

필요 의존성:

- PostgreSQL user DB
- Redis
- Jaeger

## 5. 처음부터 Helm을 쓰지 않는 이유

Helm은 실무에서 자주 쓰지만, 처음부터 Helm chart를 만들면 Kubernetes 기본 개념이 흐려질 수 있습니다.

처음에는 직접 YAML을 작성해서 아래 감각을 익히는 게 좋습니다.

- Deployment가 Pod를 만든다
- Service가 Pod 앞에 고정 주소를 만든다
- ConfigMap/Secret이 환경변수로 들어간다
- readinessProbe가 트래픽 받을 준비를 판단한다
- `kubectl describe`와 `kubectl logs`로 문제를 추적한다

그 다음에 Helm으로 중복을 줄이면 됩니다.

## 6. 자주 쓰는 kubectl 명령

```bash
kubectl get ns
kubectl get all -n go-commerce
kubectl get pods -n go-commerce -o wide
kubectl get svc -n go-commerce
kubectl describe pod <pod-name> -n go-commerce
kubectl logs deployment/orderfc -n go-commerce
kubectl rollout status deployment/orderfc -n go-commerce
kubectl rollout restart deployment/orderfc -n go-commerce
kubectl delete -f k8s/manifests/orderfc.yaml
```

문제가 생기면 보통 이 순서로 봅니다.

```text
kubectl get pods
-> STATUS 확인
-> kubectl describe pod
-> Events 확인
-> kubectl logs
-> 앱 설정/환경변수 확인
```

### 상태 이름 읽기

| 상태 | 의미 | 먼저 볼 것 |
|------|------|------------|
| `Pending` | Pod가 아직 노드에 배치되지 않음 | 리소스 부족, PVC, 이미지 |
| `ContainerCreating` | 컨테이너 생성 중 | 이미지 다운로드, 볼륨 마운트 |
| `Running` | 컨테이너 실행 중 | readiness가 true인지 확인 |
| `CrashLoopBackOff` | 컨테이너가 계속 죽고 재시작됨 | `kubectl logs`, 앱 설정 |
| `ImagePullBackOff` | 이미지를 가져오지 못함 | 이미지 이름, kind image load |

`go-commerce` Phase 1에서 가장 자주 볼 수 있는 문제는 두 가지입니다.

- `ImagePullBackOff`: `kind load docker-image`를 안 했거나 이미지 이름이 manifest와 다름
- `CrashLoopBackOff`: ORDERFC가 PostgreSQL/Redis 연결 실패로 종료됨

## 7. 면접에서 말할 포인트

나쁜 설명:

> Kubernetes로 배포했습니다.

좋은 설명:

> Docker Compose로 구성돼 있던 go-commerce MSA를 kind 기반 로컬 Kubernetes 환경으로 옮기면서, 서비스별 Deployment/Service와 설정 분리를 위한 ConfigMap/Secret을 작성했습니다. Pod 상태, Service DNS, 로그, API 호출을 통해 배포 결과를 검증했고, Saga 흐름은 각 서비스 로그로 확인했습니다.

더 좋은 설명:

> Compose의 `depends_on`에 의존하던 관점을 Kubernetes에서는 readinessProbe와 애플리케이션 retry로 바꿔야 한다는 점을 학습했습니다. 또한 Pod IP가 아니라 Service DNS를 기준으로 서비스 간 통신을 구성했습니다.

## 8. 포트폴리오 캡처 체크리스트

- [x] `kubectl get pods -n go-commerce`
- [x] `kubectl get svc -n go-commerce`
- [x] ORDERFC API 호출 성공
- [x] PRODUCTFC 재고 차감 확인
- [x] PAYMENTFC 결제 요청 저장 확인
- [x] Prometheus scrape target 확인
- [x] Grafana health 확인
- [ ] Loki 또는 Jaeger 고도화

## 9. Observability를 왜 붙이는가?

서비스가 `Running`이라는 사실은 운영 관점에서 충분하지 않습니다.

```text
Pod Running
```

은 컨테이너가 살아 있다는 뜻에 가깝고,

```text
Prometheus up = 1
```

은 Prometheus가 해당 서비스의 `/metrics` endpoint를 주기적으로 읽고 있다는 뜻입니다.

이번 Phase 5에서는 다음 흐름을 만들었습니다.

```text
Go service middleware
-> /metrics
-> Prometheus scrape
-> PromQL query
-> Grafana dashboard
```

이때 Grafana는 데이터를 직접 수집하지 않습니다. Grafana는 Prometheus를 datasource로 사용해 PromQL 결과를 시각화합니다.

대표적으로 보는 HTTP RED metric은 아래 세 가지입니다.

| 이름 | 질문 | Prometheus metric |
|------|------|-------------------|
| Rate | 요청이 얼마나 들어오는가? | `commerce_http_requests_total` |
| Errors | 실패 비율이 얼마나 되는가? | `commerce_http_requests_total{status=~"5.."}` |
| Duration | 응답 시간이 얼마나 걸리는가? | `commerce_http_request_duration_seconds_bucket` |

면접에서 중요한 포인트는 "Grafana를 띄웠다"가 아니라, 장애 상황에서 어떤 질문에 답할 수 있는지를 설명하는 것입니다.

예를 들면:

> 주문 요청이 느려졌을 때 먼저 Grafana에서 ORDERFC p95 latency가 올라갔는지 확인하고, 5xx ratio가 같이 올라가는지 봅니다. 이후 특정 서비스만 느린지 전체 서비스가 느린지 PromQL의 `service` label 기준으로 나눠 봅니다.

## 10. 처음 구현했던 파일

Phase 1의 첫 번째 구현 대상:

```text
k8s/manifests/namespace.yaml
k8s/manifests/orderfc.yaml
k8s/scripts/create-kind-cluster.sh
k8s/scripts/build-and-load-images.sh
```

처음 목표는 작게 잡았습니다.

> ORDERFC Pod 하나를 kind에서 Running 상태로 만들고, `kubectl logs`로 앱 기동 로그를 확인한다.

## 11. Phase 1에서 왜 Postgres/Redis도 같이 띄우는가?

ORDERFC는 `main.go`에서 시작하자마자 아래 순서로 외부 의존성에 연결합니다.

```text
config.LoadConfig()
-> InitRedis()
-> InitDB()
-> AutoMigrate()
-> Kafka producer/consumer 준비
-> HTTP server start
```

현재 구현은 Redis나 DB 연결에 실패하면 `Fatal` 로그를 남기고 프로세스를 종료합니다. 그래서 ORDERFC Pod 하나만 띄우면 `CrashLoopBackOff`가 됩니다.

Phase 1에서 Kafka와 PRODUCTFC까지 모두 붙이지 않는 이유는, ORDERFC의 HTTP 서버 기동 자체에는 PostgreSQL과 Redis가 가장 먼저 필요하기 때문입니다. Kafka/Product 연동은 실제 주문 API를 호출하는 Phase 2~3에서 검증합니다.

이번 manifest의 핵심 학습 포인트:

- `postgres-order`와 `redis`는 Deployment + Service로 만든다.
- ORDERFC는 ConfigMap으로 `/root/files/config/config.yaml`을 덮어쓴다.
- ORDERFC는 `postgres-order:5432`, `redis:6379`처럼 Service DNS로 의존성에 접근한다.
- ORDERFC Pod는 Phase 1 안정화를 위해 initContainer로 PostgreSQL/Redis 포트가 열릴 때까지 기다린 뒤 시작한다.
- `/health` readinessProbe로 트래픽 받을 준비가 되었는지 확인한다.

운영에 더 가까운 다음 개선:

- ORDERFC 내부에 DB/Redis 연결 retry/backoff 추가
- `/health`는 프로세스 생존, `/ready`는 의존성 준비 상태로 분리
- readinessProbe는 `/ready`를 보도록 변경

현재 구현 상태:

```text
GET /health
-> {"service":"orderfc","status":"healthy"}

GET /ready
-> {"checks":{"database":"ok","redis":"ok"},"service":"orderfc","status":"ready"}
```

이제 Kubernetes는 Pod가 살아 있는지와 트래픽을 받아도 되는지를 다르게 판단합니다.

### Phase 1에서 Kafka 에러가 보여도 되는 이유

ORDERFC는 시작 시 Kafka consumer goroutine도 함께 실행합니다.

Phase 1은 `postgres-order + redis + orderfc`만 검증하기 때문에 아직 `kafka` Service가 없습니다. 따라서 로그에 다음과 같은 메시지가 보일 수 있습니다.

```text
failed to open connection to kafka:9092
lookup kafka ... no such host
```

이 에러는 Kafka consumer가 아직 연결할 브로커를 찾지 못했다는 의미입니다. `/health`가 200이고 Pod가 Running이면 Phase 1 목표는 달성한 것입니다.

다음 Phase에서는 Kafka/Zookeeper 또는 단일 노드 Kafka manifest를 추가해 이 로그를 없애고, `order.created` 발행까지 검증합니다.
