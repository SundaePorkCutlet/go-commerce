# go-commerce Kubernetes Local Deployment

이 디렉토리는 `go-commerce`를 로컬 Kubernetes 환경(kind 기준)에 배포하기 위한 작업 공간입니다.

목표는 클라우드 비용을 쓰지 않고도, MSA 서비스를 Kubernetes 관점에서 실행하고 검증할 수 있는 포트폴리오 증거를 만드는 것입니다.

## Why Kubernetes Here?

`go-commerce`는 이미 다음 특징을 갖고 있습니다.

- 서비스 분리: `USERFC`, `PRODUCTFC`, `ORDERFC`, `PAYMENTFC`
- 서비스별 DB: PostgreSQL database per service
- 비동기 통신: Kafka 기반 Saga
- 캐시/상태 저장소: Redis, MongoDB
- 관측성: Prometheus, Grafana, Loki, Jaeger

그래서 Kubernetes 학습 주제로 적합합니다. 단순히 Nginx 하나 올리는 예제가 아니라, 백엔드 시스템이 실제로 Kubernetes에서 어떤 단위로 쪼개지고 연결되는지 설명할 수 있습니다.

## Scope

처음부터 모든 것을 한 번에 올리지 않습니다.

| Phase | 목표 | 완료 기준 |
|-------|------|-----------|
| 1 | kind 클러스터 생성 + ORDERFC/PostgreSQL/Redis 배포 | `/health`, `/ready` 응답 |
| 2 | Kafka/Zookeeper 추가 | `kafka:9092` 접근 + Kafka topic 생성 |
| 3 | PRODUCTFC/PAYMENTFC/USERFC 추가 | 4개 서비스와 각 DB Pod Running |
| 4 | Kafka 기반 Saga 확인 | `order.created -> stock.reserved -> payment` 로그 확인 |
| 5 | Observability 연결 | Prometheus/Grafana 또는 Jaeger 화면 캡처 |

## Directory Plan

```text
k8s/
├── README.md              # 실행 절차와 포트폴리오 검증 기록
├── STUDY.md               # Kubernetes 개념 학습 노트
├── manifests/             # 직접 작성한 Kubernetes YAML
│   ├── namespace.yaml
│   ├── configmap.yaml
│   ├── secret.yaml
│   ├── orderfc.yaml
│   └── ...
├── scripts/               # kind cluster 생성/이미지 로드/검증 스크립트
└── screenshots/           # 포트폴리오용 캡처
```

## Tooling Choice

이 프로젝트에서는 **kind**를 우선 사용합니다.

| 도구 | 선택 이유 |
|------|-----------|
| kind | Docker 위에서 Kubernetes node를 띄워 가볍고 재현성이 좋음 |
| kubectl | 실무에서 가장 기본이 되는 Kubernetes CLI |
| Docker | 서비스 이미지를 빌드하고 kind cluster에 로드 |

Minikube도 가능하지만, 이 프로젝트의 목적은 로컬에서 가볍게 반복하고 문서화하는 것이므로 kind가 더 적합합니다.

## Prerequisites

```bash
docker --version
kubectl version --client
kind version
```

설치 예시(macOS):

```bash
brew install kind kubectl
```

Docker Desktop은 실행 중이어야 합니다. 아래 에러가 나오면 Docker Desktop을 먼저 켭니다.

```text
Cannot connect to the Docker daemon
```

`kind: command not found`가 나오면:

```bash
brew install kind
```

## Phase 1 Target

첫 번째 목표는 작게 잡습니다. ORDERFC는 기동 시 PostgreSQL과 Redis 연결에 실패하면 종료하므로, Phase 1에는 `postgres-order`, `redis`, `orderfc`만 포함합니다. Kafka와 PRODUCTFC는 Saga API를 호출하기 전까지 다음 Phase로 미룹니다.

```text
Docker image build
-> kind cluster create
-> image load
-> Namespace 생성
-> postgres-order / redis 생성
-> ORDERFC Deployment 생성
-> Service 생성
-> kubectl port-forward 또는 NodePort로 API 확인
```

