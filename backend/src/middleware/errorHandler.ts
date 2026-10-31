import { Prisma } from '@prisma/client';
import { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { env } from '../config/env.js';

/**
 * Single error envelope for every failure:
 *   { error: { code, message, fields? } }
 * Request bodies are never logged, so passwords and reset tokens cannot leak into logs.
 */
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    const fields: Record<string, string> = {};
    for (const issue of err.issues) {
      const path = issue.path.filter((part) => part !== 'body' && part !== 'query' && part !== 'params').join('.') || 'root';
      fields[path] ??= issue.message;
    }
    return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Please correct the highlighted fields', fields } });
  }

  if (err instanceof SyntaxError && 'body' in err) {
    return res.status(400).json({ error: { code: 'INVALID_JSON', message: 'Request body is not valid JSON' } });
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') return res.status(409).json({ error: { code: 'CONFLICT', message: 'A record with these details already exists' } });
    if (err.code === 'P2025') return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Record not found' } });
    if (err.code === 'P2003') return res.status(400).json({ error: { code: 'INVALID_REFERENCE', message: 'A referenced record does not exist' } });
  }

  const known = err as { statusCode?: number; code?: string; message?: string };
  const statusCode = typeof known.statusCode === 'number' && known.statusCode >= 400 && known.statusCode < 600 ? known.statusCode : 500;

  if (statusCode >= 500 && env.NODE_ENV !== 'test') {
    console.error(`[${req.method} ${req.path}]`, err instanceof Error ? err.stack ?? err.message : 'Unknown error');
  }

  return res.status(statusCode).json({
    error: {
      code: statusCode === 500 ? 'INTERNAL_SERVER_ERROR' : known.code ?? 'ERROR',
      message: statusCode === 500 ? 'An unexpected error occurred' : known.message ?? 'Request failed',
    },
  });
}

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({ error: { code: 'ROUTE_NOT_FOUND', message: `No route for ${req.method} ${req.path}` } });
}
