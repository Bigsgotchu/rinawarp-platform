#!/bin/bash

# Configuration
DOMAIN="rinawarptech.com"
EMAIL="admin@rinawarptech.com"
NGINX_SSL_DIR="./nginx/ssl"

# Check if mkcert is installed (for local development)
if ! command -v mkcert &> /dev/null; then
    echo "mkcert not found. Installing..."
    brew install mkcert
    brew install nss # for Firefox support
    mkcert -install
fi

# Create SSL directory if it doesn't exist
mkdir -p "$NGINX_SSL_DIR"

# Generate local development certificates
echo "Generating local development SSL certificates..."
mkcert -cert-file "$NGINX_SSL_DIR/fullchain.pem" \
       -key-file "$NGINX_SSL_DIR/privkey.pem" \
       "$DOMAIN" "www.$DOMAIN" "api.$DOMAIN" "localhost" "127.0.0.1"

# Set proper permissions
chmod 600 "$NGINX_SSL_DIR/fullchain.pem" "$NGINX_SSL_DIR/privkey.pem"

echo "SSL certificate setup complete!"
echo "Certificate location: $NGINX_SSL_DIR"
echo "Note: These are development certificates. For production, use Let's Encrypt certificates."
