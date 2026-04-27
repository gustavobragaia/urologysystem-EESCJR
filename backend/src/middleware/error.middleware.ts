import type { Request, Response, NextFunction } from 'express';
import { env } from '../lib/env';

export function errorMiddleware(err: Error, req: Request, res: Response, _next: NextFunction) {
  const isProd = env.NODE_ENV === 'production';

  console.error('[Error]', err.message, isProd ? '' : err.stack);

  res.status(500).json({
    error: 'Internal Server Error',
    message: isProd ? 'Erro interno do servidor' : err.message,
  });
}
