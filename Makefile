# ──────────────────────────────────────────────────────────────
# Kinora — Makefile
# Wraps pnpm scripts and common dev workflows.
# Usage:  make <target>   (run `make help` for a list)
# ──────────────────────────────────────────────────────────────

.DEFAULT_GOAL := help
SHELL := /bin/zsh

# ── Core ─────────────────────────────────────────────────────

.PHONY: install
install: ## Install dependencies via pnpm
	pnpm install

.PHONY: dev
dev: ## Start Next.js dev server
	pnpm dev

.PHONY: build
build: ## Production build
	pnpm build

.PHONY: start
start: ## Start production server (requires `make build` first)
	pnpm start

# ── Quality ──────────────────────────────────────────────────

.PHONY: lint
lint: ## Run ESLint
	pnpm lint

.PHONY: typecheck
typecheck: ## Run TypeScript type checking (tsc --noEmit)
	pnpm typecheck

.PHONY: format
format: ## Format code with Prettier
	pnpm format

.PHONY: check
check: typecheck lint ## Run typecheck + lint (pre-commit gate)

# ── Tests ────────────────────────────────────────────────────

.PHONY: test
test: ## Run tests once (vitest run)
	pnpm test

.PHONY: test-watch
test-watch: ## Run tests in watch mode
	pnpm test:watch

# ── Database ─────────────────────────────────────────────────

.PHONY: db-generate
db-generate: ## Generate Drizzle migration files from schema changes
	pnpm db:generate

.PHONY: db-migrate
db-migrate: ## Apply pending migrations to the database
	pnpm db:migrate

.PHONY: db-studio
db-studio: ## Open Drizzle Studio (visual DB browser)
	pnpm db:studio

.PHONY: db-seed
db-seed: ## Seed effect presets
	pnpm db:seed

.PHONY: db-setup
db-setup: db-migrate db-seed ## Migrate + seed in one step

# ── Seeding ──────────────────────────────────────────────────

.PHONY: seed-demo
seed-demo: ## Seed demo content (explore feed, sample jobs, etc.)
	pnpm seed:demo

# ── Setup ────────────────────────────────────────────────────

.PHONY: setup
setup: install db-setup ## Full local setup: install deps → migrate → seed

.PHONY: env
env: ## Copy .env.example → .env.local (won't overwrite)
	@if [ -f .env.local ]; then \
		echo "⚠  .env.local already exists — skipping."; \
	else \
		cp .env.example .env.local; \
		echo "✔  Created .env.local from .env.example — fill in your secrets."; \
	fi

# ── Clean ────────────────────────────────────────────────────

.PHONY: clean
clean: ## Remove build artifacts (.next, tsconfig.tsbuildinfo)
	rm -rf .next tsconfig.tsbuildinfo

.PHONY: clean-all
clean-all: clean ## Remove build artifacts + node_modules
	rm -rf node_modules

# ── CI ───────────────────────────────────────────────────────

.PHONY: ci
ci: install check test build ## Full CI pipeline: install → check → test → build

# ── Help ─────────────────────────────────────────────────────

.PHONY: help
help: ## Show this help message
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2}'
