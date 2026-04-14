import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Env, Variables } from "./env";
import { securityHeaders } from "./middleware/security";
import { idempotency } from "./middleware/idempotency";
import { healthRoutes } from "./routes/health";
import { authRoutes } from "./routes/auth";
import { supplementRoutes } from "./routes/supplements";
import { logRoutes } from "./routes/logs";
import { doseRoutes } from "./routes/doses";
import { scheduleRoutes, singleScheduleRoutes } from "./routes/schedule";
import { pushRoutes } from "./routes/push";
import { complianceRoutes } from "./routes/compliance";
import { foodRoutes } from "./routes/foods";
import { foodEntryRoutes } from "./routes/food-entries";
import { savedFoodRoutes } from "./routes/saved-foods";
import { metricsRoutes } from "./routes/metrics";
import { trainingRoutes } from "./routes/training";
import { journalRoutes } from "./routes/journal";
import { analysisRoutes } from "./routes/analysis";
import { dailySummaryRoutes } from "./routes/daily-summary";
import { calendarSupplementRoutes } from "./routes/calendar-supplements";
import { batchLogRoutes } from "./routes/batch-log";
import { exportRoutes, importRoutes } from "./routes/export";
import { handleScheduledEvent } from "./cron";

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

// --- Global Middleware ---
app.use("*", cors({
  origin: (origin) => {
    // Allow localhost in development
    if (origin && (origin.startsWith("http://localhost") || origin.startsWith("https://localhost"))) {
      return origin;
    }
    // Allow Cloudflare Pages frontend
    if (origin && (origin.endsWith(".peakprotocol-web.pages.dev") || origin === "https://peakprotocol-web.pages.dev")) {
      return origin;
    }
    // In production with same origin or custom domain
    return origin ?? "";
  },
  credentials: true,
  allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowHeaders: ["Content-Type", "Authorization", "X-Request-Id"],
  maxAge: 86400,
}));
app.use("*", securityHeaders());
app.use("*", idempotency);

// --- Routes ---
app.route("/", healthRoutes);
app.route("/", authRoutes);
app.route("/api/supplements", logRoutes);
app.route("/api/supplements", supplementRoutes);
app.route("/api/supplements", doseRoutes);
app.route("/api/supplements/schedule", scheduleRoutes);
app.route("/api/supplements/:id/schedule", singleScheduleRoutes);
app.route("/api/push", pushRoutes);
app.route("/api/compliance", complianceRoutes);
app.route("/api/foods", foodRoutes);
app.route("/api/food-entries", foodEntryRoutes);
app.route("/api/saved-foods", savedFoodRoutes);
app.route("/api/training-sessions", trainingRoutes);
app.route("/api/metrics", metricsRoutes);
app.route("/api/journal", journalRoutes);
app.route("/api/analysis", analysisRoutes);
app.route("/api/daily-summary", dailySummaryRoutes);
app.route("/api/calendar-supplements", calendarSupplementRoutes);
app.route("/api/supplements", batchLogRoutes);
app.route("/api/export", exportRoutes);
app.route("/api/import", importRoutes);

// --- Global Error Handler ---
app.onError((err, c) => {
  console.error(`[ERROR] ${err.message}`, err.stack);
  return c.json(
    { error: "Internal Server Error", message: err.message },
    500
  );
});

// --- 404 Handler ---
app.notFound((c) => {
  return c.json({ error: "Not Found", path: c.req.path }, 404);
});

// --- Cron Handler ---
const scheduled: ExportedHandlerScheduledHandler<Env> = async (
  event,
  env,
  ctx
) => {
  ctx.waitUntil(handleScheduledEvent(event, env, ctx));
};

export default {
  fetch: app.fetch,
  scheduled,
};
