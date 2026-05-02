package com.example.order_service.config;

import com.example.order_service.model.Order;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.Map;

@Component
@ConditionalOnBean(RabbitTemplate.class)
public class OrderEventPublisher {

    private final RabbitTemplate rabbitTemplate;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public OrderEventPublisher(RabbitTemplate rabbitTemplate) {
        this.rabbitTemplate = rabbitTemplate;
    }

    public void publishOrderPlaced(Order order) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("orderId", order.getId());
        payload.put("userId", order.getUserId());
        payload.put("totalAmount", order.getTotalAmount() != null ? order.getTotalAmount().doubleValue() : null);
        payload.put("status", order.getStatus() != null ? order.getStatus().name() : null);
        payload.put("createdAt", order.getCreatedAt() != null ? order.getCreatedAt().toString() : null);
        try {
            String json = objectMapper.writeValueAsString(payload);
            rabbitTemplate.convertAndSend(RabbitConfig.ORDER_PLACED_QUEUE, json);
        } catch (JsonProcessingException e) {
            // log and skip
        }
    }
}
