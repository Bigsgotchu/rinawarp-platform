.PHONY: setup dev test lint build deploy clean

# Development environment setup
setup:
	@echo "Setting up development environment..."
	@chmod +x scripts/setup-dev.sh
	@./scripts/setup-dev.sh

# Start development environment
dev:
	@echo "Starting development environment..."
	@docker-compose -f docker-compose.dev.yml up

# Run tests
test:
	@echo "Running tests..."
	@npm test

# Run linting
lint:
	@echo "Running linter..."
	@npm run lint

# Build for production
build:
	@echo "Building for production..."
	@docker build -t rinawarp:latest .

# Deploy to development environment
deploy-dev:
	@echo "Deploying to development..."
	@ENVIRONMENT=development ./scripts/deploy.sh

# Clean up development environment
clean:
	@echo "Cleaning up development environment..."
	@docker-compose -f docker-compose.dev.yml down -v
	@minikube stop
	@rm -rf node_modules
