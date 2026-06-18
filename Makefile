.PHONY: help init-env sanitize-template up up-quicktunnel up-tunnel down logs-app quicktunnel-url

COMPOSE := docker compose
PPTX ?= templates/default.pptx
SANITIZE_ARGS ?=

help:
	@echo "Available targets:"
	@echo "  make init-env        Create .env from .env.example if missing"
	@echo "  make sanitize-template PPTX=path/to/template.pptx"
	@echo "  make sanitize-template PPTX=path/to/template.pptx SANITIZE_ARGS='--password ...'"
	@echo "                       Remove template metadata and validate the AI_* contract"
	@echo "  make up              Start the local app stack on 127.0.0.1:13001"
	@echo "  make up-quicktunnel  Start the app plus an ephemeral Cloudflare Quick Tunnel"
	@echo "  make up-tunnel       Start the app plus a named Cloudflare Tunnel"
	@echo "  make down            Stop and remove the compose stack"
	@echo "  make logs-app        Follow logs for the app service"
	@echo "  make quicktunnel-url Print the current Quick Tunnel URL from logs"

init-env:
	@if [ ! -f .env ]; then cp .env.example .env; echo "Created .env from .env.example"; else echo ".env already exists"; fi

sanitize-template:
	uv run python scripts/sanitize_pptx_template.py "$(PPTX)" $(SANITIZE_ARGS)

up:
	$(COMPOSE) up -d --build

up-quicktunnel:
	$(COMPOSE) --profile quicktunnel up -d --build

up-tunnel:
	$(COMPOSE) --profile tunnel up -d --build

down:
	$(COMPOSE) down

logs-app:
	$(COMPOSE) logs -f app

quicktunnel-url:
	@$(COMPOSE) logs quicktunnel | grep -Eo 'https://[-a-z0-9]+\.trycloudflare\.com' | tail -n 1
