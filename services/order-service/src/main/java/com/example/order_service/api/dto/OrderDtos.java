package com.example.order_service.api.dto;

import com.example.order_service.model.OrderStatus;
import com.example.order_service.model.PaymentStatus;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;

public final class OrderDtos {

    private OrderDtos() {
    }

    public static class OrderItemRequest {
        @NotNull(message = "productId is required")
        private Long productId;
        @Min(value = 1, message = "quantity must be at least 1")
        private int quantity;
        @NotNull(message = "unitPrice is required")
        @DecimalMin(value = "0", inclusive = true, message = "unitPrice must be >= 0")
        private BigDecimal unitPrice;

        public Long getProductId() {
            return productId;
        }

        public void setProductId(Long productId) {
            this.productId = productId;
        }

        public int getQuantity() {
            return quantity;
        }

        public void setQuantity(int quantity) {
            this.quantity = quantity;
        }

        public BigDecimal getUnitPrice() {
            return unitPrice;
        }

        public void setUnitPrice(BigDecimal unitPrice) {
            this.unitPrice = unitPrice;
        }
    }

    public static class UpdateOrderStatusRequest {
        @NotNull(message = "status is required")
        private OrderStatus status;

        public OrderStatus getStatus() {
            return status;
        }

        public void setStatus(OrderStatus status) {
            this.status = status;
        }
    }

    public static class CreatePaymentIntentResponse {
        private String paymentReference;
        private String clientSecret;
        private PaymentStatus paymentStatus;

        public String getPaymentReference() {
            return paymentReference;
        }

        public void setPaymentReference(String paymentReference) {
            this.paymentReference = paymentReference;
        }

        public String getClientSecret() {
            return clientSecret;
        }

        public void setClientSecret(String clientSecret) {
            this.clientSecret = clientSecret;
        }

        public PaymentStatus getPaymentStatus() {
            return paymentStatus;
        }

        public void setPaymentStatus(PaymentStatus paymentStatus) {
            this.paymentStatus = paymentStatus;
        }
    }

    public static class PaymentWebhookRequest {
        @NotNull(message = "paymentReference is required")
        private String paymentReference;
        @NotNull(message = "status is required")
        private String status;

        public String getPaymentReference() {
            return paymentReference;
        }

        public void setPaymentReference(String paymentReference) {
            this.paymentReference = paymentReference;
        }

        public String getStatus() {
            return status;
        }

        public void setStatus(String status) {
            this.status = status;
        }
    }

    public static class CreateOrderRequest {
        @NotNull(message = "userId is required")
        private Long userId;
        @NotNull(message = "items is required")
        @Valid
        private List<OrderItemRequest> items;
        @Size(max = 32, message = "couponCode too long")
        private String couponCode;
        @Size(max = 500, message = "shippingAddress too long")
        private String shippingAddress;

        public Long getUserId() {
            return userId;
        }

        public void setUserId(Long userId) {
            this.userId = userId;
        }

        public List<OrderItemRequest> getItems() {
            return items;
        }

        public void setItems(List<OrderItemRequest> items) {
            this.items = items;
        }

        public String getCouponCode() {
            return couponCode;
        }

        public void setCouponCode(String couponCode) {
            this.couponCode = couponCode;
        }

        public String getShippingAddress() {
            return shippingAddress;
        }

        public void setShippingAddress(String shippingAddress) {
            this.shippingAddress = shippingAddress;
        }
    }

    public static class UpsertPromotionRequest {
        @NotNull(message = "code is required")
        @Size(min = 3, max = 32, message = "code length must be between 3 and 32")
        private String code;
        @DecimalMin(value = "0.0", inclusive = false, message = "percentOff must be > 0")
        private BigDecimal percentOff;
        @DecimalMin(value = "0.0", inclusive = true, message = "minBasketAmount must be >= 0")
        private BigDecimal minBasketAmount;
        @Min(value = 1, message = "maxUses must be at least 1")
        private Integer maxUses;
        private Boolean active;
        private String expiresAt;

        public String getCode() { return code; }
        public void setCode(String code) { this.code = code; }
        public BigDecimal getPercentOff() { return percentOff; }
        public void setPercentOff(BigDecimal percentOff) { this.percentOff = percentOff; }
        public BigDecimal getMinBasketAmount() { return minBasketAmount; }
        public void setMinBasketAmount(BigDecimal minBasketAmount) { this.minBasketAmount = minBasketAmount; }
        public Integer getMaxUses() { return maxUses; }
        public void setMaxUses(Integer maxUses) { this.maxUses = maxUses; }
        public Boolean getActive() { return active; }
        public void setActive(Boolean active) { this.active = active; }
        public String getExpiresAt() { return expiresAt; }
        public void setExpiresAt(String expiresAt) { this.expiresAt = expiresAt; }
    }

    public static class PromotionResponse {
        private String code;
        private BigDecimal percentOff;
        private BigDecimal minBasketAmount;
        private Integer maxUses;
        private Integer usedCount;
        private Boolean active;
        private OffsetDateTime expiresAt;

