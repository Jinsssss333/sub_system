import { Router } from 'express';

export const reportsRouter = Router();

reportsRouter.get('/summary', (req, res) => {
  res.json({ message: 'Reports module ready for Person 2' });
});
