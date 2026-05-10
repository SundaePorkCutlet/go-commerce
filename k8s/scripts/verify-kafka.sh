#!/usr/bin/env bash
set -euo pipefail

NAMESPACE="${NAMESPACE:-go-commerce}"

kubectl get pods -n "$NAMESPACE" -l app.kubernetes.io/name=kafka
kubectl get svc -n "$NAMESPACE" kafka

echo "Recent Kafka readiness signals"
kubectl logs deployment/kafka -n "$NAMESPACE" --tail=120 \
  | rg 'KafkaServer id=1] started|GroupCoordinator|ERROR|WARN' || true

echo "Listing Kafka topics"
kubectl exec deployment/kafka -n "$NAMESPACE" -- \
  kafka-topics --bootstrap-server kafka:9092 --list

echo "Checking kafka Service DNS and port from inside the cluster"
kubectl run kafka-dns-check \
  -n "$NAMESPACE" \
  --rm \
  -i \
  --restart=Never \
  --image=busybox:1.36 \
  -- sh -c 'nc -z kafka 9092 && echo "kafka:9092 reachable"'
