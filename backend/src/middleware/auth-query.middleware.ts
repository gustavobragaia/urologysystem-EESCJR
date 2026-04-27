import type { Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../lib/supabase';

// Para rotas SSE e PDF onde EventSource/window.open não suportam headers customizados
// Aceita token via ?token= na query string OU via header Authorization: Bearer
export async function authQueryMiddleware(req: Request, res: Response, next: NextFunction) {
  const token = (req.query.token as string) || req.headers.authorization?.slice(7);

  if (!token) {
    res.status(401).json({ error: 'Unauthorized', message: 'Token não fornecido' });
    return;
  }

  const { data, error } = await supabaseAdmin.auth.getUser(token);

  if (error || !data.user) {
    res.status(401).json({ error: 'Unauthorized', message: 'Token inválido ou expirado' });
    return;
  }

  req.user = data.user;
  next();
}
