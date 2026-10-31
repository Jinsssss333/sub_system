import { Router } from 'express';

export const paymentsRouter = Router();

paymentsRouter.get('/', (req, res) => {
  res.json({ message: 'Payments module ready for Person 3' });
});