예상 명령 흐름:

```bash
./k8s/scripts/create-kind-cluster.sh
./k8s/scripts/build-and-load-orderfc.sh
./k8s/scripts/deploy-orderfc.sh
./k8s/scripts/verify-orderfc.sh
```

수동으로 실행하고 싶다면:

```bash
kind create cluster --name go-commerce
docker build -t go-commerce-orderfc:local ./ORDERFC
kind load docker-image go-commerce-orderfc:local --name go-commerce
kubectl apply -k k8s/manifests
kubectl get pods -n go-commerce
kubectl logs deployment/orderfc -n go-commerce
kubectl port-forward -n go-commerce service/orderfc 18083:8083
curl http://localhost:18083/health
```

## Kubernetes Mapping

Docker Compose와 Kubernetes의 개념을 이렇게 대응시킵니다.

| Docker Compose | Kubernetes | 의미 |
|----------------|------------|------|
| service | Deployment + Service | Pod 실행과 네트워크 접근을 분리 |
| container_name | Pod name prefix | 실제 Pod 이름은 ReplicaSet이 생성 |
| environment | ConfigMap / Secret | 일반 설정과 민감 정보를 분리 |
| ports | Service / port-forward / Ingress | 외부 또는 클러스터 내부 접근 |
| volume | PersistentVolumeClaim | DB 같은 상태 저장 데이터 유지 |
| depends_on | readinessProbe / app retry / initContainer | Kubernetes는 시작 순서를 보장하지 않음. initContainer는 학습용 대기 장치로만 제한적으로 사용 |
| networks | Namespace + Service DNS | 같은 namespace에서 DNS로 통신 |

## Service Ports

| 서비스 | Container Port | 참고 |
|--------|----------------|------|
| USERFC | `28080`, `50051` | HTTP + gRPC |
| PRODUCTFC | `8081` | Dockerfile 기준 |
| ORDERFC | `8083` | Dockerfile 기준, compose host는 `28082` |
| PAYMENTFC | `28083` | HTTP |

Kubernetes에서는 host port가 아니라 **Service port**와 **targetPort**를 명확히 구분합니다.

## What To Capture

포트폴리오에는 실제 클라우드 배포보다 검증 증거가 중요합니다.

권장 캡처:

```bash
kubectl get pods -n go-commerce
kubectl get svc -n go-commerce
kubectl describe pod <pod-name> -n go-commerce
kubectl logs deployment/orderfc -n go-commerce
curl http://localhost:<port>/swagger/index.html
```

추가로 Saga까지 연결되면:

```bash
kubectl logs deployment/productfc -n go-commerce
kubectl logs deployment/paymentfc -n go-commerce
```

여기서 `order.created`, `stock.reserved`, `payment.success` 흐름을 캡처하면 좋습니다.

## Current Verification

2026-05-09 기준 Phase 1/2 검증:

```bash
kind version
# kind v0.31.0

docker version --format '{{.Server.Version}}'
# 28.5.1

kubectl version --client
# Client Version: v1.34.1
```

실제 캡처용 명령:

```bash
kubectl get pods -n go-commerce
```

예상 형태:

```text
NAME                              READY   STATUS    RESTARTS   AGE
kafka-...                         1/1     Running   ...        ...
mongodb-...                       1/1     Running   0          ...
orderfc-...                       1/1     Running   0          ...
paymentfc-...                     1/1     Running   0          ...
postgres-order-...                1/1     Running   0          ...
postgres-payment-...              1/1     Running   0          ...
postgres-product-...              1/1     Running   0          ...
postgres-user-...                 1/1     Running   0          ...
productfc-...                     1/1     Running   0          ...
redis-...                         1/1     Running   0          ...
userfc-...                        1/1     Running   0          ...
zookeeper-...                     1/1     Running   0          ...
```

Service:

