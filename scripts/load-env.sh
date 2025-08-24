#!/bin/bash

# Read and export environment variables from .env.production
set -a
source .env.production
set +a

# Verify the variables are set
echo "Cloudflare API Token set: ${CLOUDFLARE_API_TOKEN:0:8}..."
echo "Cloudflare Zone ID set: $CLOUDFLARE_ZONE_ID"
