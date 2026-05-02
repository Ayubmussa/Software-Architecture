package com.example.order_service.api;

import com.example.order_service.api.dto.OrderDtos.CreateOrderRequest;
import com.example.order_service.api.dto.OrderDtos.CreatePaymentIntentResponse;
import com.example.order_service.api.dto.OrderDtos.OrderItemRequest;
import com.example.order_service.api.dto.OrderDtos.OrderItemResponse;
import com.example.order_service.api.dto.OrderDtos.OrderResponse;
import com.example.order_service.api.dto.OrderDtos.PaymentWebhookRequest;
import com.example.order_service.api.dto.OrderDtos.PromotionResponse;
import com.example.order_service.api.dto.OrderDtos.UpdateShipmentRequest;
import com.example.order_service.api.dto.OrderDtos.UpdateOrderStatusRequest;
import com.example.order_service.api.dto.OrderDtos.UpsertPromotionRequest;
import com.example.order_service.config.OrderEventPublisher;
import com.example.order_service.model.Order;
import com.example.order_service.model.OrderItem;
import com.example.order_service.model.OrderStatus;
import com.example.order_service.model.PaymentStatus;
import com.example.order_service.repository.OrderRepository;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import jakarta.validation.Valid;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/orders")
public class OrderController {

    private final OrderRepository orderRepository;
    private final OrderEventPublisher orderEventPublisher;
    private final Map<String, PromotionRule> promotionRules = new ConcurrentHashMap<>();

    public OrderController(OrderRepository orderRepository,
                           @org.springframework.beans.factory.annotation.Autowired(required = false) OrderEventPublisher orderEventPublisher) {
        this.orderRepository = orderRepository;
        this.orderEventPublisher = orderEventPublisher;
        seedDefaultPromotions();
    }

