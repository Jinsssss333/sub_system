import { Router } from 'express';

export const discountsRouter = Router();

discountsRouter.get('/', (req, res) => {
  res.json({ message: 'Discounts module ready for Person 1' });
});
