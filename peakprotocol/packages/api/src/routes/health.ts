import { Hono } from "hono";
import type { Env } from "../env";

export const healthRoutes = new Hono<{ Bindings: Env }>();

const healthResponse = () => ({
  status: "ok" as const,
  timestamp: new Date().toISOString(),
});

// GET /health
healthRoutes.get("/health", (c) => {
  return c.json(healthResponse());
});

// GET /api/health
healthRoutes.get("/api/health", (c) => {
  return c.json(healthResponse());
});
