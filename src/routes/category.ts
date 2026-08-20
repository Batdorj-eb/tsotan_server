import { Router } from "express";
import { query, queryOne } from "../db.js";
import { requireAdmin } from "../middleware/auth.js";

export const categoryRouter = Router();

categoryRouter.get("/list", async (_req, res) => {
  const rows = await query(
    "SELECT id, parent_id AS \"parentId\", name FROM categories ORDER BY id",
  );
  res.json(rows);
});

categoryRouter.get("/list/:parentId", async (req, res) => {
  const parentId = Number(req.params.parentId);
  const rows = await query(
    `SELECT id, parent_id AS "parentId", name
     FROM categories
     WHERE parent_id = $1
     ORDER BY id`,
    [parentId],
  );
  res.json(rows);
});

categoryRouter.get("/list-names", async (_req, res) => {
  const rows = await query(
    "SELECT id, parent_id AS \"parentId\", name FROM categories ORDER BY id",
  );
  res.json(rows);
});

categoryRouter.post("/create", requireAdmin, async (req, res) => {
  const { name, parentId } = req.body as { name?: string; parentId?: number };
  if (!name?.trim()) {
    res.status(400).json({ message: "Нэр оруулна уу" });
    return;
  }
  const row = await queryOne(
    `INSERT INTO categories (parent_id, name)
     VALUES ($1, $2)
     RETURNING id, parent_id AS "parentId", name`,
    [parentId ?? 0, name.trim()],
  );
  res.json(row);
});

categoryRouter.delete("/delete/:categoryId", requireAdmin, async (req, res) => {
  await query("DELETE FROM categories WHERE id = $1", [
    Number(req.params.categoryId),
  ]);
  res.json(true);
});
