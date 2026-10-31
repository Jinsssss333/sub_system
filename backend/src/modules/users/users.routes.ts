import { Router } from 'express';

export const usersRouter = Router();

usersRouter.get('/', (req, res) => {
  res.json({ message: 'Users module ready for Person 1' });
});
