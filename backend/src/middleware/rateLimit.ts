import { NextFunction, Request, Response } from 'express';

/**
 * Minimal in-memory fixed-window limiter, keyed by client IP. Good enough for a
 * single-process local deployment; not shared across processes.
 */
export function rateLimit({ windowMs, max }: { windowMs: number; max: number }) {
  const hits = new Map<string, { count: number; resetAt: number }>();
  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    const key = req.ip ?? 'unknown';
    const entry = hits.get(key);
    if (!entry || entry.resetAt <= now) {
      hits.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }
    entry.count += 1;
    if (entry.count > max) {
      res.setHeader('Retry-After', Math.ceil((entry.resetAt - now) / 1000).toString());
      return res.status(429).json({ error: { code: 'TOO_MANY_REQUESTS', message: 'Too many attempts. Please wait a minute and try again.' } });
    }
    return next();
  };
}
