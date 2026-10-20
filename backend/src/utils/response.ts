import { Response } from 'express';

export interface ApiSuccess<T> {
  success: true;
  data: T;
  meta?: Record<string, unknown>;
}

export interface ApiFailure {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export function sendSuccess<T>(
  res: Response,
  data: T,
  status = 200,
  meta?: Record<string, unknown>
): Response {
  const body: ApiSuccess<T> = { success: true, data };
  if (meta) body.meta = meta;
  return res.status(status).json(body);
}

export function sendPaginated<T>(
  res: Response,
  data: T[],
  page: number,
  limit: number,
  total: number
): Response {
  return sendSuccess(res, data, 200, {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit) || 1,
  });
}
