import IORedis from "ioredis";
import logger from "./logger.js";

const redisUrl = process.env.REDIS_URL || "redis://redis:6379";
const url = new URL(redisUrl);

const redisClient = new IORedis({
  host: url.hostname,
  port: parseInt(url.port || "6379", 10),
  ...(url.username ? { username: url.username } : {}),
  ...(url.password ? { password: url.password } : {}),
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  retryStrategy: (times) => {
    if (times > 10) {
      return null;
    }
    return Math.min(times * 200, 10000);
  },
});

redisClient.on("error", (err) => logger.error({ err }, "Redis client error"));
redisClient.on("connect", () => logger.info("Connected to Redis"));
redisClient.on("reconnecting", () => logger.info("Reconnecting to Redis"));

export const connectRedis = async () => {
  try {
    await redisClient.ping();
    logger.info("Redis connection verified");
  } catch (err) {
    logger.error({ err }, "Failed to connect to Redis on startup");
    throw err;
  }
};

export default redisClient;
