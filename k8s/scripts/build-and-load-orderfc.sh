#!/usr/bin/env bash
set -euo pipefail

CLUSTER_NAME="${CLUSTER_NAME:-go-commerce}"
IMAGE_NAME="${IMAGE_NAME:-go-commerce-orderfc:local}"

docker build -t "$IMAGE_NAME" ./ORDERFC
kind load docker-image "$IMAGE_NAME" --name "$CLUSTER_NAME"
