import { Router } from 'express';

import { login, logout, refresh, register } from '../controllers/auth.controller';
import { validateRequest } from '../validators/request';
import { loginSchema, registerSchema } from '../validators/auth';

export const authRouter = Router();
authRouter.post('/register', validateRequest(registerSchema), register);
authRouter.post('/login', validateRequest(loginSchema), login);
authRouter.post('/refresh', refresh);
authRouter.post('/logout', logout);
