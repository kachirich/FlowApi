import { Router } from "express";
import authenticate from "../middleware/auth.js";
import pool, { query } from "../db/connection.js";

const router = Router();

router.delete("/me", authenticate, async (req, res, next) => {
  const userId = req.user.id;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM users WHERE id = $1", [userId]);
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    client.release();
    return next(err);
  }
  client.release();

  res.clearCookie("jwt", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict"
  });

  return res.status(200).json({
    success: true,
    message: "Account permanently deleted"
  });
});

export default router;
