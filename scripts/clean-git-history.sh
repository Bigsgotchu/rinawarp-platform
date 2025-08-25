#!/bin/bash

# This script removes sensitive data from git history

# List of patterns to remove (add more as needed)
PATTERNS=(
    "password[=\"':][^\"']*[\"']"
    "secret[=\"':][^\"']*[\"']"
    "key[=\"':][^\"']*[\"']"
    "token[=\"':][^\"']*[\"']"
    "DATABASE_URL=.*"
    "REDIS_URL=.*"
    "postgres://.*"
    "redis://.*"
)

# Function to create filter-branch command
create_filter_command() {
    local command="git filter-branch --force --index-filter \""
    
    for pattern in "${PATTERNS[@]}"; do
        command+="git ls-files -z | xargs -0 perl -pi -e 's/$pattern/REDACTED/g' ;"
    done
    
    command+="\" --prune-empty --tag-name-filter cat -- --all"
    echo "$command"
}

# Main cleanup process
echo "Starting git history cleanup..."

# Create backup
git branch backup/sensitive-data

# Run filter-branch command
eval "$(create_filter_command)"

# Force push changes
echo "Cleaning complete. Please review the changes and then force push with:"
echo "git push origin --force --all"
echo ""
echo "To push tags:"
echo "git push origin --force --tags"
echo ""
echo "WARNING: This will rewrite history. Make sure all team members are aware."
echo "They will need to delete and re-clone the repository after the push."
