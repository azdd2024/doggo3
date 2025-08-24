# DOGGO Platform Makefile
.PHONY: help install setup dev build start clean test lint docker-up docker-down deploy

# Default target
help: ## Show this help message
	@echo "🐕 DOGGO Platform Commands"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

# Development commands
install: ## Install all dependencies
	@echo "📦 Installing dependencies..."
	npm install

setup: ## Complete setup with infrastructure
	@echo "🚀 Running complete setup..."
	chmod +x scripts/setup.sh && ./scripts/setup.sh

dev: ## Start development servers
	@echo "🛠️  Starting development servers..."
	npm run dev

build: ## Build all packages and apps
	@echo "🔨 Building all packages and apps..."
	npm run build

start: ## Start production servers
	@echo "🚀 Starting production servers..."
	npm run start

# Database commands
db-setup: ## Setup database with schema and seed data
	@echo "🗄️  Setting up database..."
	npm run db:generate
	npm run db:push
	npm run db:seed

db-reset: ## Reset database and reseed
	@echo "🔄 Resetting database..."
	docker-compose down postgres
	docker-compose up -d postgres
	sleep 10
	npm run db:push
	npm run db:seed

db-studio: ## Open Prisma Studio
	@echo "🔍 Opening Prisma Studio..."
	npm run db:studio

# Infrastructure commands
docker-up: ## Start Docker infrastructure
	@echo "🐳 Starting Docker containers..."
	docker-compose up -d

docker-down: ## Stop Docker infrastructure
	@echo "🛑 Stopping Docker containers..."
	docker-compose down

docker-logs: ## Show Docker logs
	@echo "📋 Docker logs..."
	docker-compose logs -f

docker-clean: ## Clean Docker volumes and containers
	@echo "🧹 Cleaning Docker..."
	docker-compose down -v
	docker system prune -f

# Testing commands
test: ## Run all tests
	@echo "🧪 Running tests..."
	npm run test

lint: ## Run linting
	@echo "🔍 Running linter..."
	npm run lint

type-check: ## Run TypeScript type checking
	@echo "📝 Type checking..."
	npm run type-check

# Cleaning commands
clean: ## Clean build artifacts
	@echo "🧹 Cleaning build artifacts..."
	npm run clean
	rm -rf node_modules/.cache

clean-all: ## Clean everything including node_modules
	@echo "🧹 Deep cleaning..."
	npm run clean
	rm -rf node_modules
	rm -rf apps/*/node_modules
	rm -rf packages/*/node_modules

# Deployment commands
deploy-railway: ## Deploy to Railway
	@echo "🚀 Deploying to Railway..."
	railway up

deploy-render: ## Deploy to Render (via git push)
	@echo "🚀 Deploying to Render..."
	git push origin main

# Monitoring commands
logs: ## Show application logs
	@echo "📋 Application logs..."
	docker-compose logs -f cms web

health: ## Check application health
	@echo "🏥 Checking application health..."
	curl -f http://localhost:3000/health || echo "Backend not responding"
	curl -f http://localhost:3001/api/health || echo "Frontend not responding"

# Backup commands
backup-db: ## Backup database
	@echo "💾 Backing up database..."
	docker-compose exec postgres pg_dump -U doggo_user doggo > backup_$(shell date +%Y%m%d_%H%M%S).sql

restore-db: ## Restore database from backup (requires BACKUP_FILE variable)
	@echo "📥 Restoring database..."
	@if [ -z "$(BACKUP_FILE)" ]; then echo "❌ Please specify BACKUP_FILE=path/to/backup.sql"; exit 1; fi
	docker-compose exec -T postgres psql -U doggo_user -d doggo < $(BACKUP_FILE)

# Security commands
security-audit: ## Run security audit
	@echo "🔒 Running security audit..."
	npm audit
	npm audit fix

update-deps: ## Update dependencies
	@echo "📦 Updating dependencies..."
	npm update
	npm run build

# Performance commands
analyze: ## Analyze bundle size
	@echo "📊 Analyzing bundle size..."
	ANALYZE=true npm run build --workspace=apps/web

benchmark: ## Run performance benchmarks
	@echo "⚡ Running benchmarks..."
	@echo "TODO: Implement performance benchmarks"

# Development utilities
generate-types: ## Generate TypeScript types
	@echo "📝 Generating types..."
	npm run db:generate

check-env: ## Check environment configuration
	@echo "🔍 Checking environment..."
	@if [ ! -f .env ]; then echo "❌ .env file not found. Copy .env.example to .env"; exit 1; fi
	@echo "✅ Environment file exists"
	@node -e "console.log('Node.js version:', process.version)"
	@docker --version || echo "❌ Docker not found"
	@docker-compose --version || echo "❌ Docker Compose not found"

quick-start: install docker-up db-setup dev ## Quick start (install + setup + dev)

production-setup: install build docker-up db-setup ## Production setup

# Git hooks
pre-commit: lint type-check ## Pre-commit checks
	@echo "✅ Pre-commit checks passed"

# Documentation
docs: ## Generate documentation
	@echo "📚 Generating documentation..."
	@echo "TODO: Implement documentation generation"

# Mobile app helpers
flutter-types: ## Generate types for Flutter app
	@echo "📱 Generating Flutter types..."
	@echo "TODO: Generate Dart types from TypeScript"

api-docs: ## Generate API documentation
	@echo "📖 Generating API docs..."
	@echo "TODO: Generate OpenAPI documentation"