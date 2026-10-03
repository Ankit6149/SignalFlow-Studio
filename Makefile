.PHONY: dev build test fmt

dev:
	cd frontend && npm run dev

build:
	cd frontend && npm run build

test:
	cd frontend && npm test
	cd mcp && npm test
	pytest -q

fmt:
	@echo "Formatting is intentionally tool-specific; no repository-wide formatter is configured."
