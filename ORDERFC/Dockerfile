# Go 빌드 스테이지
FROM golang:1.23-alpine AS builder

WORKDIR /app

# 의존성 파일 복사
COPY go.mod go.sum ./
RUN go mod download

# 소스 코드 복사
COPY . .

# 애플리케이션 빌드
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o main .

# 최종 실행 스테이지
FROM alpine:latest

RUN apk --no-cache add ca-certificates
WORKDIR /root/

# 빌드된 바이너리 복사
COPY --from=builder /app/main .

# config 파일 복사
COPY --from=builder /app/files/config ./files/config

# 포트 노출
EXPOSE 8083

# 애플리케이션 실행
CMD ["./main"]
