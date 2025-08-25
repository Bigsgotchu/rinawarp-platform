#!/bin/bash
set -e

# Configuration
APP_NAME="rinawarp-platform"
BACKUP_DIR="/var/backups/${APP_NAME}"
LOG_DIR="/var/log/${APP_NAME}"

# Ensure we're in the project root
cd "$(dirname "$0")/.."

echo "Starting production deployment for ${APP_NAME}..."

# Verify environment
if [ ! -f .env.production ]; then
    echo "Error: .env.production not found!"
    exit 1
fi

# Create necessary directories
sudo mkdir -p "$BACKUP_DIR" "$LOG_DIR"
sudo chown -R $(whoami) "$BACKUP_DIR" "$LOG_DIR"

# Backup current state
if [ -d "node_modules" ]; then
    echo "Creating backup of current state..."
    timestamp=$(date +%Y%m%d_%H%M%S)
    tar -czf "$BACKUP_DIR/backup_${timestamp}.tar.gz" . || {
        echo "Warning: Backup creation failed, continuing with deployment..."
    }
fi

# Install/Update dependencies
echo "Installing dependencies..."
npm ci --production

# Build application
echo "Building application..."
npm run build

# Database migrations
echo "Running database migrations..."
npm run migrate

# Stop existing PM2 process if it exists
if pm2 list | grep -q "$APP_NAME"; then
    echo "Stopping existing process..."
    pm2 stop "$APP_NAME"
fi

# Start application with PM2
echo "Starting application with PM2..."
pm2 start npm --name "$APP_NAME" -- start

# Wait for application to start
echo "Waiting for application to start..."
sleep 5

# Health check
echo "Performing health check..."
if ! curl -s http://localhost:3000/health; then
    echo "Health check failed! Rolling back..."
    pm2 stop "$APP_NAME"
    exit 1
fi

# Save PM2 process list
pm2 save

echo "Deployment completed successfully!"
