import { z } from 'zod';

export const createUserSchema = z.object({
  username: z.string().min(3).max(64).regex(/^[a-zA-Z0-9._-]+$/),
  email: z.string().email().max(255),
  password: z.string().min(8).max(128),
  roleCode: z.enum(['ADMIN', 'HR', 'FINANCE']),
});

export const updateUserRoleSchema = z.object({
  roleCode: z.enum(['ADMIN', 'HR', 'FINANCE']),
});
