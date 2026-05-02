# Advanced Commerce Roadmap

This document lists advanced features to implement after the core platform.

## Implemented in this phase

- Elasticsearch-backed product search with SQL fallback.
- Search index synchronization on product create/update/delete.
- Manual reindex endpoint: `POST /api/products/search/reindex`.
- Promo-code discounts at checkout (`WELCOME10`, `SAVE20`, `VIP30`).
- Inventory reservation during checkout with rollback on order-creation failure.
- Product service inventory endpoints:
  - `POST /api/products/reserve`
  - `POST /api/products/release`
- Simulated payment lifecycle:
  - Create payment intent: `POST /api/orders/{id}/payment-intent`
  - Payment webhook confirmation: `POST /api/orders/{id}/payment-webhook`
  - Order transitions to `PAID` on successful payment confirmation.
- Recommendations:
  - Product-service endpoint: `GET /api/products/recommendations`
  - Landing page "Recommended for you" section
  - Product detail "Related products" section

## Next prioritized features

1. Shipping workflow
- Add shipping address, shipment tracking ID, and status mapping (`SHIPPED`, `DELIVERED`).

2. Event consumers and projections
- Consume `order_placed` from RabbitMQ to build analytics/read models.
- Maintain search projections and low-latency dashboards.

3. Promotions engine (v2)
- Expiration windows, usage limits, category-scoped discounts, and minimum basket value rules.

4. Observability and reliability
- Distributed tracing, structured logs, alerting, dead-letter queues, retry policies.

## Suggested implementation order

1) Shipping workflow
2) Event consumers/projections
3) Promotions engine v2
4) Observability hardening

