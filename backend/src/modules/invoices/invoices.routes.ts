import { Router } from 'express';

export const invoicesRouter = Router();

invoicesRouter.get('/', (req, res) => {
  res.json({ message: 'Invoices module ready for Person 2' });
});

