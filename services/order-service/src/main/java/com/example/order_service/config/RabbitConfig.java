package com.example.order_service.config;

import org.springframework.amqp.core.Queue;
import org.springframework.amqp.rabbit.annotation.EnableRabbit;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
@ConditionalOnProperty(name = "spring.rabbitmq.host")
public class RabbitConfig {

    public static final String ORDER_PLACED_QUEUE = "order.placed";

    @Bean
    public Queue orderPlacedQueue() {
        return new Queue(ORDER_PLACED_QUEUE, false);
    }
}
