#!/bin/bash
set -e

# Configuration
APP_NAME="rinawarp-platform"
BACKUP_DIR="/var/backups/${APP_NAME}"
RETENTION_DAYS=30
DB_NAME="rinawarp_prod"
DB_USER="$POSTGRES_USER"
S3_BUCKET="${S3_BACKUP_BUCKET:-''}"

# Ensure backup directory exists
sudo mkdir -p "$BACKUP_DIR"
sudo chown -R $(whoami) "$BACKUP_DIR"

# Create backup function
create_backup() {
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_file="${BACKUP_DIR}/${DB_NAME}_${timestamp}.sql.gz"
    
    echo "Creating database backup..."
    pg_dump -U "$DB_USER" "$DB_NAME" | gzip > "$backup_file"
    
    # Create checksum
    sha256sum "$backup_file" > "${backup_file}.sha256"
    
    # Upload to S3 if configured
    if [ ! -z "$S3_BUCKET" ]; then
        echo "Uploading backup to S3..."
        aws s3 cp "$backup_file" "s3://${S3_BUCKET}/backups/${DB_NAME}/"
        aws s3 cp "${backup_file}.sha256" "s3://${S3_BUCKET}/backups/${DB_NAME}/"
    fi
}

# Clean old backups
cleanup_old_backups() {
    echo "Cleaning up old backups..."
    find "$BACKUP_DIR" -type f -mtime +${RETENTION_DAYS} -delete
    
    if [ ! -z "$S3_BUCKET" ]; then
        echo "Cleaning up old S3 backups..."
        aws s3 ls "s3://${S3_BUCKET}/backups/${DB_NAME}/" | \
        while read -r line; do
            createDate=$(echo $line | awk {'print $1" "$2'})
            createDate=$(date -j -f "%Y-%m-%d %H:%M:%S" "${createDate}" +%s)
            olderThan=$(date -j -v-${RETENTION_DAYS}d +%s)
            if [[ $createDate -lt $olderThan ]]
            then 
                fileName=$(echo $line | awk {'print $4'})
                if [ ! -z "$fileName" ]; then
                    aws s3 rm "s3://${S3_BUCKET}/backups/${DB_NAME}/${fileName}"
                fi
            fi
        done
    fi
}

# Verify backup integrity
verify_backup() {
    local backup_file="$1"
    echo "Verifying backup integrity: $backup_file"
    
    if [ -f "${backup_file}.sha256" ]; then
        sha256sum -c "${backup_file}.sha256"
    else
        echo "Warning: No checksum file found for $backup_file"
        return 1
    fi
}

# Set up cron jobs
setup_cron() {
    # Daily backup at 1 AM
    (crontab -l 2>/dev/null || true; echo "0 1 * * * $0 backup") | crontab -
    
    # Weekly cleanup at 2 AM on Sundays
    (crontab -l 2>/dev/null || true; echo "0 2 * * 0 $0 cleanup") | crontab -
}

# Main execution
case "${1:-setup}" in
    backup)
        create_backup
        ;;
    cleanup)
        cleanup_old_backups
        ;;
    verify)
        if [ -z "$2" ]; then
            echo "Error: Please specify backup file to verify"
            exit 1
        fi
        verify_backup "$2"
        ;;
    setup)
        echo "Setting up backup configuration..."
        setup_cron
        echo "Backup configuration completed successfully!"
        echo "Daily backups scheduled for 1 AM"
        echo "Weekly cleanup scheduled for 2 AM on Sundays"
        ;;
    *)
        echo "Usage: $0 {setup|backup|cleanup|verify BACKUP_FILE}"
        exit 1
        ;;
esac
