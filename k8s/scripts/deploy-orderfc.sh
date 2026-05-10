#!/usr/bin/env bash
set -euo pipefail

kubectl apply -k k8s/manifests
kubectl rollout status deployment/postgres-user -n go-commerce --timeout=120s
kubectl rollout status deployment/postgres-product -n go-commerce --timeout=120s
kubectl rollout status deployment/postgres-order -n go-commerce --timeout=120s
kubectl rollout status deployment/postgres-payment -n go-commerce --timeout=120s
kubectl rollout status deployment/redis -n go-commerce --timeout=120s
kubectl rollout status deployment/mongodb -n go-commerce --timeout=180s
kubectl rollout status deployment/zookeeper -n go-commerce --timeout=180s
kubectl rollout status deployment/kafka -n go-commerce --timeout=180s
kubectl rollout status deployment/userfc -n go-commerce --timeout=180s
kubectl rollout status deployment/productfc -n go-commerce --timeout=180s
kubectl rollout status deployment/orderfc -n go-commerce --timeout=180s
kubectl rollout status deployment/paymentfc -n go-commerce --timeout=180s
kubectl get pods -n go-commerce
kubectl get svc -n go-commerce
