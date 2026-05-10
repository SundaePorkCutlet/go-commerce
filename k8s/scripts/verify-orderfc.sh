#!/usr/bin/env bash
set -euo pipefail

NAMESPACE="${NAMESPACE:-go-commerce}"
PORT="${PORT:-18083}"

kubectl get pods -n "$NAMESPACE"
kubectl get svc -n "$NAMESPACE"
kubectl logs deployment/orderfc -n "$NAMESPACE" --tail=80

echo "Starting port-forward on localhost:$PORT -> orderfc:8083"
kubectl port-forward -n "$NAMESPACE" service/orderfc "$PORT:8083" >/tmp/go-commerce-orderfc-port-forward.log 2>&1 &
PF_PID=$!
trap 'kill "$PF_PID" >/dev/null 2>&1 || true' EXIT

sleep 3
echo "GET /health"
curl -fsS "http://localhost:$PORT/health"
echo
echo "GET /ready"
curl -fsS "http://localhost:$PORT/ready"
echo
