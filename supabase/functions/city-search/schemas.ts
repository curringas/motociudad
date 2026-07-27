/**
 * Zod schema for city-search input validation.
 */

import { z } from "npm:zod@3";

/** Minimum query length before hitting the geocoder. */
export const MIN_QUERY_LENGTH = 2;

export const citySearchSchema = z.object({
  q: z
    .string({ invalid_type_error: "La consulta debe ser texto" })
    .trim()
    .max(120, "La consulta es demasiado larga"),
});

export type CitySearchInput = z.infer<typeof citySearchSchema>;

export function parseCitySearch(body: unknown):
  | { success: true; data: CitySearchInput }
  | { success: false; error: string } {
  const result = citySearchSchema.safeParse(body);
  if (!result.success) {
    const firstError = result.error.errors[0];
    return {
      success: false,
      error: firstError
        ? `${firstError.path.join(".")}: ${firstError.message}`
        : "Datos de entrada inválidos",
    };
  }
  return { success: true, data: result.data };
}
