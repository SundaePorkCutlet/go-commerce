#!/usr/bin/env bash
set -euo pipefail

CLUSTER_NAME="${CLUSTER_NAME:-go-commerce}"

if kind get clusters | grep -qx "$CLUSTER_NAME"; then
  echo "kind cluster already exists: $CLUSTER_NAME"
else
  kind create cluster --name "$CLUSTER_NAME"
fi

kubectl cluster-info --context "kind-$CLUSTER_NAME"
