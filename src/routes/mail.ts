import { Router } from "express";
import nodemailer from "nodemailer";
import { config } from "../config.js";
import { query } from "../db.js";

export const mailRouter = Router();

mailRouter.post("/send", async (req, res) => {
  const { suggest, phoneNumber } = req.body as {
    suggest?: string;
    phoneNumber?: string;
  };
  await query(
    "INSERT INTO messages (phone_number, suggest) VALUES ($1, $2)",
    [phoneNumber || null, suggest || null],
  );

  if (config.smtp.host && config.smtp.user) {
    const transporter = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: false,
      auth: { user: config.smtp.user, pass: config.smtp.pass },
    });
    await transporter.sendMail({
      from: config.smtp.user,
      to: config.mailTo,
      subject: "Tsotan санал хүсэлт",
      text: `Утас: ${phoneNumber}\n\n${suggest}`,
    });
  }

  res.json(true);
});
