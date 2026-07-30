import { z } from 'zod';
import { parkingTypeSchema, parkingStatusSchema } from '@/features/parkings/schemas';

// Roles del sistema (espejo del enum user_role en la BD).
export const userRoleSchema = z.enum(['user', 'contributor', 'admin']);
export type UserRole = z.infer<typeof userRoleSchema>;

// Perfil del usuario autenticado / gestionado (subconjunto de public.users).
export const adminProfileSchema = z.object({
  id: z.string().uuid(),
  username: z.string(),
  display_name: z.string(),
  role: userRoleSchema,
  suspended: z.boolean(),
  suspended_reason: z.string().nullable(),
  current_level: z.number().int(),
  total_octanos: z.number().int(),
  octanos_this_month: z.number().int(),
});
export type AdminProfile = z.infer<typeof adminProfileSchema>;

// Fila mínima del listado de parkings del panel.
export const adminParkingSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  type: parkingTypeSchema,
  status: parkingStatusSchema,
  city: z.string(),
  address: z.string().nullable(),
  district: z.string().nullable(),
  capacity: z.number().int().nullable(),
  notes: z.string().nullable(),
  features: z.record(z.boolean()).nullable().optional(),
  proposed_by: z.string().uuid(),
  verifications_count: z.number().int(),
  // Veredicto de Otto (IA). Default 'approved' por si la columna aún no existe
  // en un despliegue previo a la migración (transición segura).
  ai_review_status: z.enum(['approved', 'flagged', 'rejected']).default('approved'),
  deleted_at: z.string().nullable(),
  created_at: z.string(),
});
export type AdminParking = z.infer<typeof adminParkingSchema>;

// Fila del RPC admin_list_comments (comentario aplanado con autor + parking).
export const adminCommentRowSchema = z.object({
  id: z.string().uuid(),
  body: z.string(),
  moderation_status: z.enum(['approved', 'pending_review']),
  upvotes_count: z.number().int().nonnegative(),
  created_at: z.string(),
  author_id: z.string().uuid(),
  username: z.string().nullable(),
  display_name: z.string().nullable(),
  parking_id: z.string().uuid(),
  parking_name: z.string().nullable(),
  city: z.string().nullable(),
});
export type AdminComment = z.infer<typeof adminCommentRowSchema>;

export const adminCommentListSchema = z.object({
  rows: z.array(adminCommentRowSchema),
  total: z.number().int().nonnegative(),
});
export type AdminCommentList = z.infer<typeof adminCommentListSchema>;

// Vista/estado del filtro de comentarios del panel.
export const commentStatusFilterSchema = z.enum(['pending_review', 'approved', 'all']);
export type CommentStatusFilter = z.infer<typeof commentStatusFilterSchema>;

// ── Filtros ──────────────────────────────────────────────────
export const userFilterSchema = z.object({
  search: z.string().default(''),
  role: z.union([userRoleSchema, z.literal('all')]).default('all'),
});
export type UserFilter = z.infer<typeof userFilterSchema>;

// Filtro por revisión de Otto: dudosos, rechazados, o aprobados-pero-no-verificados
// por la comunidad (approved + status pending).
export const aiReviewFilterSchema = z.enum(['all', 'flagged', 'rejected', 'unverified']);
export type AiReviewFilter = z.infer<typeof aiReviewFilterSchema>;

export const parkingFilterSchema = z.object({
  city: z.string().default(''),
  status: z.union([parkingStatusSchema, z.literal('all')]).default('all'),
  scope: z.enum(['all', 'mine']).default('all'),
  aiReview: aiReviewFilterSchema.default('all'),
});
export type ParkingFilter = z.infer<typeof parkingFilterSchema>;

// ── Mutaciones ───────────────────────────────────────────────
// Cambio de rol/suspensión (input de la Edge Function admin-set-role).
export const setRoleInputSchema = z
  .object({
    userId: z.string().uuid(),
    role: userRoleSchema.optional(),
    suspended: z.boolean().optional(),
    suspendedReason: z.string().max(500).optional(),
  })
  .refine((d) => d.role !== undefined || d.suspended !== undefined, {
    message: "Debe indicar 'role' y/o 'suspended'",
  });
export type SetRoleInput = z.infer<typeof setRoleInputSchema>;

// Características editables de un parking (JSONB features).
export const parkingFeaturesSchema = z.object({
  covered: z.boolean().optional(),
  cameras: z.boolean().optional(),
  anchors: z.boolean().optional(),
  lit: z.boolean().optional(),
  free: z.boolean().optional(),
  h24: z.boolean().optional(),
  battery_layout: z.boolean().optional(),
});

// Crear un parking desde el panel (proposed_by lo pone la capa de datos).
export const createParkingSchema = z.object({
  name: z.string().min(3, 'Mínimo 3 caracteres').max(120),
  type: parkingTypeSchema,
  city: z.string().min(1, 'Ciudad obligatoria'),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  address: z.string().max(200).optional(),
  district: z.string().max(80).optional(),
  capacity: z.number().int().positive().nullable().optional(),
  notes: z.string().max(500).optional(),
  features: parkingFeaturesSchema.optional(),
});
export type CreateParkingInput = z.infer<typeof createParkingSchema>;

// Editar campos de un parking (todos opcionales; sin status ni ubicación).
export const editParkingSchema = z.object({
  name: z.string().min(3).max(120).optional(),
  type: parkingTypeSchema.optional(),
  city: z.string().min(1).optional(),
  address: z.string().max(200).nullable().optional(),
  district: z.string().max(80).nullable().optional(),
  capacity: z.number().int().positive().nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
  features: parkingFeaturesSchema.optional(),
});
export type EditParkingInput = z.infer<typeof editParkingSchema>;
