# Multi-Language Microservices E-Commerce Platform

Term project for **SFWE415 (Spring 2026)**.  
This repository implements an end-to-end e-commerce platform using a microservices architecture, with each core domain in a different language/runtime.

## Architecture

- **Frontend (`frontend/frontend-app`)**: React + TypeScript (Vite)
- **API Gateway (`gateway`)**: Node.js + Express + TypeScript
- **User Service (`services/user-service`)**: Node.js + Express + MongoDB
- **Product Service (`services/product-service`)**: Python + FastAPI + PostgreSQL + Elasticsearch
- **Order Service (`services/order-service`)**: Java + Spring Boot + MySQL
- **Infrastructure (`infra`)**: Docker Compose (MongoDB, PostgreSQL, MySQL, RabbitMQ, Elasticsearch)

## Implemented Capabilities

- Authentication and profile management
- Product catalog and category browsing
- Product reviews and ratings:
  - create/edit/delete own reviews
  - verified purchase badges
  - sorting, pagination, total count
  - helpful votes with duplicate-vote protection
- Wishlist
- Personalized home experience:
  - recommended products
  - recently viewed
- Orders and payment simulation
- Promotions engine (admin-managed rules)
- Shipment updates (admin)
- Notification center:
  - in-app notifications
  - filters and unread counts
  - mark read / clear actions
- Admin panel:
  - users (search, pagination, role/activation updates, delete)
  - global review moderation (delete + force edit)
  - promotions management
  - ops overview (service health)
  - basic audit logs

## Quick Start

Detailed instructions are in `HOW-TO-RUN.txt`.  
Fast path:

1. Start infra:
   - `docker compose -f infra/docker-compose.yml up -d`
2. Start services:
   - `services/user-service`: `npm run dev`
   - `services/product-service`: `python -m uvicorn app.main:app --reload --port 5001`
   - `services/order-service`: `mvnw.cmd spring-boot:run` (Windows) or `./mvnw spring-boot:run`
   - `gateway`: `npm run dev`
   - `frontend/frontend-app`: `npm run dev`

## Environment Notes

- `JWT_SECRET` must match between:
  - `services/user-service/.env`
  - `gateway/.env`
- Example env files are provided (`.env.example` where available).
- Do not commit real secrets; keep `.env` local.

## Repository Notes

- Root `.gitignore` is configured for:
  - Node.js, Python, Java/Maven artifacts
  - local env files and secrets
  - IDE/editor and OS-generated files
- CI workflow lives under `.github/workflows/`.

## Health / Dev Endpoints

- Gateway: `http://localhost:4000/health`
- User service: `http://localhost:4001/health`
- Product service: `http://localhost:5001/health`
- Product docs: `http://localhost:5001/docs`
- Order service: `http://localhost:8080/health`
