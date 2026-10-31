import { Router } from 'express';

export const subscriptionsRouter = Router();

subscriptionsRouter.get('/', (req, res) => {
  res.json({ message: 'Subscriptions module ready for Person 2' });
});

