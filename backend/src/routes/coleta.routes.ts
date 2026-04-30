import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth.middleware';
import { authQueryMiddleware } from '../middleware/auth-query.middleware';
import { coletaRateLimit } from '../middleware/rateLimit.middleware';
import { validate } from '../middleware/validate.middleware';
import { processarExame, payloadEsp32Schema } from '../services/processamento.service';
import { salvarExame } from '../services/exame.service';
import {
  registrarSessao,
  notificarExamePronto,
  cancelarSessao,
  listarSessoes,
} from '../services/sse.service';
import { db } from '../db';
import { exames, pacientes, leituras } from '../db/schema';
import { eq, and } from 'drizzle-orm';

const router = Router();

/**
 * @openapi
 * /coleta/dados:
 *   post:
 *     summary: Recebe dados do ESP32 (endpoint público)
 *     tags: [Coleta]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: array
 *             items:
 *               type: object
 *               properties:
 *                 Fl: { type: string }
 *                 It: { type: string }
 *     responses:
 *       200:
 *         description: Exame recebido
 */
router.post('/dados', coletaRateLimit, validate(payloadEsp32Schema), async (req, res, next) => {
  try {
    const { metricas, leiturasTruncadas } = processarExame(req.body);

    const sessoesAtivas = listarSessoes();
    const sessaoAtiva = sessoesAtivas[0] ?? null;

    console.log(`[/dados] sessões SSE ativas: ${sessoesAtivas.length}`, sessaoAtiva ? `→ paciente ${sessaoAtiva.pacienteId}` : '→ sem sessão (órfão)');

    let medicoId: string;
    let pacienteId: string | null = null;

    if (sessaoAtiva) {
      medicoId = sessaoAtiva.medicoId;
      pacienteId = sessaoAtiva.pacienteId;
    } else {
      medicoId = '00000000-0000-0000-0000-000000000000';
    }

    const exameId = await salvarExame({ medicoId, pacienteId, metricas, leiturasArray: leiturasTruncadas });

    if (sessaoAtiva && pacienteId) {
      const notificado = notificarExamePronto(pacienteId, exameId);
      console.log(`[/dados] notificarExamePronto → ${notificado ? 'OK' : 'FALHOU (sessão já encerrada)'}`);
    }

    res.json({
      exameId,
      pacienteId,
      status: pacienteId ? 'vinculado' : 'orfao',
    });
  } catch (err) {
    if (err instanceof Error && err.message.startsWith('Exame inválido')) {
      res.status(422).json({
        error: 'Validation Error',
        message: err.message,
        code: 'no_positive_flow',
      });
      return;
    }
    next(err);
  }
});

/**
 * @openapi
 * /coleta/aguardar/{pacienteId}:
 *   get:
 *     summary: SSE — aguardar dados do ESP32 para um paciente
 *     tags: [Coleta]
 *     parameters:
 *       - in: path
 *         name: pacienteId
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: token
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Server-Sent Events stream
 */
router.get('/aguardar/:pacienteId', authQueryMiddleware, async (req, res, next) => {
  try {
    const { pacienteId } = req.params;
    const medicoId = req.user!.id;

    // Verificar que o paciente pertence ao médico
    const [paciente] = await db
      .select({ id: pacientes.id })
      .from(pacientes)
      .where(and(eq(pacientes.id, pacienteId), eq(pacientes.medicoId, medicoId)));

    if (!paciente) {
      res.status(404).json({ error: 'Not Found', message: 'Paciente não encontrado' });
      return;
    }

    registrarSessao(pacienteId, medicoId, res);
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /coleta/cancelar/{pacienteId}:
 *   post:
 *     summary: Cancela coleta em andamento
 *     tags: [Coleta]
 *     parameters:
 *       - in: path
 *         name: pacienteId
 *         required: true
 *         schema: { type: string }
 */
router.post('/cancelar/:pacienteId', authMiddleware, (req, res) => {
  const { pacienteId } = req.params;
  const cancelado = cancelarSessao(pacienteId);
  res.json({ cancelado });
});

const vincularSchema = z.object({
  exameId: z.string().uuid(),
  pacienteId: z.string().uuid(),
});

/**
 * @openapi
 * /coleta/vincular:
 *   post:
 *     summary: Vincula exame órfão a um paciente
 *     tags: [Coleta]
 */
router.post('/vincular', authMiddleware, validate(vincularSchema), async (req, res, next) => {
  try {
    const { exameId, pacienteId } = req.body as z.infer<typeof vincularSchema>;
    const medicoId = req.user!.id;

    const [exame] = await db
      .select()
      .from(exames)
      .where(eq(exames.id, exameId));

    if (!exame) {
      res.status(404).json({ error: 'Not Found', message: 'Exame não encontrado' });
      return;
    }

    if (exame.statusVinculacao !== 'orfao') {
      res.status(409).json({ error: 'Conflict', message: 'Exame não está órfão' });
      return;
    }

    const [paciente] = await db
      .select({ id: pacientes.id })
      .from(pacientes)
      .where(and(eq(pacientes.id, pacienteId), eq(pacientes.medicoId, medicoId)));

    if (!paciente) {
      res.status(404).json({ error: 'Not Found', message: 'Paciente não encontrado' });
      return;
    }

    const [atualizado] = await db
      .update(exames)
      .set({ pacienteId, medicoId, statusVinculacao: 'vinculado' })
      .where(eq(exames.id, exameId))
      .returning();

    res.json({ exame: atualizado });
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /coleta/orfaos:
 *   get:
 *     summary: Lista exames órfãos do médico
 *     tags: [Coleta]
 */
router.get('/orfaos', authMiddleware, async (_req, res, next) => {
  try {
    const orfaos = await db
      .select({
        id: exames.id,
        dataExame: exames.dataExame,
        fluxoMaximo: exames.fluxoMaximo,
        volumeMiccao: exames.volumeMiccao,
        tempoTotalMiccao: exames.tempoTotalMiccao,
      })
      .from(exames)
      .where(eq(exames.statusVinculacao, 'orfao'));

    // Buscar preview de leituras para cada exame órfão
    const orfaosComPreview = await Promise.all(
      orfaos.map(async (exame) => {
        const leiturasPreview = await db
          .select({ indice: leituras.indice, fluxo: leituras.fluxo })
          .from(leituras)
          .where(eq(leituras.exameId, exame.id))
          .limit(50);

        return { ...exame, leiturasPreview };
      })
    );

    res.json({ exames: orfaosComPreview, total: orfaosComPreview.length });
  } catch (err) {
    next(err);
  }
});

export default router;
