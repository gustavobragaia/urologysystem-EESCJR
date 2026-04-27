import type { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';

export function validate(schema: ZodSchema, source: 'body' | 'query' | 'params' = 'body') {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      res.status(422).json({
        error: 'Validation Error',
        message: 'Dados de entrada inválidos',
        details: result.error.flatten(),
      });
      return;
    }
    req[source] = result.data;
    next();
  };
}
