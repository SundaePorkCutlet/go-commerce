# Kubernetes Verification Evidence

Captured: 2026-05-10 08:35:35 UTC

## kubectl get pods -n go-commerce
- Text: `01-pods.txt`
- Image: `01-pods.svg`

## kubectl get svc -n go-commerce
- Text: `02-services.txt`
- Image: `02-services.svg`

## ./k8s/scripts/verify-kafka.sh
- Text: `03-kafka-verification.txt`
- Image: `03-kafka-verification.svg`

## ./k8s/scripts/verify-services.sh
- Text: `04-service-health.txt`
- Image: `04-service-health.svg`

## ORDERFC DB: orders + order_outbox_events
- Text: `05-saga-order-db.txt`
- Image: `05-saga-order-db.svg`

## PRODUCTFC DB: products stock after Saga
- Text: `06-saga-product-db.txt`
- Image: `06-saga-product-db.svg`

## PAYMENTFC DB: payment_requests after Saga
- Text: `07-saga-payment-db.txt`
- Image: `07-saga-payment-db.svg`
