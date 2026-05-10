#!/usr/bin/env bash
set -euo pipefail

NAMESPACE="${NAMESPACE:-go-commerce}"

kubectl get pods -n "$NAMESPACE" -l 'app in (prometheus,grafana)'
kubectl get svc -n "$NAMESPACE" prometheus grafana

echo
echo "== Prometheus readiness and queries =="
kubectl run prometheus-check \
  -n "$NAMESPACE" \
  --rm \
  -i \
  --restart=Never \
  --image=curlimages/curl:8.10.1 \
  -- sh -c '
    set -e
    curl -fsS http://prometheus:9090/-/ready
    echo
    for query in \
      "up{job=\"userfc\"}" \
      "up{job=\"productfc\"}" \
      "up{job=\"orderfc\"}" \
      "up{job=\"paymentfc\"}" \
      "sum by (service) (commerce_http_requests_total)"
    do
      echo
      echo "QUERY: $query"
      curl -G -fsS --data-urlencode "query=$query" http://prometheus:9090/api/v1/query
      echo
    done
  '

echo
echo "== Grafana health =="
kubectl run grafana-check \
  -n "$NAMESPACE" \
  --rm \
  -i \
  --restart=Never \
  --image=curlimages/curl:8.10.1 \
  -- sh -c 'curl -fsS http://grafana:3000/api/health && echo'

echo
echo "Grafana local access:"
echo "kubectl port-forward -n $NAMESPACE service/grafana 13000:3000"
echo "open http://localhost:13000/d/go-commerce-red/go-commerce-http-red"
