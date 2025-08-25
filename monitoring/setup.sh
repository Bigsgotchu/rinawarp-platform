#!/bin/bash
set -e

# Configuration
APP_NAME="rinawarp-platform"
PM2_KEYMETRICS_SECRET="${PM2_SECRET:-''}"
ALERT_EMAIL="${ALERT_EMAIL:-''}"

echo "Setting up monitoring for ${APP_NAME}..."

# Install PM2 monitoring modules
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
pm2 set pm2-logrotate:compress true

# Install PM2 metrics module
pm2 install pm2-server-monit

# Configure PM2 monitoring thresholds
pm2 set pm2-server-monit:cpu 80
pm2 set pm2-server-monit:memory 85
pm2 set pm2-server-monit:drive 85

# Set up email alerts if configured
if [ ! -z "$ALERT_EMAIL" ]; then
    echo "Configuring email alerts to: $ALERT_EMAIL"
    pm2 set pm2-alerts:email $ALERT_EMAIL
    pm2 install pm2-alerts
fi

# Configure PM2 Keymetrics if secret is provided
if [ ! -z "$PM2_KEYMETRICS_SECRET" ]; then
    echo "Connecting to PM2 Keymetrics..."
    pm2 link $PM2_KEYMETRICS_SECRET
fi

# Enable automatic startup
pm2 startup

# Save PM2 configuration
pm2 save

echo "Monitoring setup completed successfully!"
echo "View metrics with: pm2 monit"
echo "View logs with: pm2 logs ${APP_NAME}"
