import { z } from 'zod';

export const userOctanosSchema = z.object({
  total_octanos: z.number().int().nonnegative(),
});

export const userLevelSchema = z.object({
  level: z.number().int(),
  name: z.string(),
  min_octanos: z.number().int().nonnegative(),
});

export const octanoPointsRowSchema = z.object({
  points: z.number().int(),
});
