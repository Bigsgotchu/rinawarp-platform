#!/bin/bash

# Configuration
LOG_DIR="/var/log/rinawarp-maintenance"
MAINTENANCE_LOG="$LOG_DIR/maintenance.log"
ALERT_EMAIL="alerts@rinawarp.com"
BACKUP_SCRIPT="./verify-backups.sh"
SECURITY_AUDIT_SCRIPT="./security-audit.sh"

# Create log directory if it doesn't exist
mkdir -p "$LOG_DIR"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$MAINTENANCE_LOG"
}

send_alert() {
    local subject="$1"
    local message="$2"
    echo "$message" | mail -s "$subject" "$ALERT_EMAIL"
}

# Weekly Tasks
weekly_maintenance() {
    log "Starting weekly maintenance tasks"

    # Verify backups
    log "Running backup verification"
    if ! $BACKUP_SCRIPT; then
        send_alert "Backup Verification Failed" "Weekly backup verification failed. Check maintenance logs."
        log "ERROR: Backup verification failed"
    else
        log "Backup verification completed successfully"
    fi

    # Check disk usage
    log "Checking disk usage"
    DISK_USAGE=$(df -h / | awk 'NR==2 {print $5}' | sed 's/%//')
    if [ "$DISK_USAGE" -gt 85 ]; then
        send_alert "High Disk Usage" "Disk usage is at ${DISK_USAGE}%"
        log "WARNING: High disk usage detected: ${DISK_USAGE}%"
    fi

    # Cleanup old logs
    log "Cleaning up old logs"
    find "$LOG_DIR" -type f -name "*.log" -mtime +30 -delete

    log "Weekly maintenance completed"
}

# Monthly Tasks
monthly_maintenance() {
    log "Starting monthly maintenance tasks"

    # Run security audit
    log "Running security audit"
    if ! $SECURITY_AUDIT_SCRIPT; then
        send_alert "Security Audit Failed" "Monthly security audit failed. Check maintenance logs."
        log "ERROR: Security audit failed"
    else
        log "Security audit completed successfully"
    fi

    # Update dependencies audit
    log "Checking for dependency updates"
    npm audit
    npm outdated

    # Database maintenance
    log "Running database maintenance"
    psql -c "VACUUM ANALYZE;"

    # Generate monthly metrics
    log "Generating monthly metrics"
    node scripts/generate-metrics.js

    log "Monthly maintenance completed"
}

# Quarterly Tasks
quarterly_maintenance() {
    log "Starting quarterly maintenance tasks"

    # Review monitoring alerts
    log "Reviewing monitoring alerts"
    node scripts/alert-review.js

    # Performance review
    log "Running performance review"
    node scripts/performance-review.js

    # Update documentation
    log "Checking documentation updates"
    node scripts/check-docs.js

    log "Quarterly maintenance completed"
}

# Main execution
case "$1" in
    "weekly")
        weekly_maintenance
        ;;
    "monthly")
        monthly_maintenance
        ;;
    "quarterly")
        quarterly_maintenance
        ;;
    *)
        echo "Usage: $0 {weekly|monthly|quarterly}"
        exit 1
        ;;
esac
