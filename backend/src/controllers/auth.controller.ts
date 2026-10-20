import { Request, Response, NextFunction } from 'express';
import * as authService from '../services/auth.service';
import { sendSuccess } from '../utils/response';

export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { username, password } = req.body;
    const result = await authService.login(username, password, {
      ip: req.ip,
      userAgent: req.get('user-agent') ?? undefined,
    });
    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
}

export async function refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await authService.refreshSession(req.body.refreshToken);
    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
}

export async function me(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    sendSuccess(res, { user: req.user });
  } catch (error) {
    next(error);
  }
}

export async function logout(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await authService.logout(req.user!.id);
    sendSuccess(res, { message: 'Logged out' });
  } catch (error) {
    next(error);
  }
}
