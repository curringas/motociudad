import { z } from 'zod';

export const parkingTypeSchema = z.enum(['public', 'private']);
export const parkingStatusSchema = z.enum([
  'pending',
  'verified',
  'rejected',
  'archived',
]);

export const parkingFeaturesSchema = z.object({
  covered: z.boolean().optional(),
  cameras: z.boolean().optional(),
  anchors: z.boolean().optional(),
  lit: z.boolean().optional(),
  free: z.boolean().optional(),
  h24: z.boolean().optional(),
  battery_layout: z.boolean().optional(),
});

export const nearbyParkingSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  type: parkingTypeSchema,
  status: parkingStatusSchema,
  lat: z.number(),
  lng: z.number(),
  distance_meters: z.number().nonnegative(),
  city: z.string(),
  capacity: z.number().int().positive().nullable(),
  features: z.record(z.boolean()),
  verifications_count: z.number().int().nonnegative(),
  last_verified_at: z.string().nullable(),
});

export const proposeParkingSchema = z.object({
  name: z
    .string()
    .min(3, 'El nombre debe tener al menos 3 caracteres')
    .max(120, 'El nombre no puede superar los 120 caracteres'),
  type: parkingTypeSchema,
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  city: z.string().min(1, 'La ciudad es obligatoria'),
  capacity: z.number().int().positive().nullable().optional(),
  features: parkingFeaturesSchema.optional(),
  notes: z
    .string()
    .max(500, 'Las notas no pueden superar los 500 caracteres')
    .optional(),
});

export type ProposeParkingInput = z.infer<typeof proposeParkingSchema>;
export type NearbyParkingRaw = z.infer<typeof nearbyParkingSchema>;
