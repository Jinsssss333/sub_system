import { Router } from 'express';

export const plansRouter = Router();

plansRouter.get('/', (req, res) => {
  res.json({ message: 'Plans module ready for Person 1' });
});
