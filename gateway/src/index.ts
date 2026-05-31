import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import axios from 'axios';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { AsyncLocalStorage } from 'async_hooks';
import { randomUUID } from 'crypto';
import { requireAuth, requireAdmin, AuthRequest } from './auth.middleware';

dotenv.config();

const app = express();
const requestContext = new AsyncLocalStorage<{ requestId: string }>();

app.use((req: Request, res: Response, next: NextFunction) => {
  const incoming = req.header('x-request-id');
  const requestId = incoming && incoming.trim() ? incoming.trim().slice(0, 128) : randomUUID();
  res.setHeader('X-Request-Id', requestId);
  requestContext.run({ requestId }, next);
});
axios.interceptors.request.use((config) => {
  const requestId = requestContext.getStore()?.requestId;
  if (requestId) {
    config.headers = config.headers ?? {};
    config.headers['X-Request-Id'] = requestId;
  }
  return config;
});
morgan.token('request-id', (req) => req.headers['x-request-id']?.toString() || '-');
app.use(morgan((tokens, req, res) => JSON.stringify({
  service: 'api-gateway',
  requestId: tokens['request-id'](req, res),
  method: tokens.method(req, res),
  url: tokens.url(req, res),
  status: Number(tokens.status(req, res)),
  responseTimeMs: Number(tokens['response-time'](req, res)),
})));
app.use(
  rateLimit({
    windowMs: 60 * 1000,
    max: 200,
    message: { message: 'Too many requests, please try again later.' },
  })
);
app.use(
  cors({
    exposedHeaders: ['X-Total-Count', 'X-Request-Id'],
  })
);
app.use(express.json());

function forwardCountHeader(upstream: { headers?: Record<string, any> } | undefined, res: Response) {
  const total = upstream?.headers?.['x-total-count'] ?? upstream?.headers?.['X-Total-Count'];
  if (total != null) {
    res.setHeader('X-Total-Count', String(total));
  }
}

/**
 * Fire-and-forget audit logging for admin write actions across services.
 * Forwards the caller's bearer token so the user-service can attribute the actor.
 */
function recordAdminAudit(
  authHeader: string | undefined,
  action: string,
  target: string,
  details?: Record<string, unknown>
): void {
  if (!authHeader) return;
  axios
    .post(
      `${USER_SERVICE_URL}/api/auth/admin/audit-logs`,
      { action, target, details: details || {} },
      { headers: { 'Content-Type': 'application/json', Authorization: authHeader } }
    )
    .catch((err: any) => {
      // eslint-disable-next-line no-console
      console.warn('audit log forward failed:', err?.message || err);
    });
}

app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'api-gateway' });
});

const USER_SERVICE_URL = process.env.USER_SERVICE_URL || 'http://localhost:4001';
const PRODUCT_SERVICE_URL = process.env.PRODUCT_SERVICE_URL || 'http://localhost:5001';
const ORDER_SERVICE_URL = process.env.ORDER_SERVICE_URL || 'http://localhost:8080';

type InventoryItem = { productId: number; quantity: number };

function extractInventoryItems(body: any): InventoryItem[] {
  const rawItems = Array.isArray(body?.items) ? body.items : [];
  const merged = new Map<number, number>();
  for (const item of rawItems) {
    const productId = Number(item?.productId);
    const quantity = Number(item?.quantity);
    if (!Number.isInteger(productId) || productId <= 0 || !Number.isInteger(quantity) || quantity <= 0) {
      continue;
    }
    merged.set(productId, (merged.get(productId) || 0) + quantity);
  }
  return Array.from(merged.entries()).map(([productId, quantity]) => ({ productId, quantity }));
}

app.post('/api/auth/register', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const response = await axios.post(`${USER_SERVICE_URL}/api/auth/register`, req.body, {
      headers: { 'Content-Type': 'application/json' },
    });
    res.status(response.status).json(response.data);
  } catch (error: any) {
    if (error.response) {
      res.status(error.response.status).json(error.response.data);
    } else {
      next(error);
    }
  }
});

app.post('/api/auth/login', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const response = await axios.post(`${USER_SERVICE_URL}/api/auth/login`, req.body, {
      headers: { 'Content-Type': 'application/json' },
    });
    res.status(response.status).json(response.data);
  } catch (error: any) {
    if (error.response) {
      res.status(error.response.status).json(error.response.data);
    } else {
      next(error);
    }
  }
});

