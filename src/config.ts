import "dotenv/config";

export const config = {
  port: Number(process.env.PORT || 4000),
  databaseUrl:
    process.env.DATABASE_URL ||
    "postgres://tsotan:tsotan@localhost:5432/tsotan",
  jwtSecret: process.env.JWT_SECRET || "change-this-secret",
  publicUrl: process.env.PUBLIC_URL || "http://localhost:4000",
  adminUsername: process.env.ADMIN_USERNAME || "admin",
  adminPassword: process.env.ADMIN_PASSWORD || "admin123",
  usdRate: Number(process.env.USD_RATE || 3400),
  qpay: {
    username: process.env.QPAY_USERNAME || "",
    password: process.env.QPAY_PASSWORD || "",
    invoiceCode: process.env.QPAY_INVOICE_CODE || "TSOTAN_INVOICE",
    baseUrl: process.env.QPAY_BASE_URL || "https://merchant.qpay.mn/v2",
    callbackUrl:
      process.env.QPAY_CALLBACK_URL ||
      "http://localhost:4000/order/qpay-callback",
  },
  mailTo: process.env.MAIL_TO || "tsotan.des@gmail.com",
  smtp: {
    host: process.env.SMTP_HOST || "",
    port: Number(process.env.SMTP_PORT || 587),
    user: process.env.SMTP_USER || "",
    pass: process.env.SMTP_PASS || "",
  },
};
