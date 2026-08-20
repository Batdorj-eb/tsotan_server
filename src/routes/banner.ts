import { Router } from "express";
import { query, queryOne, publicFileUrl } from "../db.js";
import { requireAdmin } from "../middleware/auth.js";

export const bannerRouter = Router();

const BANNER_SELECT = `id, url, type, title, subtitle, eyebrow, cta, href, description,
  sort_order AS "sortOrder", created_at AS "createdAt"`;

type BannerRow = {
  id: number;
  url: string;
  type: string;
  title?: string | null;
  subtitle?: string | null;
  eyebrow?: string | null;
  cta?: string | null;
  href?: string | null;
  description?: string | null;
  sortOrder?: number;
  createdAt?: string;
};

function toBanner(row: BannerRow) {
  return {
    ...row,
    url: publicFileUrl(String(row.url)),
    path: row.url,
  };
}

bannerRouter.get("/list", async (req, res) => {
  const type = String(req.query.type || "");
  const rows = await query<BannerRow>(
    `SELECT ${BANNER_SELECT} FROM banners WHERE type = $1 ORDER BY sort_order ASC, id ASC`,
    [type],
  );
  res.json(rows.map(toBanner));
});

bannerRouter.get("/list-all", requireAdmin, async (_req, res) => {
  const rows = await query<BannerRow>(
    `SELECT ${BANNER_SELECT} FROM banners ORDER BY sort_order ASC, id ASC`,
  );
  res.json(rows.map(toBanner));
});

bannerRouter.post("/add", requireAdmin, async (req, res) => {
  const body = req.body as Record<string, unknown>;
  const type = String(body.type || "slider");
  const max = await queryOne<{ max: number }>(
    `SELECT COALESCE(MAX(sort_order), 0) AS max FROM banners WHERE type = $1`,
    [type],
  );
  const row = await queryOne<BannerRow>(
    `INSERT INTO banners (url, type, title, subtitle, eyebrow, cta, href, description, sort_order)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     RETURNING ${BANNER_SELECT}`,
    [
      body.url,
      type,
      body.title || null,
      body.subtitle || null,
      body.eyebrow || null,
      body.cta || null,
      body.href || null,
      body.description || null,
      Number(body.sortOrder ?? (max?.max || 0) + 1),
    ],
  );
  res.json(row ? toBanner(row) : row);
});

bannerRouter.post("/update/:id", requireAdmin, async (req, res) => {
  const body = req.body as Record<string, unknown>;
  const row = await queryOne<BannerRow>(
    `UPDATE banners SET
      url = COALESCE($1, url),
      type = COALESCE($2, type),
      title = COALESCE($3, title),
      subtitle = COALESCE($4, subtitle),
      eyebrow = COALESCE($5, eyebrow),
      cta = COALESCE($6, cta),
      href = COALESCE($7, href),
      description = COALESCE($8, description),
      sort_order = COALESCE($9, sort_order)
     WHERE id = $10
     RETURNING ${BANNER_SELECT}`,
    [
      body.url || null,
      body.type || null,
      body.title ?? null,
      body.subtitle ?? null,
      body.eyebrow ?? null,
      body.cta ?? null,
      body.href ?? null,
      body.description ?? null,
      body.sortOrder == null ? null : Number(body.sortOrder),
      Number(req.params.id),
    ],
  );
  res.json(row ? toBanner(row) : row);
});

bannerRouter.delete("/delete/:id", requireAdmin, async (req, res) => {
  await query("DELETE FROM banners WHERE id = $1", [Number(req.params.id)]);
  res.json(true);
});
