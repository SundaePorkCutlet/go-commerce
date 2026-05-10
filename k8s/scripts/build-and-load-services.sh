#!/usr/bin/env bash
set -euo pipefail

CLUSTER_NAME="${CLUSTER_NAME:-go-commerce}"

services=(
  "USERFC:go-commerce-userfc:local"
  "PRODUCTFC:go-commerce-productfc:local"
  "ORDERFC:go-commerce-orderfc:local"
  "PAYMENTFC:go-commerce-paymentfc:local"
)

for service in "${services[@]}"; do
  context="${service%%:*}"
  image="${service#*:}"

  echo "Building $context -> $image"
  docker build -t "$image" "./$context"

  echo "Loading $image into kind cluster $CLUSTER_NAME"
  kind load docker-image "$image" --name "$CLUSTER_NAME"
done
