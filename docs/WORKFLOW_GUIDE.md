# GitHub Actions 워크플로 YAML 한 줄 설명 + 대안

MSA 구조: **각 FC(서비스) 레포 안에** `.github/workflows/go-ci.yml` 을 두고, 해당 서비스만 빌드·테스트합니다.  
강의에서 다룬 Go CI를 기준으로 각 키/블록의 역할과 대안을 정리했습니다.

---

## 1. `name: Go CI`

| 역할 | GitHub Actions 탭에 표시되는 워크플로 이름. |
| 대안 | 생략 가능. 영문: `name: CI` 등. |

---

## 2. `on:` (트리거)

```yaml
on:
  push:
    branches:
      - main
```

| 항목 | 역할 | 대안 |
|------|------|------|
| **on** | 워크플로를 **언제** 실행할지 정의. | — |
| **push** | 브랜치에 push 될 때 실행. | **pull_request**: PR 생성/업데이트 시.<br>**workflow_dispatch**: 수동 실행만.<br>**schedule**: cron 주기 실행.<br>**release**: Release 발행 시. |
| **branches: main** | `main` 브랜치 push 시에만 실행. | **branches: [main, develop]** 등 여러 브랜치.<br>**branches-ignore** 로 제외. |
| **paths** (생략) | 서비스 단일 레포에서는 보통 생략. push = 이 서비스 변경이므로. | 모노레포면 `paths: ['서비스경로/**']` 로 해당 서비스만 트리거. |

---

## 3. `jobs:` / `ci:` / `name` / `runs-on`

```yaml
jobs:
  ci:
    name: Go CI Checks
    runs-on: ubuntu-latest
```

| 항목 | 역할 | 대안 |
|------|------|------|
| **jobs** | 실행할 작업(job) 묶음. | — |
| **ci** | job ID. `needs: ci` 로 의존 시 사용. | `build`, `test` 등. |
| **name** | Actions 화면에 보이는 job 이름. | 생략 시 job ID 표시. |
| **runs-on: ubuntu-latest** | GitHub 호스팅 Ubuntu VM에서 실행. | **macos-latest**, **windows-latest**, **self-hosted** 등. |

---

## 4. `steps:` (각 단계)

### Step 1: Checkout

```yaml
- name: Checkout Code
  uses: actions/checkout@v4
```

| 역할 | 대안 |
|------|------|
| 현재 저장소를 runner 작업 디렉터리에 clone. | **ref: develop**, **fetch-depth: 0** 등. |

### Step 2: Set up Go

```yaml
- name: Set up Go
  uses: actions/setup-go@v5
  with:
    go-version: "1.23"
```

| 역할 | 대안 |
|------|------|
| 지정한 Go 버전 설치 후 PATH 설정. | **go-version-file: 'go.mod'** 로 go.mod 버전 사용. **"1.23.x"**, **"1"** 등. |

### Step 3: Verify Formatting

```yaml
- name: Verify Formatting
  run: |
    echo "Checking gofmt..."
    fmt_result=$(gofmt -l .)
    if [ -n "$fmt_result" ]; then
      echo "The following files need formatting:"
      echo "$fmt_result"
      exit 1
    fi
```

| 역할 | 대안 |
|------|------|
| `gofmt -l .` 로 포맷 안 맞는 파일 목록만 출력. 있으면 `exit 1` 로 실패. | **gofmt -w .**, **go fmt ./...**, **golangci-lint** 등. |

(각 서비스 레포 루트에 있으므로 **working-directory** 불필요.)

### Step 4: Run tests

```yaml
- name: Run tests
  run: go test ./... -v
```

| 역할 | 대안 |
|------|------|
| 현재 모듈 전체 테스트 실행. | **go test -short ./...**, **go test -race ./...**, 경로 제한 등. |

---

## 5. 기타 패턴

- **캐시**: `actions/setup-go` 에 `cache: true` 로 모듈 캐시.
- **시크릿**: `env: API_KEY: ${{ secrets.API_KEY }}` 로 Settings → Secrets 참조.
- **여러 job**: `build` → `test` → `deploy` 처럼 `needs:` 로 순서 지정.

각 FC는 **자기 레포**에 위와 같은 `go-ci.yml` 하나씩 두면 됩니다.
