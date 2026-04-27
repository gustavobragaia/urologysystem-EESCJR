import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

/**
 * @openapi
 * /auth/me:
 *   get:
 *     summary: Retorna dados do usuário logado
 *     tags: [Auth]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Dados do usuário
 */
router.get('/me', authMiddleware, (req, res) => {
  const user = req.user!;
  res.json({
    id: user.id,
    email: user.email,
    user_metadata: user.user_metadata,
  });
});

export default router;
