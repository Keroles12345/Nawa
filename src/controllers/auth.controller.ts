import { Request, Response } from 'express';

import { loginUser, logoutUser, refreshTokens, registerUser } from '../services/auth.service';

export async function register(req: Request, res: Response): Promise<void> {
  try {
    const result = await registerUser(req.body);
    res.status(201).json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, message: error instanceof Error ? error.message : 'Registration failed' });
  }
}

export async function login(req: Request, res: Response): Promise<void> {
  try {
    const result = await loginUser(req.body);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    res.status(401).json({ success: false, message: error instanceof Error ? error.message : 'Authentication failed' });
  }
}

export async function refresh(req: Request, res: Response): Promise<void> {
  try {
    const token = (req.body as { refreshToken?: string }).refreshToken;
    if (!token) {
      res.status(400).json({ success: false, message: 'Refresh token is required' });
      return;
    }

    const result = await refreshTokens(token);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    res.status(401).json({ success: false, message: error instanceof Error ? error.message : 'Token refresh failed' });
  }
}

export async function logout(req: Request, res: Response): Promise<void> {
  try {
    const token = (req.body as { refreshToken?: string }).refreshToken;
    if (!token) {
      res.status(400).json({ success: false, message: 'Refresh token is required' });
      return;
    }

    await logoutUser(token);
    res.status(200).json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    res.status(400).json({ success: false, message: error instanceof Error ? error.message : 'Logout failed' });
  }
}
