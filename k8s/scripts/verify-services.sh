#!/usr/bin/env bash
set -euo pipefail

NAMESPACE="${NAMESPACE:-go-commerce}"

kubectl get pods -n "$NAMESPACE"
kubectl get svc -n "$NAMESPACE"

echo "Checking service health endpoints from inside the cluster"
kubectl run service-health-check \
  -n "$NAMESPACE" \
  --rm \
  -i \
  --restart=Never \
  --image=curlimages/curl:8.10.1 \
  -- sh -c 'for target in userfc:28080 productfc:8081 orderfc:8083 paymentfc:28083; do echo "GET http://$target/health"; curl -fsS "http://$target/health"; echo; done'

echo "Checking recent service startup signals"
kubectl logs deployment/userfc -n "$NAMESPACE" --since=5m \
  | rg 'HTTP server is running|gRPC server is running|Failed|ERROR|panic|fatal' || true
kubectl logs deployment/productfc -n "$NAMESPACE" --since=5m \
  | rg 'Kafka .* consumer started|Failed|ERROR|panic|fatal' || true
kubectl logs deployment/paymentfc -n "$NAMESPACE" --since=5m \
  | rg 'Connected to MongoDB|Connected to user gRPC service|Failed|ERROR|panic|fatal' || true
