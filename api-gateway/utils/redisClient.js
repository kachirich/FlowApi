import { createClient } from "redis";

const redisUrl = process.env.REDIS_URL || "redis://redis:6379";

const redisClient = createClient({
  url: redisUrl,
});

redisClient.on("error", (err) => console.error("[redis] Redis Client Error:", err));
redisClient.on("connect", () => console.log("[redis] Connected to Redis instance for rate limiting"));

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
