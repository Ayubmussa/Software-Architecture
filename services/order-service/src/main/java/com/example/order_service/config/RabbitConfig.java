package com.example.order_service.config;

import org.springframework.amqp.core.Queue;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.Map;

@Configuration
@ConditionalOnProperty(name = "spring.rabbitmq.host")
public class RabbitConfig {

    public static final String ORDER_PLACED_QUEUE = "order.placed";
    public static final String ORDER_PLACED_DLQ = "order.placed.dlq";

    @Bean
    public Queue orderPlacedQueue() {
        return new Queue(
                ORDER_PLACED_QUEUE,
                true,
                false,
                false,
                Map.of("x-dead-letter-exchange", "", "x-dead-letter-routing-key", ORDER_PLACED_DLQ));
    }

    @Bean
    public Queue orderPlacedDeadLetterQueue() {
        return new Queue(ORDER_PLACED_DLQ, true);
    }
}
