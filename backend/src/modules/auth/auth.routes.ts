import { Router } from 'express';

export const authRouter = Router();

// Person 1 will implement: signup, login, forgot-password, reset-password, me
authRouter.get('/me', (req, res) => {
  res.json({ message: 'Auth module ready for Person 1' });
});
