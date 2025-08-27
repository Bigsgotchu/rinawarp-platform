#!/bin/bash

# Exit on error
set -e

echo "🚀 Starting deployment process..."

# Check if we're on the main branch
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ "$CURRENT_BRANCH" != "main" ]; then
    echo "❌ Must be on main branch to deploy"
    exit 1
fi

# Check if working directory is clean
if [ -n "$(git status --porcelain)" ]; then
    echo "❌ Working directory not clean. Please commit or stash changes."
    exit 1
fi

# Pull latest changes
echo "📥 Pulling latest changes..."
git pull origin main

# Install dependencies
echo "📦 Installing dependencies..."
npm ci

# Run tests
echo "🧪 Skipping tests (not configured)..."

# Build the application
echo "🏗️ Building application..."
npm run build

# Skip type checking and linting for now
echo "✅ Skipping type checks and linting (not configured)..."

# Check environment variables
echo "🔍 Checking environment variables..."
if [ ! -f .env ]; then
    echo "❌ .env file not found"
    echo "Please create .env file from .env.template"
    exit 1
fi

# Deploy to production
echo "🚀 Deploying to production..."
npm run deploy:prod

echo "✨ Deployment completed successfully!"
