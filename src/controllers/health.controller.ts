import { Request, Response } from 'express';

export function getHealth(req: Request, res: Response): void {
  res.status(200).json({
    success: true,
    data: {
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      platform: process.platform,
    },
  });
}