app.get('/api/auth/me', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    const response = await axios.get(`${USER_SERVICE_URL}/api/auth/me`, {
      headers: {
        Authorization: authHeader || '',
      },
    });
    res.status(response.status).json(response.data);
  } catch (error: any) {
    if (error.response) {
      res.status(error.response.status).json(error.response.data);
    } else {
      next(error);
    }
  }
});

app.patch('/api/auth/me', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    const response = await axios.patch(`${USER_SERVICE_URL}/api/auth/me`, req.body, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: authHeader || '',
      },
    });
    res.status(response.status).json(response.data);
  } catch (error: any) {
    if (error.response) {
      res.status(error.response.status).json(error.response.data);
    } else {
      next(error);
    }
  }
});

app.get('/api/auth/wishlist', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    const response = await axios.get(`${USER_SERVICE_URL}/api/auth/wishlist`, {
      headers: { Authorization: authHeader || '' },
    });
    res.status(response.status).json(response.data);
  } catch (error: any) {
    if (error.response) {
      res.status(error.response.status).json(error.response.data);
    } else {
      next(error);
    }
  }
});

app.post('/api/auth/wishlist/:productId', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    const { productId } = req.params;
    const response = await axios.post(`${USER_SERVICE_URL}/api/auth/wishlist/${productId}`, undefined, {
      headers: { Authorization: authHeader || '' },
    });
    res.status(response.status).json(response.data);
  } catch (error: any) {
    if (error.response) {
      res.status(error.response.status).json(error.response.data);
    } else {
      next(error);
    }
  }
});

app.delete('/api/auth/wishlist/:productId', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    const { productId } = req.params;
    const response = await axios.delete(`${USER_SERVICE_URL}/api/auth/wishlist/${productId}`, {
      headers: { Authorization: authHeader || '' },
    });
    res.status(response.status).json(response.data);
  } catch (error: any) {
    if (error.response) {
      res.status(error.response.status).json(error.response.data);
    } else {
      next(error);
    }
  }
});

app.get('/api/auth/admin/users', requireAuth, requireAdmin, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    const response = await axios.get(`${USER_SERVICE_URL}/api/auth/admin/users`, {
      params: req.query,
      headers: { Authorization: authHeader || '' },
    });
    forwardCountHeader(response, res);
    res.status(response.status).json(response.data);
  } catch (error: any) {
    if (error.response) res.status(error.response.status).json(error.response.data);
    else next(error);
  }
});

app.patch('/api/auth/admin/users/:id', requireAuth, requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    const response = await axios.patch(`${USER_SERVICE_URL}/api/auth/admin/users/${req.params.id}`, req.body, {
      headers: { 'Content-Type': 'application/json', Authorization: authHeader || '' },
    });
    res.status(response.status).json(response.data);
  } catch (error: any) {
    if (error.response) res.status(error.response.status).json(error.response.data);
    else next(error);
  }
});

app.delete('/api/auth/admin/users/:id', requireAuth, requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    const response = await axios.delete(`${USER_SERVICE_URL}/api/auth/admin/users/${req.params.id}`, {
      headers: { Authorization: authHeader || '' },
    });
    res.status(response.status).send(response.data);
  } catch (error: any) {
    if (error.response) res.status(error.response.status).json(error.response.data);
    else next(error);
  }
});

app.get('/api/auth/admin/audit-logs', requireAuth, requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    const response = await axios.get(`${USER_SERVICE_URL}/api/auth/admin/audit-logs`, {
      params: req.query,
      headers: { Authorization: authHeader || '' },
    });
    forwardCountHeader(response, res);
    res.status(response.status).json(response.data);
  } catch (error: any) {
    if (error.response) res.status(error.response.status).json(error.response.data);
    else next(error);
  }
});

app.get('/api/auth/admin/analytics/orders', requireAuth, requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    const response = await axios.get(`${USER_SERVICE_URL}/api/auth/admin/analytics/orders`, {
      params: req.query,
      headers: { Authorization: authHeader || '' },
    });
    res.status(response.status).json(response.data);
  } catch (error: any) {
    if (error.response) res.status(error.response.status).json(error.response.data);
    else next(error);
  }
});

