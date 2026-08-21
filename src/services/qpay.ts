import { config } from "../config.js";

type TokenCache = { token: string; expiresAt: number };
let cache: TokenCache | null = null;

export function isQpayNetworkError(err: unknown): boolean {
  let current: unknown = err;
  for (let i = 0; i < 5 && current; i++) {
    if (typeof current !== "object") break;
    const e = current as {
      name?: string;
      code?: string;
      message?: string;
      cause?: unknown;
    };
    const name = String(e.name || "");
    const code = String(e.code || "");
    const message = String(e.message || "");
    if (
      name === "AbortError" ||
      name === "TimeoutError" ||
      name === "ConnectTimeoutError" ||
      /ENOTFOUND|EAI_AGAIN|ECONNREFUSED|ECONNRESET|ETIMEDOUT|UND_ERR_|ConnectTimeout/.test(
        code,
      ) ||
      /fetch failed|ENOTFOUND|ConnectTimeout|aborted|timeout/i.test(message)
    ) {
      return true;
    }
    current = e.cause;
  }
  return false;
}

export function qpayErrorMessage(err: unknown): string {
  if (!err) return "unknown error";
  if (err instanceof Error) {
    const cause = (err as Error & { cause?: { code?: string; message?: string } })
      .cause;
    const code =
      (err as NodeJS.ErrnoException).code ||
      cause?.code ||
      "";
    const detail = cause?.message || err.message;
    return code ? `${detail} (${code})` : detail;
  }
  return String(err);
}

async function qpayFetch(path: string, init: RequestInit) {
  const res = await fetch(`${config.qpay.baseUrl}${path}`, {
    ...init,
    signal: init.signal ?? AbortSignal.timeout(20_000),
  });
  const text = await res.text();
  let data: unknown = text;
  try {
    data = JSON.parse(text);
  } catch {
    /* keep text */
  }
  if (!res.ok) {
    throw new Error(`QPay ${path} failed: ${res.status} ${text}`);
  }
  return data as Record<string, unknown>;
}

export async function getQpayToken() {
  if (!config.qpay.username || !config.qpay.password) {
    throw new Error("QPay username/password тохируулаагүй");
  }
  if (cache && cache.expiresAt > Date.now() + 30_000) return cache.token;

  const basic = Buffer.from(
    `${config.qpay.username}:${config.qpay.password}`,
  ).toString("base64");

  const data = await qpayFetch("/auth/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: "{}",
  });

  const token = String(data.access_token || "");
  const expiresIn = Number(data.expires_in || 3600);
  cache = { token, expiresAt: Date.now() + expiresIn * 1000 };
  return token;
}

export async function createQpayInvoice(senderInvoiceNo: string, amount: number) {
  const token = await getQpayToken();
  return qpayFetch("/invoice", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify({
      invoice_code: config.qpay.invoiceCode,
      sender_invoice_no: senderInvoiceNo,
      invoice_receiver_code: `PR${senderInvoiceNo}`,
      invoice_description: `TSOTAN ${senderInvoiceNo}`,
      amount,
      callback_url: `${config.qpay.callbackUrl}?payment_id=${encodeURIComponent(senderInvoiceNo)}`,
    }),
  });
}

export async function checkQpayPayment(invoiceId: string) {
  const token = await getQpayToken();
  return qpayFetch("/payment/check", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify({
      object_type: "INVOICE",
      object_id: invoiceId,
    }),
  });
}

export function isQpayPaid(
  payment: Record<string, unknown>,
  orderPrice: number,
) {
  const rows = Array.isArray(payment.rows) ? payment.rows : [];
  const count = Number(payment.count || 0);
  const paidAmount = Number(payment.paid_amount ?? payment.paidAmount ?? 0);
  const rowPaid = rows.some((row) => {
    const status = String(
      (row as Record<string, unknown>).payment_status ||
        (row as Record<string, unknown>).paymentStatus ||
        "",
    ).toUpperCase();
    return status === "PAID" || status === "SUCCESS";
  });
  return paidAmount >= orderPrice || rowPaid || (count > 0 && paidAmount > 0);
}
