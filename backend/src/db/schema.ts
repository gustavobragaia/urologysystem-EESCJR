import { pgTable, uuid, text, timestamp, real, integer, pgEnum } from 'drizzle-orm/pg-core';

export const sexoEnum = pgEnum('sexo', ['M', 'F', 'Outro']);
export const statusVinculacaoEnum = pgEnum('status_vinculacao', ['vinculado', 'orfao']);

export const pacientes = pgTable('pacientes', {
  id: uuid('id').primaryKey().defaultRandom(),
  medicoId: uuid('medico_id').notNull(),

  nome: text('nome').notNull(),
  dataNascimento: text('data_nascimento').notNull(), // ISO date YYYY-MM-DD
  sexo: sexoEnum('sexo').notNull(),

  cpf: text('cpf'),
  convenio: text('convenio'),
  telefone: text('telefone'),
  email: text('email'),
  endereco: text('endereco'),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const exames = pgTable('exames', {
  id: uuid('id').primaryKey().defaultRandom(),
  medicoId: uuid('medico_id').notNull(),
  pacienteId: uuid('paciente_id').references(() => pacientes.id, { onDelete: 'cascade' }),
  statusVinculacao: statusVinculacaoEnum('status_vinculacao').notNull().default('vinculado'),

  dataExame: timestamp('data_exame', { withTimezone: true }).defaultNow().notNull(),

  fluxoMaximo: real('fluxo_maximo').notNull(),
  fluxoMedio: real('fluxo_medio').notNull(),
  volumeMiccao: real('volume_miccao').notNull(),
  tempoAteFluxoMax: real('tempo_ate_fluxo_max').notNull(),
  tempoTotalMiccao: real('tempo_total_miccao').notNull(),

  volumeResidual: real('volume_residual'),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const leituras = pgTable('leituras', {
  id: uuid('id').primaryKey().defaultRandom(),
  exameId: uuid('exame_id').notNull().references(() => exames.id, { onDelete: 'cascade' }),
  indice: integer('indice').notNull(),
  fluxo: real('fluxo').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
