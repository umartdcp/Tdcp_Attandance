import { z } from 'zod';

export const createEmployeeSchema = z.object({
  employeeCode: z.string().min(2).max(32),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  fatherName: z.string().max(150).nullable().optional(),
  cnic: z.string().max(20).nullable().optional(),
  email: z.string().email().nullable().optional(),
  phone: z.string().max(32).nullable().optional(),
  designation: z.string().max(128).nullable().optional(),
  departmentId: z.string().uuid().nullable().optional(),
  departmentName: z.string().max(128).nullable().optional(),
  currentResortId: z.string().uuid(),
  hireDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  gender: z.enum(['male', 'female', 'other']).nullable().optional(),
  deviceUserId: z.string().max(64).nullable().optional(),
  shiftStart: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).nullable().optional(),
  shiftEnd: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).nullable().optional(),
  fingerStatus: z.enum(['not_captured', 'captured', 'failed']).optional(),
});

export const updateDepartmentSchema = z.object({
  departmentName: z.string().max(128),
});

export const updateGenderSchema = z.object({
  gender: z.enum(['male', 'female', 'other']).nullable(),
});

export const updateEmployeeSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  departmentName: z.string().max(128).nullable().optional(),
  designation: z.string().max(128).nullable().optional(),
  gender: z.enum(['male', 'female', 'other']).nullable().optional(),
  shiftStart: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).nullable().optional(),
  shiftEnd: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).nullable().optional(),
  currentResortId: z.string().uuid().nullable().optional(),
});

export const transferEmployeeSchema = z.object({
  toResortId: z.string().uuid(),
  toDepartmentId: z.string().uuid().nullable().optional(),
  transferDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  designation: z.string().max(128).nullable().optional(),
  reason: z.string().max(2000).nullable().optional(),
});
