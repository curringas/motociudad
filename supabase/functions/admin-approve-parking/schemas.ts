/**
 * Request schema for admin-approve-parking.
 * OpenSpec: changes/otto-parking-verification · spec admin-parking-management.
 */
import { z } from "npm:zod@3";

const approveParkingSchema = z.object({
  parkingId: z.string().uuid("parkingId debe ser un UUID válido"),
});

export type ApproveParkingInput = z.infer<typeof approveParkingSchema>;

export function parseApproveParkingRequest(
  body: unknown,
): { success: true; data: ApproveParkingInput } | { success: false; error: string } {
  const result = approveParkingSchema.safeParse(body);
  if (!result.success) {
    return { success: false, error: result.error.issues[0]?.message ?? "Body inválido" };
  }
  return { success: true, data: result.data };
}
