#!/bin/bash

set -e # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Load production environment
if [ ! -f .env.production ]; then
    echo -e "${RED}Error: .env.production file not found${NC}"
    exit 1
fi

source .env.production

# Find latest backup
LATEST_BACKUP=$(ls -t backups/backup_before_golive_* 2>/dev/null | head -n1)
if [ -z "$LATEST_BACKUP" ]; then
    echo -e "${RED}Error: No backup found${NC}"
    exit 1
fi

# Confirmation
echo -e "${RED}WARNING: This will rollback the system to the last backup${NC}"
echo -e "Latest backup: ${YELLOW}${LATEST_BACKUP}${NC}"
echo "Are you sure you want to continue? (yes/no)"
read answer
if [ "$answer" != "yes" ]; then
    echo "Aborted."
    exit 1
fi

echo -e "\n${YELLOW}Starting rollback process...${NC}\n"

# 1. Stop the application
echo "Stopping application..."
pm2 stop all

# 2. Restore database backup
echo "Restoring database from backup..."
DATETIME=$(date +%Y%m%d_%H%M%S)
BACKUP_NAME="backup_before_rollback_${DATETIME}.sql"

# Create backup of current state
echo "Creating backup of current state..."
pg_dump $DATABASE_URL > "backups/${BACKUP_NAME}"

# Restore from previous backup
echo "Restoring from backup: ${LATEST_BACKUP}"
psql $DATABASE_URL < "$LATEST_BACKUP"

# 3. Switch to test mode in Stripe
echo "Switching to Stripe test mode..."
# Create a temporary file with test mode keys
sed 's/sk_live_/sk_test_/g; s/pk_live_/pk_test_/g' .env.production > .env.production.tmp
mv .env.production.tmp .env.production

# 4. Run database migrations
echo "Running database migrations..."
npx prisma migrate deploy

# 5. Clean test data
echo "Cleaning test data..."
node scripts/clean-test-data.js

# 6. Rebuild application
echo "Rebuilding application..."
npm run build

# 7. Start application in test mode
echo "Starting application in test mode..."
pm2 reload ecosystem.config.js --env test --update-env

# 8. Run health checks
echo "Running health checks..."
./scripts/health-check.sh

# Create rollback report
REPORT_FILE="rollback_report_${DATETIME}.txt"
echo "Creating rollback report: ${REPORT_FILE}"

cat << EOF > "reports/${REPORT_FILE}"
Rollback Report
==============
Date: $(date)

Rollback Details:
- Original Backup: ${LATEST_BACKUP}
- Pre-rollback Backup: ${BACKUP_NAME}
- Environment: Test Mode
- Node Version: $(node -v)
- Database: $DATABASE_URL

Actions Performed:
✓ Application stopped
✓ Database restored from ${LATEST_BACKUP}
✓ Switched to Stripe test mode
✓ Database migrations applied
✓ Test data cleaned
✓ Application rebuilt
✓ Application started in test mode
✓ Health checks passed

Next Steps:
1. Verify application functionality
2. Test core features
3. Monitor logs for errors
4. Update status page/notify users

To Return to Production:
1. Fix identified issues
2. Run go-live script again
3. Verify production functionality

Backup Locations:
- Pre-rollback backup: backups/${BACKUP_NAME}
- Restored backup: ${LATEST_BACKUP}

Emergency Contacts:
$(cat docs/emergency-contacts.txt 2>/dev/null || echo "No emergency contacts file found")
EOF

# Make scripts executable
chmod +x scripts/*.sh

echo -e "\n${GREEN}Rollback completed successfully!${NC}"
echo -e "Rollback report created: reports/${REPORT_FILE}"
echo -e "\nNext steps:"
echo "1. Verify application is running in test mode"
echo "2. Check logs: pm2 logs"
echo "3. Test core functionality"
echo -e "4. Review rollback report: reports/${REPORT_FILE}\n"
