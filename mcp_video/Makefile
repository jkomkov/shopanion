# MCP Video Service - UV Commands

.PHONY: help install dev run test clean docker

help: ## Show this help message
	@echo "MCP Video Service - Available Commands:"
	@echo "======================================"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-15s\033[0m %s\n", $$1, $$2}'

install: ## Install dependencies with uv
	@echo "📦 Installing dependencies with uv..."
	uv venv
	uv pip install -r requirements.txt
	@echo "✅ Installation complete!"

dev: ## Install development dependencies
	@echo "🛠️  Installing development dependencies..."
	uv pip install -e ".[dev,security]"
	@echo "✅ Development setup complete!"

run: ## Run the service with uv
	@echo "🚀 Starting MCP Video Service..."
	uv run python run.py

start: ## Alternative way to start the service
	@echo "🚀 Starting MCP Video Service with uvicorn..."
	uv run uvicorn app:app --host 0.0.0.0 --port 8002 --reload

test: ## Run tests
	@echo "🧪 Running tests..."
	uv run python test_service.py

health: ## Check service health
	@echo "🏥 Checking service health..."
	curl -s http://localhost:8002/health | python -m json.tool

format: ## Format code with black
	@echo "🎨 Formatting code..."
	uv run black .

lint: ## Lint code with flake8
	@echo "🔍 Linting code..."
	uv run flake8 .

type-check: ## Type check with mypy
	@echo "🔍 Type checking..."
	uv run mypy .

clean: ## Clean up generated files
	@echo "🧹 Cleaning up..."
	rm -rf .venv/
	rm -rf __pycache__/
	rm -rf *.pyc
	rm -rf .mypy_cache/
	rm -rf .pytest_cache/
	@echo "✅ Cleanup complete!"

docker-build: ## Build Docker image
	@echo "🐳 Building Docker image..."
	docker build -t mcp-video .

docker-run: ## Run Docker container
	@echo "🐳 Running Docker container..."
	docker run -p 8002:8002 -e MINIMAX_API_KEY=${MINIMAX_API_KEY} mcp-video

redis: ## Start Redis with Docker
	@echo "🔴 Starting Redis..."
	docker run -d -p 6379:6379 --name mcp-redis redis:alpine

redis-stop: ## Stop Redis container
	@echo "🛑 Stopping Redis..."
	docker stop mcp-redis && docker rm mcp-redis

logs: ## Show service logs (if running in background)
	@echo "📋 Service logs:"
	@tail -f logs/mcp-video.log 2>/dev/null || echo "No log file found. Run service in foreground to see logs."

env-check: ## Check environment setup
	@echo "🔍 Environment Check:"
	@echo "UV version: $$(uv --version 2>/dev/null || echo 'Not installed')"
	@echo "Python version: $$(python --version 2>/dev/null || echo 'Not found')"
	@echo "Redis status: $$(redis-cli ping 2>/dev/null || echo 'Not running')"
	@echo "Root .env file: $$([ -f ../.env ] && echo 'Found' || echo 'Not found')"
	@echo "MINIMAX_API_KEY: $$([ -n "$$MINIMAX_API_KEY" ] && echo 'Set' || echo 'Not set')"

setup: ## Complete setup (install uv, dependencies, check env)
	@echo "🔧 Complete setup..."
	@command -v uv >/dev/null 2>&1 || (echo "Installing uv..." && curl -LsSf https://astral.sh/uv/install.sh | sh)
	@make install
	@make env-check
	@echo "✅ Setup complete! Run 'make run' to start the service."
