import { Request, Response, NextFunction } from 'express';
import { TemplatesService } from './templates.service.js';

export async function createTemplateHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const template = await TemplatesService.createTemplate(req.body);
    return res.status(201).json({ data: template });
  } catch (error) {
    return next(error);
  }
}

export async function getTemplatesHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { page, pageSize, q } = req.query as unknown as { page: number; pageSize: number; q?: string };
    return res.json(await TemplatesService.getTemplates(page, pageSize, q));
  } catch (error) {
    return next(error);
  }
}

export async function getTemplateByIdHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const template = await TemplatesService.getTemplateById(req.params.id);
    return res.json({ data: template });
  } catch (error) {
    return next(error);
  }
}

export async function deleteTemplateHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await TemplatesService.deleteTemplate(req.params.id);
    return res.json({ data: result });
  } catch (error) {
    return next(error);
  }
}
