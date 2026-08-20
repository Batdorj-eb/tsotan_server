import { config } from "../config.js";
import { publicFileUrl, query } from "../db.js";

type CategoryRow = { id: number; parent_id: number; name: string };

type ProductRow = {
  id: number;
  name: string;
  category_id: number;
  price: string | number;
  img1: string | null;
  img2: string | null;
  img3: string | null;
  img4: string | null;
  description: string | null;
  instruction: string | null;
  size: string | null;
  weight: string | null;
  material: string | null;
  is_special: boolean;
  is_new: boolean;
  images?: string[] | string | null;
};

export async function loadCategories() {
  return query<CategoryRow>(
    "SELECT id, parent_id, name FROM categories ORDER BY id",
  );
}

export function categoryNames(
  categories: CategoryRow[],
  categoryId: number,
) {
  const byId = new Map(categories.map((c) => [c.id, c]));
  const chain: string[] = [];
  let current = byId.get(categoryId);
  const seen = new Set<number>();
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    chain.unshift(current.name);
    current =
      current.parent_id && current.parent_id !== 0
        ? byId.get(current.parent_id)
        : undefined;
  }
  return {
    parentCategory: chain[0] || null,
    childCategory: chain[1] || null,
    category: chain[2] || chain[chain.length - 1] || null,
  };
}

function gallery(product: ProductRow) {
  const fromJson = Array.isArray(product.images)
    ? product.images
    : typeof product.images === "string"
      ? (JSON.parse(product.images || "[]") as string[])
      : [];
  const fromCols = [product.img1, product.img2, product.img3, product.img4].filter(
    Boolean,
  ) as string[];
  const source = (fromJson.length ? fromJson : fromCols).filter(Boolean);
  return [...new Set(source)].map((img) => publicFileUrl(img));
}

export function toProductDto(product: ProductRow, categories: CategoryRow[]) {
  const names = categoryNames(categories, product.category_id);
  const price = Number(product.price);
  const images = gallery(product);
  return {
    id: product.id,
    name: product.name,
    price,
    usdPrice: Number((price / config.usdRate).toFixed(2)),
    parentCategory: names.parentCategory,
    childCategory: names.childCategory,
    category: names.category,
    categoryId: product.category_id,
    img: images[0] || publicFileUrl(product.img1),
    isSpecial: product.is_special,
    isNew: product.is_new,
  };
}

export function toProductDetail(product: ProductRow, categories: CategoryRow[]) {
  const base = toProductDto(product, categories);
  return {
    ...base,
    description: product.description,
    instruction: product.instruction,
    size: product.size,
    weight: product.weight,
    material: product.material,
    image: gallery(product),
  };
}

export async function descendantIds(categoryId: number) {
  const categories = await loadCategories();
  const children = categories.filter((c) => c.parent_id === categoryId);
  const grandchildren = categories.filter((c) =>
    children.some((ch) => ch.id === c.parent_id),
  );
  if (grandchildren.length) return grandchildren.map((c) => c.id);
  if (children.length) return children.map((c) => c.id);
  return [categoryId];
}