```bash
kubectl get svc -n go-commerce

NAME             TYPE        CLUSTER-IP      EXTERNAL-IP   PORT(S)
kafka            ClusterIP   ...             <none>        9092/TCP
mongodb          ClusterIP   ...             <none>        27017/TCP
orderfc          ClusterIP   ...             <none>        8083/TCP
paymentfc        ClusterIP   ...             <none>        28083/TCP
postgres-order   ClusterIP   ...             <none>        5432/TCP
postgres-payment ClusterIP   ...             <none>        5432/TCP
postgres-product ClusterIP   ...             <none>        5432/TCP
postgres-user    ClusterIP   ...             <none>        5432/TCP
productfc        ClusterIP   ...             <none>        8081/TCP
redis            ClusterIP   ...             <none>        6379/TCP
userfc           ClusterIP   ...             <none>        28080/TCP,50051/TCP
zookeeper        ClusterIP   ...             <none>        2181/TCP
```

Health check:

```bash
./k8s/scripts/verify-orderfc.sh
# {"service":"orderfc","status":"healthy"}
# {"checks":{"database":"ok","redis":"ok"},"service":"orderfc","status":"ready"}
```

Probe split:

- `/health`: 프로세스가 살아 있고 HTTP 서버가 응답하는지 확인
- `/ready`: PostgreSQL/Redis 연결이 가능한지 확인
- Kubernetes `readinessProbe`: `/ready`를 사용
- Kubernetes `livenessProbe`: `/health`를 사용

Phase 1에서는 Kafka를 배포하지 않아 ORDERFC consumer 로그에 `kafka:9092 no such host`가 보였습니다. Phase 2에서 Kafka/Zookeeper를 추가한 뒤에는 DNS 에러가 사라지고, consumer group이 안정화되는지까지 확인합니다.

Kafka check:

```bash
./k8s/scripts/verify-kafka.sh
# __consumer_offsets
# payment.failed
# payment.success
# stock.rejected
# kafka:9092 reachable
```

ORDERFC Kafka consumer 확인:

```bash
kubectl logs deployment/orderfc -n go-commerce --since=20s \
  | rg 'Failed to read|no such host|Group Coordinator|Invalid Replication|connection refused|Kafka|kafka' || true
```

정상 상태에서는 위 명령이 에러 로그를 출력하지 않습니다. Kafka가 재시작되는 순간에는 일시적으로 `connection refused`가 보일 수 있지만, broker와 consumer group이 안정화되면 사라져야 합니다.

Service health check:

```bash
./k8s/scripts/verify-services.sh
# GET http://userfc:28080/health
# {"service":"userfc","status":"healthy"}
# GET http://productfc:8081/health
# {"service":"productfc","status":"healthy"}
# GET http://orderfc:8083/health
# {"service":"orderfc","status":"healthy"}
# GET http://paymentfc:28083/health
# {"service":"paymentfc","status":"healthy"}
```

Phase 3에서 확인한 추가 연결:

- USERFC: HTTP `28080`, gRPC `50051` 기동
- PRODUCTFC: `order.created`, `stock.updated`, `stock.rollback` Kafka consumer 시작
- PAYMENTFC: MongoDB 연결, USERFC gRPC 연결, `stock.reserved` Kafka consumer 시작

### Kafka Notes

Kafka는 단순히 `kafka:9092` 포트가 열렸다고 준비 완료라고 보기 어렵습니다. Consumer group을 쓰려면 내부 토픽인 `__consumer_offsets`가 만들어지고 group coordinator가 활성화되어야 합니다.

이번 로컬 kind 배포에서 확인한 포인트:

- `KAFKA_ADVERTISED_LISTENERS`를 `kafka:9092` Service 주소로 두면, Kafka가 readiness 통과 전에 자기 자신을 Service로 다시 연결하려다가 endpoint가 없어 실패할 수 있습니다.
- 단일 broker 로컬 배포에서는 Pod IP를 `POD_IP`로 주입하고 `PLAINTEXT://$(POD_IP):9092`로 광고하게 했습니다.
- Service 이름이 `kafka`이면 Kubernetes가 `KAFKA_PORT` 같은 Service env var를 자동 주입할 수 있고, Confluent Kafka image의 설정 파싱과 충돌할 수 있습니다. 그래서 `enableServiceLinks: false`를 설정했습니다.
- `broker.id=1`인 단일 Kafka broker는 RollingUpdate 중 같은 broker id가 잠시 두 개 뜨면 Zookeeper에서 `NodeExists`가 날 수 있습니다. 그래서 `strategy.type: Recreate`를 사용했습니다.

