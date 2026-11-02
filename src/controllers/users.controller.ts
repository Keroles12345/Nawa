import { Request, Response } from 'express';

import { createCustomer, createTeamUser, getUserById, listUsers, UserAlreadyExistsError } from '../services/user.service';

async function createUserResponse(
  create: () => Promise<Awaited<ReturnType<typeof createCustomer>>>,
  res: Response,
  failureMessage: string,
): Promise<void> {
  try {
    const user = await create();
    res.status(201).json({ success: true, data: user });
  } catch (error) {
    const status = error instanceof UserAlreadyExistsError ? 409 : 500;
    res.status(status).json({ success: false, message: error instanceof Error ? error.message : failureMessage });
  }
}

export function createCustomerController(req: Request, res: Response): Promise<void> {
  return createUserResponse(() => createCustomer(req.body), res, 'Failed to create customer');
}

export function createTeamUserController(req: Request, res: Response): Promise<void> {
  return createUserResponse(() => createTeamUser(req.body), res, 'Failed to create team user');
}

export async function getUsers(req: Request, res: Response): Promise<void> {
  try {
    const users = await listUsers();
    res.status(200).json({ success: true, data: users });
  } catch (error) {
    res.status(500).json({ success: false, message: error instanceof Error ? error.message : 'Failed to fetch users' });
  }
}

export async function getUser(req: Request, res: Response): Promise<void> {
  try {
    const id = typeof req.params.id === 'string' ? req.params.id : req.params.id[0];
    const user = await getUserById(id);
    if (!user) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    res.status(200).json({ success: true, data: user });
  } catch (error) {
    res.status(500).json({ success: false, message: error instanceof Error ? error.message : 'Failed to fetch user' });
  }
}
