import { Router } from 'express';

export const taxesRouter = Router();

taxesRouter.get('/', (req, res) => {
  res.json({ message: 'Taxes module ready for Person 1' });
});