app.post('/api/products', requireAuth, requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    const response = await axios.post(`${PRODUCT_SERVICE_URL}/api/products`, req.body, {
      headers: { 'Content-Type': 'application/json', ...(authHeader && { Authorization: authHeader }) },
    });
    if (response.status >= 200 && response.status < 300) {
      const newId = (response.data as any)?.id;
      recordAdminAudit(authHeader, 'admin.product.create', `product:${newId ?? 'new'}`, {
        name: (req.body as any)?.name,
        category: (req.body as any)?.category,
      });
    }
    res.status(response.status).json(response.data);
  } catch (error: any) {
    if (error.response) {
      res.status(error.response.status).json(error.response.data);
    } else {
      next(error);
    }
  }
});

app.get('/api/products/categories', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const response = await axios.get(`${PRODUCT_SERVICE_URL}/api/products/categories`);
    res.status(response.status).json(response.data);
  } catch (error: any) {
    if (error.response) {
      res.status(error.response.status).json(error.response.data);
    } else {
      next(error);
    }
  }
});

app.get('/api/products', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const response = await axios.get(`${PRODUCT_SERVICE_URL}/api/products`, {
      params: req.query,
    });
    forwardCountHeader(response, res);
    res.status(response.status).json(response.data);
  } catch (error: any) {
    if (error.response) {
      res.status(error.response.status).json(error.response.data);
    } else {
      next(error);
    }
  }
});

app.get('/api/products/recommendations', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const response = await axios.get(`${PRODUCT_SERVICE_URL}/api/products/recommendations`, {
      params: req.query,
    });
    res.status(response.status).json(response.data);
  } catch (error: any) {
    if (error.response) {
      res.status(error.response.status).json(error.response.data);
    } else {
      next(error);
    }
  }
});

app.get('/api/products/:id/reviews', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const response = await axios.get(`${PRODUCT_SERVICE_URL}/api/products/${id}/reviews`, {
      params: req.query,
      headers: req.headers['x-voter-key'] ? { 'x-voter-key': String(req.headers['x-voter-key']) } : {},
    });
    res.status(response.status).json(response.data);
  } catch (error: any) {
    if (error.response) {
      res.status(error.response.status).json(error.response.data);
    } else {
      next(error);
    }
  }
});

app.post('/api/products/:id/reviews', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const response = await axios.post(`${PRODUCT_SERVICE_URL}/api/products/${id}/reviews`, req.body, {
      headers: { 'Content-Type': 'application/json' },
    });
    res.status(response.status).json(response.data);
  } catch (error: any) {
    if (error.response) {
      res.status(error.response.status).json(error.response.data);
    } else {
      next(error);
    }
  }
});

app.get('/api/products/:id/reviews/meta', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const response = await axios.get(`${PRODUCT_SERVICE_URL}/api/products/${id}/reviews/meta`);
    res.status(response.status).json(response.data);
  } catch (error: any) {
    if (error.response) {
      res.status(error.response.status).json(error.response.data);
    } else {
      next(error);
    }
  }
});

app.get('/api/products/reviews', requireAuth, requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const response = await axios.get(`${PRODUCT_SERVICE_URL}/api/products/reviews`, { params: req.query });
    forwardCountHeader(response, res);
    res.status(response.status).json(response.data);
  } catch (error: any) {
    if (error.response) res.status(error.response.status).json(error.response.data);
    else next(error);
  }
});

app.delete('/api/products/reviews/:reviewId', requireAuth, requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const response = await axios.delete(`${PRODUCT_SERVICE_URL}/api/products/reviews/${req.params.reviewId}`);
    if (response.status >= 200 && response.status < 300) {
      recordAdminAudit(req.headers.authorization, 'admin.review.delete', `review:${req.params.reviewId}`);
    }
    res.status(response.status).send(response.data);
  } catch (error: any) {
    if (error.response) res.status(error.response.status).json(error.response.data);
    else next(error);
  }
});

app.post('/api/products/:id/reviews/:reviewId/helpful', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id, reviewId } = req.params;
    const response = await axios.post(
      `${PRODUCT_SERVICE_URL}/api/products/${id}/reviews/${reviewId}/helpful`,
      undefined,
      {
        headers: req.headers['x-voter-key'] ? { 'x-voter-key': String(req.headers['x-voter-key']) } : {},
      }
    );
    res.status(response.status).json(response.data);
  } catch (error: any) {
    if (error.response) {
      res.status(error.response.status).json(error.response.data);
    } else {
      next(error);
    }
  }
});

app.put('/api/products/:id/reviews/:reviewId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id, reviewId } = req.params;
    const response = await axios.put(`${PRODUCT_SERVICE_URL}/api/products/${id}/reviews/${reviewId}`, req.body, {
      headers: { 'Content-Type': 'application/json' },
    });
    res.status(response.status).json(response.data);
  } catch (error: any) {
    if (error.response) {
      res.status(error.response.status).json(error.response.data);
    } else {
      next(error);
    }
  }
});

