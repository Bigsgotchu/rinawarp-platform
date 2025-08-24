#!/bin/bash

# Configuration
DOMAIN="rinawarptech.com"
EMAIL="admin@rinawarptech.com"
NGINX_SSL_DIR="/etc/nginx/ssl"

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to install certbot based on OS
install_certbot() {
    if command_exists apt-get; then
        # Debian/Ubuntu
        apt-get update
        apt-get install -y certbot python3-certbot-nginx
    elif command_exists dnf; then
        # RHEL/CentOS 8+
        dnf install -y certbot python3-certbot-nginx
    elif command_exists yum; then
        # RHEL/CentOS 7
        yum install -y epel-release
        yum install -y certbot python3-certbot-nginx
    else
        echo "Unable to detect package manager. Please install certbot manually."
        exit 1
    fi
}

# Ensure script is run with root privileges
if [ "$EUID" -ne 0 ]; then 
    echo "Please run as root (sudo)"
    exit 1
fi

# Check if nginx is installed
if ! command_exists nginx; then
    echo "Nginx is not installed. Please install nginx first."
    exit 1
fi

# Install certbot if not present
if ! command_exists certbot; then
    echo "Installing certbot..."
    install_certbot
fi

# Create SSL directory
mkdir -p "$NGINX_SSL_DIR"

# Stop nginx temporarily
echo "Stopping nginx..."
systemctl stop nginx

# Obtain certificates
echo "Obtaining Let's Encrypt certificates..."
certbot certonly \
    --standalone \
    --agree-tos \
    --non-interactive \
    --expand \
    --email "$EMAIL" \
    --domains "$DOMAIN,www.$DOMAIN,api.$DOMAIN" \
    --rsa-key-size 4096

# Check if certificate was obtained successfully
if [ $? -ne 0 ]; then
    echo "Failed to obtain SSL certificates. Check the error messages above."
    systemctl start nginx
    exit 1
fi

# Create strong DH parameters (2048 bits)
if [ ! -f "$NGINX_SSL_DIR/dhparam.pem" ]; then
    echo "Generating DH parameters (this may take a while)..."
    openssl dhparam -out "$NGINX_SSL_DIR/dhparam.pem" 2048
fi

# Set up auto-renewal
echo "Setting up automatic renewal..."
cat > /etc/cron.d/certbot-renewal << EOF
0 0 * * * root certbot renew --quiet --deploy-hook "systemctl reload nginx"
EOF
chmod 644 /etc/cron.d/certbot-renewal

# Create OCSP Stapling cache directory
mkdir -p /var/cache/nginx/ocsp
chown -R nginx:nginx /var/cache/nginx/ocsp

# Update Nginx SSL configuration
cat > /etc/nginx/conf.d/ssl.conf << EOF
# SSL Configuration
ssl_session_timeout 1d;
ssl_session_cache shared:SSL:50m;
ssl_session_tickets off;

# Modern configuration
ssl_protocols TLSv1.2 TLSv1.3;
ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305:DHE-RSA-AES128-GCM-SHA256:DHE-RSA-AES256-GCM-SHA384;
ssl_prefer_server_ciphers off;

# HSTS (uncomment if you're sure)
# add_header Strict-Transport-Security "max-age=63072000" always;

# OCSP Stapling
ssl_stapling on;
ssl_stapling_verify on;
ssl_trusted_certificate /etc/letsencrypt/live/$DOMAIN/chain.pem;
resolver 8.8.8.8 8.8.4.4 valid=300s;
resolver_timeout 5s;

# DH parameters
ssl_dhparam $NGINX_SSL_DIR/dhparam.pem;
EOF

# Create symbolic links for certificates
ln -sf "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" "$NGINX_SSL_DIR/fullchain.pem"
ln -sf "/etc/letsencrypt/live/$DOMAIN/privkey.pem" "$NGINX_SSL_DIR/privkey.pem"

# Start nginx
echo "Starting nginx..."
systemctl start nginx

# Test nginx configuration
nginx -t

if [ $? -eq 0 ]; then
    echo "SSL certificates have been successfully installed and configured!"
    echo "Certificate location: /etc/letsencrypt/live/$DOMAIN/"
    echo "Auto-renewal has been configured to run daily"
    echo ""
    echo "To verify the SSL configuration, visit:"
    echo "https://www.ssllabs.com/ssltest/analyze.html?d=$DOMAIN"
else
    echo "Warning: Nginx configuration test failed. Please check the configuration."
fi
