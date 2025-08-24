# Production SSL Certificate Deployment Guide

This guide explains how to set up SSL certificates using Let's Encrypt on your production server.

## Prerequisites

1. A domain name pointing to your server (rinawarptech.com)
2. SSH access to your production server
3. Root/sudo access on the server
4. Nginx installed on the server

## Deployment Steps

### 1. Copy the SSL Setup Script

```bash
# On your local machine
scp scripts/setup-prod-ssl.sh user@your-server:/tmp/
```

### 2. Prepare the Server

Ensure that ports 80 and 443 are open in your firewall:

```bash
# On Ubuntu/Debian
sudo ufw allow 80
sudo ufw allow 443

# On CentOS/RHEL
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --reload
```

### 3. Run the SSL Setup Script

```bash
# On your production server
cd /tmp
chmod +x setup-prod-ssl.sh
sudo ./setup-prod-ssl.sh
```

### 4. Verify the Installation

After the script completes:

1. Check the Nginx configuration:
```bash
sudo nginx -t
```

2. Visit your website using HTTPS:
- https://rinawarptech.com
- https://www.rinawarptech.com
- https://api.rinawarptech.com

3. Test your SSL configuration:
- Visit https://www.ssllabs.com/ssltest/analyze.html?d=rinawarptech.com

### 5. Certificate Auto-Renewal

The script sets up automatic renewal, but you can test it manually:

```bash
sudo certbot renew --dry-run
```

## SSL Configuration Details

The setup includes:

- TLS 1.2 and 1.3 support
- Modern cipher suite configuration
- OCSP Stapling
- 4096-bit RSA keys
- 2048-bit Diffie-Hellman parameters
- Daily automatic renewal
- Nginx integration

## Troubleshooting

### Certificate Issues
```bash
# Check certificate status
sudo certbot certificates

# Force renewal
sudo certbot renew --force-renewal
```

### Nginx Issues
```bash
# Check Nginx error logs
sudo tail -f /var/log/nginx/error.log

# Test configuration
sudo nginx -t
```

### Permission Issues
```bash
# Fix SSL directory permissions
sudo chown -R nginx:nginx /etc/nginx/ssl
sudo chmod -R 600 /etc/nginx/ssl
```

## Security Best Practices

1. Keep your system updated:
```bash
sudo apt update && sudo apt upgrade  # Ubuntu/Debian
sudo yum update                      # CentOS/RHEL
```

2. Regular monitoring:
```bash
# Check SSL certificate expiry
echo | openssl s_client -servername rinawarptech.com -connect rinawarptech.com:443 2>/dev/null | openssl x509 -noout -dates
```

3. Enable HSTS after confirming everything works:
Edit `/etc/nginx/conf.d/ssl.conf` and uncomment the HSTS line:
```nginx
add_header Strict-Transport-Security "max-age=63072000" always;
```

## Backup and Recovery

1. Backup certificate files:
```bash
sudo cp -r /etc/letsencrypt/live/rinawarptech.com /path/to/backup
sudo cp -r /etc/letsencrypt/archive/rinawarptech.com /path/to/backup
```

2. Backup Nginx configuration:
```bash
sudo cp -r /etc/nginx/conf.d /path/to/backup
```