app.put('/api/products/:id/reviews/:reviewId/admin', requireAuth, requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const response = await axios.put(`${PRODUCT_SERVICE_URL}/api/products/${req.params.id}/reviews/${req.params.reviewId}`, req.body, {
      params: { force: true },
      headers: { 'Content-Type': 'application/json' },
    });
    if (response.status >= 200 && response.status < 300) {
      recordAdminAudit(
        req.headers.authorization,
        'admin.review.update',
        `review:${req.params.reviewId}`,
        { product_id: req.params.id, rating: (req.body as any)?.rating }
      );
    }
    res.status(response.status).json(response.data);
  } catch (error: any) {
    if (error.response) res.status(error.response.status).json(error.response.data);
    else next(error);
  }
});

app.delete('/api/products/:id/reviews/:reviewId/admin', requireAuth, requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const response = await axios.delete(`${PRODUCT_SERVICE_URL}/api/products/${req.params.id}/reviews/${req.params.reviewId}`, {
      params: { force: true },
    });
    if (response.status >= 200 && response.status < 300) {
      recordAdminAudit(
        req.headers.authorization,
        'admin.review.delete',
        `review:${req.params.reviewId}`,
        { product_id: req.params.id }
      );
    }
    res.status(response.status).send(response.data);
  } catch (error: any) {
    if (error.response) res.status(error.response.status).json(error.response.data);
    else next(error);
  }
});

app.delete('/api/products/:id/reviews/:reviewId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id, reviewId } = req.params;
    const response = await axios.delete(`${PRODUCT_SERVICE_URL}/api/products/${id}/reviews/${reviewId}`, {
      params: req.query,
    });
    res.status(response.status).send(response.data);
  } catch (error: any) {
    if (error.response) {
      res.status(error.response.status).json(error.response.data);
    } else {
      next(error);
    }
  }
});

app.get('/api/products/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const response = await axios.get(`${PRODUCT_SERVICE_URL}/api/products/${id}`);
    res.status(response.status).json(response.data);
  } catch (error: any) {
    if (error.response) {
      res.status(error.response.status).json(error.response.data);
    } else {
      next(error);
    }
  }
});

app.put('/api/products/:id', requireAuth, requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const authHeader = req.headers.authorization;
    const response = await axios.put(`${PRODUCT_SERVICE_URL}/api/products/${id}`, req.body, {
      headers: { 'Content-Type': 'application/json', ...(authHeader && { Authorization: authHeader }) },
    });
    if (response.status >= 200 && response.status < 300) {
      recordAdminAudit(authHeader, 'admin.product.update', `product:${id}`, {
        fields: Object.keys(req.body || {}),
      });
    }
    res.status(response.status).json(response.data);
  } catch (error: any) {
    if (error.response) {
      res.status(error.response.status).json(error.response.data);
    } else {
      next(error);
    }
  }
});

app.delete('/api/products/:id', requireAuth, requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const authHeader = req.headers.authorization;
    const response = await axios.delete(`${PRODUCT_SERVICE_URL}/api/products/${id}`, {
      headers: authHeader ? { Authorization: authHeader } : {},
    });
    if (response.status >= 200 && response.status < 300) {
      recordAdminAudit(authHeader, 'admin.product.delete', `product:${id}`);
    }
    res.status(response.status).send(response.data);
  } catch (error: any) {
    if (error.response) {
      res.status(error.response.status).json(error.response.data);
    } else {
      next(error);
    }
  }
});

app.get('/api/orders', requireAuth, requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    const response = await axios.get(`${ORDER_SERVICE_URL}/api/orders`, {
      params: req.query,
      headers: authHeader ? { Authorization: authHeader } : {},
    });
    forwardCountHeader(response, res);
    res.status(response.status).json(response.data);
  } catch (error: any) {
    if (error.response) {
      res.status(error.response.status).json(error.response.data);
    } else {
      next(error);
    }
  }
});