        public String getCode() { return code; }
        public void setCode(String code) { this.code = code; }
        public BigDecimal getPercentOff() { return percentOff; }
        public void setPercentOff(BigDecimal percentOff) { this.percentOff = percentOff; }
        public BigDecimal getMinBasketAmount() { return minBasketAmount; }
        public void setMinBasketAmount(BigDecimal minBasketAmount) { this.minBasketAmount = minBasketAmount; }
        public Integer getMaxUses() { return maxUses; }
        public void setMaxUses(Integer maxUses) { this.maxUses = maxUses; }
        public Integer getUsedCount() { return usedCount; }
        public void setUsedCount(Integer usedCount) { this.usedCount = usedCount; }
        public Boolean getActive() { return active; }
        public void setActive(Boolean active) { this.active = active; }
        public OffsetDateTime getExpiresAt() { return expiresAt; }
        public void setExpiresAt(OffsetDateTime expiresAt) { this.expiresAt = expiresAt; }
    }

    public static class UpdateShipmentRequest {
        @NotNull(message = "trackingId is required")
        @Size(min = 3, max = 80, message = "trackingId length invalid")
        private String trackingId;
        @NotNull(message = "status is required")
        private String status;

        public String getTrackingId() { return trackingId; }
        public void setTrackingId(String trackingId) { this.trackingId = trackingId; }
        public String getStatus() { return status; }
        public void setStatus(String status) { this.status = status; }
    }

    public static class OrderItemResponse {
        private Long id;
        private Long productId;
        private int quantity;
        private BigDecimal unitPrice;

        public Long getId() {
            return id;
        }

        public void setId(Long id) {
            this.id = id;
        }

        public Long getProductId() {
            return productId;
        }

        public void setProductId(Long productId) {
            this.productId = productId;
        }

        public int getQuantity() {
            return quantity;
        }

        public void setQuantity(int quantity) {
            this.quantity = quantity;
        }

        public BigDecimal getUnitPrice() {
            return unitPrice;
        }

        public void setUnitPrice(BigDecimal unitPrice) {
            this.unitPrice = unitPrice;
        }
    }

    public static class OrderResponse {
        private Long id;
        private Long userId;
        private BigDecimal totalAmount;
        private BigDecimal discountAmount;
        private String couponCode;
        private PaymentStatus paymentStatus;
        private String paymentReference;
        private OffsetDateTime paidAt;
        private String shippingAddress;
        private String shipmentTrackingId;
        private OffsetDateTime shippedAt;
        private OffsetDateTime deliveredAt;
        private OrderStatus status;
        private OffsetDateTime createdAt;
        private List<OrderItemResponse> items;

        public Long getId() {
            return id;
        }

        public void setId(Long id) {
            this.id = id;
        }

        public Long getUserId() {
            return userId;
        }

        public void setUserId(Long userId) {
            this.userId = userId;
        }

        public BigDecimal getTotalAmount() {
            return totalAmount;
        }

        public void setTotalAmount(BigDecimal totalAmount) {
            this.totalAmount = totalAmount;
        }

        public BigDecimal getDiscountAmount() {
            return discountAmount;
        }

        public void setDiscountAmount(BigDecimal discountAmount) {
            this.discountAmount = discountAmount;
        }

        public String getCouponCode() {
            return couponCode;
        }

        public void setCouponCode(String couponCode) {
            this.couponCode = couponCode;
        }

        public PaymentStatus getPaymentStatus() {
            return paymentStatus;
        }

        public void setPaymentStatus(PaymentStatus paymentStatus) {
            this.paymentStatus = paymentStatus;
        }

        public String getPaymentReference() {
            return paymentReference;
        }

        public void setPaymentReference(String paymentReference) {
            this.paymentReference = paymentReference;
        }

        public OffsetDateTime getPaidAt() {
            return paidAt;
        }

        public void setPaidAt(OffsetDateTime paidAt) {
            this.paidAt = paidAt;
        }

        public String getShippingAddress() {
            return shippingAddress;
        }

        public void setShippingAddress(String shippingAddress) {
            this.shippingAddress = shippingAddress;
        }

        public String getShipmentTrackingId() {
            return shipmentTrackingId;
        }

        public void setShipmentTrackingId(String shipmentTrackingId) {
            this.shipmentTrackingId = shipmentTrackingId;
        }

        public OffsetDateTime getShippedAt() {
            return shippedAt;
        }

        public void setShippedAt(OffsetDateTime shippedAt) {
            this.shippedAt = shippedAt;
        }

        public OffsetDateTime getDeliveredAt() {
            return deliveredAt;
        }

        public void setDeliveredAt(OffsetDateTime deliveredAt) {
            this.deliveredAt = deliveredAt;
        }

        public OrderStatus getStatus() {
            return status;
        }

        public void setStatus(OrderStatus status) {
            this.status = status;
        }

        public OffsetDateTime getCreatedAt() {
            return createdAt;
        }

        public void setCreatedAt(OffsetDateTime createdAt) {
            this.createdAt = createdAt;
        }

        public List<OrderItemResponse> getItems() {
            return items;
        }

        public void setItems(List<OrderItemResponse> items) {
            this.items = items;
        }
    }
}

