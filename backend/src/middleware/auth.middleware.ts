import type { Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../lib/supabase';

export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized', message: 'Token não fornecido' });
    return;
  }

  const token = authHeader.slice(7);
  try {
    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !data.user) {
      res.status(401).json({ error: 'Unauthorized', message: 'Token inválido ou expirado' });
      return;
    }
    req.user = data.user;
    next();
  } catch {
    res.status(401).json({ error: 'Unauthorized', message: 'Token inválido ou expirado' });
  }
}
