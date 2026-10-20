import { z } from 'zod';

export const createResortSchema = z.object({
  organizationId: z.string().uuid().optional(),
  regionId: z.string().uuid().nullable().optional(),
  code: z.string().min(2).max(32),
  name: z.string().min(2).max(255),
  locationType: z.enum(['head_office', 'regional_office', 'resort', 'other']).default('resort'),
  address: z.string().max(1000).nullable().optional(),
  contactPhone: z.string().max(32).nullable().optional(),
  contactEmail: z.string().email().nullable().optional(),
  attendanceConfig: z.record(z.unknown()).nullable().optional(),
});

export const updateResortSchema = z.object({
  name: z.string().min(2).max(255).optional(),
  regionId: z.string().uuid().nullable().optional(),
  address: z.string().max(1000).nullable().optional(),
  contactPhone: z.string().max(32).nullable().optional(),
  contactEmail: z.string().email().nullable().optional(),
  status: z.enum(['active', 'inactive']).optional(),
  attendanceConfig: z.record(z.unknown()).nullable().optional(),
});
