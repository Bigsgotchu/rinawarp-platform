#!/bin/bash

set -e

VERSION=${1:-latest}

echo "Building and pushing RinaWarp platform version: $VERSION"

# Build image
docker build -t rinawarptech/platform:$VERSION .

# Push to registry
docker push rinawarptech/platform:$VERSION

echo "Successfully built and pushed rinawarptech/platform:$VERSION"
