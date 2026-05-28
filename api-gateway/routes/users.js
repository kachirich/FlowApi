import { Router } from "express";
import authenticate from "../middleware/auth.js";
import { query } from "../db/connection.js";

const router = Router();

router.delete("/me", authenticate, async (req, res, next) => {
  try {
    const userId = req.user.id;

    await query("BEGIN");

    // Delete user api_keys
    await query("DELETE FROM api_keys WHERE user_id = $1", [userId]);

    // Delete user webhook_keys (which holds webhook destinations)
    await query("DELETE FROM webhook_keys WHERE user_id = $1", [userId]);

    // Delete from webhook_destinations in case it exists/is created
    try {
      await query("DELETE FROM webhook_destinations WHERE user_id = $1", [userId]);
    } catch (e) {
      // Ignored if table does not exist
    }

    // Delete the user record
    await query("DELETE FROM users WHERE id = $1", [userId]);

    await query("COMMIT");

    // Clear the jwt HttpOnly cookie
    res.clearCookie("jwt", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict"
    });

    return res.status(200).json({
      success: true,
      message: "Account permanently deleted"
    });
  } catch (err) {
    try {
      await query("ROLLBACK");
    } catch (rollbackErr) {
      console.error("Rollback failed:", rollbackErr);
    }
    next(err);
  }
});

export default router;
