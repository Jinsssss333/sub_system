import { Router } from 'express';

export const customersRouter = Router();

customersRouter.get('/', (req, res) => {
  res.json({ message: 'Customers module ready for Person 1' });
});

