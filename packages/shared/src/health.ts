import { z } from "zod";

/** Body of the API's `GET /health` (api-foundation AC3). */
export const healthResponseSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("ok"), db: z.literal("ok") }),
  z.object({ status: z.literal("error"), db: z.literal("down") }),
]);

export type HealthResponse = z.infer<typeof healthResponseSchema>;