app.post('/api/orders', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  const inventoryItems = extractInventoryItems(req.body);
  if (inventoryItems.length === 0) {
    res.status(400).json({ message: 'Order items are required' });
    return;
  }
  try {
    await axios.post(
      `${PRODUCT_SERVICE_URL}/api/products/reserve`,
      { items: inventoryItems },
      { headers: { 'Content-Type': 'application/json' } }
    );

    const response = await axios.post(`${ORDER_SERVICE_URL}/api/orders`, req.body, {
      headers: { 'Content-Type': 'application/json' },
    });
    res.status(response.status).json(response.data);
  } catch (error: any) {
    // best-effort release if order creation fails after a successful reserve
    if (!error?.config?.url?.includes('/api/products/reserve')) {
      try {
        await axios.post(
          `${PRODUCT_SERVICE_URL}/api/products/release`,
          { items: inventoryItems },
          { headers: { 'Content-Type': 'application/json' } }
        );
      } catch {
        // ignore release failure and return original error
      }
    }
    if (error.response) {
      res.status(error.response.status).json(error.response.data);
    } else {
      next(error);
    }
  }
});

app.patch('/api/orders/:id', requireAuth, requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const authHeader = req.headers.authorization;
    const response = await axios.patch(`${ORDER_SERVICE_URL}/api/orders/${id}`, req.body, {
      headers: { 'Content-Type': 'application/json', ...(authHeader && { Authorization: authHeader }) },
    });
    if (response.status >= 200 && response.status < 300) {
      recordAdminAudit(authHeader, 'admin.order.update', `order:${id}`, {
        status: (req.body as any)?.status,
      });
    }
    res.status(response.status).json(response.data);
  } catch (error: any) {
    if (error.response) {
      res.status(error.response.status).json(error.response.data);
    } else {
      next(error);
    }
  }
});

app.post('/api/orders/:id/shipment', requireAuth, requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    const response = await axios.post(`${ORDER_SERVICE_URL}/api/orders/${req.params.id}/shipment`, req.body, {
      headers: { 'Content-Type': 'application/json', ...(authHeader && { Authorization: authHeader }) },
    });
    if (response.status >= 200 && response.status < 300) {
      recordAdminAudit(authHeader, 'admin.order.shipment', `order:${req.params.id}`, {
        status: (req.body as any)?.status,
        trackingId: (req.body as any)?.trackingId,
      });
    }
    res.status(response.status).json(response.data);
  } catch (error: any) {
    if (error.response) res.status(error.response.status).json(error.response.data);
    else next(error);
  }
});

app.get('/api/orders/promotions', requireAuth, requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const response = await axios.get(`${ORDER_SERVICE_URL}/api/orders/promotions`);
    res.status(response.status).json(response.data);
  } catch (error: any) {
    if (error.response) res.status(error.response.status).json(error.response.data);
    else next(error);
  }
});

app.post('/api/orders/promotions', requireAuth, requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const response = await axios.post(`${ORDER_SERVICE_URL}/api/orders/promotions`, req.body, {
      headers: { 'Content-Type': 'application/json' },
    });
    if (response.status >= 200 && response.status < 300) {
      recordAdminAudit(
        req.headers.authorization,
        'admin.promotion.upsert',
        `promotion:${(req.body as any)?.code ?? 'unknown'}`,
        {
          percentOff: (req.body as any)?.percentOff,
          categoryScope: (req.body as any)?.categoryScope ?? null,
          maxUses: (req.body as any)?.maxUses ?? null,
        }
      );
    }
    res.status(response.status).json(response.data);
  } catch (error: any) {
    if (error.response) res.status(error.response.status).json(error.response.data);
    else next(error);
  }
});

app.patch('/api/orders/promotions/:code', requireAuth, requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const response = await axios.patch(`${ORDER_SERVICE_URL}/api/orders/promotions/${req.params.code}`, req.body, {
      headers: { 'Content-Type': 'application/json' },
    });
    if (response.status >= 200 && response.status < 300) {
      recordAdminAudit(
        req.headers.authorization,
        'admin.promotion.update',
        `promotion:${req.params.code}`,
        { fields: Object.keys(req.body || {}) }
      );
    }
    res.status(response.status).json(response.data);
  } catch (error: any) {
    if (error.response) res.status(error.response.status).json(error.response.data);
    else next(error);
  }
});

app.patch('/api/orders/promotions/:code/toggle', requireAuth, requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const response = await axios.patch(`${ORDER_SERVICE_URL}/api/orders/promotions/${req.params.code}/toggle`);
    if (response.status >= 200 && response.status < 300) {
      recordAdminAudit(
        req.headers.authorization,
        'admin.promotion.toggle',
        `promotion:${req.params.code}`,
        { active: (response.data as any)?.active }
      );
    }
    res.status(response.status).json(response.data);
  } catch (error: any) {
    if (error.response) res.status(error.response.status).json(error.response.data);
    else next(error);
  }
});

