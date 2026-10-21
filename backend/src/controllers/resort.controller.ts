import { Request, Response, NextFunction } from 'express';
import * as resortService from '../services/resort.service';
import { resolveAccessibleResortIds } from '../middleware/auth';
import { sendSuccess } from '../utils/response';
import { paramId } from '../utils/params';

export async function list(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const locationIds = resolveAccessibleResortIds(req.user!, req.query.resortId as string | undefined);
    const rows = await resortService.listResorts({
      status: req.query.status as string | undefined,
      regionId: req.query.regionId as string | undefined,
      locationIds,
    });
    sendSuccess(res, rows);
  } catch (error) {
    next(error);
  }
}

export async function getById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = paramId(req);
    resolveAccessibleResortIds(req.user!, id);
    const row = await resortService.getResortById(id);
    sendSuccess(res, row);
  } catch (error) {
    next(error);
  }
}

export async function create(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await resortService.createResort(req.body, req.user!.id);
    sendSuccess(res, result, 201);
  } catch (error) {
    next(error);
  }
}

export async function update(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await resortService.updateResort(paramId(req), req.body, req.user!.id);
    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
}

export async function reverseGeocode(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const lat = Number(req.query.lat);
    const lng = Number(req.query.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'lat and lng are required' },
      });
      return;
    }
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`;
    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'TDCP-Attendance/1.0 (office attendance setup)',
      },
    });
    if (!response.ok) {
      res.status(502).json({
        success: false,
        error: { code: 'GEOCODE_FAILED', message: 'Could not look up that location' },
      });
      return;
    }
    const body = (await response.json()) as { display_name?: string };
    sendSuccess(res, {
      address: body.display_name ?? '',
      latitude: lat,
      longitude: lng,
    });
  } catch (error) {
    next(error);
  }
}

export async function regions(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const rows = await resortService.listRegions();
    sendSuccess(res, rows);
  } catch (error) {
    next(error);
  }
}
