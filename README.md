# Multi-Language Microservices E-Commerce Platform

Term project for **SFWE415 (Spring 2026)**.  
This repository implements an end-to-end e-commerce platform using a microservices architecture, with each core domain in a different language/runtime.

## Architecture

- **Frontend (`frontend-app`)**: React + TypeScript (Vite)
- **API Gateway (`gateway`)**: Node.js + Express + TypeScript
- **User Service (`services/user-service`)**: Node.js + Express + MongoDB
- **Product Service (`services/product-service`)**: Python + FastAPI + PostgreSQL + Elasticsearch
- **Order Service (`services/order-service`)**: Java + Spring Boot + MySQL
- **Infrastructure (`infra`)**: Docker Compose (MongoDB, PostgreSQL, MySQL, RabbitMQ, Elasticsearch)

## Implemented Capabilities

- Authentication and profile management
- Product catalog and category browsing with page-based pagination
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
- Customer order shipment timeline (placed / paid / shipped / delivered)
- Promotions engine (admin-managed and paginated rules):
  - expiry, usage limits, min basket, category-scoped discounts
- Shipment updates (admin)
- Order analytics (RabbitMQ `order.placed` → MongoDB projection → admin dashboard)
- Observability and reliability:
  - propagated `X-Request-Id` across gateway and services
  - structured JSON request logs
  - durable RabbitMQ `order.placed` queue with `order.placed.dlq`
- Notification center:
  - in-app notifications
  - filters and unread counts
  - mark read / clear actions
- Admin panel:
  - products, orders, users, reviews, promotions, and audit logs with page-based pagination
  - users (search, role/activation updates, delete)
  - global review moderation (delete + force edit)
  - promotions management
  - order analytics (revenue, daily orders, top customers)
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
   - `frontend-app`: `npm run dev`
3. Seed demo data (from repo root):
   - Products (with product-service running): `python scripts/seed_products.py`
     – 55 products across 10 categories, with images and sample reviews.
   - Users (with MongoDB running): `node scripts/seed_users.js`
     – 1 admin + 14 customers + 1 inactive account.
     – Admin: `admin@shop.test` / `Admin123!`
     – Customers: `*@example.com` / `Password123!`

## Environment Notes

- `JWT_SECRET` must match between:
  - `services/user-service/.env`
  - `gateway/.env`
- Optional for admin analytics: set `RABBIT_URL=amqp://guest:guest@localhost:5672` in user-service `.env`, and start order-service with the `rabbit` profile so `order.placed` events are consumed.
- Existing local RabbitMQ queues created before the durable queue change may need to be deleted from the RabbitMQ UI (`http://localhost:15672`) or recreated by restarting the RabbitMQ container.
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
