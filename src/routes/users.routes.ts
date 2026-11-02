import { Router } from 'express';

import { createCustomerController, createTeamUserController, getUser, getUsers } from '../controllers/users.controller';
import { authenticateToken, authorizeRole } from '../middlewares/auth';
import { validateRequest } from '../validators/request';
import { createTeamUserSchema, registerSchema } from '../validators/auth';

export const usersRouter = Router();
usersRouter.get('/', authenticateToken, authorizeRole('ADMIN', 'STAFF'), getUsers);
usersRouter.post('/', authenticateToken, authorizeRole('ADMIN', 'STAFF'), validateRequest(registerSchema), createCustomerController);
usersRouter.post('/staff', authenticateToken, authorizeRole('ADMIN', 'STAFF'), validateRequest(createTeamUserSchema), createTeamUserController);
usersRouter.get('/:id', authenticateToken, getUser);