app.delete('/api/orders/promotions/:code', requireAuth, requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const response = await axios.delete(`${ORDER_SERVICE_URL}/api/orders/promotions/${req.params.code}`);
    if (response.status >= 200 && response.status < 300) {
      recordAdminAudit(
        req.headers.authorization,
        'admin.promotion.delete',
        `promotion:${req.params.code}`
      );
    }
    res.status(response.status).send(response.data);
  } catch (error: any) {
    if (error.response) res.status(error.response.status).json(error.response.data);
    else next(error);
  }
});

app.post('/api/orders/:id/payment-intent', requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const authHeader = req.headers.authorization;
    const orderResponse = await axios.get(`${ORDER_SERVICE_URL}/api/orders/${id}`);
    const order = orderResponse.data as { userId?: number };
    const isAdmin = req.user?.role === 'admin';
    if (!isAdmin && order?.userId !== req.user?.orderUserId) {
      res.status(403).json({ message: 'Access denied' });
      return;
    }
    const response = await axios.post(`${ORDER_SERVICE_URL}/api/orders/${id}/payment-intent`, undefined, {
      headers: authHeader ? { Authorization: authHeader } : {},
    });
    res.status(response.status).json(response.data);
  } catch (error: any) {
    if (error.response) {
      res.status(error.response.status).json(error.response.data);
    } else {
      next(error);
    }
  }
});

app.post('/api/orders/:id/payment-webhook', requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const authHeader = req.headers.authorization;
    const orderResponse = await axios.get(`${ORDER_SERVICE_URL}/api/orders/${id}`);
    const order = orderResponse.data as { userId?: number };
    const isAdmin = req.user?.role === 'admin';
    if (!isAdmin && order?.userId !== req.user?.orderUserId) {
      res.status(403).json({ message: 'Access denied' });
      return;
    }
    const response = await axios.post(`${ORDER_SERVICE_URL}/api/orders/${id}/payment-webhook`, req.body, {
      headers: { 'Content-Type': 'application/json', ...(authHeader && { Authorization: authHeader }) },
    });
    res.status(response.status).json(response.data);
  } catch (error: any) {
    if (error.response) {
      res.status(error.response.status).json(error.response.data);
    } else {
      next(error);
    }
  }
});

app.get('/api/orders/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const response = await axios.get(`${ORDER_SERVICE_URL}/api/orders/${id}`);
    res.status(response.status).json(response.data);
  } catch (error: any) {
    if (error.response) {
      res.status(error.response.status).json(error.response.data);
    } else {
      next(error);
    }
  }
});

app.get('/api/orders/user/:userId', requireAuth, (req: AuthRequest, res: Response, next: NextFunction) => {
  const { userId } = req.params;
  const orderUserId = req.user?.orderUserId;
  const isAdmin = req.user?.role === 'admin';
  const requestedId = Number(userId);
  if (Number.isNaN(requestedId) || (!isAdmin && (orderUserId == null || orderUserId !== requestedId))) {
    res.status(403).json({ message: 'Access denied' });
    return;
  }
  axios
    .get(`${ORDER_SERVICE_URL}/api/orders/user/${userId}`, {
      headers: req.headers.authorization ? { Authorization: req.headers.authorization } : {},
    })
    .then((response) => res.status(response.status).json(response.data))
    .catch((error: any) => {
      if (error.response) res.status(error.response.status).json(error.response.data);
      else next(error);
    });
});

app.get('/api/admin/ops/overview', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  const checks = await Promise.allSettled([
    axios.get(`${USER_SERVICE_URL}/health`),
    axios.get(`${PRODUCT_SERVICE_URL}/health`),
    axios.get(`${ORDER_SERVICE_URL}/health`),
  ]);
  const statuses = {
    user: checks[0].status === 'fulfilled' ? 'up' : 'down',
    product: checks[1].status === 'fulfilled' ? 'up' : 'down',
    order: checks[2].status === 'fulfilled' ? 'up' : 'down',
  };
  res.json({
    gateway: 'up',
    services: statuses,
    generatedAt: new Date().toISOString(),
  });
});

app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error(err);
  res.status(500).json({ message: 'Internal server error' });
});

export { app };

const PORT = process.env.PORT || 4000;

if (require.main === module) {
  app.listen(PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`API Gateway listening on port ${PORT}`);
  });
}

