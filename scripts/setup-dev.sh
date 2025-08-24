#!/bin/bash
set -e

echo "🚀 Setting up development environment..."

# Check for required tools
REQUIRED_TOOLS=(
  "docker"
  "docker-compose"
  "kubectl"
  "minikube"
  "helm"
)

echo "🔍 Checking required tools..."
for tool in "${REQUIRED_TOOLS[@]}"; do
  if ! command -v "$tool" &> /dev/null; then
    echo "❌ $tool is not installed"
    case $tool in
      "docker")
        echo "Please install Docker Desktop from https://www.docker.com/products/docker-desktop"
        ;;
      "kubectl")
        echo "Please install kubectl: brew install kubectl"
        ;;
      "minikube")
        echo "Please install minikube: brew install minikube"
        ;;
      "helm")
        echo "Please install helm: brew install helm"
        ;;
    esac
    exit 1
  fi
  echo "✅ $tool is installed"
done

# Start Minikube if not running
if ! minikube status &>/dev/null; then
  echo "🔄 Starting Minikube cluster..."
  minikube start --memory=4096 --cpus=2
else
  echo "✅ Minikube is running"
fi

# Enable required Minikube addons
echo "🔌 Enabling Minikube addons..."
minikube addons enable ingress
minikube addons enable metrics-server

# Create development namespace if it doesn't exist
echo "🔧 Setting up Kubernetes namespace..."
kubectl create namespace development --dry-run=client -o yaml | kubectl apply -f -

# Setup environment variables
echo "📝 Creating environment variables file..."
cat > .env.development << EOL
# Application
NODE_ENV=development
PORT=3000

# Database
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=rinawarp_dev
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# JWT
JWT_SECRET=dev-jwt-secret
COOKIE_SECRET=dev-cookie-secret
EOL

# Create SSL certificates for local development
if [ ! -d "./certs" ]; then
  echo "🔒 Generating SSL certificates for local development..."
  mkdir -p certs
  openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout certs/dev.key -out certs/dev.crt \
    -subj "/C=US/ST=State/L=City/O=Organization/CN=localhost"
fi

# Start development services with Docker Compose
echo "🐳 Starting development services..."
docker-compose -f docker-compose.dev.yml up -d

# Wait for services to be ready
echo "⏳ Waiting for services to be ready..."
sleep 10

# Setup database
echo "💾 Setting up database..."
docker-compose -f docker-compose.dev.yml exec -T postgres psql -U postgres -c "CREATE DATABASE rinawarp_dev;" || true

# Run database migrations
if [ -f "./prisma/schema.prisma" ]; then
  echo "🔄 Running database migrations..."
  npx prisma migrate dev
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install

echo "✨ Development environment setup complete!"
echo "
🌟 Next steps:
1. Start the development server: npm run dev
2. Visit https://localhost:3000
3. Access services:
   - Database UI: http://localhost:8080
   - MailHog UI: http://localhost:8025
   - Prometheus: http://localhost:9090
   - Grafana: http://localhost:3001
"
