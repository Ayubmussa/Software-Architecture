# Infrastructure

## Databases (Docker Compose)

From the project root:

```bash
docker compose -f infra/docker-compose.yml up -d
```

This starts:

- **MongoDB** on `localhost:27017` (user-service)
- **PostgreSQL** on `localhost:5432` (product-service), db: `product_service`, user: `postgres`, password: `password`
- **MySQL** on `localhost:3306` (order-service), db: `order_service`, root password: `root`
- **RabbitMQ** on `localhost:5672` (AMQP), management UI on `http://localhost:15672` (guest/guest)
- **Elasticsearch** on `http://localhost:9200` (used by product-service search)

Point each service at these when running locally (see each service’s `.env.example`).

## Stop

```bash
docker compose -f infra/docker-compose.yml down
```

Add `-v` to remove volumes.
