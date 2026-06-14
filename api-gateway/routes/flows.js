/**
 * routes/flows.js — Flow management API (JWT-authenticated)
 *
 * A "Flow" is a named pipeline that groups a SUBSET of a user's destinations
 * with its own routing strategy. API keys can point at a flow so partners
 * firing webhooks route only to that flow's destinations.
 *
 * Every route is scoped to req.user.id and verifies ownership of each row.
 */
import { Router } from "express";
import authenticate from "../middleware/auth.js";
import { query } from "../db/connection.js";
import {
  validateRequest,
  createFlowSchema,
  updateFlowSchema,
  addFlowDestinationSchema,
} from "../middleware/validateRequest.js";

const router = Router();

// All flow management routes require a valid user session
router.use(authenticate);

// Shape used for the destinations array returned with a flow
const FLOW_SELECT = `
  SELECT f.id, f.name, f.routing_strategy, f.created_at,
    COALESCE(
      json_agg(
        json_build_object(
          'id', d.id,
          'name', d.name,
          'target_url', d.target_url,
          'daily_cap', d.daily_cap,
          'is_active', d.is_active
        )
      ) FILTER (WHERE d.id IS NOT NULL),
      '[]'
    ) AS destinations,
    (SELECT COUNT(*)::int FROM api_keys ak WHERE ak.flow_id = f.id) AS api_key_count
  FROM flows f
  LEFT JOIN flow_destinations fd ON fd.flow_id = f.id
  LEFT JOIN destinations d ON d.id = fd.destination_id
`;

/**
 * POST /api/flows
 * body: { name, routing_strategy?, destination_ids?: [] }
 */
router.post("/", validateRequest(createFlowSchema), async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { name, routing_strategy = "round_robin", destination_ids = [] } = req.body;

    // Validate each destination belongs to the user before attaching
    if (destination_ids.length > 0) {
      const check = await query(
        `SELECT id FROM destinations WHERE user_id = $1 AND id = ANY($2::uuid[])`,
        [userId, destination_ids]
      );
      if (check.rows.length !== new Set(destination_ids).size) {
        return res.status(404).json({
          success: false,
          message: "One or more destinations were not found.",
        });
      }
    }

    const flowRes = await query(
      `INSERT INTO flows (user_id, name, routing_strategy)
       VALUES ($1, $2, $3)
       RETURNING id, name, routing_strategy, created_at`,
      [userId, name, routing_strategy]
    );
    const flow = flowRes.rows[0];

    if (destination_ids.length > 0) {
      await query(
        `INSERT INTO flow_destinations (flow_id, destination_id)
         SELECT $1, unnest($2::uuid[])
         ON CONFLICT DO NOTHING`,
        [flow.id, destination_ids]
      );
    }

    const full = await query(`${FLOW_SELECT} WHERE f.id = $1 GROUP BY f.id`, [flow.id]);

    return res.status(201).json({ success: true, flow: full.rows[0] });
  } catch (error) {
    console.error("Error creating flow:", error);
    next(error);
  }
});

/**
 * GET /api/flows
 * Returns the user's flows, each with its destinations and assigned key count.
 */
router.get("/", async (req, res, next) => {
  try {
    const userId = req.user.id;
    const result = await query(
      `${FLOW_SELECT} WHERE f.user_id = $1 GROUP BY f.id ORDER BY f.created_at DESC`,
      [userId]
    );
    return res.status(200).json({ success: true, flows: result.rows });
  } catch (error) {
    console.error("Error listing flows:", error);
    next(error);
  }
});

/**
 * GET /api/flows/:id
 */
router.get("/:id", async (req, res, next) => {
  try {
    const userId = req.user.id;
    const result = await query(
      `${FLOW_SELECT} WHERE f.id = $1 AND f.user_id = $2 GROUP BY f.id`,
      [req.params.id, userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Flow not found." });
    }
    return res.status(200).json({ success: true, flow: result.rows[0] });
  } catch (error) {
    console.error("Error fetching flow:", error);
    next(error);
  }
});

/**
 * PUT /api/flows/:id
 * body: { name?, routing_strategy? }
 */
router.put("/:id", validateRequest(updateFlowSchema), async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { name, routing_strategy } = req.body;

    const result = await query(
      `UPDATE flows
       SET name = COALESCE($1, name),
           routing_strategy = COALESCE($2, routing_strategy)
       WHERE id = $3 AND user_id = $4
       RETURNING id`,
      [
        name !== undefined ? name : null,
        routing_strategy !== undefined ? routing_strategy : null,
        req.params.id,
        userId,
      ]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, message: "Flow not found." });
    }

    const full = await query(`${FLOW_SELECT} WHERE f.id = $1 GROUP BY f.id`, [req.params.id]);
    return res.status(200).json({ success: true, flow: full.rows[0] });
  } catch (error) {
    console.error("Error updating flow:", error);
    next(error);
  }
});

/**
 * DELETE /api/flows/:id
 * flow_destinations cascade; api_keys.flow_id is set null via FK.
 */
router.delete("/:id", async (req, res, next) => {
  try {
    const userId = req.user.id;
    const result = await query(
      `DELETE FROM flows WHERE id = $1 AND user_id = $2 RETURNING id`,
      [req.params.id, userId]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, message: "Flow not found." });
    }
    return res.status(200).json({ success: true, message: "Flow deleted successfully." });
  } catch (error) {
    console.error("Error deleting flow:", error);
    next(error);
  }
});

/**
 * POST /api/flows/:id/destinations
 * body: { destination_id }
 */
router.post(
  "/:id/destinations",
  validateRequest(addFlowDestinationSchema),
  async (req, res, next) => {
    try {
      const userId = req.user.id;
      const flowId = req.params.id;
      const { destination_id } = req.body;

      // Verify the flow belongs to the user
      const flowCheck = await query(
        `SELECT id FROM flows WHERE id = $1 AND user_id = $2`,
        [flowId, userId]
      );
      if (flowCheck.rowCount === 0) {
        return res.status(404).json({ success: false, message: "Flow not found." });
      }

      // Verify the destination belongs to the user
      const destCheck = await query(
        `SELECT id FROM destinations WHERE id = $1 AND user_id = $2`,
        [destination_id, userId]
      );
      if (destCheck.rowCount === 0) {
        return res.status(404).json({ success: false, message: "Destination not found." });
      }

      await query(
        `INSERT INTO flow_destinations (flow_id, destination_id)
         VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [flowId, destination_id]
      );

      const full = await query(`${FLOW_SELECT} WHERE f.id = $1 GROUP BY f.id`, [flowId]);
      return res.status(200).json({ success: true, flow: full.rows[0] });
    } catch (error) {
      console.error("Error attaching destination to flow:", error);
      next(error);
    }
  }
);

/**
 * DELETE /api/flows/:id/destinations/:destination_id
 */
router.delete("/:id/destinations/:destination_id", async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { id: flowId, destination_id } = req.params;

    // Verify the flow belongs to the user
    const flowCheck = await query(
      `SELECT id FROM flows WHERE id = $1 AND user_id = $2`,
      [flowId, userId]
    );
    if (flowCheck.rowCount === 0) {
      return res.status(404).json({ success: false, message: "Flow not found." });
    }

    const result = await query(
      `DELETE FROM flow_destinations WHERE flow_id = $1 AND destination_id = $2 RETURNING destination_id`,
      [flowId, destination_id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Destination is not attached to this flow.",
      });
    }

    return res.status(200).json({ success: true, message: "Destination detached from flow." });
  } catch (error) {
    console.error("Error detaching destination from flow:", error);
    next(error);
  }
});

export default router;
