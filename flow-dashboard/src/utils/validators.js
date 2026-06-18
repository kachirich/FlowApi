import { z } from "zod";

export const webhookDestinationSchema = z
  .string()
  .url({ message: "Invalid URL format" })
  .startsWith("https://", { message: "Secure HTTPS connections are required." })
  .superRefine((url, ctx) => {
    try {
      const parsed = new URL(url);
      const hostname = parsed.hostname.toLowerCase();

      const isInternal =
        hostname === "localhost" ||
        hostname === "127.0.0.1" ||
        hostname === "0.0.0.0" ||
        hostname === "::1" ||
        hostname.startsWith("10.") ||
        hostname.startsWith("192.168.") ||
        hostname.startsWith("172.16.") ||
        hostname.startsWith("172.17.") ||
        hostname.startsWith("172.18.") ||
        hostname.startsWith("172.19.") ||
        hostname.startsWith("172.20.") ||
        hostname.startsWith("172.21.") ||
        hostname.startsWith("172.22.") ||
        hostname.startsWith("172.23.") ||
        hostname.startsWith("172.24.") ||
        hostname.startsWith("172.25.") ||
        hostname.startsWith("172.26.") ||
        hostname.startsWith("172.27.") ||
        hostname.startsWith("172.28.") ||
        hostname.startsWith("172.29.") ||
        hostname.startsWith("172.30.") ||
        hostname.startsWith("172.31.") ||
        hostname.startsWith("169.254.") || // Cloud metadata SSRF
        hostname.endsWith(".local");

      if (isInternal) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Internal or restricted IP addresses are prohibited.",
        });
      }
    } catch {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Malformed URL.",
      });
    }
  });

export const jsonKeyMappingSchema = z
  .string()
  .trim()
  .transform((val) => val.replace(/\s+/g, ""))
  .pipe(
    z
      .string()
      .regex(/^[a-zA-Z0-9_]+$/, "Only alphanumeric characters and underscores are allowed")
      .max(50, "Maximum length is 50 characters")
  );
