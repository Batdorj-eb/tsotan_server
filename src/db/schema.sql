-- Tsotan schema

CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  username      TEXT UNIQUE NOT NULL,
  email         TEXT,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'ADMIN',
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  last_login    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS categories (
  id         SERIAL PRIMARY KEY,
  parent_id  INTEGER NOT NULL DEFAULT 0,
  name       TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS products (
  id            SERIAL PRIMARY KEY,
  name          TEXT NOT NULL,
  category_id   INTEGER NOT NULL REFERENCES categories(id),
  price         NUMERIC(12,2) NOT NULL,
  img1          TEXT,
  img2          TEXT,
  img3          TEXT,
  img4          TEXT,
  description   TEXT,
  instruction   TEXT,
  size          TEXT,
  weight        TEXT,
  material      TEXT,
  is_special    BOOLEAN NOT NULL DEFAULT FALSE,
  is_new        BOOLEAN NOT NULL DEFAULT TRUE,
  images        JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS banners (
  id          SERIAL PRIMARY KEY,
  url         TEXT NOT NULL,
  type        TEXT NOT NULL,
  title       TEXT,
  subtitle    TEXT,
  eyebrow     TEXT,
  cta         TEXT,
  href        TEXT,
  description TEXT,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS orders (
  id                 SERIAL PRIMARY KEY,
  phone_number       TEXT,
  ordered_products   TEXT,
  price              NUMERIC(12,2) NOT NULL DEFAULT 0,
  address            TEXT,
  comment            TEXT,
  email              TEXT,
  fb                 TEXT,
  order_state        TEXT NOT NULL DEFAULT 'CREATED',
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  transaction_info   TEXT,
  qpay_invoice_id    TEXT
);

CREATE TABLE IF NOT EXISTS messages (
  id            SERIAL PRIMARY KEY,
  phone_number  TEXT,
  suggest       TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
