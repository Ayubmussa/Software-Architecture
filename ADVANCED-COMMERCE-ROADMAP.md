# Advanced Commerce Roadmap

This document lists advanced features to implement after the core platform.

## Implemented in this phase

- Elasticsearch-backed product search with SQL fallback.
- Search index synchronization on product create/update/delete.
- Manual reindex endpoint: `POST /api/products/search/reindex`.
- Promo-code discounts at checkout (`WELCOME10`, `SAVE20`, `VIP30`, `BOOKS15`).
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
- **Shipping workflow (customer UX)**:
  - Order cards show a 4-step shipment timeline (placed → paid → shipped → delivered)
  - Tracking ID and shipping address on order history
  - Admin shipment updates via `POST /api/orders/{id}/shipment`
- **Event consumers and projections**:
  - Order-service publishes `order.placed` to RabbitMQ (with `rabbit` profile)
  - User-service consumes events into MongoDB `OrderEvent` read model
  - Admin analytics endpoint: `GET /api/auth/admin/analytics/orders`
  - Admin **Analytics** tab: revenue summary, daily chart, top customers, recent events
- **Promotions engine (v2)**:
  - Expiration windows (`expiresAt`)
  - Usage limits (`maxUses` / `usedCount`)
  - Minimum basket value rules
  - Category-scoped discounts (`categoryScope` on promo, category on order line items)
  - Admin UI for creating promos with category + expiry
- **Observability and reliability**:
  - Gateway generates/propagates `X-Request-Id` to downstream services
  - Gateway, user-service, product-service, and order-service emit structured JSON request logs
  - Order-service adds an `X-Request-Id` servlet filter
  - RabbitMQ `order.placed` is durable and failed messages dead-letter to `order.placed.dlq`
  - Request-ID behavior is covered by gateway, user-service, and order-service tests

## Next prioritized features

1. Promotions persistence
- Move in-memory promotion rules to a durable store (MySQL or Redis) so restarts do not reset usage counts.

2. Customer-facing shipment notifications
- Push in-app notifications when admin marks an order SHIPPED or DELIVERED.

3. Deeper reliability and alerting
- Add retry/backoff metrics, alert thresholds, and production-grade tracing export.

## Suggested implementation order

1) Promotions persistence
2) Shipment notifications
3) Deeper reliability and alerting
