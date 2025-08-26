#!/bin/bash
# install-rinawarp.sh — Install RinaWarp Terminal with PM2 on macOS

set -e

echo "🔧 Installing RinaWarp Terminal..."

PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"
TERMINAL_EXECUTABLE="rinawarp"  # command to launch terminal

# -----------------------------
# STEP 1: Clean previous builds
# -----------------------------
echo "🧹 Cleaning previous build outputs..."
npm run clean

# -----------------------------
# STEP 2: Install dependencies and generate Prisma client
# -----------------------------
echo "📦 Installing root dependencies..."
npm install

echo "📦 Generating Prisma client..."
npx prisma generate

# -----------------------------
# STEP 3: Build packages in order
# -----------------------------
echo "📦 Building shared..."
cd "$PROJECT_ROOT/packages/shared" && npm install && npm run build

echo "📦 Building core..."
cd "$PROJECT_ROOT/packages/core" && npm install && npm run build

echo "📦 Building terminal..."
cd "$PROJECT_ROOT/packages/terminal" && npm install && npm run build

echo "📦 Building API..."
cd "$PROJECT_ROOT/packages/api" && npm install && npm run build

# -----------------------------
# STEP 4: Install terminal globally
# -----------------------------
if [ ! -f "$PROJECT_ROOT/packages/terminal/dist/index.js" ]; then
    echo "❌ Terminal build not found at $PROJECT_ROOT/packages/terminal/dist/index.js"
    exit 1
fi

echo "🚀 Installing terminal globally..."
sudo cp "$PROJECT_ROOT/packages/terminal/dist/index.js" /usr/local/bin/$TERMINAL_EXECUTABLE
sudo chmod +x /usr/local/bin/$TERMINAL_EXECUTABLE

# -----------------------------
# STEP 5: Install PM2 if missing
# -----------------------------
if ! command -v pm2 &> /dev/null; then
    echo "📦 Installing PM2..."
    npm install -g pm2
fi

# -----------------------------
# STEP 6: Start API with PM2
# -----------------------------
if [ ! -f "$PROJECT_ROOT/packages/api/dist/index.js" ]; then
    echo "❌ API build not found at $PROJECT_ROOT/packages/api/dist/index.js"
    exit 1
fi

echo "🚀 Starting API with PM2..."
pm2 start "$PROJECT_ROOT/packages/api/dist/index.js" --name rinawarp-api
pm2 save

# -----------------------------
# STEP 7: Done
# -----------------------------
echo "✅ RinaWarp Terminal installed with PM2 backend!"
echo "You can now run: $TERMINAL_EXECUTABLE"
echo "API is running in the background as 'rinawarp-api'."
echo "Use 'pm2 status' to check, 'pm2 logs rinawarp-api' to view logs."
