import { createClient } from "redis";

const redisUrl = process.env.REDIS_URL || "redis://redis:6379";

const redisClient = createClient({
  url: redisUrl,
  socket: {
    // Fail a connection attempt after 5s instead of hanging indefinitely.
    connectTimeout: 5000,
    // Exponential backoff capped at 10s. After 10 consecutive failures, stop
    // retrying and surface an error so commands reject fast rather than
    // queueing forever (the node-redis analogue of bounded per-request retries).
    reconnectStrategy: (retries) => {
      if (retries > 10) {
        return new Error("[redis] Max reconnection attempts reached");
      }
      return Math.min(retries * 200, 10000);
    },
  },
});

redisClient.on("error", (err) => console.error("[redis] Redis Client Error:", err));
redisClient.on("connect", () => console.log("[redis] Connected to Redis"));

export const connectRedis = async () => {
  try {
    if (!redisClient.isOpen) {
      await redisClient.connect();
    }
  } catch (err) {
    console.error("[redis] Failed to connect on startup:", err.message);
  }
};

export default redisClient;
