package com.example.order_service.api;

import com.example.order_service.api.dto.OrderDtos;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.math.BigDecimal;
import java.util.List;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
class OrderControllerTest {

    @Autowired
    private MockMvc mockMvc;

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    void health_returnsOk() throws Exception {
        mockMvc.perform(get("/health").header("X-Request-Id", "test-request-1"))
                .andExpect(status().isOk())
                .andExpect(header().string("X-Request-Id", "test-request-1"))
                .andExpect(jsonPath("$.status").value("ok"))
                .andExpect(jsonPath("$.service").value("order-service"));
    }

    @Test
    void createOrder_returnsCreated() throws Exception {
        OrderDtos.OrderItemRequest item = new OrderDtos.OrderItemRequest();
        item.setProductId(1L);
        item.setQuantity(2);
        item.setUnitPrice(BigDecimal.valueOf(9.99));

        OrderDtos.CreateOrderRequest request = new OrderDtos.CreateOrderRequest();
        request.setUserId(1L);
        request.setItems(List.of(item));

        mockMvc.perform(post("/api/orders")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.userId").value(1))
                .andExpect(jsonPath("$.status").value("PENDING"))
                .andExpect(jsonPath("$.items.length()").value(1));
    }
}
