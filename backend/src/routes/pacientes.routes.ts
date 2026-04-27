import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { db } from '../db';
import { pacientes, exames } from '../db/schema';
import { eq, and, ilike, desc, sql, count } from 'drizzle-orm';

const router = Router();

const pacienteBodySchema = z.object({
  nome: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  dataNascimento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data deve ser YYYY-MM-DD'),
  sexo: z.enum(['M', 'F', 'Outro']),
  cpf: z.string().optional().nullable(),
  convenio: z.string().optional().nullable(),
  telefone: z.string().optional().nullable(),
  email: z.string().email().optional().nullable(),
  endereco: z.string().optional().nullable(),
});

const pacientePatchSchema = pacienteBodySchema.partial();

/**
 * @openapi
 * /pacientes:
 *   get:
 *     summary: Lista pacientes do médico
 *     tags: [Pacientes]
 */
router.get('/', authMiddleware, async (req, res, next) => {
  try {
    const medicoId = req.user!.id;
    const busca = req.query.busca as string | undefined;
    const limit = Math.min(Number(req.query.limit) || 50, 100);
    const offset = Number(req.query.offset) || 0;

    const baseWhere = eq(pacientes.medicoId, medicoId);
    const whereClause = busca
      ? and(baseWhere, ilike(pacientes.nome, `%${busca}%`))
      : baseWhere;

    const lista = await db
      .select({
        id: pacientes.id,
        nome: pacientes.nome,
        dataNascimento: pacientes.dataNascimento,
        sexo: pacientes.sexo,
        cpf: pacientes.cpf,
        convenio: pacientes.convenio,
        telefone: pacientes.telefone,
        email: pacientes.email,
        endereco: pacientes.endereco,
        createdAt: pacientes.createdAt,
      })
      .from(pacientes)
      .where(whereClause)
      .orderBy(pacientes.nome)
      .limit(limit)
      .offset(offset);

    // Total count
    const [{ total }] = await db
      .select({ total: count() })
      .from(pacientes)
      .where(whereClause);

    // Último exame e total de exames por paciente
    const pacientesComExames = await Promise.all(
      lista.map(async (p) => {
        const [ultimoExame] = await db
          .select({ dataExame: exames.dataExame })
          .from(exames)
          .where(and(eq(exames.pacienteId, p.id), eq(exames.statusVinculacao, 'vinculado')))
          .orderBy(desc(exames.dataExame))
          .limit(1);

        const [{ totalExames }] = await db
          .select({ totalExames: count() })
          .from(exames)
          .where(and(eq(exames.pacienteId, p.id), eq(exames.statusVinculacao, 'vinculado')));

        return {
          ...p,
          ultimoExame: ultimoExame?.dataExame?.toISOString() ?? null,
          totalExames: Number(totalExames),
        };
      })
    );

    res.json({ pacientes: pacientesComExames, total: Number(total) });
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /pacientes:
 *   post:
 *     summary: Cria novo paciente
 *     tags: [Pacientes]
 */
router.post('/', authMiddleware, validate(pacienteBodySchema), async (req, res, next) => {
  try {
    const medicoId = req.user!.id;
    const data = req.body as z.infer<typeof pacienteBodySchema>;

    const [novo] = await db
      .insert(pacientes)
      .values({ ...data, medicoId })
      .returning();

    res.status(201).json({ paciente: novo });
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /pacientes/{id}:
 *   get:
 *     summary: Detalhes do paciente + histórico de exames
 *     tags: [Pacientes]
 */
router.get('/:id', authMiddleware, async (req, res, next) => {
  try {
    const medicoId = req.user!.id;
    const { id } = req.params;

    const [paciente] = await db
      .select()
      .from(pacientes)
      .where(and(eq(pacientes.id, id), eq(pacientes.medicoId, medicoId)));

    if (!paciente) {
      res.status(404).json({ error: 'Not Found', message: 'Paciente não encontrado' });
      return;
    }

    const historico = await db
      .select({
        id: exames.id,
        dataExame: exames.dataExame,
        fluxoMaximo: exames.fluxoMaximo,
        fluxoMedio: exames.fluxoMedio,
        volumeMiccao: exames.volumeMiccao,
        tempoAteFluxoMax: exames.tempoAteFluxoMax,
        tempoTotalMiccao: exames.tempoTotalMiccao,
        volumeResidual: exames.volumeResidual,
      })
      .from(exames)
      .where(and(eq(exames.pacienteId, id), eq(exames.statusVinculacao, 'vinculado')))
      .orderBy(desc(exames.dataExame));

    res.json({ paciente, exames: historico });
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /pacientes/{id}:
 *   patch:
 *     summary: Atualiza paciente
 *     tags: [Pacientes]
 */
router.patch('/:id', authMiddleware, validate(pacientePatchSchema), async (req, res, next) => {
  try {
    const medicoId = req.user!.id;
    const { id } = req.params;
    const data = req.body as z.infer<typeof pacientePatchSchema>;

    const [atualizado] = await db
      .update(pacientes)
      .set(data)
      .where(and(eq(pacientes.id, id), eq(pacientes.medicoId, medicoId)))
      .returning();

    if (!atualizado) {
      res.status(404).json({ error: 'Not Found', message: 'Paciente não encontrado' });
      return;
    }

    res.json({ paciente: atualizado });
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /pacientes/{id}:
 *   delete:
 *     summary: Exclui paciente (cascata)
 *     tags: [Pacientes]
 */
router.delete('/:id', authMiddleware, async (req, res, next) => {
  try {
    const medicoId = req.user!.id;
    const { id } = req.params;

    const [deletado] = await db
      .delete(pacientes)
      .where(and(eq(pacientes.id, id), eq(pacientes.medicoId, medicoId)))
      .returning({ id: pacientes.id });

    if (!deletado) {
      res.status(404).json({ error: 'Not Found', message: 'Paciente não encontrado' });
      return;
    }

    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;
