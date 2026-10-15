import { BadRequestException, type PipeTransform } from "@nestjs/common";
import { fieldErrorsOf } from "@stride/shared";
import type { z } from "zod";

/**
 * Validates a request body with a shared schema (`@Body(new ZodBodyPipe(loginSchema))`).
 * Invalid → 400 `{ fieldErrors }` with the schema's own messages, never the values.
 */
export class ZodBodyPipe<T extends z.ZodType> implements PipeTransform<
  unknown,
  z.output<T>
> {
  constructor(private readonly schema: T) {}

  transform(body: unknown): z.output<T> {
    // A non-object body is checked as {} so the errors stay per field.
    const isObject =
      typeof body === "object" && body !== null && !Array.isArray(body);
    const result = this.schema.safeParse(isObject ? body : {});
    if (!result.success) {
      throw new BadRequestException({
        fieldErrors: fieldErrorsOf(result.error),
      });
    }
    return result.data;
  }
}
