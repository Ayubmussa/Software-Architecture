package com.example.order_service.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.UUID;

@Component
public class RequestObservabilityFilter extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger(RequestObservabilityFilter.class);
    private static final String REQUEST_ID_HEADER = "X-Request-Id";

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain) throws ServletException, IOException {
        String requestId = resolveRequestId(request);
        long startedAt = System.nanoTime();
        MDC.put("requestId", requestId);
        response.setHeader(REQUEST_ID_HEADER, requestId);
        try {
            filterChain.doFilter(request, response);
        } finally {
            long durationMs = (System.nanoTime() - startedAt) / 1_000_000;
            log.info(
                    "{\"service\":\"order-service\",\"requestId\":\"{}\",\"method\":\"{}\",\"path\":\"{}\",\"status\":{},\"durationMs\":{}}",
                    requestId,
                    request.getMethod(),
                    request.getRequestURI(),
                    response.getStatus(),
                    durationMs);
            MDC.remove("requestId");
        }
    }

    private String resolveRequestId(HttpServletRequest request) {
        String incoming = request.getHeader(REQUEST_ID_HEADER);
        if (incoming == null || incoming.trim().isEmpty()) {
            return UUID.randomUUID().toString();
        }
        String trimmed = incoming.trim();
        return trimmed.length() > 128 ? trimmed.substring(0, 128) : trimmed;
    }
}
