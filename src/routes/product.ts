import { Router } from "express";
import multer from "multer";
import path from "node:path";
import fs from "node:fs";
import { query, queryOne, publicFileUrl } from "../db.js";
import { requireAdmin } from "../middleware/auth.js";
import {
  descendantIds,
  loadCategories,
  toProductDetail,
  toProductDto,
} from "../services/catalog.js";

const uploadDir = path.join(process.cwd(), "uploads");
fs.mkdirSync(uploadDir, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: uploadDir,
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname || "").toLowerCase();
      cb(null, `${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`);
    },
  }),
  limits: { fileSize: 8 * 1024 * 1024 },
});

export const productRouter = Router();

productRouter.get("/list", async (_req, res) => {
  const [products, categories] = await Promise.all([
    query("SELECT * FROM products ORDER BY id DESC"),
    loadCategories(),
  ]);
  res.json(products.map((p) => toProductDto(p as never, categories)));
});

productRouter.get("/list/:id", async (req, res) => {
  const categoryId = Number(req.params.id);
  const categories = await loadCategories();
  if (!categoryId) {
    const products = await query("SELECT * FROM products ORDER BY id DESC");
    res.json(products.map((p) => toProductDto(p as never, categories)));
    return;
  }
  const ids = await descendantIds(categoryId);
  const products = await query(
    `SELECT * FROM products WHERE category_id = ANY($1::int[]) ORDER BY id DESC`,
    [ids],
  );
  res.json(products.map((p) => toProductDto(p as never, categories)));
});

productRouter.get("/detail/:id", async (req, res) => {
  const product = await queryOne("SELECT * FROM products WHERE id = $1", [
    Number(req.params.id),
  ]);
  if (!product) {
    res.status(404).json({ message: "Бүтээгдэхүүн олдсонгүй" });
    return;
  }
  const categories = await loadCategories();
  res.json(toProductDetail(product as never, categories));
});

productRouter.get("/view/:id", async (req, res) => {
  const product = await queryOne("SELECT * FROM products WHERE id = $1", [
    Number(req.params.id),
  ]);
  if (!product) {
    res.status(404).json({ message: "Бүтээгдэхүүн олдсонгүй" });
    return;
  }
  const categories = await loadCategories();
  res.json(toProductDto(product as never, categories));
});

productRouter.post("/create", requireAdmin, async (req, res) => {
  const body = req.body as Record<string, unknown>;
  const images = Array.isArray(body.images)
    ? (body.images as string[])
    : [body.img1, body.img2, body.img3, body.img4].filter(Boolean) as string[];
  const row = await queryOne(
    `INSERT INTO products
      (name, category_id, price, img1, img2, img3, img4, images, description, instruction, size, weight, material, is_special, is_new)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10,$11,$12,$13,$14,$15)
     RETURNING id`,
    [
      body.name,
      body.categoryId,
      body.price,
      images[0] || null,
      images[1] || null,
      images[2] || null,
      images[3] || null,
      JSON.stringify(images),
      body.description || null,
      body.instruction || null,
      body.size || null,
      body.weight || null,
      body.material || null,
      Boolean(body.isSpecial),
      body.isNew === undefined ? true : Boolean(body.isNew),
    ],
  );
  res.json(row?.id);
});

productRouter.post("/update/:productId", requireAdmin, async (req, res) => {
  const body = req.body as Record<string, unknown>;
  const id = Number(req.params.productId);
  const images = Array.isArray(body.images)
    ? (body.images as string[])
    : [body.img1, body.img2, body.img3, body.img4].filter(Boolean) as string[];
  await query(
    `UPDATE products SET
      name=$1, category_id=$2, price=$3, img1=$4, img2=$5, img3=$6, img4=$7, images=$8::jsonb,
      description=$9, instruction=$10, size=$11, weight=$12, material=$13,
      is_special=$14, is_new=$15, updated_at=NOW()
     WHERE id=$16`,
    [
      body.name,
      body.categoryId,
      body.price,
      images[0] || null,
      images[1] || null,
      images[2] || null,
      images[3] || null,
      JSON.stringify(images),
      body.description || null,
      body.instruction || null,
      body.size || null,
      body.weight || null,
      body.material || null,
      Boolean(body.isSpecial),
      Boolean(body.isNew),
      id,
    ],
  );
  res.json(id);
});

productRouter.delete("/delete/:productId", requireAdmin, async (req, res) => {
  await query("DELETE FROM products WHERE id = $1", [
    Number(req.params.productId),
  ]);
  res.json(true);
});

productRouter.post(
  "/upload",
  requireAdmin,
  upload.fields([
    { name: "files", maxCount: 20 },
    { name: "file", maxCount: 1 },
  ]),
  (req, res) => {
    const grouped = req.files as Record<string, Express.Multer.File[]> | undefined;
    const files = [
      ...(grouped?.files || []),
      ...(grouped?.file || []),
    ];
    if (!files.length) {
      res.status(400).json({ message: "Файл олдсонгүй" });
      return;
    }
    const items = files.map((file) => {
      const stored = `/uploads/${file.filename}`;
      return { url: publicFileUrl(stored), path: stored };
    });
    res.json({
      items,
      ...(items.length === 1 ? items[0] : {}),
    });
  },
);
