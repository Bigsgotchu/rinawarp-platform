#!/bin/bash

# Configuration
LOG_DIR="/var/log/rinawarp-security"
AUDIT_LOG="$LOG_DIR/security-audit.log"
ALERT_EMAIL="security@rinawarp.com"

# Create log directory if it doesn't exist
mkdir -p "$LOG_DIR"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$AUDIT_LOG"
}

send_alert() {
    local subject="$1"
    local message="$2"
    echo "$message" | mail -s "$subject" "$ALERT_EMAIL"
}

check_dependencies() {
    log "Checking npm dependencies for vulnerabilities"
    
    # Run npm audit
    npm audit
    if [ $? -ne 0 ]; then
        send_alert "Security Vulnerability Found" "npm audit detected vulnerabilities"
        log "WARNING: npm audit detected vulnerabilities"
    fi
    
    # Check for outdated packages
    npm outdated
}

check_file_permissions() {
    log "Checking file permissions"
    
    # Check sensitive files
    find . -type f -name "*.env*" -not -path "*/node_modules/*" -ls
    find . -type f -name "*config*.js" -not -path "*/node_modules/*" -ls
    
    # Check for world-writable files
    world_writable=$(find . -type f -perm -002 -not -path "*/node_modules/*" -ls)
    if [ -n "$world_writable" ]; then
        log "WARNING: Found world-writable files:"
        echo "$world_writable" | tee -a "$AUDIT_LOG"
    fi
}

check_env_files() {
    log "Checking environment files"
    
    # Check for unencrypted sensitive files
    env_files=$(find . -type f -name "*.env*" -not -path "*/node_modules/*")
    for file in $env_files; do
        if [ -r "$file" ]; then
            log "WARNING: Readable .env file found: $file"
        fi
    done
}

check_git_security() {
    log "Checking git security"
    
    # Check for sensitive files in git history
    git log -p | grep -i "password\|secret\|key\|token" || true
    
    # Check for untracked sensitive files
    git status --porcelain | grep ".env" || true
}

check_ssl_certificates() {
    log "Checking SSL certificates"
    
    # Check certificate expiration
    for cert in ./nginx/ssl/*.pem; do
        if [ -f "$cert" ]; then
            expiry=$(openssl x509 -enddate -noout -in "$cert" | cut -d= -f2)
            log "Certificate $cert expires: $expiry"
        fi
    done
}

check_api_security() {
    log "Checking API security configuration"
    
    # Check rate limiting configuration
    if grep -r "rate-limit" . --include="*.js" --include="*.ts"; then
        log "Rate limiting found in configuration"
    else
        log "WARNING: No rate limiting configuration found"
    fi
    
    # Check CORS configuration
    if grep -r "cors" . --include="*.js" --include="*.ts"; then
        log "CORS configuration found"
    else
        log "WARNING: No CORS configuration found"
    fi
}

check_docker_security() {
    log "Checking Docker security"
    
    # Check Dockerfile security
    if [ -f "Dockerfile" ]; then
        # Check if running as non-root
        if ! grep -q "USER" Dockerfile; then
            log "WARNING: Dockerfile doesn't specify non-root user"
        fi
        
        # Check for latest tag usage
        if grep -q "latest" Dockerfile; then
            log "WARNING: Dockerfile uses 'latest' tag"
        fi
    fi
    
    # Check Docker Compose security
    if [ -f "docker-compose.yml" ]; then
        # Check for exposed ports
        exposed_ports=$(grep -A1 "ports:" docker-compose.yml)
        log "Exposed ports in docker-compose.yml:"
        echo "$exposed_ports" | tee -a "$AUDIT_LOG"
    fi
}

main() {
    log "Starting security audit"
    
    # Run all checks
    check_dependencies
    check_file_permissions
    check_env_files
    check_git_security
    check_ssl_certificates
    check_api_security
    check_docker_security
    
    log "Security audit completed"
}

# Execute main function
main
