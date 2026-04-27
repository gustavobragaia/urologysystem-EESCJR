import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth.middleware';
import { authQueryMiddleware } from '../middleware/auth-query.middleware';
import { validate } from '../middleware/validate.middleware';
import { db } from '../db';
import { exames, pacientes, leituras } from '../db/schema';
import { eq, and, asc } from 'drizzle-orm';
import { gerarPdfExame } from '../services/pdf.service';

const router = Router();

/**
 * @openapi
 * /exames/{id}:
 *   get:
 *     summary: Detalhes do exame com métricas e leituras
 *     tags: [Exames]
 */
router.get('/:id', authMiddleware, async (req, res, next) => {
  try {
    const medicoId = req.user!.id;
    const { id } = req.params;

    const [exame] = await db
      .select()
      .from(exames)
      .where(and(eq(exames.id, id), eq(exames.medicoId, medicoId)));

    if (!exame) {
      res.status(404).json({ error: 'Not Found', message: 'Exame não encontrado' });
      return;
    }

    let paciente = null;
    if (exame.pacienteId) {
      const [p] = await db
        .select()
        .from(pacientes)
        .where(eq(pacientes.id, exame.pacienteId));
      paciente = p ?? null;
    }

    const leiturasExame = await db
      .select({ indice: leituras.indice, fluxo: leituras.fluxo })
      .from(leituras)
      .where(eq(leituras.exameId, id))
      .orderBy(asc(leituras.indice));

    res.json({ exame, paciente, leituras: leiturasExame });
  } catch (err) {
    next(err);
  }
});

const examePatchSchema = z.object({
  volumeResidual: z.number().nullable(),
});

/**
 * @openapi
 * /exames/{id}:
 *   patch:
 *     summary: Atualiza volume residual do exame
 *     tags: [Exames]
 */
router.patch('/:id', authMiddleware, validate(examePatchSchema), async (req, res, next) => {
  try {
    const medicoId = req.user!.id;
    const { id } = req.params;
    const { volumeResidual } = req.body as z.infer<typeof examePatchSchema>;

    const [atualizado] = await db
      .update(exames)
      .set({ volumeResidual: volumeResidual ?? undefined })
      .where(and(eq(exames.id, id), eq(exames.medicoId, medicoId)))
      .returning();

    if (!atualizado) {
      res.status(404).json({ error: 'Not Found', message: 'Exame não encontrado' });
      return;
    }

    res.json({ exame: atualizado });
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /exames/{id}:
 *   delete:
 *     summary: Exclui exame (cascata leituras)
 *     tags: [Exames]
 */
router.delete('/:id', authMiddleware, async (req, res, next) => {
  try {
    const medicoId = req.user!.id;
    const { id } = req.params;

    const [deletado] = await db
      .delete(exames)
      .where(and(eq(exames.id, id), eq(exames.medicoId, medicoId)))
      .returning({ id: exames.id });

    if (!deletado) {
      res.status(404).json({ error: 'Not Found', message: 'Exame não encontrado' });
      return;
    }

    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /exames/{id}/pdf:
 *   get:
 *     summary: Gera PDF clínico do exame
 *     tags: [Exames]
 *     parameters:
 *       - in: query
 *         name: token
 *         schema: { type: string }
 *       - in: query
 *         name: download
 *         schema: { type: string }
 */
router.get('/:id/pdf', authQueryMiddleware, async (req, res, next) => {
  try {
    const medicoId = req.user!.id;
    const { id } = req.params;
    const download = req.query.download === '1';

    const [exame] = await db
      .select()
      .from(exames)
      .where(and(eq(exames.id, id), eq(exames.medicoId, medicoId)));

    if (!exame) {
      res.status(404).json({ error: 'Not Found', message: 'Exame não encontrado' });
      return;
    }

    let paciente = null;
    if (exame.pacienteId) {
      const [p] = await db
        .select()
        .from(pacientes)
        .where(eq(pacientes.id, exame.pacienteId));
      paciente = p ?? null;
    }

    const leiturasExame = await db
      .select({ indice: leituras.indice, fluxo: leituras.fluxo })
      .from(leituras)
      .where(eq(leituras.exameId, id))
      .orderBy(asc(leituras.indice));

    await gerarPdfExame(exame as any, paciente as any, leiturasExame, res, download);
  } catch (err) {
    next(err);
  }
});

export default router;
