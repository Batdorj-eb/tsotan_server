import cors from "cors";
import express from "express";
import path from "node:path";
import fs from "node:fs";
import { config } from "./config.js";
import { pool } from "./db.js";
import { authRouter } from "./routes/auth.js";
import { bannerRouter } from "./routes/banner.js";
import { categoryRouter } from "./routes/category.js";
import { mailRouter } from "./routes/mail.js";
import { orderRouter, syncCreatedPayments } from "./routes/order.js";
import { productRouter } from "./routes/product.js";

fs.mkdirSync(path.join(process.cwd(), "uploads"), { recursive: true });

const app = express();
app.use(
  cors({
    origin(origin, callback) {
      if (!origin) {
        callback(null, true);
        return;
      }
      try {
        const allowedHost = new URL(config.publicUrl).hostname;
        const requestHost = new URL(origin).hostname;
        if (
          requestHost === allowedHost ||
          config.corsOrigins.includes(origin) ||
          requestHost === "localhost" ||
          requestHost === "127.0.0.1"
        ) {
          callback(null, true);
          return;
        }
      } catch {
        /* deny */
      }
      callback(new Error(`CORS blocked: ${origin}`));
    },
    credentials: true,
  }),
);
app.use(express.json({ limit: "10mb" }));
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

app.get("/health", (_req, res) => res.json({ ok: true }));
app.use("/auth", authRouter);
app.use("/category", categoryRouter);
app.use("/product", productRouter);
app.use("/banner", bannerRouter);
app.use("/order", orderRouter);
app.use("/mail", mailRouter);

app.use(
  (
    err: Error,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    console.error(err);
    res.status(500).json({ message: err.message || "Алдаа гарлаа" });
  },
);

async function migrate() {
  await pool.query(
    `ALTER TABLE products ADD COLUMN IF NOT EXISTS images JSONB NOT NULL DEFAULT '[]'::jsonb`,
  );
  await pool.query(`ALTER TABLE banners ADD COLUMN IF NOT EXISTS title TEXT`);
  await pool.query(`ALTER TABLE banners ADD COLUMN IF NOT EXISTS subtitle TEXT`);
  await pool.query(`ALTER TABLE banners ADD COLUMN IF NOT EXISTS eyebrow TEXT`);
  await pool.query(`ALTER TABLE banners ADD COLUMN IF NOT EXISTS cta TEXT`);
  await pool.query(`ALTER TABLE banners ADD COLUMN IF NOT EXISTS href TEXT`);
  await pool.query(`ALTER TABLE banners ADD COLUMN IF NOT EXISTS description TEXT`);
  await pool.query(
    `ALTER TABLE banners ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0`,
  );
}

const QPAY_POLL_HEALTHY_MS = 15_000;
const QPAY_POLL_MAX_MS = 5 * 60_000;

function scheduleQpayPoll(delayMs = QPAY_POLL_HEALTHY_MS) {
  setTimeout(() => {
    syncCreatedPayments()
      .then((result) => {
        if (result?.unreachable) {
          const nextMs = Math.min(delayMs * 2, QPAY_POLL_MAX_MS);
          console.warn(`QPay unreachable, retry in ${Math.round(nextMs / 1000)}s`);
          scheduleQpayPoll(nextMs);
          return;
        }
        scheduleQpayPoll(QPAY_POLL_HEALTHY_MS);
      })
      .catch((err) => {
        console.error("QPay poll", err instanceof Error ? err.message : err);
        scheduleQpayPoll(QPAY_POLL_HEALTHY_MS);
      });
  }, delayMs);
}

async function start() {
  await migrate();
  app.listen(config.port, () => {
    console.log(`Tsotan API http://localhost:${config.port}`);
    scheduleQpayPoll();
  });
}

start().catch((err) => {
  console.error(err);
  process.exit(1);
});
