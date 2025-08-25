#!/bin/bash

# Configuration
BACKUP_DIR="/backups"
TEMP_RESTORE_DIR="/tmp/restore_test"
LOG_FILE="/var/log/backup-verification.log"
RETENTION_DAYS=30
MIN_BACKUP_SIZE_MB=1

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

verify_backup_exists() {
    local latest_backup=$(find "$BACKUP_DIR" -name "backup-*.sql" -type f -mtime -1 | sort -r | head -n1)
    
    if [ -z "$latest_backup" ]; then
        log "ERROR: No recent backup found in $BACKUP_DIR"
        return 1
    fi
    
    local backup_size_mb=$(du -m "$latest_backup" | cut -f1)
    if [ "$backup_size_mb" -lt "$MIN_BACKUP_SIZE_MB" ]; then
        log "ERROR: Latest backup size ($backup_size_mb MB) is smaller than minimum required size ($MIN_BACKUP_SIZE_MB MB)"
        return 1
    }
    
    log "SUCCESS: Found valid backup: $latest_backup (${backup_size_mb}MB)"
    echo "$latest_backup"
}

verify_backup_integrity() {
    local backup_file=$1
    
    # Verify backup file is not corrupted
    if ! pg_restore --list "$backup_file" >/dev/null 2>&1; then
        log "ERROR: Backup file is corrupted or invalid"
        return 1
    }
    
    log "SUCCESS: Backup integrity verified"
}

test_restore() {
    local backup_file=$1
    
    # Create temporary database for restore test
    local test_db="restore_test_$(date +%s)"
    
    log "Creating test database: $test_db"
    if ! createdb "$test_db"; then
        log "ERROR: Failed to create test database"
        return 1
    }
    
    # Attempt restore
    if ! pg_restore --dbname="$test_db" "$backup_file" >/dev/null 2>&1; then
        log "ERROR: Failed to restore backup"
        dropdb "$test_db"
        return 1
    }
    
    # Verify basic database connectivity and content
    if ! psql -d "$test_db" -c "SELECT COUNT(*) FROM users;" >/dev/null 2>&1; then
        log "ERROR: Restored database verification failed"
        dropdb "$test_db"
        return 1
    }
    
    # Cleanup
    dropdb "$test_db"
    log "SUCCESS: Restore test completed successfully"
}

verify_retention() {
    local old_backups=$(find "$BACKUP_DIR" -name "backup-*.sql" -type f -mtime +$RETENTION_DAYS)
    if [ -n "$old_backups" ]; then
        log "WARNING: Found backups older than $RETENTION_DAYS days:"
        echo "$old_backups" | tee -a "$LOG_FILE"
    else
        log "SUCCESS: No backups found exceeding retention period"
    fi
}

verify_encryption() {
    local backup_file=$1
    
    # Check if backup is encrypted
    if ! grep -q "ENCRYPTED" "$backup_file"; then
        log "ERROR: Backup file is not encrypted"
        return 1
    }
    
    log "SUCCESS: Backup encryption verified"
}

main() {
    log "Starting backup verification"
    
    # Create log directory if it doesn't exist
    mkdir -p "$(dirname "$LOG_FILE")"
    
    # Verify latest backup exists and meets size requirements
    local backup_file=$(verify_backup_exists)
    if [ $? -ne 0 ]; then
        log "FAILED: Backup verification failed"
        exit 1
    fi
    
    # Verify backup integrity
    verify_backup_integrity "$backup_file"
    if [ $? -ne 0 ]; then
        log "FAILED: Backup integrity check failed"
        exit 1
    fi
    
    # Test restore process
    test_restore "$backup_file"
    if [ $? -ne 0 ]; then
        log "FAILED: Restore test failed"
        exit 1
    fi
    
    # Verify backup retention
    verify_retention
    
    # Verify backup encryption
    verify_encryption "$backup_file"
    if [ $? -ne 0 ]; then
        log "FAILED: Encryption verification failed"
        exit 1
    fi
    
    log "All backup verifications completed successfully"
}

# Execute main function
main