    @GetMapping
    public List<OrderResponse> getAllOrders() {
        return orderRepository.findAll().stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    @PostMapping
    public ResponseEntity<OrderResponse> createOrder(@RequestBody @Valid CreateOrderRequest request) {
        if (request.getItems() == null || request.getItems().isEmpty()) {
            return ResponseEntity.badRequest().build();
        }

        Order order = new Order();
        order.setUserId(request.getUserId());
        order.setStatus(OrderStatus.PENDING);

        BigDecimal total = BigDecimal.ZERO;
        for (OrderItemRequest itemRequest : request.getItems()) {
            OrderItem item = new OrderItem();
            item.setOrder(order);
            item.setProductId(itemRequest.getProductId());
            item.setQuantity(itemRequest.getQuantity());
            item.setUnitPrice(itemRequest.getUnitPrice());

            order.getItems().add(item);
            if (itemRequest.getUnitPrice() != null) {
                total = total.add(itemRequest.getUnitPrice().multiply(BigDecimal.valueOf(itemRequest.getQuantity())));
            }
        }
        String couponCode = normalizeCouponCode(request.getCouponCode());
        PromotionRule promotionRule = resolvePromotion(couponCode);
        if (couponCode != null && promotionRule == null) {
            return ResponseEntity.badRequest().body(null);
        }
        if (promotionRule != null && !promotionRule.isEligible(total)) {
            return ResponseEntity.badRequest().body(null);
        }
        BigDecimal discountRate = promotionRule == null ? null : promotionRule.percentOff;
        BigDecimal discountAmount = discountRate == null
                ? BigDecimal.ZERO
                : total.multiply(discountRate).setScale(2, RoundingMode.HALF_UP);
        BigDecimal finalTotal = total.subtract(discountAmount).max(BigDecimal.ZERO).setScale(2, RoundingMode.HALF_UP);
        order.setCouponCode(couponCode);
        order.setDiscountAmount(discountAmount);
        order.setTotalAmount(finalTotal);
        order.setShippingAddress(request.getShippingAddress());
        if (promotionRule != null) {
            promotionRule.usedCount = promotionRule.usedCount + 1;
        }

        Order saved = orderRepository.save(order);
        if (orderEventPublisher != null) {
            orderEventPublisher.publishOrderPlaced(saved);
        }
        return ResponseEntity.status(HttpStatus.CREATED).body(toResponse(saved));
    }

    @GetMapping("/{orderId}")
    public ResponseEntity<OrderResponse> getOrder(@PathVariable Long orderId) {
        return orderRepository
                .findById(orderId)
                .map(order -> ResponseEntity.ok(toResponse(order)))
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @GetMapping("/user/{userId}")
    public List<OrderResponse> getOrdersForUser(@PathVariable Long userId) {
        return orderRepository.findByUserId(userId).stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    @PatchMapping("/{orderId}")
    public ResponseEntity<OrderResponse> updateOrderStatus(
            @PathVariable Long orderId,
            @RequestBody @Valid UpdateOrderStatusRequest request) {
        return orderRepository.findById(orderId)
                .map(order -> {
                    if (request.getStatus() != null) {
                        order.setStatus(request.getStatus());
                        order = orderRepository.save(order);
                    }
                    return ResponseEntity.ok(toResponse(order));
                })
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @PostMapping("/{orderId}/shipment")
    public ResponseEntity<OrderResponse> updateShipment(
            @PathVariable Long orderId,
            @RequestBody @Valid UpdateShipmentRequest request) {
        return orderRepository.findById(orderId)
                .map(order -> {
                    String status = request.getStatus().trim().toUpperCase(Locale.ROOT);
                    order.setShipmentTrackingId(request.getTrackingId().trim());
                    if ("SHIPPED".equals(status)) {
                        order.setStatus(OrderStatus.SHIPPED);
                        order.setShippedAt(OffsetDateTime.now());
                    } else if ("DELIVERED".equals(status)) {
                        order.setStatus(OrderStatus.COMPLETED);
                        if (order.getShippedAt() == null) {
                            order.setShippedAt(OffsetDateTime.now());
                        }
                        order.setDeliveredAt(OffsetDateTime.now());
                    } else {
                        return ResponseEntity.badRequest().<OrderResponse>build();
                    }
                    order = orderRepository.save(order);
                    return ResponseEntity.ok(toResponse(order));
                })
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @GetMapping("/promotions")
    public List<PromotionResponse> listPromotions() {
        return promotionRules.values().stream()
                .map(this::toPromotionResponse)
                .sorted((a, b) -> a.getCode().compareToIgnoreCase(b.getCode()))
                .collect(Collectors.toList());
    }

    @PostMapping("/promotions")
    public ResponseEntity<PromotionResponse> upsertPromotion(@RequestBody @Valid UpsertPromotionRequest request) {
        String code = normalizeCouponCode(request.getCode());
        if (code == null) {
            return ResponseEntity.badRequest().build();
        }
        PromotionRule rule = promotionRules.getOrDefault(code, new PromotionRule());
        rule.code = code;
        rule.percentOff = request.getPercentOff() == null ? BigDecimal.ZERO : request.getPercentOff();
        rule.minBasketAmount = request.getMinBasketAmount() == null ? BigDecimal.ZERO : request.getMinBasketAmount();
        rule.maxUses = request.getMaxUses();
        rule.active = request.getActive() == null ? true : request.getActive();
        rule.expiresAt = parseDate(request.getExpiresAt());
        promotionRules.put(code, rule);
        return ResponseEntity.ok(toPromotionResponse(rule));
    }

    @PatchMapping("/promotions/{code}")
    public ResponseEntity<PromotionResponse> patchPromotion(
            @PathVariable String code,
            @RequestBody UpsertPromotionRequest request) {
        String normalized = normalizeCouponCode(code);
        PromotionRule rule = promotionRules.get(normalized);
        if (rule == null) {
            return ResponseEntity.notFound().build();
        }
        if (request.getPercentOff() != null) rule.percentOff = request.getPercentOff();
        if (request.getMinBasketAmount() != null) rule.minBasketAmount = request.getMinBasketAmount();
        if (request.getMaxUses() != null) rule.maxUses = request.getMaxUses();
        if (request.getActive() != null) rule.active = request.getActive();
        if (request.getExpiresAt() != null) rule.expiresAt = parseDate(request.getExpiresAt());
        return ResponseEntity.ok(toPromotionResponse(rule));
    }

    @PatchMapping("/promotions/{code}/toggle")
    public ResponseEntity<PromotionResponse> togglePromotion(@PathVariable String code) {
        String normalized = normalizeCouponCode(code);
        PromotionRule rule = promotionRules.get(normalized);
        if (rule == null) {
            return ResponseEntity.notFound().build();
        }
        rule.active = !rule.active;
        return ResponseEntity.ok(toPromotionResponse(rule));
    }

    @org.springframework.web.bind.annotation.DeleteMapping("/promotions/{code}")
    public ResponseEntity<Void> deletePromotion(@PathVariable String code) {
        String normalized = normalizeCouponCode(code);
        promotionRules.remove(normalized);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{orderId}/payment-intent")
    public ResponseEntity<CreatePaymentIntentResponse> createPaymentIntent(@PathVariable Long orderId) {
        return orderRepository.findById(orderId)
                .map(order -> {
                    if (order.getStatus() == OrderStatus.CANCELLED || order.getStatus() == OrderStatus.COMPLETED) {
                        return ResponseEntity.badRequest().<CreatePaymentIntentResponse>build();
                    }
                    String paymentRef = "pay_" + UUID.randomUUID().toString().replace("-", "").substring(0, 18);
                    String clientSecret = "sec_" + UUID.randomUUID().toString().replace("-", "");
                    order.setPaymentReference(paymentRef);
                    order.setPaymentClientSecret(clientSecret);
                    order.setPaymentStatus(PaymentStatus.PROCESSING);
                    orderRepository.save(order);

                    CreatePaymentIntentResponse response = new CreatePaymentIntentResponse();
                    response.setPaymentReference(paymentRef);
                    response.setClientSecret(clientSecret);
                    response.setPaymentStatus(order.getPaymentStatus());
                    return ResponseEntity.ok(response);
                })
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @PostMapping("/{orderId}/payment-webhook")
    public ResponseEntity<OrderResponse> paymentWebhook(
            @PathVariable Long orderId,
            @RequestBody @Valid PaymentWebhookRequest request) {
        return orderRepository.findById(orderId)
                .map(order -> {
                    if (order.getPaymentReference() == null || !order.getPaymentReference().equals(request.getPaymentReference())) {
                        return ResponseEntity.badRequest().<OrderResponse>build();
                    }
                    String status = request.getStatus().trim().toLowerCase(Locale.ROOT);
                    if ("succeeded".equals(status)) {
                        order.setPaymentStatus(PaymentStatus.SUCCEEDED);
                        order.setStatus(OrderStatus.PAID);
                        order.setPaidAt(OffsetDateTime.now());
                    } else if ("failed".equals(status)) {
                        order.setPaymentStatus(PaymentStatus.FAILED);
                    } else {
                        return ResponseEntity.badRequest().<OrderResponse>build();
                    }
                    order = orderRepository.save(order);
                    return ResponseEntity.ok(toResponse(order));
                })
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    private OrderResponse toResponse(Order order) {
        OrderResponse resp = new OrderResponse();
        resp.setId(order.getId());
        resp.setUserId(order.getUserId());
        resp.setTotalAmount(order.getTotalAmount());
        resp.setDiscountAmount(order.getDiscountAmount());
        resp.setCouponCode(order.getCouponCode());
        resp.setPaymentStatus(order.getPaymentStatus());
        resp.setPaymentReference(order.getPaymentReference());
        resp.setPaidAt(order.getPaidAt());
        resp.setShippingAddress(order.getShippingAddress());
        resp.setShipmentTrackingId(order.getShipmentTrackingId());
        resp.setShippedAt(order.getShippedAt());
        resp.setDeliveredAt(order.getDeliveredAt());
        resp.setStatus(order.getStatus());
        resp.setCreatedAt(order.getCreatedAt());
        List<OrderItemResponse> items = order.getItems().stream().map(oi -> {
            OrderItemResponse ir = new OrderItemResponse();
            ir.setId(oi.getId());
            ir.setProductId(oi.getProductId());
            ir.setQuantity(oi.getQuantity());
            ir.setUnitPrice(oi.getUnitPrice());
            return ir;
        }).collect(Collectors.toList());
        resp.setItems(items);
        return resp;
    }

    private static String normalizeCouponCode(String raw) {
        if (raw == null) {
            return null;
        }
        String value = raw.trim();
        if (value.isEmpty()) {
            return null;
        }
        return value.toUpperCase(Locale.ROOT);
    }

    private PromotionRule resolvePromotion(String couponCode) {
        if (couponCode == null) {
            return null;
        }
        PromotionRule rule = promotionRules.get(couponCode);
        if (rule == null || !rule.active) return null;
        if (rule.expiresAt != null && rule.expiresAt.isBefore(OffsetDateTime.now())) return null;
        if (rule.maxUses != null && rule.usedCount >= rule.maxUses) return null;
        return rule;
    }

    private void seedDefaultPromotions() {
        createSeed("WELCOME10", BigDecimal.valueOf(0.10));
        createSeed("SAVE20", BigDecimal.valueOf(0.20));
        createSeed("VIP30", BigDecimal.valueOf(0.30));
    }

    private void createSeed(String code, BigDecimal percent) {
        PromotionRule rule = new PromotionRule();
        rule.code = code;
        rule.percentOff = percent;
        rule.minBasketAmount = BigDecimal.ZERO;
        rule.maxUses = null;
        rule.usedCount = 0;
        rule.active = true;
        rule.expiresAt = null;
        promotionRules.put(code, rule);
    }

    private OffsetDateTime parseDate(String iso) {
        if (iso == null || iso.trim().isEmpty()) return null;
        try {
            return OffsetDateTime.parse(iso.trim());
        } catch (Exception e) {
            return null;
        }
    }

    private PromotionResponse toPromotionResponse(PromotionRule rule) {
        PromotionResponse resp = new PromotionResponse();
        resp.setCode(rule.code);
        resp.setPercentOff(rule.percentOff);
        resp.setMinBasketAmount(rule.minBasketAmount);
        resp.setMaxUses(rule.maxUses);
        resp.setUsedCount(rule.usedCount);
        resp.setActive(rule.active);
        resp.setExpiresAt(rule.expiresAt);
        return resp;
    }

    private static class PromotionRule {
        String code;
        BigDecimal percentOff = BigDecimal.ZERO;
        BigDecimal minBasketAmount = BigDecimal.ZERO;
        Integer maxUses;
        int usedCount;
        boolean active = true;
        OffsetDateTime expiresAt;

        boolean isEligible(BigDecimal basketTotal) {
            if (basketTotal == null) return false;
            if (minBasketAmount == null) return true;
            return basketTotal.compareTo(minBasketAmount) >= 0;
        }
    }
}

