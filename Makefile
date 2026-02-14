.PHONY: help install dev dev-frontend dev-backend build docker-build docker-up docker-down test clean

help:
	@echo "AWS Labs Platform - Available Commands"
	@echo ""
	@echo "Setup:"
	@echo "  make install        - Install all dependencies (frontend + backend)"
	@echo "  make setup          - Run install and create .env files"
	@echo ""
	@echo "Development:"
	@echo "  make dev            - Start both frontend and backend"
	@echo "  make dev-frontend   - Start frontend only (http://localhost:3000)"
	@echo "  make dev-backend    - Start backend only (http://localhost:3001)"
	@echo ""
	@echo "Building:"
	@echo "  make build          - Build frontend and backend"
	@echo "  make build-frontend - Build frontend only"
	@echo "  make build-backend  - Build backend only"
	@echo ""
	@echo "Docker:"
	@echo "  make docker-build   - Build Docker images"
	@echo "  make docker-up      - Start services with Docker Compose"
	@echo "  make docker-down    - Stop Docker Compose services"
	@echo "  make docker-logs    - View Docker logs"
	@echo ""
	@echo "Utilities:"
	@echo "  make test           - Test backend API"
	@echo "  make clean          - Remove build artifacts"
	@echo "  make format         - Format code with Biome"

install:
	@echo "Installing frontend..."
	npm install
	@echo "Installing backend..."
	cd backend && npm install

setup: install
	@echo "Creating environment files..."
	@if [ ! -f .env.local ]; then \
		echo "NEXT_PUBLIC_BACKEND_URL=http://localhost:3001" > .env.local; \
		echo "Created .env.local"; \
	fi
	@if [ ! -f backend/.env ]; then \
		cp backend/.env.example backend/.env; \
		echo "Created backend/.env from .env.example"; \
		echo "⚠️  Please update backend/.env with your configuration"; \
	fi

dev:
	@echo "Starting frontend and backend..."
	@echo "Frontend will run on http://localhost:3000"
	@echo "Backend will run on http://localhost:3001"
	@echo ""
	@echo "Run in separate terminals:"
	@echo "  Terminal 1: make dev-frontend"
	@echo "  Terminal 2: make dev-backend"
	@echo ""
	@echo "Or run both together (requires tmux or similar):"
	tmux new-session -d -s aws-labs; \
	tmux send-keys -t aws-labs 'npm run dev' Enter; \
	tmux split-window -t aws-labs -h -c backend; \
	tmux send-keys -t aws-labs 'npm run dev' Enter; \
	tmux attach -t aws-labs

dev-frontend:
	npm run dev

dev-backend:
	cd backend && npm run dev

build: build-frontend build-backend
	@echo "✅ Build complete"

build-frontend:
	@echo "Building frontend..."
	npm run build

build-backend:
	@echo "Building backend..."
	cd backend && npm run build

docker-build:
	@echo "Building Docker images..."
	docker-compose build

docker-up:
	@echo "Starting Docker services..."
	docker-compose up -d
	@echo "✅ Services started"
	@echo "Frontend:  http://localhost:3000"
	@echo "Backend:   http://localhost:3001"
	@echo ""
	@echo "View logs: make docker-logs"
	@echo "Stop:      make docker-down"

docker-down:
	@echo "Stopping Docker services..."
	docker-compose down

docker-logs:
	docker-compose logs -f

test:
	@echo "Testing backend health..."
	@curl -s http://localhost:3001/health | jq . || echo "Backend not running. Start with: make dev-backend"

test-lab-start:
	@echo "Testing lab start endpoint..."
	@curl -X POST http://localhost:3001/api/labs/start \
		-H "Content-Type: application/json" \
		-d '{"userId":"test-user","labId":"lab-1-s3","purchaseId":"test-123","token":"demo-token"}' \
		| jq . || echo "Backend not running"

clean:
	@echo "Cleaning up..."
	rm -rf .next
	rm -rf backend/dist
	rm -rf node_modules
	rm -rf backend/node_modules
	find . -name ".DS_Store" -delete
	@echo "✅ Clean complete"

format:
	@echo "Formatting code..."
	npx biome format --write . || echo "Biome not installed"

lint:
	@echo "Linting code..."
	npm run lint || echo "Lint script not configured"

# Development helpers
logs-frontend:
	docker-compose logs -f frontend

logs-backend:
	docker-compose logs -f backend

shell-backend:
	docker-compose exec backend sh

ps:
	@echo "Running services:"
	@docker-compose ps

# AWS utilities
aws-health:
	@echo "Checking AWS credentials..."
	@aws sts get-caller-identity || echo "AWS credentials not configured"

aws-control-tower:
	@echo "Checking AWS Control Tower status..."
	@aws controltower list-landing-zones || echo "Control Tower not accessible"

# Quick start
demo: setup dev-backend dev-frontend

# Production
prod-build: build docker-build

prod-deploy:
	@echo "Deploying to production..."
	@echo "Make sure docker-compose.yml is configured with production settings"
	docker-compose -f docker-compose.yml up -d

# Documentation
docs:
	@echo "AWS Labs Platform Documentation"
	@echo ""
	@echo "Quick Start: cat QUICKSTART.md"
	@echo "Deployment: cat DEPLOYMENT.md"
	@echo "AWS Setup:  cat AWS_SETUP_GUIDE.md"
	@echo "Architecture: cat ARCHITECTURE.md"
	@echo "Overview:   cat README.md"

# Status check
status:
	@echo "AWS Labs Platform Status"
	@echo ""
	@echo "Frontend:"
	@curl -s http://localhost:3000 > /dev/null && echo "✅ Running (http://localhost:3000)" || echo "❌ Not running"
	@echo ""
	@echo "Backend:"
	@curl -s http://localhost:3001/health > /dev/null && echo "✅ Running (http://localhost:3001)" || echo "❌ Not running"
	@echo ""
	@echo "Docker services:"
	@docker-compose ps || echo "Docker not running"

# .PHONY targets for commands that don't create files
.PHONY: help install setup dev dev-frontend dev-backend build build-frontend build-backend
.PHONY: docker-build docker-up docker-down docker-logs test clean format lint
.PHONY: logs-frontend logs-backend shell-backend ps aws-health aws-control-tower
.PHONY: demo prod-build prod-deploy docs status test-lab-start
