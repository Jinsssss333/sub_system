import { Request, Response, NextFunction } from 'express';
import * as productsService from './products.service.js';

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await productsService.listProducts(req.query as any);
    return res.json(result);
  } catch (error) {
    return next(error);
  }
}

export async function getById(req: Request, res: Response, next: NextFunction) {
  try {
    const product = await productsService.getProductById(req.params.id);
    return res.json({ data: product });
  } catch (error) {
    return next(error);
  }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const product = await productsService.createProduct(req.body);
    return res.status(201).json({ data: product });
  } catch (error) {
    return next(error);
  }
}

export async function addVariant(req: Request, res: Response, next: NextFunction) {
  try {
    const variant = await productsService.createVariant(req.params.id, req.body);
    return res.status(201).json({ data: variant });
  } catch (error) {
    return next(error);
  }
}


export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    const product = await productsService.updateProduct(req.params.id, req.body);
    return res.json({ data: product });
  } catch (error) {
    return next(error);
  }
}
