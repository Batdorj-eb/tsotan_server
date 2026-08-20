import bcrypt from "bcryptjs";
import { config } from "../config.js";
import { pool, query, queryOne, schemaSql } from "../db.js";

const rootCategories = [
  "Даавуу",
  "Футболк",
  "Бүс",
  "Уут",
  "Ширээний бүтээлэг",
  "Ширээний гол",
  "Амны алчуур",
  "Цүнх, Богц",
  "Аравч",
  "Буйдангын суудал",
  "Дэрний уут",
  "Холст хэвлэл",
  "Хормогч",
  "Бэлэн хувцас",
  "Бусад",
];

async function init() {
  await pool.query(schemaSql());
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

  const existing = await queryOne("SELECT id FROM users WHERE username = $1", [
    config.adminUsername,
  ]);
  if (!existing) {
    const hash = await bcrypt.hash(config.adminPassword, 10);
    await query(
      `INSERT INTO users (username, email, password_hash, role)
       VALUES ($1, $2, $3, 'ADMIN')`,
      [config.adminUsername, "admin@tsotan.mn", hash],
    );
    console.log(`Admin user created: ${config.adminUsername}`);
  }

  const cats = await query("SELECT id FROM categories LIMIT 1");
  if (cats.length === 0) {
    for (const name of rootCategories) {
      await query(
        "INSERT INTO categories (parent_id, name) VALUES (0, $1)",
        [name],
      );
    }
    console.log("Root categories seeded");
  }

  console.log("Database ready");
  await pool.end();
}

init().catch((err) => {
  console.error(err);
  process.exit(1);
});
