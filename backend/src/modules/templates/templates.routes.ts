import { Router } from 'express';

export const templatesRouter = Router();

templatesRouter.get('/', (req, res) => {
  res.json({ message: 'Templates module ready for Person 2' });
});

