# Order Service

Spring Boot service for orders and payments. Persists to MySQL.

## Requirements

- JDK 17+
- MySQL 8 (database `order_service` must exist, or use Hibernate `ddl-auto=update` which creates tables)

## Configuration

Copy `src/main/resources/application.properties.example` to `application.properties` and set:

- `spring.datasource.url` – MySQL JDBC URL (default: `localhost:3306/order_service`)
- `spring.datasource.username` / `spring.datasource.password` – DB credentials (Docker Compose uses `root` / `root`)

## Run

```bash
./mvnw spring-boot:run
```

Runs on port 8080 by default.

## API

- `POST /api/orders` – Create order (body: `{ "userId": number, "items": [ { "productId", "quantity", "unitPrice" } ] }`)
- `GET /api/orders/{orderId}` – Get order by ID
- `GET /api/orders/user/{userId}` – List orders for user

## Project layout

- `model/` – `Order`, `OrderItem`, `OrderStatus` (JPA entities)
- `repository/` – `OrderRepository` (Spring Data JPA)
- `api/dto/` – Request/response DTOs
- `api/OrderController.java` – REST endpoints