### Note: initContainer Is Not `depends_on`

Phase 1 manifest는 ORDERFC가 PostgreSQL/Redis보다 먼저 떠서 재시작되는 현상을 줄이기 위해 initContainer로 포트 오픈을 기다립니다.

다만 이것은 Docker Compose `depends_on`의 정석적인 대체가 아닙니다. 운영에 가까운 구조에서는 애플리케이션이 DB/Redis/Kafka 연결 retry/backoff를 갖고, readinessProbe가 트래픽 수신 가능 여부를 표현하는 편이 더 좋습니다.

이 프로젝트에서 initContainer는 다음 목적의 학습용 장치입니다.

- Kubernetes에는 Compose처럼 시작 순서를 보장하는 `depends_on`이 없다는 점을 확인
- Service DNS(`postgres-order`, `redis`)로 의존성을 찾는 방식 학습
- `kubectl get pods` 결과를 안정적으로 캡처하기 위한 Phase 1 보조 장치

다음 개선 방향:

- ORDERFC에 DB/Redis 연결 retry/backoff 추가
- Kafka consumer 연결 실패가 앱 health를 오염시키지 않도록 graceful retry 유지

## Resume Sentence

이 작업이 완료되면 이력서에는 이렇게 쓸 수 있습니다.

> go-commerce MSA를 로컬 Kubernetes(kind) 환경에 배포할 수 있도록 Deployment, Service, ConfigMap, Secret manifest를 구성하고, 서비스 상태 확인과 API 호출 검증 절차를 문서화했습니다.

Saga까지 검증하면:

> Kubernetes 환경에서 ORDERFC, PRODUCTFC, PAYMENTFC 간 Saga 이벤트 흐름을 실행하고, Pod 로그와 Kafka 이벤트를 통해 `order.created -> stock.reserved -> payment` 흐름을 검증했습니다.

## Next Step

다음 작업은 실제 Saga 흐름을 Kubernetes 내부에서 검증하는 것입니다.

```bash
kubectl logs deployment/orderfc -n go-commerce
kubectl logs deployment/productfc -n go-commerce
kubectl logs deployment/paymentfc -n go-commerce
```

성공하면 `k8s/screenshots/`에 `kubectl get pods`, `kubectl get svc`, `/health`, `/ready`, Kafka topic 목록, Saga 이벤트 로그를 캡처합니다.

## Troubleshooting

### `kind: command not found`

kind가 설치되지 않은 상태입니다.

```bash
brew install kind
kind version
```

### `Cannot connect to the Docker daemon`

Docker Desktop이 실행 중이 아니거나 Docker context가 준비되지 않은 상태입니다.

```bash
open -a Docker
docker version
```

### `ImagePullBackOff`

kind cluster 안에 로컬 이미지가 로드되지 않은 상태일 가능성이 큽니다.

```bash
docker build -t go-commerce-orderfc:local ./ORDERFC
kind load docker-image go-commerce-orderfc:local --name go-commerce
kubectl rollout restart deployment/orderfc -n go-commerce
```

### `CrashLoopBackOff`

ORDERFC가 기동 중 DB/Redis 연결에 실패했을 가능성이 큽니다.

```bash
kubectl logs deployment/orderfc -n go-commerce
kubectl get pods -n go-commerce
kubectl describe pod -n go-commerce -l app=orderfc
```

Phase 1에서는 `postgres-order`와 `redis` Pod가 먼저 Running이어야 합니다.

현재 ORDERFC manifest는 initContainer로 `postgres-order:5432`, `redis:6379` 포트가 열릴 때까지 기다린 뒤 앱 컨테이너를 시작합니다. 이것은 Phase 1 검증을 안정화하기 위한 보조 장치이며, 장기적으로는 애플리케이션 retry와 readinessProbe 중심으로 개선하는 것이 더 적절합니다.
