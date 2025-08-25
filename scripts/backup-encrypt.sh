#!/bin/bash

# Configuration
BACKUP_DIR="/backups"
BACKUP_KEY_FILE="/etc/rinawarp/backup.key"
LOG_FILE="/var/log/backup-encryption.log"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

generate_encryption_key() {
    if [ ! -f "$BACKUP_KEY_FILE" ]; then
        log "Generating new backup encryption key..."
        mkdir -p "$(dirname "$BACKUP_KEY_FILE")"
        openssl rand -base64 32 > "$BACKUP_KEY_FILE"
        chmod 600 "$BACKUP_KEY_FILE"
    fi
}

encrypt_backup() {
    local backup_file=$1
    local encrypted_file="${backup_file}.enc"
    
    log "Encrypting backup: $backup_file"
    
    # Encrypt backup using AES-256-CBC
    openssl enc -aes-256-cbc -salt \
        -in "$backup_file" \
        -out "$encrypted_file" \
        -pass file:"$BACKUP_KEY_FILE"
        
    if [ $? -eq 0 ]; then
        log "SUCCESS: Backup encrypted successfully"
        # Replace original with encrypted version
        mv "$encrypted_file" "$backup_file"
        echo "ENCRYPTED" >> "$backup_file"
    else
        log "ERROR: Backup encryption failed"
        rm -f "$encrypted_file"
        return 1
    fi
}

decrypt_backup() {
    local backup_file=$1
    local decrypted_file="${backup_file}.dec"
    
    log "Decrypting backup: $backup_file"
    
    # Remove encryption marker before decryption
    sed -i'' -e '$d' "$backup_file"
    
    # Decrypt backup
    openssl enc -d -aes-256-cbc \
        -in "$backup_file" \
        -out "$decrypted_file" \
        -pass file:"$BACKUP_KEY_FILE"
        
    if [ $? -eq 0 ]; then
        log "SUCCESS: Backup decrypted successfully"
        mv "$decrypted_file" "$backup_file"
    else
        log "ERROR: Backup decryption failed"
        rm -f "$decrypted_file"
        # Restore encryption marker
        echo "ENCRYPTED" >> "$backup_file"
        return 1
    fi
}

main() {
    local command=$1
    local backup_file=$2
    
    if [ -z "$command" ] || [ -z "$backup_file" ]; then
        echo "Usage: $0 {encrypt|decrypt} backup_file"
        exit 1
    fi
    
    # Create log directory if it doesn't exist
    mkdir -p "$(dirname "$LOG_FILE")"
    
    # Ensure encryption key exists
    generate_encryption_key
    
    case "$command" in
        encrypt)
            encrypt_backup "$backup_file"
            ;;
        decrypt)
            decrypt_backup "$backup_file"
            ;;
        *)
            echo "Invalid command. Use 'encrypt' or 'decrypt'"
            exit 1
            ;;
    esac
}

# Execute main function with all arguments
main "$@"
