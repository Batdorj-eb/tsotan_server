import { Router } from "express";
import bcrypt from "bcryptjs";
import { query, queryOne } from "../db.js";
import { signToken } from "../middleware/auth.js";

export const authRouter = Router();

authRouter.post("/login", async (req, res) => {
  const { username, password } = req.body as {
    username?: string;
    password?: string;
  };
  const user = await queryOne<{
    id: number;
    username: string;
    password_hash: string;
    role: string;
    is_active: boolean;
  }>("SELECT * FROM users WHERE username = $1", [username]);

  if (!user || !user.is_active) {
    res.status(401).json({ message: "Нэвтрэх нэр эсвэл нууц үг буруу" });
    return;
  }
  const ok = await bcrypt.compare(password || "", user.password_hash);
  if (!ok) {
    res.status(401).json({ message: "Нэвтрэх нэр эсвэл нууц үг буруу" });
    return;
  }

  await query("UPDATE users SET last_login = NOW() WHERE id = $1", [user.id]);
  const token = signToken({
    id: user.id,
    username: user.username,
    role: user.role,
  });
  res.json({
    token,
    user: { id: user.id, username: user.username, role: user.role },
  });
});
