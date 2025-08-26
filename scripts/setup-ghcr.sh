#!/bin/bash

set -e

# Check if token is provided
if [ -z "$GITHUB_TOKEN" ]; then
    echo "Please set GITHUB_TOKEN environment variable"
    echo ""
    echo "To create a token:"
    echo "1. Go to GitHub.com → Settings → Developer settings → Personal access tokens → Tokens (classic)"
    echo "2. Click 'Generate new token' → 'Generate new token (classic)'"
    echo "3. Name: 'RinaWarp Container Registry'"
    echo "4. Select scopes:"
    echo "   - write:packages"
    echo "   - read:packages"
    echo "   - delete:packages"
    echo "5. Generate token and copy it"
    echo ""
    echo "Then run: export GITHUB_TOKEN=your_token_here"
    exit 1
fi

# Check if GitHub username is provided
if [ -z "$GITHUB_USERNAME" ]; then
    echo "Please set GITHUB_USERNAME environment variable"
    echo "Example: export GITHUB_USERNAME=your-github-username"
    exit 1
fi

# Login to GHCR
echo "$GITHUB_TOKEN" | docker login ghcr.io -u "$GITHUB_USERNAME" --password-stdin

# Tag image for GHCR
docker tag rinawarptech/platform:latest "ghcr.io/$GITHUB_USERNAME/rinawarp-platform:latest"

# Push image
docker push "ghcr.io/$GITHUB_USERNAME/rinawarp-platform:latest"

# Create Kubernetes secret for pulling images
kubectl create namespace rinawarp --dry-run=client -o yaml | kubectl apply -f -
kubectl create secret docker-registry ghcr-cred \
    -n rinawarp \
    --docker-server=ghcr.io \
    --docker-username="$GITHUB_USERNAME" \
    --docker-password="$GITHUB_TOKEN" \
    --docker-email="$(git config --get user.email)" \
    --dry-run=client -o yaml | kubectl apply -f -

# Update platform deployment to use GHCR
echo ""
echo "GitHub Container Registry setup complete!"
echo "Image pushed to: ghcr.io/$GITHUB_USERNAME/rinawarp-platform:latest"
echo "Kubernetes secret 'ghcr-cred' created in 'rinawarp' namespace"
