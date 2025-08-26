#!/bin/bash
set -e

echo "🚀 Installing Rinawarp Platform..."

# Check prerequisites
command -v node >/dev/null 2>&1 || { echo "❌ Node.js is required but not installed. Aborting." >&2; exit 1; }
command -v npm >/dev/null 2>&1 || { echo "❌ npm is required but not installed. Aborting." >&2; exit 1; }
command -v pm2 >/dev/null 2>&1 || { echo "⚙️ Installing PM2 globally..." && npm install -g pm2; }

# Create .env if it doesn't exist
if [ ! -f .env ]; then
    echo "📝 Creating default .env file..."
    cat > .env << EOL
NODE_ENV=development
API_PORT=3000
API_HOST=localhost
REDIS_HOST=localhost
REDIS_PORT=6379
EOL
fi

# Clean install in each package
echo "📦 Installing dependencies..."
PACKAGES=("shared" "core" "terminal" "api")

for pkg in "${PACKAGES[@]}"; do
    echo "📦 Installing $pkg package..."
    cd "packages/$pkg"
    rm -rf node_modules package-lock.json
    npm install
    cd ../..
done

# Clean all previous builds
echo "🧹 Cleaning previous builds..."
rm -rf packages/*/dist packages/*/tsconfig.tsbuildinfo

# Build packages in order
echo "🔨 Building packages..."
for pkg in "${PACKAGES[@]}"; do
    echo "🔨 Building $pkg..."
    cd "packages/$pkg"
    npm run build
    cd ../..
done

# Start API with PM2
echo "🚀 Starting API..."
./setup-api.sh

echo "✅ Installation complete!"
echo "🌐 API is running at http://localhost:3000"
echo "💡 Run 'pm2 logs rinawarp-api' to see logs"
echo "💡 Run 'pm2 stop rinawarp-api' to stop the API"
