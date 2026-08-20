import { Router } from "express";
import { query, queryOne } from "../db.js";
import { requireAdmin } from "../middleware/auth.js";
import {
  checkQpayPayment,
  createQpayInvoice,
  isQpayNetworkError,
  isQpayPaid,
  qpayErrorMessage,
} from "../services/qpay.js";

export const orderRouter = Router();

type OrderBody = {
  phoneNumber?: string;
  orderedProducts?: string;
  price?: number;
  address?: string;
  comment?: string;
  email?: string;
  fb?: string;
};

function mapOrder(row: Record<string, unknown>) {
  return {
    id: row.id,
    phoneNumber: row.phone_number,
    orderedProducts: row.ordered_products,
    price: Number(row.price),
    address: row.address,
    comment: row.comment,
    email: row.email,
    fb: row.fb,
    orderState: row.order_state,
    createdAt: row.created_at,
    transactionInfo: row.transaction_info,
    qpayInvoiceId: row.qpay_invoice_id,
  };
}

orderRouter.post("/create", async (req, res) => {
  const body = req.body as OrderBody;
  const row = await queryOne(
    `INSERT INTO orders (phone_number, ordered_products, price, address, comment, email, fb, order_state)
     VALUES ($1,$2,$3,$4,$5,$6,$7,'CREATED')
     RETURNING *`,
    [
      body.phoneNumber || null,
      body.orderedProducts || null,
      body.price || 0,
      body.address || null,
      body.comment || null,
      body.email || null,
      body.fb || null,
    ],
  );
  res.json(mapOrder(row as Record<string, unknown>));
});

orderRouter.post("/qpay-invoice", async (req, res, next) => {
  try {
  const body = req.body as OrderBody;
  const order = await queryOne(
    `INSERT INTO orders (phone_number, ordered_products, price, address, comment, email, fb, order_state)
     VALUES ($1,$2,$3,$4,$5,$6,$7,'CREATED')
     RETURNING *`,
    [
      body.phoneNumber || null,
      body.orderedProducts || null,
      body.price || 0,
      body.address || null,
      body.comment || null,
      body.email || null,
      body.fb || null,
    ],
  );
  if (!order) {
    res.status(500).json({ message: "Захиалга үүсгэж чадсангүй" });
    return;
  }

  const unique = `#${order.id}`;
  const invoice = await createQpayInvoice(unique, Number(order.price));
  const invoiceId = String(invoice.invoice_id || "");
  await query(
    `UPDATE orders
     SET qpay_invoice_id = $1, transaction_info = $2
     WHERE id = $3`,
    [invoiceId, `TSOTAN ${unique}`, order.id],
  );

  res.json({
    qpayUrl: invoice.qr_image,
    qpayText: invoice.qr_text,
    invoiceId,
    qpayShortUrl: invoice.qPay_shortUrl || invoice.qpay_shortUrl,
    transactionInfo: unique,
    orderId: order.id,
  });
  } catch (err) {
    next(err);
  }
});

async function markPaidIfNeeded(order: Record<string, unknown>) {
  if (order.order_state === "PAID") return mapOrder(order);
  if (!order.qpay_invoice_id) return mapOrder(order);

  const payment = await checkQpayPayment(String(order.qpay_invoice_id));
  if (isQpayPaid(payment, Number(order.price))) {
    const updated = await queryOne(
      "UPDATE orders SET order_state = 'PAID' WHERE id = $1 RETURNING *",
      [order.id],
    );
    return mapOrder(updated as Record<string, unknown>);
  }
  return mapOrder(order);
}

export async function syncCreatedPayments() {
  const orders = await query(
    `SELECT * FROM orders
     WHERE order_state = 'CREATED'
       AND qpay_invoice_id IS NOT NULL
       AND created_at >= NOW() - INTERVAL '6 hours'
     ORDER BY id DESC
     LIMIT 30`,
  );
  for (const order of orders) {
    try {
      await markPaidIfNeeded(order as Record<string, unknown>);
    } catch (err) {
      if (isQpayNetworkError(err)) {
        return { unreachable: true };
      }
      console.error("QPay sync failed", order.id, qpayErrorMessage(err));
    }
  }
  return { unreachable: false };
}

orderRouter.get("/check-payment/:id", async (req, res, next) => {
  try {
    const order = await queryOne("SELECT * FROM orders WHERE id = $1", [
      Number(req.params.id),
    ]);
    if (!order) {
      res.status(404).json({ message: "Захиалга олдсонгүй" });
      return;
    }
    res.json(await markPaidIfNeeded(order as Record<string, unknown>));
  } catch (err) {
    next(err);
  }
});

async function handleQpayCallback(
  req: { query: Record<string, unknown> },
  res: { json: (v: unknown) => void },
) {
  const paymentId = String(req.query.payment_id || "").replace("#", "");
  const order = await queryOne("SELECT * FROM orders WHERE id = $1", [
    Number(paymentId),
  ]);
  if (order) await markPaidIfNeeded(order as Record<string, unknown>);
  res.json(true);
}

orderRouter.get("/qpay-callback", async (req, res, next) => {
  try {
    await handleQpayCallback(req, res);
  } catch (err) {
    next(err);
  }
});

orderRouter.post("/qpay-callback", async (req, res, next) => {
  try {
    await handleQpayCallback(req, res);
  } catch (err) {
    next(err);
  }
});

orderRouter.get("/search", requireAdmin, async (req, res) => {
  const phone = req.query.phoneNumber ? `%${req.query.phoneNumber}%` : null;
  const state = req.query.state ? String(req.query.state) : null;
  const page = Number(req.query.page || 0);
  const size = Number(req.query.size || 20);
  const rows = await query(
    `SELECT * FROM orders
     WHERE ($1::text IS NULL OR phone_number ILIKE $1)
       AND ($2::text IS NULL OR order_state = $2)
     ORDER BY id DESC
     LIMIT $3 OFFSET $4`,
    [phone, state, size, page * size],
  );
  const count = await queryOne<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM orders
     WHERE ($1::text IS NULL OR phone_number ILIKE $1)
       AND ($2::text IS NULL OR order_state = $2)`,
    [phone, state],
  );
  res.json({
    content: rows.map((row) => mapOrder(row as Record<string, unknown>)),
    totalElements: Number(count?.count || 0),
    number: page,
    size,
  });
});

orderRouter.get("/update-state/:id", requireAdmin, async (req, res) => {
  const state = String(req.query.state || "");
  const row = await queryOne(
    "UPDATE orders SET order_state = $1 WHERE id = $2 RETURNING *",
    [state, Number(req.params.id)],
  );
  res.json(mapOrder(row as Record<string, unknown>));
});
