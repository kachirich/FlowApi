import { z } from "zod";

export const webhookDestinationSchema = z
  .string()
  .superRefine((url, ctx) => {
    try {
      new URL(url);
    } catch {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Invalid URL format" });
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
