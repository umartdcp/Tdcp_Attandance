import { NextFunction, Request, Response } from 'express';
import * as userService from '../services/user.service';
import { sendSuccess } from '../utils/response';
import { paramId } from '../utils/params';

export async function list(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    sendSuccess(res, await userService.listUsers());
  } catch (error) {
    next(error);
  }
}

export async function roles(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    sendSuccess(res, await userService.listAssignableRoles());
  } catch (error) {
    next(error);
  }
}

export async function create(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = await userService.createUser(req.body, req.user!.id);
    sendSuccess(res, user, 201);
  } catch (error) {
    next(error);
  }
}

export async function updateRole(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await userService.updateUserRole(paramId(req), req.body.roleCode, req.user!.id);
    sendSuccess(res, { id: paramId(req), roleCode: req.body.roleCode });
  } catch (error) {
    next(error);
  }
}
