import { Response } from 'express';

export function sendJson<T>(res: Response, status: number, payload: T): Response {
  return res.status(status).json(payload);
}
