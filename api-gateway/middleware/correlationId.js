import { randomUUID } from "crypto";

export const correlationId = (req, res, next) => {
  req.id = req.headers["x-request-id"] || randomUUID();
  res.setHeader("x-request-id", req.id);
  next();
};

export default correlationId;
