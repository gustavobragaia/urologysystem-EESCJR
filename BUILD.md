# BUILD.md — Sistema de Urofluxometria

**Cliente:** Dr. Rômulo Nunes — Urologista e Cirurgião Robótico
**Produto:** Dr. Rômulo Nunes — Sistema de Urofluxometria
**Desenvolvedor:** GBS Media · CNPJ 49.544.746/0001-55
**Contrato:** EESC Jr. USP · R$ 5.000 em 3 parcelas
**Versão:** 1.0 (final, pronto para implementação)

---

## SUMÁRIO

1. [Contexto e Visão Geral](#1-contexto-e-visão-geral)
2. [Decisões de Arquitetura](#2-decisões-de-arquitetura)
3. [Stack Tecnológica](#3-stack-tecnológica)
4. [Estrutura do Monorepo](#4-estrutura-do-monorepo)
5. [Hardware ESP32 — Contrato de Integração](#5-hardware-esp32--contrato-de-integração)
6. [Banco de Dados — Schema e RLS](#6-banco-de-dados--schema-e-rls)
7. [Motor de Processamento — 6 Métricas](#7-motor-de-processamento--6-métricas)
8. [Fluxo SSE — Server-Sent Events](#8-fluxo-sse--server-sent-events)
9. [API REST — Endpoints](#9-api-rest--endpoints)
10. [Design System](#10-design-system)
11. [Frontend — Páginas e Comportamento](#11-frontend--páginas-e-comportamento)
12. [Geração de PDF Clínico](#12-geração-de-pdf-clínico)
13. [Mock do ESP32](#13-mock-do-esp32)
14. [Docker, CI/CD e Deploy](#14-docker-cicd-e-deploy)
15. [Variáveis de Ambiente](#15-variáveis-de-ambiente)
16. [Setup da VPS Contabo](#16-setup-da-vps-contabo)
17. [Checklist de Segurança](#17-checklist-de-segurança)
18. [Plano de Implementação por Fases](#18-plano-de-implementação-por-fases)
19. [Gotchas Críticos](#19-gotchas-críticos)
20. [Apêndices](#20-apêndices)

---

## 1. CONTEXTO E VISÃO GERAL

### 1.1 O que é urofluxometria

Urofluxometria é um exame que mede a velocidade e o volume do fluxo urinário durante a micção. Permite avaliar disfunções do trato urinário inferior (obstruções, hiperplasia prostática, problemas neurológicos). Produz uma curva fluxo × tempo e um conjunto de métricas clínicas (fluxo máximo, volume total, etc.) que o urologista interpreta.

### 1.2 Cenário e solução

Exames são tradicionalmente realizados em laboratórios — caro, agendamento difícil, ambiente artificial que invalida resultados. O Dr. Rômulo desenvolveu um **dispositivo ESP32 + célula de carga HX711** portátil. O paciente urina no dispositivo, que mede variação de massa em tempo real, calcula o fluxo, e ao final envia os dados via WiFi.

A GBS Media desenvolve a camada de software que:
- Recebe os dados do ESP32 via HTTP POST
- Processa as métricas clínicas
- Armazena no banco
- Apresenta ao médico via dashboard web
- Gera relatório clínico em PDF

### 1.3 Características do sistema

- **Usuário único:** Dr. Rômulo (não é multi-tenant; conta criada manualmente no Supabase)
- **Uso no consultório:** dispositivo numa rede WiFi controlada
- **Web responsivo:** desktop + mobile
- **Tempo real:** SSE notifica o frontend quando o ESP32 envia dados
- **Recuperação de exames órfãos:** se o ESP32 enviar sem sessão ativa do médico, o exame fica disponível para vinculação manual

### 1.4 Decisões clínicas validadas com o cliente

| Decisão | Definição |
|---|---|
| Métricas calculadas | 5 automáticas (Fluxo Máximo, Fluxo Médio, Volume de Micção, Tempo até Fluxo Máximo, Tempo Total de Micção) + 1 manual (Volume Residual) |
| Volume Residual | Campo opcional — médico mede via ultrassom/sonda e digita |
| Classificação Normal/Atenção/Alerta | **REMOVIDA**. Sistema não classifica. Médico interpreta. |
| Faixas de referência | Faixa única, sem diferenciação por sexo |
| Cadastro de paciente | Obrigatórios: nome, data nasc, sexo. Opcionais: CPF, convênio, telefone, email, endereço |
| Volume Máximo | Removido por solicitação do cliente (redundante com Volume de Micção) |
| Tempo de Pré-Micção | Removido por solicitação do cliente |

---

## 2. DECISÕES DE ARQUITETURA

### 2.1 Princípios

1. **Type-safety end-to-end**: TypeScript em todo o stack, Zod validando inputs externos, Drizzle gerando tipos do schema.
2. **Server-first**: lógica clínica e validação no backend. Frontend é viewer + form.
3. **Separação clara**: backend em VPS Contabo (Docker), frontend em Vercel (estático), banco no Supabase. Cada camada escala independentemente.
4. **Recuperação de falhas**: ESP32 não retenta. Backend salva exames órfãos quando não há sessão ativa, e médico vincula depois.
5. **Real-time leve**: SSE puro (sem WebSocket, sem Supabase Realtime). Backend mantém um Map em memória de sessões aguardando.
6. **Single process**: como o Map de SSE é em memória, o container Docker roda **1 processo apenas**. Sem cluster, sem Redis.

### 2.2 Diagrama de alto nível

```
┌─────────────────────────────────────────────────────────────┐
│                         CONSULTÓRIO                          │
│  ┌──────────┐                                                │
│  │  ESP32   │  WiFi do consultório → HTTP POST              │
│  │  HX711   │──────────────────────────┐                    │
│  └──────────┘                          │                    │
│                                        ▼                    │
└────────────────────────────────────────┼────────────────────┘
                                         │
                                         ▼
┌─────────────────────────────────────────────────────────────┐
│                   VPS CONTABO (Docker)                       │
│  ┌────────────────────────────────────────────┐             │
│  │  Backend Node + Express + TS               │             │
│  │  - POST /api/coleta/dados                  │             │
│  │  - GET  /api/coleta/aguardar/:pacienteId   │ (SSE)       │
│  │  - GET  /api/exames/:id/pdf                │             │
│  │  - CRUD pacientes/exames                   │             │
│  │  - Map<pacienteId, Response> em memória   │             │
│  └────────────────────────────────────────────┘             │
└──────────────┬──────────────────────────────┬───────────────┘
               │                              │
               ▼                              ▼
   ┌───────────────────────┐     ┌──────────────────────────┐
   │   Supabase            │     │   Vercel                 │
   │   - Postgres          │     │   - Frontend React/Vite  │
   │   - Auth              │     │   - Servido via CDN      │
   │   - RLS policies      │     │                          │
   └───────────────────────┘     └──────────────────────────┘
                                              │
                                              ▼
                                      ┌───────────────┐
                                      │  Médico       │
                                      │  (browser)    │
                                      └───────────────┘
```

### 2.3 Por que essas escolhas

| Escolha | Justificativa |
|---|---|
| Backend separado em VPS | ESP32 manda POST direto pro backend; precisa de URL HTTPS estável e sem cold-start. Vercel/Lambda têm latência e cold-start inviáveis pra um POST que vem 1× por exame. |
| SSE em vez de WebSocket | Conexão é unidirecional (servidor → cliente). SSE reconecta sozinho, é mais simples e usa HTTP padrão (passa em qualquer firewall). |
| Map em memória em vez de Redis | Único usuário, único processo. Redis seria over-engineering. |
| Supabase em vez de Postgres self-hosted | Auth pronto, RLS pronto, backups, dashboard. R$0 no plano free. |
| Drizzle em vez de Prisma | Menor, gera SQL legível, sem runtime engine, melhor performance em ambiente serverless e dockerizado. |
| Vercel pro frontend | Deploy automático do GitHub, CDN global, free tier suficiente. |

---

## 3. STACK TECNOLÓGICA

### 3.1 Backend

| Categoria | Tecnologia | Versão |
|---|---|---|
| Runtime | Node.js | 20 LTS |
| Linguagem | TypeScript | 5.4+ |
| Framework HTTP | Express | 4.19+ |
| ORM | Drizzle ORM + drizzle-kit | 0.30+ |
| Driver Postgres | postgres (porsager) | 3.4+ |
| Validação | Zod | 3.23+ |
| Auth helper | @supabase/supabase-js | 2.43+ |
| PDF | PDFKit | 0.15+ |
| Rate limit | express-rate-limit | 7.3+ |
| CORS | cors | 2.8+ |
| Swagger | swagger-ui-express + swagger-jsdoc | latest |
| Container | Docker + Docker Compose | latest |

### 3.2 Frontend

| Categoria | Tecnologia | Versão |
|---|---|---|
| Framework | React | 18.3+ |
| Build | Vite | 5.3+ |
| Linguagem | TypeScript | 5.4+ |
| Estilo | Tailwind CSS | 3.4+ |
| Componentes | shadcn/ui (customizado) | latest |
| Ícones | lucide-react | latest |
| Roteamento | react-router-dom | 6.24+ |
| Estado servidor | TanStack Query | 5.51+ |
| Forms | react-hook-form + @hookform/resolvers | 7.52+ |
| Validação | Zod | 3.23+ |
| Gráfico | Recharts | 2.12+ |
| Toasts | Sonner | 1.5+ |
| HTTP | axios | 1.7+ |
| Auth | @supabase/supabase-js | 2.43+ |
| Datas | date-fns | 3.6+ |
| Animação | CSS transitions (sem Framer Motion) | — |

### 3.3 Infraestrutura

| Componente | Provedor | Plano |
|---|---|---|
| Banco + Auth | Supabase | Free |
| Backend | Contabo VPS Cloud VPS 10 | $3.96/mo (4 vCPU, 8GB) |
| Frontend | Vercel | Free |
| Container Registry | GitHub Container Registry (ghcr.io) | Free |
| CI/CD | GitHub Actions | Free |
| DNS/Domínio | A registrar | — |

---

## 4. ESTRUTURA DO MONOREPO

Monorepo simples (sem Turborepo). Cada pasta tem seu próprio `package.json`.

```
urofluxometria/
├── backend/
│   ├── src/
│   │   ├── routes/
│   │   │   ├── auth.routes.ts
│   │   │   ├── pacientes.routes.ts
│   │   │   ├── exames.routes.ts
│   │   │   └── coleta.routes.ts
│   │   ├── services/
│   │   │   ├── processamento.service.ts   # Calcula as 5 métricas
│   │   │   ├── pdf.service.ts              # Gera PDF clínico
│   │   │   ├── sse.service.ts              # Map de sessões SSE
│   │   │   └── exame.service.ts            # Lógica de salvar exame
│   │   ├── middleware/
│   │   │   ├── auth.middleware.ts          # Valida JWT do Supabase
│   │   │   ├── rateLimit.middleware.ts
│   │   │   ├── validate.middleware.ts      # Wrapper Zod
│   │   │   └── error.middleware.ts         # Error handler global
│   │   ├── db/
│   │   │   ├── schema.ts                   # Drizzle schema
│   │   │   ├── index.ts                    # Connection
│   │   │   └── migrations/                 # Geradas por drizzle-kit
│   │   ├── lib/
│   │   │   ├── supabase.ts                 # Client admin
│   │   │   └── env.ts                      # Validação de envs (Zod)
│   │   ├── swagger/
│   │   │   └── config.ts
│   │   ├── types/
│   │   │   └── express.d.ts                # Augment Request com user
│   │   └── server.ts                       # Entry point
│   ├── Dockerfile
│   ├── .dockerignore
│   ├── drizzle.config.ts
│   ├── package.json
│   ├── tsconfig.json
│   └── .env.example
│
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── auth/
│   │   │   │   ├── Login.tsx
│   │   │   │   ├── RecuperarSenha.tsx
│   │   │   │   └── RedefinirSenha.tsx
│   │   │   ├── pacientes/
│   │   │   │   ├── ListaPacientes.tsx
│   │   │   │   ├── DetalhesPaciente.tsx
│   │   │   │   ├── NovoPaciente.tsx
│   │   │   │   └── EditarPaciente.tsx
│   │   │   ├── coleta/
│   │   │   │   ├── ColetaFlow.tsx
│   │   │   │   └── ExamesOrfaos.tsx
│   │   │   ├── exames/
│   │   │   │   └── DetalhesExame.tsx
│   │   │   └── perfil/
│   │   │       └── Perfil.tsx
│   │   ├── components/
│   │   │   ├── ui/                         # shadcn/ui customizado
│   │   │   ├── layout/
│   │   │   │   ├── AppShell.tsx
│   │   │   │   ├── Header.tsx
│   │   │   │   ├── BottomNav.tsx
│   │   │   │   └── ProtectedRoute.tsx
│   │   │   ├── pacientes/
│   │   │   │   ├── PacienteCard.tsx
│   │   │   │   └── FormPaciente.tsx
│   │   │   ├── coleta/
│   │   │   │   ├── PassoSelecionarPaciente.tsx
│   │   │   │   ├── PassoAguardando.tsx
│   │   │   │   ├── PassoConcluido.tsx
│   │   │   │   ├── BadgeOrfaos.tsx
│   │   │   │   └── ModalVincularPaciente.tsx
│   │   │   └── exames/
│   │   │       ├── GraficoFluxo.tsx
│   │   │       ├── TabelaMetricas.tsx
│   │   │       └── VolumeResidualInput.tsx
│   │   ├── services/
│   │   │   ├── api.ts                      # Axios + interceptors
│   │   │   └── supabase.ts
│   │   ├── hooks/
│   │   │   ├── useAuth.ts
│   │   │   ├── useColeta.ts                # Gerencia conexão SSE
│   │   │   ├── usePacientes.ts             # TanStack Query
│   │   │   ├── useExames.ts
│   │   │   └── useExamesOrfaos.ts
│   │   ├── lib/
│   │   │   ├── formatters.ts               # Datas, CPF, telefone
│   │   │   └── utils.ts                    # cn() do shadcn
│   │   ├── types/
│   │   │   └── index.ts                    # Paciente, Exame, Métricas
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   └── index.css                       # Tailwind base + tokens
│   ├── public/
│   │   └── logo.svg                        # Adicionado pelo dev manualmente
│   ├── components.json                     # Config shadcn/ui
│   ├── tailwind.config.ts
│   ├── vite.config.ts
│   ├── package.json
│   ├── tsconfig.json
│   └── .env.example
│
├── mock/
│   ├── esp32-mock.ts                       # Simula POST do ESP32
│   ├── package.json
│   └── tsconfig.json
│
├── shared/
│   └── types.ts                            # Tipos compartilhados
│
├── docker-compose.yml
├── .github/workflows/deploy.yml
├── .gitignore
└── README.md
```

### 4.1 package.json raiz

```json
{
  "name": "urofluxometria",
  "private": true,
  "version": "1.0.0",
  "scripts": {
    "dev:backend": "cd backend && npm run dev",
    "dev:frontend": "cd frontend && npm run dev",
    "dev:mock": "cd mock && npm run start"
  }
}
```

---

## 5. HARDWARE ESP32 — CONTRATO DE INTEGRAÇÃO

### 5.1 Comportamento do firmware (imutável, validado)

1. ESP32 liga e cria AP WiFi `ESP32-Setup` (senha: `12345678`)
2. Médico acessa `192.168.4.1` no navegador e digita SSID/senha do consultório
3. ESP32 conecta e fica ocioso, escutando o sensor HX711
4. Quando detecta variação de massa, começa a coletar a 10 Hz (uma leitura a cada 100 ms)
5. Cada leitura tem `Fl` (fluxo em mL/s) e `It` (índice sequencial)
6. Quando detecta 8 leituras consecutivas com `Fl = 0` após o início do fluxo, encerra
7. Envia **um único POST HTTP** para a URL hardcoded no firmware

### 5.2 Linha a alterar no firmware

```cpp
// main.ino — linha ~65
String serverPath = "https://api.SEU_DOMINIO.com.br/api/coleta/dados";
```

> **AÇÃO PENDENTE:** após registrar o domínio, o desenvolvedor (ou equipe do firmware) precisa atualizar essa linha e regravar o ESP32.

### 5.3 Formato JSON enviado pelo ESP32

```json
[
  {"Fl": "0.000000", "It": "0"},
  {"Fl": "0.000000", "It": "1"},
  {"Fl": "12.340000", "It": "2"},
  {"Fl": "25.670000", "It": "3"},
  {"Fl": "18.450000", "It": "4"},
  {"Fl": "0.000000", "It": "5"}
]
```

### 5.4 Características críticas do payload

| Característica | Detalhe | Implicação no backend |
|---|---|---|
| `Fl` é string | Ex: `"12.340000"` | `parseFloat()` — Zod valida formato numérico |
| `It` é string | Ex: `"3"` | `parseInt()` |
| Intervalo entre leituras | 100 ms (10 Hz) | Constante `INTERVALO_S = 0.1` |
| Tamanho do array | Sempre 1000 posições | Backend trunca no fim real (8 zeros consecutivos após primeiro fluxo positivo) |
| Posição 0 sempre `Fl = 0` | Inicialização do firmware | Tratado como protocolo, não como ausência de fluxo |
| Sem retry | ESP32 não retenta | Backend salva exames órfãos quando não há sessão ativa |
| Sem autenticação | Endpoint é público | Mitigação: rate limit + Exames Órfãos |

### 5.5 Lógica de truncamento

```typescript
function truncarLeiturasReais(leituras: Array<{Fl: string, It: string}>) {
  const fluxos = leituras.map(l => parseFloat(l.Fl));

  const inicioFluxo = fluxos.findIndex(f => f > 0);
  if (inicioFluxo === -1) {
    throw new Error('Exame inválido: nenhum fluxo positivo detectado');
  }

  let zerosConsecutivos = 0;
  let fimReal = fluxos.length;
  for (let i = inicioFluxo; i < fluxos.length; i++) {
    if (fluxos[i] === 0) {
      zerosConsecutivos++;
      if (zerosConsecutivos === 8) {
        fimReal = i + 1;
        break;
      }
    } else {
      zerosConsecutivos = 0;
    }
  }

  return leituras.slice(0, fimReal);
}
```

---

## 6. BANCO DE DADOS — SCHEMA E RLS

### 6.1 Setup inicial no Supabase

1. Criar projeto em [supabase.com](https://supabase.com) (plano Free)
2. Anotar `Project URL`, `anon key`, `service_role key`
3. Criar usuário do Dr. Rômulo:
   - Dashboard → Authentication → Users → "Add user" → "Create new user"
   - Email e senha definidos manualmente
   - Marcar "Auto Confirm User" como TRUE
4. Executar migrations geradas pelo Drizzle (`npx drizzle-kit push`)
5. Aplicar RLS policies (SQL abaixo) no SQL Editor

### 6.2 Schema Drizzle (`backend/src/db/schema.ts`)

```typescript
import { pgTable, uuid, text, timestamp, real, integer, pgEnum } from 'drizzle-orm/pg-core';

export const sexoEnum = pgEnum('sexo', ['M', 'F', 'Outro']);
export const statusVinculacaoEnum = pgEnum('status_vinculacao', ['vinculado', 'orfao']);

export const pacientes = pgTable('pacientes', {
  id: uuid('id').primaryKey().defaultRandom(),
  medicoId: uuid('medico_id').notNull(), // FK lógica para auth.users(id)

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
  pacienteId: uuid('paciente_id').references(() => pacientes.id, { onDelete: 'cascade' }), // NULL se órfão
  statusVinculacao: statusVinculacaoEnum('status_vinculacao').notNull().default('vinculado'),

  dataExame: timestamp('data_exame', { withTimezone: true }).defaultNow().notNull(),

  // 5 métricas calculadas
  fluxoMaximo: real('fluxo_maximo').notNull(),            // mL/s — ref: 15-50
  fluxoMedio: real('fluxo_medio').notNull(),              // mL/s — ref: 10-25
  volumeMiccao: real('volume_miccao').notNull(),          // mL — ref: 150-500
  tempoAteFluxoMax: real('tempo_ate_fluxo_max').notNull(),// s — ref: 3-10
  tempoTotalMiccao: real('tempo_total_miccao').notNull(), // s — ref: 15-40

  // 1 métrica manual (opcional)
  volumeResidual: real('volume_residual'),                // mL — ref: <50, NULL = não medido

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
```

### 6.3 SQL adicional (executar no Supabase SQL Editor)

```sql
-- Índices
CREATE INDEX idx_pacientes_medico ON pacientes(medico_id);
CREATE INDEX idx_pacientes_nome ON pacientes(nome);
CREATE INDEX idx_exames_paciente ON exames(paciente_id, data_exame DESC);
CREATE INDEX idx_exames_medico_status ON exames(medico_id, status_vinculacao);
CREATE INDEX idx_leituras_exame ON leituras(exame_id, indice ASC);

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION trigger_update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER pacientes_updated_at
BEFORE UPDATE ON pacientes
FOR EACH ROW EXECUTE FUNCTION trigger_update_updated_at();

CREATE TRIGGER exames_updated_at
BEFORE UPDATE ON exames
FOR EACH ROW EXECUTE FUNCTION trigger_update_updated_at();
```

### 6.4 Row Level Security

```sql
ALTER TABLE pacientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE exames    ENABLE ROW LEVEL SECURITY;
ALTER TABLE leituras  ENABLE ROW LEVEL SECURITY;

-- Pacientes: apenas o médico dono
CREATE POLICY "medico_seleciona_proprios_pacientes" ON pacientes
  FOR SELECT USING (auth.uid() = medico_id);
CREATE POLICY "medico_insere_pacientes" ON pacientes
  FOR INSERT WITH CHECK (auth.uid() = medico_id);
CREATE POLICY "medico_atualiza_proprios_pacientes" ON pacientes
  FOR UPDATE USING (auth.uid() = medico_id);
CREATE POLICY "medico_deleta_proprios_pacientes" ON pacientes
  FOR DELETE USING (auth.uid() = medico_id);

-- Exames: apenas o médico dono
CREATE POLICY "medico_seleciona_proprios_exames" ON exames
  FOR SELECT USING (auth.uid() = medico_id);
CREATE POLICY "medico_atualiza_proprios_exames" ON exames
  FOR UPDATE USING (auth.uid() = medico_id);
CREATE POLICY "medico_deleta_proprios_exames" ON exames
  FOR DELETE USING (auth.uid() = medico_id);

-- IMPORTANTE: INSERT em exames vem do ESP32 (sem auth).
-- Backend usa SERVICE_ROLE_KEY para esse insert, que bypassa RLS.
-- Por isso NÃO criamos política de INSERT para exames.

-- Leituras: acesso via JOIN com exame
CREATE POLICY "medico_seleciona_leituras" ON leituras
  FOR SELECT USING (
    exame_id IN (SELECT id FROM exames WHERE medico_id = auth.uid())
  );
CREATE POLICY "medico_deleta_leituras" ON leituras
  FOR DELETE USING (
    exame_id IN (SELECT id FROM exames WHERE medico_id = auth.uid())
  );
```

### 6.5 Conexão Drizzle (`backend/src/db/index.ts`)

```typescript
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import { env } from '../lib/env';

const queryClient = postgres(env.DATABASE_URL, {
  max: 10,
  idle_timeout: 20,
  prepare: false, // Necessário para Supabase (PgBouncer transaction mode)
});

export const db = drizzle(queryClient, { schema });
```

### 6.6 Configuração drizzle-kit (`backend/drizzle.config.ts`)

```typescript
import type { Config } from 'drizzle-kit';
import 'dotenv/config';

export default {
  schema: './src/db/schema.ts',
  out: './src/db/migrations',
  dialect: 'postgresql',
  dbCredentials: { url: process.env.DATABASE_URL! },
} satisfies Config;
```

---

## 7. MOTOR DE PROCESSAMENTO — 6 MÉTRICAS

### 7.1 Faixas de referência (validadas com Dr. Rômulo)

| # | Métrica | Unidade | Faixa | Origem |
|---|---|---|---|---|
| 1 | Fluxo Máximo (Qmax) | mL/s | 15 – 50 | Calculado |
| 2 | Fluxo Médio (Qavg) | mL/s | 10 – 25 | Calculado |
| 3 | Volume de Micção | mL | 150 – 500 | Calculado |
| 4 | Tempo até Fluxo Máximo | s | 3 – 10 | Calculado |
| 5 | Tempo Total de Micção | s | 15 – 40 | Calculado |
| 6 | Volume Residual | mL | < 50 | Manual (médico digita) |

> **O sistema NÃO classifica Normal/Atenção/Alerta.** Os valores são exibidos com a faixa de referência ao lado, mas a interpretação é responsabilidade do médico.

### 7.2 Implementação completa (`backend/src/services/processamento.service.ts`)

```typescript
import { z } from 'zod';

// Schema de validação do payload do ESP32
export const leituraEsp32Schema = z.object({
  Fl: z.string().regex(/^\d+\.\d+$/, 'Fl deve ser numérico'),
  It: z.string().regex(/^\d+$/, 'It deve ser inteiro'),
});

export const payloadEsp32Schema = z.array(leituraEsp32Schema)
  .min(1, 'Payload vazio')
  .max(1000, 'Payload excede 1000 leituras');

export type LeituraEsp32 = z.infer<typeof leituraEsp32Schema>;

// Constante: intervalo entre leituras
export const INTERVALO_S = 0.1; // 100ms = 10Hz

export interface MetricasCalculadas {
  fluxoMaximo: number;
  fluxoMedio: number;
  volumeMiccao: number;
  tempoAteFluxoMax: number;
  tempoTotalMiccao: number;
}

// Faixas para uso no frontend e PDF
export const REFERENCIAS = {
  fluxoMaximo:      { min: 15,  max: 50,  unidade: 'mL/s', label: 'Fluxo Máximo (Qmax)' },
  fluxoMedio:       { min: 10,  max: 25,  unidade: 'mL/s', label: 'Fluxo Médio (Qavg)' },
  volumeMiccao:     { min: 150, max: 500, unidade: 'mL',   label: 'Volume de Micção' },
  tempoAteFluxoMax: { min: 3,   max: 10,  unidade: 's',    label: 'Tempo até Fluxo Máximo' },
  tempoTotalMiccao: { min: 15,  max: 40,  unidade: 's',    label: 'Tempo Total de Micção' },
  volumeResidual:   { min: 0,   max: 50,  unidade: 'mL',   label: 'Volume Residual' },
} as const;

/**
 * Trunca o array no fim real do exame.
 * ESP32 envia 1000 posições — cortamos quando há 8 zeros consecutivos
 * após o primeiro fluxo positivo.
 */
export function truncarLeiturasReais(leituras: LeituraEsp32[]): LeituraEsp32[] {
  const fluxos = leituras.map(l => parseFloat(l.Fl));

  const inicioFluxo = fluxos.findIndex(f => f > 0);
  if (inicioFluxo === -1) {
    throw new Error('Exame inválido: nenhum fluxo positivo detectado');
  }

  let zerosConsecutivos = 0;
  let fimReal = fluxos.length;

  for (let i = inicioFluxo; i < fluxos.length; i++) {
    if (fluxos[i] === 0) {
      zerosConsecutivos++;
      if (zerosConsecutivos === 8) {
        fimReal = i + 1;
        break;
      }
    } else {
      zerosConsecutivos = 0;
    }
  }

  return leituras.slice(0, fimReal);
}

/**
 * Calcula as 5 métricas a partir do array truncado.
 * Volume Residual é manual e não é calculado aqui.
 */
export function calcularMetricas(leituras: LeituraEsp32[]): MetricasCalculadas {
  if (leituras.length === 0) {
    throw new Error('Array de leituras vazio');
  }

  const fluxos = leituras.map(l => parseFloat(l.Fl));
  const fluxosPositivos = fluxos.filter(f => f > 0);

  if (fluxosPositivos.length === 0) {
    throw new Error('Exame sem fluxo positivo registrado');
  }

  // Fluxo Máximo (Qmax) + índice do pico
  let fluxoMaximo = 0;
  let idxMax = -1;
  for (let i = 0; i < fluxos.length; i++) {
    if (fluxos[i] > fluxoMaximo) {
      fluxoMaximo = fluxos[i];
      idxMax = i;
    }
  }

  // Fluxo Médio (Qavg)
  const somaFluxos = fluxosPositivos.reduce((acc, f) => acc + f, 0);
  const fluxoMedio = somaFluxos / fluxosPositivos.length;

  // Volume de Micção — integral discreta: soma de (fluxo × intervalo)
  const volumeMiccao = fluxosPositivos.reduce((acc, f) => acc + f * INTERVALO_S, 0);

  // Tempo até Fluxo Máximo
  const tempoAteFluxoMax = idxMax * INTERVALO_S;

  // Tempo Total de Micção
  const tempoTotalMiccao = fluxosPositivos.length * INTERVALO_S;

  return {
    fluxoMaximo:      arredondar(fluxoMaximo, 2),
    fluxoMedio:       arredondar(fluxoMedio, 2),
    volumeMiccao:     arredondar(volumeMiccao, 2),
    tempoAteFluxoMax: arredondar(tempoAteFluxoMax, 2),
    tempoTotalMiccao: arredondar(tempoTotalMiccao, 2),
  };
}

function arredondar(valor: number, casas: number): number {
  const fator = Math.pow(10, casas);
  return Math.round(valor * fator) / fator;
}

/**
 * Pipeline completo: payload bruto → métricas + leituras truncadas.
 */
export function processarExame(payloadBruto: unknown): {
  metricas: MetricasCalculadas;
  leiturasTruncadas: LeituraEsp32[];
} {
  const payload = payloadEsp32Schema.parse(payloadBruto);
  const leiturasTruncadas = truncarLeiturasReais(payload);
  const metricas = calcularMetricas(leiturasTruncadas);
  return { metricas, leiturasTruncadas };
}
```

### 7.3 Volume acumulado (frontend)

Para a linha azul do gráfico, o frontend calcula on-demand a partir das leituras:

```typescript
// frontend/src/lib/calculations.ts
export function calcularVolumeAcumulado(fluxos: number[], intervaloS = 0.1): number[] {
  const acumulado: number[] = [];
  let total = 0;
  for (const f of fluxos) {
    total += f * intervaloS;
    acumulado.push(total);
  }
  return acumulado;
}
```

---

## 8. FLUXO SSE — SERVER-SENT EVENTS

### 8.1 Visão geral do fluxo

```
1. Médico clica "Iniciar coleta" para o paciente X no frontend
2. Frontend abre conexão SSE: GET /api/coleta/aguardar/X
3. Backend registra a Response no Map<pacienteId, Response>
4. Backend manda evento "aguardando" para confirmar ao frontend
5. Backend envia "ping" a cada 30s para manter conexão viva
6. ESP32 termina exame e faz POST /api/coleta/dados
7. Backend processa, salva exame, e procura no Map o pacienteId selecionado
8. Backend envia evento "exame_pronto" com o id do exame e dá .end() na conexão SSE
9. Frontend recebe, fecha SSE, navega para /exames/:id

CASO ÓRFÃO: ESP32 envia mas não há ninguém no Map.
- Backend salva exame com paciente_id = NULL e status = 'orfao'
- Médico vê badge vermelho na home e pode vincular depois
```

### 8.2 Implementação do Map de sessões (`backend/src/services/sse.service.ts`)

```typescript
import type { Response } from 'express';

interface SSESession {
  res: Response;
  medicoId: string;
  pacienteId: string;
  iniciadoEm: Date;
  pingInterval: NodeJS.Timeout;
}

// Map global em memória (single-process)
const sessoes = new Map<string, SSESession>();

const PING_INTERVAL_MS = 30_000;
const TIMEOUT_MS = 10 * 60 * 1000; // 10 min

export function registrarSessao(pacienteId: string, medicoId: string, res: Response): void {
  // Se já existe sessão pra esse paciente, fecha a antiga
  const existente = sessoes.get(pacienteId);
  if (existente) {
    clearInterval(existente.pingInterval);
    try { existente.res.end(); } catch {}
    sessoes.delete(pacienteId);
  }

  // Headers SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Importante para nginx
  res.flushHeaders();

  // Evento inicial
  enviarEvento(res, 'aguardando', { pacienteId });

  // Ping de keepalive
  const pingInterval = setInterval(() => {
    res.write(': ping\n\n');
  }, PING_INTERVAL_MS);

  // Timeout absoluto
  const timeoutId = setTimeout(() => {
    enviarEvento(res, 'timeout', { mensagem: 'Sessão expirada após 10 minutos' });
    finalizarSessao(pacienteId);
  }, TIMEOUT_MS);

  sessoes.set(pacienteId, { res, medicoId, pacienteId, iniciadoEm: new Date(), pingInterval });

  // Cleanup quando o cliente desconecta
  res.on('close', () => {
    clearTimeout(timeoutId);
    finalizarSessao(pacienteId);
  });
}

export function notificarExamePronto(pacienteId: string, exameId: string): boolean {
  const sessao = sessoes.get(pacienteId);
  if (!sessao) return false;

  enviarEvento(sessao.res, 'exame_pronto', { exameId });
  finalizarSessao(pacienteId);
  return true;
}

export function cancelarSessao(pacienteId: string): boolean {
  const sessao = sessoes.get(pacienteId);
  if (!sessao) return false;

  enviarEvento(sessao.res, 'cancelado', {});
  finalizarSessao(pacienteId);
  return true;
}

export function temSessaoAtiva(pacienteId: string): boolean {
  return sessoes.has(pacienteId);
}

export function listarSessoes(): Array<{ pacienteId: string; medicoId: string; iniciadoEm: Date }> {
  return Array.from(sessoes.values()).map(s => ({
    pacienteId: s.pacienteId,
    medicoId: s.medicoId,
    iniciadoEm: s.iniciadoEm,
  }));
}

function finalizarSessao(pacienteId: string): void {
  const sessao = sessoes.get(pacienteId);
  if (!sessao) return;
  clearInterval(sessao.pingInterval);
  try { sessao.res.end(); } catch {}
  sessoes.delete(pacienteId);
}

function enviarEvento(res: Response, evento: string, data: unknown): void {
  res.write(`event: ${evento}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}
```

### 8.3 Eventos SSE (contrato com frontend)

| Evento | Payload | Quando |
|---|---|---|
| `aguardando` | `{ pacienteId }` | Imediatamente ao abrir conexão |
| `exame_pronto` | `{ exameId }` | Quando ESP32 envia dados e backend processa |
| `cancelado` | `{}` | Médico clicou "cancelar" via outra rota |
| `timeout` | `{ mensagem }` | Sessão expirou após 10min sem dados |
| `: ping` (comentário) | — | A cada 30s pra manter conexão viva |

### 8.4 Autenticação na rota SSE

EventSource do navegador **não envia headers customizados**. Para autenticar a rota SSE:

- A rota `GET /api/coleta/aguardar/:pacienteId` aceita `?token=` na query string
- Frontend lê `session.access_token` do Supabase e monta a URL: `new EventSource(\`${baseURL}/api/coleta/aguardar/${id}?token=${token}\`)`
- Middleware especial valida o token da query (não do header)

---

## 9. API REST — ENDPOINTS

### 9.1 Convenções gerais

- **Base URL:** `https://api.{dominio}` (definido em env var)
- **Auth:** JWT Supabase no header `Authorization: Bearer <token>` (exceto `POST /api/coleta/dados` e a query-string da rota SSE/PDF)
- **Erros:** sempre retornam `{ error: string, message: string, details?: any }`
- **Validação:** Zod em todos os payloads de entrada
- **Datas:** ISO 8601 em UTC
- **Status HTTP:** 200 OK, 201 Created, 204 No Content, 400 Bad Request, 401 Unauthorized, 403 Forbidden, 404 Not Found, 422 Unprocessable Entity, 429 Too Many Requests, 500 Internal Server Error

### 9.2 Auth

#### `POST /api/auth/login`

Login direto via Supabase (na verdade, o frontend chama `supabase.auth.signInWithPassword()` direto — **esse endpoint pode não existir no backend**). Documentado aqui apenas para referência.

#### `GET /api/auth/me`

Retorna dados do usuário logado. Usado pelo frontend pra recuperar o user no boot.

```typescript
// Auth obrigatório
// Response 200
{
  id: string;
  email: string;
  user_metadata: { nome?: string };
}
```

#### `POST /api/auth/recuperar-senha`

Frontend chama Supabase direto: `supabase.auth.resetPasswordForEmail(email, { redirectTo })`. Não há endpoint backend.

### 9.3 Pacientes

#### `GET /api/pacientes`

Lista pacientes do médico logado. Suporta busca por nome.

```typescript
// Auth obrigatório
// Query: ?busca=string&limit=number&offset=number
// Response 200
{
  pacientes: Array<{
    id: string;
    nome: string;
    dataNascimento: string;   // YYYY-MM-DD
    sexo: 'M' | 'F' | 'Outro';
    cpf: string | null;
    convenio: string | null;
    telefone: string | null;
    email: string | null;
    endereco: string | null;
    ultimoExame: string | null; // ISO ou null
    totalExames: number;
    createdAt: string;
  }>;
  total: number;
}
```

#### `POST /api/pacientes`

Cria um novo paciente.

```typescript
// Auth obrigatório
// Request body
{
  nome: string;            // obrigatório
  dataNascimento: string;  // YYYY-MM-DD obrigatório
  sexo: 'M' | 'F' | 'Outro'; // obrigatório
  cpf?: string;
  convenio?: string;
  telefone?: string;
  email?: string;
  endereco?: string;
}
// Response 201: { paciente: Paciente }
```

#### `GET /api/pacientes/:id`

Detalhes do paciente + lista de exames.

```typescript
// Auth obrigatório
// Response 200
{
  paciente: Paciente;
  exames: Array<{
    id: string;
    dataExame: string;
    fluxoMaximo: number;
    volumeMiccao: number;
    // demais métricas...
    volumeResidual: number | null;
  }>;
}
```

#### `PATCH /api/pacientes/:id`

Atualiza paciente. Mesmo body do POST, todos os campos opcionais.

```typescript
// Response 200: { paciente: Paciente }
```

#### `DELETE /api/pacientes/:id`

Exclui o paciente (cascata exclui exames + leituras).

```typescript
// Response 204
```

### 9.4 Exames

#### `GET /api/exames/:id`

Retorna o exame com métricas + leituras (para o gráfico).

```typescript
// Auth obrigatório
// Response 200
{
  exame: {
    id: string;
    pacienteId: string | null;
    statusVinculacao: 'vinculado' | 'orfao';
    dataExame: string;
    fluxoMaximo: number;
    fluxoMedio: number;
    volumeMiccao: number;
    tempoAteFluxoMax: number;
    tempoTotalMiccao: number;
    volumeResidual: number | null;
  };
  paciente: Paciente | null;  // null se órfão
  leituras: Array<{ indice: number; fluxo: number }>;
}
```

#### `PATCH /api/exames/:id`

Atualiza o volume residual (único campo editável).

```typescript
// Auth obrigatório
// Request body
{ volumeResidual: number | null }
// Response 200: { exame: Exame }
```

#### `DELETE /api/exames/:id`

Exclui o exame (cascata exclui leituras).

```typescript
// Response 204
```

#### `GET /api/exames/:id/pdf`

Retorna o PDF clínico do exame.

```typescript
// Auth via header OU query (?token=...)
// Query opcional: ?download=1 (força download em vez de inline)
// Response 200
// Content-Type: application/pdf
// Content-Disposition: inline (default) ou attachment (?download=1)
// Body: stream do PDF
```

### 9.5 Coleta

#### `POST /api/coleta/dados` ⚠️ Endpoint do ESP32

Endpoint público (sem auth). Recebe o array de leituras do ESP32, processa, e:
- Se houver sessão SSE ativa: salva exame vinculado ao paciente da sessão e notifica o frontend
- Se não houver: salva como órfão

```typescript
// SEM auth (público)
// Rate limit: 30 req/min por IP
// Request body: array de leituras conforme contrato ESP32
[
  { Fl: "0.000000", It: "0" },
  { Fl: "12.340000", It: "1" },
  ...
]
// Response 200 (se houver sessão ativa)
{
  exameId: string;
  pacienteId: string;
  status: 'vinculado';
}
// Response 200 (se órfão)
{
  exameId: string;
  pacienteId: null;
  status: 'orfao';
}
// Response 422: payload inválido (Zod)
// Response 500: erro de processamento
```

#### `GET /api/coleta/aguardar/:pacienteId`

Abre stream SSE para aguardar dados do ESP32.

```typescript
// Auth via header OU query (?token=...)
// Response: text/event-stream
// Eventos: aguardando | exame_pronto | cancelado | timeout
```

#### `POST /api/coleta/cancelar/:pacienteId`

Médico cancela a coleta em andamento.

```typescript
// Auth obrigatório
// Response 200: { cancelado: boolean }
```

#### `POST /api/coleta/vincular`

Vincula um exame órfão a um paciente.

```typescript
// Auth obrigatório
// Request body
{ exameId: string; pacienteId: string }
// Response 200: { exame: Exame }
// Response 404: exame ou paciente não encontrado
// Response 409: exame não está órfão
```

#### `GET /api/coleta/orfaos`

Lista exames órfãos do médico logado.

```typescript
// Auth obrigatório
// Response 200
{
  exames: Array<{
    id: string;
    dataExame: string;
    fluxoMaximo: number;
    volumeMiccao: number;
    tempoTotalMiccao: number;
    leiturasPreview: Array<{ indice: number; fluxo: number }>; // primeiras 50 leituras pra preview
  }>;
  total: number;
}
```

### 9.6 Health check

#### `GET /api/health`

```typescript
// SEM auth
// Response 200
{ status: 'ok', timestamp: string, version: string }
```

### 9.7 Swagger

Disponível em `GET /api/docs` (apenas em dev — desabilitado em produção via env var).

---

## 10. DESIGN SYSTEM

Design extraído do site do cliente (https://www.romulonunes.com.br). É azul corporativo médico — **NÃO usar o teal default do shadcn**.

### 10.1 Paleta

| Token | Hex | Uso |
|---|---|---|
| `primary` | `#0067CD` | Botões primários, links, foco de inputs, badge ativo |
| `primary-dark` | `#0052A4` | Hover de botões primários |
| `secondary` | `#004080` | Texto de links, títulos secundários |
| `danger` | `#E54C38` | Botão "Excluir", badge de exames órfãos, erros |
| `danger-dark` | `#D84532` | Hover do danger |
| `text-body` | `#38464B` | Texto corrido |
| `text-title` | `#232429` | Títulos h1-h6 |
| `text-muted` | `#6c757d` | Textos auxiliares, placeholders, datas |
| `bg-base` | `#FFFFFF` | Fundo principal |
| `bg-alt` | `#f7f8f9` | Fundo de cards, alt rows |
| `border` | `#dfe2e5` | Bordas de inputs, divisórias |

### 10.2 Tipografia

- **Família:** Roboto (Google Fonts)
- **Pesos:** 400 (regular), 500 (medium), 700 (bold)
- **Base:** 0.875rem (14px), `line-height: 1.6`
- **Títulos:** h1=1.75rem, h2=1.5rem, h3=1.25rem, h4=1.125rem (todos `font-weight: 700`)

### 10.3 Espaçamento, raios, transições

- **Border radius:** `2px` (inputs), `4px` (botões/cards), `8px` (imagens, avatares)
- **Botões:** `padding: 0.5rem 1rem`
- **Inputs:** `border: 2px solid #dfe2e5`, foco → border `#0067CD`
- **Transição padrão:** `all 0.3s ease-in-out`
- **Sombras:** suaves — `0 1px 3px rgba(0,0,0,0.06)` em cards

### 10.4 Tailwind config (`frontend/tailwind.config.ts`)

```typescript
import type { Config } from 'tailwindcss';

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: '#0067CD', dark: '#0052A4', foreground: '#FFFFFF' },
        secondary: { DEFAULT: '#004080', foreground: '#FFFFFF' },
        danger: { DEFAULT: '#E54C38', dark: '#D84532', foreground: '#FFFFFF' },
        body: '#38464B',
        title: '#232429',
        muted: { DEFAULT: '#f7f8f9', foreground: '#6c757d' },
        border: '#dfe2e5',
        background: '#FFFFFF',
      },
      fontFamily: {
        sans: ['Roboto', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        base: ['0.875rem', { lineHeight: '1.6' }],
      },
      borderRadius: {
        sm: '2px',
        DEFAULT: '4px',
        md: '4px',
        lg: '8px',
      },
      transitionTimingFunction: {
        DEFAULT: 'ease-in-out',
      },
      transitionDuration: {
        DEFAULT: '300ms',
      },
      boxShadow: {
        card: '0 1px 3px rgba(0,0,0,0.06)',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
} satisfies Config;
```

### 10.5 CSS global (`frontend/src/index.css`)

```css
@import url('https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap');

@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  body {
    @apply bg-background text-body font-sans text-base;
  }
  h1, h2, h3, h4, h5, h6 {
    @apply text-title font-bold;
  }
  h1 { @apply text-[1.75rem]; }
  h2 { @apply text-[1.5rem]; }
  h3 { @apply text-[1.25rem]; }
  h4 { @apply text-[1.125rem]; }
  a { @apply text-secondary hover:text-primary transition-colors; }
}
```

### 10.6 Customização do shadcn/ui

Após `npx shadcn-ui@latest init`, **substituir** as cores no `components.json` e nos componentes gerados pelos tokens da paleta. Pontos críticos:

- `Button`: variantes `default` (primary), `destructive` (danger), `outline` (border padrão), `ghost`, `link`. Hover usa `primary-dark` / `danger-dark`.
- `Input`: `border-2 border-border`, focus `border-primary`, sem ring colorido (manter sutil).
- `Card`: `bg-background` ou `bg-muted` conforme contexto, `shadow-card`, `rounded`.
- `Badge`: variante `default` (primary), `destructive` (danger), `outline`.
- `Toast (Sonner)`: tema customizado para combinar com a paleta — toast de erro vermelho (`danger`), sucesso primary (`primary`).
- `Dialog`: backdrop `bg-black/50`, conteúdo com `rounded-md` e `shadow-lg`.

### 10.7 Componentes shadcn a instalar

```bash
npx shadcn-ui@latest add button input label dialog \
  alert-dialog dropdown-menu select form sheet sonner \
  badge card skeleton tabs separator scroll-area
```

---

## 11. FRONTEND — PÁGINAS E COMPORTAMENTO

> **Princípio:** descrevo aqui o **layout, estados, dados e ações** de cada página. O Opus monta os componentes shadcn customizados. NÃO copio JSX inteiro — apenas regras de comportamento e estrutura de dados.

### 11.1 Layout global (`AppShell`)

Todas as páginas autenticadas vivem dentro do `AppShell`:

- **Header (topo, fixo):** logo (esquerda) + "Dr. Rômulo Nunes - Sistema de Urofluxometria" (centro) + avatar com dropdown (direita: "Meu perfil", "Sair")
- **Bottom nav (mobile, fixo embaixo):** 3 ícones — "Pacientes" (Users), "Coleta" (Activity), "Perfil" (User)
- **Sidebar (desktop, fixa esquerda):** mesmas 3 abas em formato vertical com label
- **Main content:** rolável, `max-w-5xl mx-auto px-4 py-6`

### 11.2 `<ProtectedRoute>`

Wrapper em todas as rotas (exceto `/login`, `/recuperar-senha`, `/redefinir-senha`):

- No mount: lê `supabase.auth.getSession()`
- Se sem sessão → `<Navigate to="/login" />`
- Se com sessão → renderiza children
- Listener `onAuthStateChange` redireciona pro login se sessão expirar

### 11.3 `/login`

**Layout:** card centralizado, logo no topo, título "Entrar", form simples.

**Form (RHF + Zod):**
- email (required, email válido)
- senha (required, min 6)

**Comportamento:**
- Submit → `supabase.auth.signInWithPassword({ email, senha })`
- Sucesso → `navigate('/pacientes')`
- Erro → toast Sonner com mensagem ("Email ou senha inválidos")
- Link "Esqueci minha senha" → `/recuperar-senha`

### 11.4 `/recuperar-senha`

**Form:** apenas `email`.

**Comportamento:**
- Submit → `supabase.auth.resetPasswordForEmail(email, { redirectTo: \`${window.location.origin}/redefinir-senha\` })`
- Toast: "Email de recuperação enviado. Confira sua caixa de entrada."
- Botão "Voltar" → `/login`

### 11.5 `/redefinir-senha`

Acessada via link do email. Supabase já põe a sessão temporária no contexto.

**Form:** `novaSenha`, `confirmarSenha` (Zod: iguais, min 6).

**Comportamento:**
- Submit → `supabase.auth.updateUser({ password })`
- Sucesso → toast + redirect `/login`

### 11.6 `/pacientes` (Home)

**Layout:**
- Topo: título "Pacientes" + botão "+ Novo paciente" (canto direito)
- **Badge de exames órfãos** (se `total > 0`): banner vermelho clicável "⚠ X exames sem paciente vinculado" → `/coleta/orfaos`
- Campo de busca (input com ícone search)
- Lista de cards de pacientes (uma coluna)

**Card de paciente (`<PacienteCard>`):**
- Nome (h3, bold)
- Idade calculada (text-muted)
- Último exame: data formatada ou "Nenhum exame ainda"
- Total de exames (badge)
- Click no card → `/pacientes/:id`

**Hooks:**
- `usePacientes({ busca })` — TanStack Query, debounce 300ms na busca
- `useExamesOrfaos()` — TanStack Query, retorna `{ total }`

**Estados:**
- Loading → skeletons de 3 cards
- Empty → mensagem "Nenhum paciente cadastrado. Clique em '+ Novo paciente' para começar."
- Error → toast + botão "Tentar novamente"

### 11.7 `/pacientes/novo` e `/pacientes/:id/editar`

Mesmo componente `<FormPaciente>` (mode: create/edit).

**Form:**
- Obrigatórios: nome, dataNascimento (input type=date), sexo (select M/F/Outro)
- Opcionais: cpf (mask 000.000.000-00), convenio, telefone (mask), email, endereco (textarea)

**Validação Zod:**
- nome: min 2
- dataNascimento: regex YYYY-MM-DD, não futura
- sexo: enum
- cpf: opcional, regex válido
- email: opcional, formato email
- telefone: opcional, regex (xx) xxxxx-xxxx

**Comportamento:**
- Botões "Cancelar" (volta) e "Salvar"
- Loading do submit desabilita o botão
- Sucesso → toast + `navigate('/pacientes/:id')`
- Erro → toast com `error.message`

### 11.8 `/pacientes/:id` (detalhes)

**Layout:**
- Topo: nome (h1) + botões "Editar" e "Excluir" (danger, abre AlertDialog de confirmação)
- Bloco de dados pessoais (grid 2 colunas em desktop, 1 em mobile)
- Separator
- Título "Histórico de exames" + botão "Iniciar nova coleta" (link pra `/coleta?pacienteId=...`)
- Lista de exames (mais recente primeiro)

**Card de exame:**
- Data formatada (dd/MM/yyyy HH:mm)
- Resumo: "Qmax: X mL/s · Volume: Y mL · Tempo: Z s"
- Botão "Ver resultado" → `/exames/:id`

**Excluir paciente:** AlertDialog "Tem certeza? Todos os exames serão excluídos." → DELETE → toast + `navigate('/pacientes')`

### 11.9 `/coleta` (3-state flow)

**State 1 — Selecionar paciente** (`PassoSelecionarPaciente`):
- Título "Iniciar coleta"
- Input de busca + lista de pacientes (mesmo componente da home, mas com seleção)
- Botão "Continuar" desabilitado até selecionar
- Click "Continuar" → muda pro state 2

> Se vier `?pacienteId=X` na query string (vindo da página de detalhes), pula direto pro state 2.

**State 2 — Aguardando dispositivo** (`PassoAguardando`):
- Título "Aguardando exame de [Nome do paciente]"
- Spinner grande com animação CSS pulse
- Texto "O dispositivo está pronto. Peça ao paciente para iniciar a micção."
- Texto pequeno: "Sessão expira em 10 minutos"
- 3 botões:
  - "Cancelar" (outline) → POST `/api/coleta/cancelar/:pacienteId` → state 1
  - "Trocar paciente" (outline) → cancela e volta pro state 1
  - "Reiniciar dispositivo" (link discreto) → mostra dialog com instruções de reset do ESP32

**State 3 — Concluído** (`PassoConcluido`):
- Ícone check verde + "Exame concluído"
- Resumo rápido das 5 métricas em cards pequenos
- Botões: "Ver resultado completo" (primary) → `/exames/:id`, "Nova coleta" (outline) → state 1, "Excluir exame" (ghost danger)

**Hook `useColeta`:**
- Gerencia estados: `'selecionando' | 'aguardando' | 'concluido'`
- Quando entra em `aguardando`: abre `EventSource` com token na query
- Listeners: `aguardando`, `exame_pronto`, `cancelado`, `timeout`
- Em `exame_pronto` → seta `exameId` e muda pra state 3
- `useEffect` cleanup: fecha EventSource ao desmontar

### 11.10 `/coleta/orfaos`

**Layout:**
- Título "Exames sem paciente vinculado" + contador
- Aviso explicativo: "Estes exames foram recebidos sem uma sessão ativa. Vincule cada um ao paciente correspondente."
- Lista de cards de exames órfãos

**Card de exame órfão:**
- Data/hora do exame
- Resumo das métricas principais
- Mini-gráfico (Recharts, 100×40px) com primeiras 50 leituras (preview)
- Botão "Vincular a paciente" → abre `<ModalVincularPaciente>`
- Botão "Excluir" (danger ghost) → AlertDialog → DELETE

**`<ModalVincularPaciente>`:**
- Dialog com input de busca de pacientes
- Lista filtrada de pacientes
- Click no paciente → POST `/api/coleta/vincular { exameId, pacienteId }`
- Sucesso → toast + remove da lista + fecha modal

### 11.11 `/exames/:id`

**Layout (4 seções):**

**Seção 1 — Cabeçalho:**
- Nome do paciente (h2) + idade + data/hora do exame
- Se órfão: badge vermelho "Exame órfão — vincule a um paciente" + botão pra abrir o modal de vinculação

**Seção 2 — Gráfico (`<GraficoFluxo>`):**
- Recharts `<LineChart>` com 2 séries:
  - Linha vermelha: fluxo (eixo Y esquerdo, mL/s)
  - Linha azul: volume acumulado (eixo Y direito, mL)
- Eixo X: tempo em segundos (calculado a partir do índice × 0.1)
- Tooltip com valores no hover
- Altura: 320px desktop, 240px mobile

**Seção 3 — Tabela de métricas (`<TabelaMetricas>`):**
- Tabela 3 colunas: Métrica · Valor (com unidade) · Faixa de referência
- 5 linhas das métricas calculadas
- Linha 6: Volume Residual com `<VolumeResidualInput>` editável inline

**`<VolumeResidualInput>`:**
- Mostra o valor atual ou "Não medido"
- Click → input editável (number, step=0.1)
- Texto de ajuda: "Medido via ultrassom ou sondagem após o exame"
- Botão "Salvar" aparece quando valor mudou
- Submit → PATCH `/api/exames/:id { volumeResidual }`
- Toast de sucesso

**Seção 4 — Ações:**
- "Abrir PDF em nova aba" → `window.open('/api/exames/:id/pdf?token=...', '_blank')`
- "Baixar PDF" → `window.location.href = '/api/exames/:id/pdf?download=1&token=...'`
- "Refazer exame" (outline) → AlertDialog → DELETE + `navigate('/coleta')`
- "Excluir exame" (danger) → AlertDialog → DELETE + voltar

> **NOTA SOBRE PDF + AUTH:** `window.open()` não envia headers, então a rota `/api/exames/:id/pdf` aceita `?token=` (mesma exceção do SSE).

### 11.12 `/perfil`

**Layout:**
- Avatar/inicial grande
- Email (read-only)
- Nome (lido de `user_metadata`, opcional)
- Botão "Alterar senha" → abre Dialog (form com senha atual + nova + confirmar)
- Botão "Sair" (danger) → `supabase.auth.signOut()` + `navigate('/login')`

Sem edição completa de perfil no protótipo.

### 11.13 Tratamento global de erros

**Axios interceptor** (`frontend/src/services/api.ts`):
- Request interceptor: anexa `Authorization: Bearer ${token}` lendo do Supabase
- Response interceptor:
  - 401 → `supabase.auth.signOut()` + `navigate('/login')` (sem toast)
  - 403, 404, 422, 500 → toast Sonner com `error.response?.data?.message ?? 'Erro inesperado'`
  - Network error → toast "Sem conexão com o servidor"

**TanStack Query global config:**
- `retry: 1`, `staleTime: 30_000`, `refetchOnWindowFocus: false`
- `onError` global delegado pro interceptor do Axios

---

## 12. GERAÇÃO DE PDF CLÍNICO

### 12.1 Layout do relatório (1 página A4)

```
┌──────────────────────────────────────────────────────────┐
│  [LOGO]   Dr. Rômulo Nunes — Sistema de Urofluxometria   │
│           Urologia e Cirurgia Robótica                    │
├──────────────────────────────────────────────────────────┤
│  RELATÓRIO DE UROFLUXOMETRIA                             │
│                                                           │
│  Paciente: João da Silva                                 │
│  Data de nascimento: 12/05/1965 (60 anos)                │
│  Sexo: Masculino                                          │
│  CPF: 123.456.789-00                                     │
│  Data do exame: 24/04/2026 às 14:32                      │
│                                                           │
├──────────────────────────────────────────────────────────┤
│                  CURVA DE FLUXO × TEMPO                   │
│                                                           │
│  [gráfico renderizado como PNG embutido — 480×260px]     │
│                                                           │
├──────────────────────────────────────────────────────────┤
│  MÉTRICAS                                                 │
│                                                           │
│  ┌─────────────────────────┬──────────┬────────────────┐│
│  │ Métrica                 │ Valor    │ Referência     ││
│  ├─────────────────────────┼──────────┼────────────────┤│
│  │ Fluxo Máximo (Qmax)     │ 22.4 mL/s│ 15 – 50 mL/s   ││
│  │ Fluxo Médio (Qavg)      │ 14.1 mL/s│ 10 – 25 mL/s   ││
│  │ Volume de Micção        │ 320 mL   │ 150 – 500 mL   ││
│  │ Tempo até Fluxo Máximo  │ 6.2 s    │ 3 – 10 s       ││
│  │ Tempo Total de Micção   │ 28.5 s   │ 15 – 40 s      ││
│  │ Volume Residual         │ 35 mL    │ < 50 mL        ││
│  └─────────────────────────┴──────────┴────────────────┘│
│                                                           │
├──────────────────────────────────────────────────────────┤
│  Observações:                                             │
│  Os valores são apresentados com referência para auxílio │
│  diagnóstico. A interpretação clínica é responsabilidade │
│  exclusiva do médico examinador.                         │
│                                                           │
├──────────────────────────────────────────────────────────┤
│  Gerado em 24/04/2026 14:35                              │
│  GBS Media · Sistema de Urofluxometria                    │
└──────────────────────────────────────────────────────────┘
```

### 12.2 Renderização do gráfico para PDF

PDFKit não desenha gráficos nativos. Estratégia: gerar um PNG do gráfico no backend usando a biblioteca **chartjs-node-canvas** (mais estável e leve que Puppeteer):

```typescript
// backend/src/services/pdf.service.ts (trecho do gráfico)
import { ChartJSNodeCanvas } from 'chartjs-node-canvas';

const chartCanvas = new ChartJSNodeCanvas({ width: 960, height: 520, backgroundColour: 'white' });

async function renderizarGrafico(leituras: Array<{ indice: number; fluxo: number }>): Promise<Buffer> {
  const tempos = leituras.map(l => (l.indice * 0.1).toFixed(1));
  const fluxos = leituras.map(l => l.fluxo);

  let acumulado = 0;
  const volumes = fluxos.map(f => (acumulado += f * 0.1));

  return await chartCanvas.renderToBuffer({
    type: 'line',
    data: {
      labels: tempos,
      datasets: [
        { label: 'Fluxo (mL/s)', data: fluxos, borderColor: '#E54C38', backgroundColor: 'transparent', yAxisID: 'y1', tension: 0.3 },
        { label: 'Volume acumulado (mL)', data: volumes, borderColor: '#0067CD', backgroundColor: 'transparent', yAxisID: 'y2', tension: 0.3 },
      ],
    },
    options: {
      scales: {
        x: { title: { display: true, text: 'Tempo (s)' } },
        y1: { type: 'linear', position: 'left', title: { display: true, text: 'Fluxo (mL/s)' } },
        y2: { type: 'linear', position: 'right', title: { display: true, text: 'Volume (mL)' }, grid: { drawOnChartArea: false } },
      },
    },
  });
}
```

### 12.3 Estrutura do PDF com PDFKit

```typescript
import PDFDocument from 'pdfkit';
import { Response } from 'express';

export async function gerarPdfExame(exame: Exame, paciente: Paciente, leituras: Leitura[], res: Response, download: boolean) {
  const filename = `exame_${exame.id}.pdf`;
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `${download ? 'attachment' : 'inline'}; filename="${filename}"`);

  const doc = new PDFDocument({ size: 'A4', margin: 40 });
  doc.pipe(res);

  // 1. Header
  doc.fontSize(10).fillColor('#0067CD').text('Dr. Rômulo Nunes — Sistema de Urofluxometria', { align: 'center' });
  doc.fontSize(9).fillColor('#6c757d').text('Urologia e Cirurgia Robótica', { align: 'center' });
  doc.moveDown();
  doc.fontSize(16).fillColor('#232429').text('RELATÓRIO DE UROFLUXOMETRIA', { align: 'center' });
  doc.moveDown();

  // 2. Dados do paciente
  doc.fontSize(11).fillColor('#38464B');
  doc.text(`Paciente: ${paciente.nome}`);
  doc.text(`Data de nascimento: ${formatarData(paciente.dataNascimento)} (${calcularIdade(paciente.dataNascimento)} anos)`);
  doc.text(`Sexo: ${paciente.sexo === 'M' ? 'Masculino' : paciente.sexo === 'F' ? 'Feminino' : 'Outro'}`);
  if (paciente.cpf) doc.text(`CPF: ${paciente.cpf}`);
  doc.text(`Data do exame: ${formatarDataHora(exame.dataExame)}`);
  doc.moveDown();

  // 3. Gráfico
  const chartBuffer = await renderizarGrafico(leituras);
  doc.image(chartBuffer, { fit: [515, 280], align: 'center' });
  doc.moveDown();

  // 4. Tabela de métricas (drawn via doc.rect + doc.text)
  desenharTabelaMetricas(doc, exame);

  // 5. Observações
  doc.moveDown();
  doc.fontSize(9).fillColor('#6c757d').text(
    'Observações: Os valores são apresentados com referência para auxílio diagnóstico. ' +
    'A interpretação clínica é responsabilidade exclusiva do médico examinador.',
    { align: 'justify' }
  );

  // 6. Footer
  doc.moveDown(2);
  doc.fontSize(8).fillColor('#6c757d').text(`Gerado em ${formatarDataHora(new Date())}`, { align: 'center' });
  doc.text('GBS Media · Sistema de Urofluxometria', { align: 'center' });

  doc.end();
}
```

> O Opus deve implementar `desenharTabelaMetricas`, `formatarData`, `formatarDataHora`, `calcularIdade` como helpers — desenhar a tabela usa `doc.rect()` + `doc.text()` em coordenadas calculadas a partir do `doc.y`.

---

## 13. MOCK DO ESP32

Script Node em TypeScript que simula o POST do ESP32 para desenvolvimento local. Roda com `npm run start` na pasta `mock/`.

### 13.1 `mock/esp32-mock.ts`

```typescript
const URL_BACKEND = process.env.BACKEND_URL ?? 'http://localhost:3000';
const ENDPOINT = `${URL_BACKEND}/api/coleta/dados`;

/**
 * Gera uma curva realista de urofluxometria:
 * - 1s de pré-micção (zeros)
 * - Subida rápida até pico em ~3-5s
 * - Pico de 18-25 mL/s
 * - Descida gradual até zero
 * - 8 zeros no fim (sinal de término)
 * - Padding final pra completar 1000 posições
 */
function gerarCurva(): Array<{ Fl: string; It: string }> {
  const leituras: Array<{ Fl: string; It: string }> = [];
  let indice = 0;

  // Pré-micção: 10 zeros
  for (let i = 0; i < 10; i++) {
    leituras.push({ Fl: '0.000000', It: String(indice++) });
  }

  // Pico aleatório entre 18 e 25
  const pico = 18 + Math.random() * 7;
  // Tempo até o pico: 3-5s = 30-50 leituras
  const passosSubida = 30 + Math.floor(Math.random() * 20);
  // Tempo total de micção: 20-35s = 200-350 leituras
  const totalLeituras = 200 + Math.floor(Math.random() * 150);
  const passosDescida = totalLeituras - passosSubida;

  // Subida (curva em senoide)
  for (let i = 0; i < passosSubida; i++) {
    const t = i / passosSubida;
    const fluxo = pico * Math.sin((Math.PI / 2) * t);
    const ruido = (Math.random() - 0.5) * 1.5;
    leituras.push({ Fl: Math.max(0, fluxo + ruido).toFixed(6), It: String(indice++) });
  }

  // Descida (decaimento exponencial)
  for (let i = 0; i < passosDescida; i++) {
    const t = i / passosDescida;
    const fluxo = pico * Math.exp(-2.5 * t);
    const ruido = (Math.random() - 0.5) * 1.0;
    leituras.push({ Fl: Math.max(0, fluxo + ruido).toFixed(6), It: String(indice++) });
  }

  // Sinal de término: 8 zeros
  for (let i = 0; i < 8; i++) {
    leituras.push({ Fl: '0.000000', It: String(indice++) });
  }

  // Padding até 1000
  while (leituras.length < 1000) {
    leituras.push({ Fl: '0.000000', It: String(indice++) });
  }

  return leituras;
}

async function main() {
  const curva = gerarCurva();
  console.log(`📡 Enviando ${curva.length} leituras para ${ENDPOINT}...`);

  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(curva),
    });
    const data = await res.json();
    console.log(`✅ Resposta (${res.status}):`, data);
  } catch (err) {
    console.error('❌ Erro:', err);
    process.exit(1);
  }
}

main();
```

### 13.2 `mock/package.json`

```json
{
  "name": "esp32-mock",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "start": "tsx esp32-mock.ts"
  },
  "devDependencies": {
    "tsx": "^4.16.0",
    "typescript": "^5.4.0"
  }
}
```

Como usar: `npm install && BACKEND_URL=http://localhost:3000 npm run start`

---

## 14. DOCKER, CI/CD E DEPLOY

### 14.1 Backend Dockerfile (`backend/Dockerfile`)

Multi-stage para reduzir tamanho da imagem final.

```dockerfile
# Stage 1: build
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json tsconfig.json ./
RUN npm ci
COPY src ./src
RUN npm run build

# Stage 2: runtime
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist
EXPOSE 3000
CMD ["node", "dist/server.js"]
```

### 14.2 `.dockerignore`

```
node_modules
dist
.env
.env.*
.git
*.md
```

### 14.3 `docker-compose.yml` (raiz, para a VPS)

```yaml
version: '3.9'
services:
  backend:
    image: ghcr.io/SEU_USUARIO/urofluxometria-backend:latest
    container_name: urofluxometria-backend
    restart: unless-stopped
    ports:
      - "3000:3000"
    env_file:
      - ./backend/.env.production
    networks:
      - urofluxo
networks:
  urofluxo:
```

> **Single process:** SSE usa Map em memória, então NUNCA escalar `replicas` ou rodar com `pm2 cluster`.

### 14.4 GitHub Actions (`.github/workflows/deploy.yml`)

```yaml
name: Deploy Backend

on:
  push:
    branches: [main]
    paths:
      - 'backend/**'
      - '.github/workflows/deploy.yml'
  workflow_dispatch:

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository_owner }}/urofluxometria-backend

jobs:
  build-and-push:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    steps:
      - uses: actions/checkout@v4
      - uses: docker/setup-buildx-action@v3
      - uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - uses: docker/build-push-action@v5
        with:
          context: ./backend
          push: true
          tags: |
            ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:latest
            ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:${{ github.sha }}
          cache-from: type=gha
          cache-to: type=gha,mode=max

  deploy-to-vps:
    needs: build-and-push
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Deploy via SSH
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.VPS_HOST }}
          username: ${{ secrets.VPS_USER }}
          key: ${{ secrets.VPS_SSH_KEY }}
          script: |
            cd /opt/urofluxometria
            echo ${{ secrets.GITHUB_TOKEN }} | docker login ghcr.io -u ${{ github.actor }} --password-stdin
            docker compose pull
            docker compose up -d
            docker image prune -f
```

### 14.5 Deploy do frontend (Vercel)

1. Push o repo no GitHub
2. Conectar no Vercel → "New Project" → escolher repo
3. Configurar:
   - **Root directory:** `frontend`
   - **Build command:** `npm run build`
   - **Output directory:** `dist`
   - **Install command:** `npm install`
4. Variáveis de ambiente: copiar de `frontend/.env.example`
5. Deploy automático em todo push pra main

---

## 15. VARIÁVEIS DE AMBIENTE

### 15.1 `backend/.env.example`

```bash
# Servidor
PORT=3000
NODE_ENV=development

# Supabase
SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...

# Banco (string de conexão direta — usa pgbouncer transaction mode)
DATABASE_URL=postgresql://postgres.xxxx:SENHA@aws-0-sa-east-1.pooler.supabase.com:6543/postgres

# CORS
FRONTEND_URL=http://localhost:5173

# Swagger (em prod: false)
ENABLE_SWAGGER=true
```

### 15.2 Validação de envs (`backend/src/lib/env.ts`)

```typescript
import { z } from 'zod';
import 'dotenv/config';

const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  DATABASE_URL: z.string().url(),
  FRONTEND_URL: z.string().url(),
  ENABLE_SWAGGER: z.coerce.boolean().default(false),
});

export const env = envSchema.parse(process.env);
```

### 15.3 `frontend/.env.example`

```bash
VITE_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc...
VITE_API_URL=http://localhost:3000
```

> Vite só expõe variáveis com prefixo `VITE_` ao código do cliente.

---

## 16. SETUP DA VPS CONTABO

### 16.1 Provisionamento

1. Comprar Cloud VPS 10 em [contabo.com](https://contabo.com) — Ubuntu 22.04 LTS, $3.96/mo
2. Anotar IP público + senha root recebidos por email
3. Apontar registro `A` do DNS (`api.SEU_DOMINIO.com.br`) para o IP da VPS

### 16.2 Acesso e hardening inicial

```bash
# Acesso inicial
ssh root@IP_DA_VPS

# Atualizar pacotes
apt update && apt upgrade -y

# Criar usuário deploy
adduser deploy
usermod -aG sudo deploy

# Copiar chave SSH para o usuário deploy
mkdir -p /home/deploy/.ssh
cp ~/.ssh/authorized_keys /home/deploy/.ssh/
chown -R deploy:deploy /home/deploy/.ssh
chmod 700 /home/deploy/.ssh
chmod 600 /home/deploy/.ssh/authorized_keys

# Desabilitar login root via SSH (editar /etc/ssh/sshd_config)
# PermitRootLogin no
# PasswordAuthentication no
systemctl restart sshd

# Firewall
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
```

### 16.3 Instalar Docker

```bash
# Como usuário deploy
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker deploy
# Logout/login para o grupo entrar em vigor
```

### 16.4 Instalar Caddy (reverse proxy + HTTPS automático)

```bash
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update
sudo apt install caddy
```

### 16.5 Configurar Caddy (`/etc/caddy/Caddyfile`)

```
api.SEU_DOMINIO.com.br {
    reverse_proxy localhost:3000 {
        flush_interval -1     # crítico para SSE — desabilita buffering
    }
    encode gzip
}
```

```bash
sudo systemctl reload caddy
```

### 16.6 Estrutura de diretórios na VPS

```bash
sudo mkdir -p /opt/urofluxometria
sudo chown deploy:deploy /opt/urofluxometria
cd /opt/urofluxometria
```

Subir manualmente via SCP os arquivos:
- `docker-compose.yml`
- `backend/.env.production` (copiado de `.env.example` e preenchido)

### 16.7 Login no GHCR (uma vez)

```bash
echo "GHCR_PERSONAL_ACCESS_TOKEN" | docker login ghcr.io -u SEU_USUARIO --password-stdin
```

> Gerar PAT em GitHub → Settings → Developer settings → Personal access tokens → escopo `read:packages`.

### 16.8 Primeiro deploy manual

```bash
cd /opt/urofluxometria
docker compose pull
docker compose up -d
docker compose logs -f
```

### 16.9 Configurar secrets do GitHub Actions

No repositório GitHub → Settings → Secrets and variables → Actions:

- `VPS_HOST`: IP da VPS
- `VPS_USER`: `deploy`
- `VPS_SSH_KEY`: chave privada SSH (correspondente à pública adicionada no `authorized_keys` do `deploy`)

### 16.10 Verificação final

- `curl https://api.SEU_DOMINIO.com.br/api/health` → `{ status: 'ok' }`
- Mock POST: `curl -X POST -H "Content-Type: application/json" -d '[{"Fl":"0.000000","It":"0"}]' https://api.SEU_DOMINIO.com.br/api/coleta/dados`

---

## 17. CHECKLIST DE SEGURANÇA

### 17.1 Backend
- [ ] **Validação Zod** em todo body, query e param de entrada
- [ ] **JWT do Supabase verificado** via `supabase.auth.getUser(token)` no middleware (não confiar em decode local)
- [ ] **Rate limit** em `/api/coleta/dados`: 30 req/min por IP
- [ ] **Rate limit global**: 100 req/min por IP nas demais rotas
- [ ] **CORS restrito** ao `FRONTEND_URL` da env var
- [ ] **Helmet** middleware (CSP, X-Frame-Options, etc)
- [ ] **SERVICE_ROLE_KEY** nunca exposta no frontend (apenas backend)
- [ ] **Swagger** desabilitado em produção (`ENABLE_SWAGGER=false`)
- [ ] **Erros sanitizados**: nunca retornar stack trace em produção
- [ ] **Tamanho máximo do body**: 1MB (suficiente pra payload do ESP32)
- [ ] **Health check** em `/api/health` sem auth pra monitoramento

### 17.2 Banco
- [ ] **RLS ativo** em todas as tabelas
- [ ] **Policies** filtrando por `medico_id = auth.uid()`
- [ ] **Backup** confiando no Supabase Free (7 dias)
- [ ] **Connection pooling** via PgBouncer (string `?pgbouncer=true` se necessário)

### 17.3 Frontend
- [ ] **Tokens** gerenciados pelo Supabase SDK (NÃO `localStorage.setItem` manual)
- [ ] **Roteas protegidas** via `<ProtectedRoute>`
- [ ] **Inputs sanitizados**: trim em todos os campos de texto
- [ ] **HTTPS only** em produção (Vercel força automaticamente)
- [ ] **Variáveis sensíveis** nunca commitadas (apenas `.env.example`)

### 17.4 Infra
- [ ] **SSH** sem senha (apenas chave)
- [ ] **Login root SSH** desabilitado
- [ ] **UFW** com apenas 22/80/443 abertas
- [ ] **Caddy** com HTTPS automático (Let's Encrypt)
- [ ] **Caddy `flush_interval -1`** ativo para SSE
- [ ] **Docker logs** com rotação configurada (`max-size: 10m`, `max-file: 3` no `daemon.json`)

### 17.5 LGPD
- [ ] **Contrato GBS Media × Dr. Rômulo** define controlador (Dr. Rômulo) e operador (GBS Media)
- [ ] **Política de privacidade** disponibilizada ao paciente pelo médico
- [ ] **Logs** sem dados pessoais (apenas IDs)
- [ ] **Direito ao esquecimento**: cascade delete remove paciente + exames + leituras

---

## 18. PLANO DE IMPLEMENTAÇÃO POR FASES

> **Como usar:** marcar `[x]` à medida que cada item for concluído. As fases são sequenciais — cada uma assume que a anterior está pronta. **Não há prazos rígidos** — o foco é completude.

### Fase 1 — Setup do monorepo

- [ ] **1.1** Criar repo `urofluxometria` no GitHub (privado)
- [ ] **1.2** Estrutura de pastas raiz: `backend/`, `frontend/`, `mock/`, `shared/`
- [ ] **1.3** `.gitignore` (node_modules, dist, .env, .env.*, .DS_Store)
- [ ] **1.4** README.md inicial com instruções de dev
- [ ] **1.5** `package.json` raiz com scripts de conveniência
- [ ] **1.6** Criar projeto Supabase + anotar URL/keys
- [ ] **1.7** Habilitar extensão `pgcrypto` no SQL Editor (para `defaultRandom()`)

### Fase 2 — Banco de dados

- [ ] **2.1** Backend: `npm init` + instalar dependências (drizzle-orm, drizzle-kit, postgres, zod, dotenv)
- [ ] **2.2** Criar `backend/src/lib/env.ts` com schema Zod das envs
- [ ] **2.3** Criar `backend/src/db/schema.ts` (seção 6.2)
- [ ] **2.4** Criar `backend/drizzle.config.ts` (seção 6.6)
- [ ] **2.5** Rodar `npx drizzle-kit generate` e `npx drizzle-kit push`
- [ ] **2.6** Verificar tabelas no dashboard Supabase
- [ ] **2.7** Aplicar SQL adicional (índices + triggers, seção 6.3)
- [ ] **2.8** Aplicar RLS policies (seção 6.4)
- [ ] **2.9** Criar usuário do Dr. Rômulo manualmente no Supabase
- [ ] **2.10** Testar inserção/seleção via SQL Editor com `auth.uid()` válido

### Fase 3 — Backend skeleton

- [ ] **3.1** Configurar TypeScript (`tsconfig.json` strict)
- [ ] **3.2** Instalar Express + middlewares (cors, helmet, express-rate-limit)
- [ ] **3.3** Criar `backend/src/server.ts` com bootstrap básico
- [ ] **3.4** Criar `backend/src/lib/supabase.ts` (client admin com SERVICE_ROLE_KEY)
- [ ] **3.5** Criar `backend/src/middleware/auth.middleware.ts` que valida JWT do Supabase
- [ ] **3.6** Criar `backend/src/middleware/validate.middleware.ts` (wrapper Zod)
- [ ] **3.7** Criar `backend/src/middleware/error.middleware.ts` (error handler global retornando `{ error, message }`)
- [ ] **3.8** Endpoint `GET /api/health`
- [ ] **3.9** Configurar Swagger em `/api/docs` (atrás de env var)
- [ ] **3.10** Script `npm run dev` com `tsx watch`

### Fase 4 — Motor de processamento

- [ ] **4.1** Criar `backend/src/services/processamento.service.ts` (seção 7.2 completa)
- [ ] **4.2** Testar manualmente com payload mock: `processarExame(payloadFake)` retorna métricas válidas
- [ ] **4.3** Validar todos os edge cases:
  - [ ] Payload vazio → erro
  - [ ] Sem fluxo positivo → erro
  - [ ] Truncamento correto nos 8 zeros
  - [ ] Posição 0 sempre `Fl=0` é tratada como protocolo

### Fase 5 — SSE

- [ ] **5.1** Criar `backend/src/services/sse.service.ts` (seção 8.2)
- [ ] **5.2** Criar `backend/src/middleware/auth-query.middleware.ts` (autenticação via `?token=` para SSE/PDF)
- [ ] **5.3** Endpoint `GET /api/coleta/aguardar/:pacienteId` que registra a sessão
- [ ] **5.4** Endpoint `POST /api/coleta/cancelar/:pacienteId`
- [ ] **5.5** Testar manualmente: abrir SSE com `curl -N` e verificar evento "aguardando"
- [ ] **5.6** Testar timeout de 10 minutos
- [ ] **5.7** Testar reconexão (fechar curl e reabrir — sessão antiga deve ser sobrescrita)

### Fase 6 — Endpoints de coleta

- [ ] **6.1** Endpoint `POST /api/coleta/dados` (público, com rate limit 30 req/min)
- [ ] **6.2** Lógica: processa payload → consulta Map SSE → salva como vinculado ou órfão
- [ ] **6.3** Endpoint `POST /api/coleta/vincular`
- [ ] **6.4** Endpoint `GET /api/coleta/orfaos`
- [ ] **6.5** Testar fluxo completo: abrir SSE + POST do mock → frontend (curl) recebe `exame_pronto`
- [ ] **6.6** Testar caso órfão: POST sem SSE ativo → exame salvo com `paciente_id = null`

### Fase 7 — Endpoints CRUD

- [ ] **7.1** Endpoints `pacientes`: GET lista (com busca), POST, GET detalhes, PATCH, DELETE
- [ ] **7.2** Endpoints `exames`: GET detalhes, PATCH (volume residual), DELETE
- [ ] **7.3** Endpoints `auth`: GET `/api/auth/me`
- [ ] **7.4** Validação Zod em todos os bodies
- [ ] **7.5** Testar todas via Swagger / Postman

### Fase 8 — PDF

- [ ] **8.1** Instalar `pdfkit` e `chartjs-node-canvas`
- [ ] **8.2** Criar `backend/src/services/pdf.service.ts` (seção 12.3)
- [ ] **8.3** Endpoint `GET /api/exames/:id/pdf` (auth via header OU query string)
- [ ] **8.4** Suporte a `?download=1` (Content-Disposition: attachment)
- [ ] **8.5** Testar geração — abrir PDF no Adobe e validar layout

### Fase 9 — Mock ESP32

- [ ] **9.1** Criar `mock/esp32-mock.ts` (seção 13.1)
- [ ] **9.2** Testar contra backend local: `BACKEND_URL=http://localhost:3000 npm run start`
- [ ] **9.3** Verificar gráfico no `/exames/:id` quando rodar o mock

### Fase 10 — Frontend skeleton

- [ ] **10.1** `npm create vite@latest frontend -- --template react-ts`
- [ ] **10.2** Instalar Tailwind CSS + plugins
- [ ] **10.3** `npx shadcn-ui@latest init` e configurar `components.json`
- [ ] **10.4** Configurar Tailwind com tokens da paleta (seção 10.4)
- [ ] **10.5** Importar Roboto e configurar `index.css` (seção 10.5)
- [ ] **10.6** Instalar shadcn components (seção 10.7)
- [ ] **10.7** Customizar componentes shadcn com a paleta (seção 10.6)
- [ ] **10.8** Instalar React Router, TanStack Query, RHF + Zod, Recharts, Sonner, axios, date-fns, supabase-js, lucide-react
- [ ] **10.9** Criar `services/supabase.ts` (cliente público)
- [ ] **10.10** Criar `services/api.ts` (axios + interceptors, seção 11.13)
- [ ] **10.11** Configurar QueryClient + `<QueryClientProvider>` em `main.tsx`
- [ ] **10.12** Configurar `<Toaster richColors position="top-right" />` da Sonner

### Fase 11 — Auth e roteamento

- [ ] **11.1** Criar hook `useAuth` (sessão + user via Supabase)
- [ ] **11.2** Criar `<ProtectedRoute>` (seção 11.2)
- [ ] **11.3** Criar `<AppShell>` com Header + BottomNav/Sidebar
- [ ] **11.4** Página `/login` (seção 11.3)
- [ ] **11.5** Página `/recuperar-senha` (seção 11.4)
- [ ] **11.6** Página `/redefinir-senha` (seção 11.5)
- [ ] **11.7** Configurar rotas no `App.tsx`
- [ ] **11.8** Testar fluxo completo de login

### Fase 12 — Pacientes (frontend)

- [ ] **12.1** Hook `usePacientes` (TanStack Query, com debounce de busca)
- [ ] **12.2** Hook `useExamesOrfaos`
- [ ] **12.3** Página `/pacientes` (lista + busca + badge órfãos)
- [ ] **12.4** Componente `<PacienteCard>`
- [ ] **12.5** Componente `<FormPaciente>` (RHF + Zod)
- [ ] **12.6** Página `/pacientes/novo`
- [ ] **12.7** Página `/pacientes/:id` (detalhes + histórico de exames)
- [ ] **12.8** Página `/pacientes/:id/editar`
- [ ] **12.9** AlertDialog de confirmação de exclusão
- [ ] **12.10** Testar todos os fluxos CRUD

### Fase 13 — Coleta (frontend)

- [ ] **13.1** Hook `useColeta` (gerencia estados + EventSource SSE)
- [ ] **13.2** Componente `<PassoSelecionarPaciente>`
- [ ] **13.3** Componente `<PassoAguardando>` (com spinner CSS pulse)
- [ ] **13.4** Componente `<PassoConcluido>`
- [ ] **13.5** Página `/coleta` (orquestra os 3 passos)
- [ ] **13.6** Suporte a `?pacienteId=` na query string
- [ ] **13.7** Testar fluxo completo com mock: selecionar paciente → rodar mock → ir pro state 3

### Fase 14 — Exames órfãos

- [ ] **14.1** Página `/coleta/orfaos`
- [ ] **14.2** Componente `<ModalVincularPaciente>`
- [ ] **14.3** Mini-gráfico de preview com Recharts
- [ ] **14.4** Testar: rodar mock sem sessão SSE → ver órfão na lista → vincular

### Fase 15 — Detalhes do exame

- [ ] **15.1** Componente `<GraficoFluxo>` (Recharts com 2 séries)
- [ ] **15.2** Componente `<TabelaMetricas>`
- [ ] **15.3** Componente `<VolumeResidualInput>` (edição inline)
- [ ] **15.4** Página `/exames/:id` (4 seções, seção 11.11)
- [ ] **15.5** Botões "Abrir PDF" e "Baixar PDF" (`window.open` com token)
- [ ] **15.6** Testar fluxo completo + verificar PDF

### Fase 16 — Perfil + ajustes finais

- [ ] **16.1** Página `/perfil` (visualização + alterar senha + sair)
- [ ] **16.2** Adicionar logo no `frontend/public/logo.svg`
- [ ] **16.3** Tela 404 (`<Route path="*" element={<NotFound />} />`)
- [ ] **16.4** Loading skeletons em todas as páginas com fetch
- [ ] **16.5** Testar responsividade (mobile, tablet, desktop)

### Fase 17 — Containerização

- [ ] **17.1** Criar `backend/Dockerfile` (seção 14.1)
- [ ] **17.2** Criar `backend/.dockerignore` (seção 14.2)
- [ ] **17.3** Build local: `docker build -t urofluxometria-backend ./backend`
- [ ] **17.4** Run local: `docker run -p 3000:3000 --env-file backend/.env urofluxometria-backend`
- [ ] **17.5** Criar `docker-compose.yml` na raiz (seção 14.3)

### Fase 18 — CI/CD

- [ ] **18.1** Criar `.github/workflows/deploy.yml` (seção 14.4)
- [ ] **18.2** Criar PAT no GitHub para usar como `GHCR_TOKEN` se necessário
- [ ] **18.3** Comprar VPS Contabo + apontar DNS
- [ ] **18.4** Setup da VPS conforme seção 16
- [ ] **18.5** Configurar secrets no GitHub
- [ ] **18.6** Push na main e validar deploy automático
- [ ] **18.7** Verificar `https://api.SEU_DOMINIO.com.br/api/health`

### Fase 19 — Deploy frontend (Vercel)

- [ ] **19.1** Criar projeto na Vercel apontando para `frontend/`
- [ ] **19.2** Configurar env vars (`VITE_*`)
- [ ] **19.3** Configurar domínio customizado se houver (`app.SEU_DOMINIO.com.br`)
- [ ] **19.4** Validar build + smoke test em produção

### Fase 20 — Validação final

- [ ] **20.1** Atualizar URL hardcoded no firmware do ESP32
- [ ] **20.2** Teste end-to-end: ESP32 real → backend → frontend
- [ ] **20.3** Gerar e imprimir PDF de teste e mostrar pro Dr. Rômulo
- [ ] **20.4** Ajustes finais conforme feedback do cliente
- [ ] **20.5** Entrega + treinamento

---

## 19. GOTCHAS CRÍTICOS

### 19.1 Específicos do ESP32

- **Posição 0 sempre `Fl=0`** — não tratar como ausência de fluxo, é protocolo
- **`Fl` e `It` são strings** — sempre `parseFloat`/`parseInt`
- **Array sempre tem 1000 posições** — truncar nos 8 zeros consecutivos após o primeiro fluxo > 0
- **Sem retry, sem auth no POST** — confiar no rate limit + sistema de exames órfãos

### 19.2 Específicos do SSE

- **Single process obrigatório** — Map é em memória. Nunca rodar com PM2 cluster, replicas, etc.
- **Caddy `flush_interval -1`** — sem isso, o reverse proxy buffera e o frontend nunca recebe os eventos
- **EventSource não envia headers** — autenticação via `?token=` na query string
- **Sempre fazer cleanup no `res.on('close')`** — senão acumula sessões zumbis no Map
- **Heartbeat (`: ping\n\n`) a cada 30s** — sem isso, proxies/firewalls podem fechar conexão ociosa

### 19.3 Específicos do Supabase

- **`prepare: false` no postgres.js** — Supabase usa PgBouncer em transaction mode, prepared statements quebram
- **`auth.getUser(token)` é assíncrono** — não pular
- **RLS bypassada com SERVICE_ROLE_KEY** — usar com cuidado, apenas no INSERT do POST do ESP32
- **`auth.uid()` retorna NULL se não autenticado** — política de RLS precisa lidar com isso

### 19.4 Específicos do PDF

- **`window.open()` não envia headers** — rota `/api/exames/:id/pdf` aceita `?token=` na query
- **chartjs-node-canvas precisa de fontes do sistema** — em Alpine, instalar `apk add ttf-dejavu` ou usar `node:20-bookworm-slim`

### 19.5 Específicos do Vite

- **Variáveis de ambiente exigem prefixo `VITE_`** — sem isso, não são expostas ao client bundle
- **Proxy de dev** opcional em `vite.config.ts` se o backend estiver em outra porta (evita CORS no dev)

### 19.6 Específicos do shadcn

- **Cores precisam ser substituídas em cada componente** — `npx shadcn-ui add button` traz cores default que precisam ser trocadas pelos tokens da paleta
- **Sonner integra direto com shadcn** — usar `<Toaster />` do `components/ui/sonner.tsx`

---

## 20. APÊNDICES

### 20.1 Comandos úteis

```bash
# Backend
cd backend && npm run dev                # Dev com tsx watch
cd backend && npm run build              # Compila TS para dist/
cd backend && npx drizzle-kit generate   # Gera migrations
cd backend && npx drizzle-kit push       # Aplica schema sem migration
cd backend && npx drizzle-kit studio     # GUI web do banco

# Frontend
cd frontend && npm run dev               # Vite dev
cd frontend && npm run build             # Build de produção
cd frontend && npm run preview           # Servir o build local

# Mock
cd mock && BACKEND_URL=http://localhost:3000 npm run start

# Docker
docker build -t urofluxometria-backend ./backend
docker run -p 3000:3000 --env-file backend/.env urofluxometria-backend

# VPS
ssh deploy@IP_DA_VPS
cd /opt/urofluxometria && docker compose pull && docker compose up -d
docker compose logs -f
```

### 20.2 Links de referência

- Drizzle ORM: https://orm.drizzle.team
- Supabase RLS: https://supabase.com/docs/guides/auth/row-level-security
- shadcn/ui: https://ui.shadcn.com
- TanStack Query: https://tanstack.com/query/latest
- Recharts: https://recharts.org
- PDFKit: https://pdfkit.org
- chartjs-node-canvas: https://github.com/SeanSobey/ChartjsNodeCanvas
- Caddy SSE: https://caddy.community/t/server-sent-events-sse-with-caddy/3593
- ESP32 firmware (referência): pasta `firmware__1_/main.ino` no projeto

### 20.3 Checklist de entrega

- [ ] Repo GitHub privado com README atualizado
- [ ] Frontend rodando em produção (Vercel)
- [ ] Backend rodando em produção (Contabo + Caddy)
- [ ] Banco com RLS ativa
- [ ] ESP32 com URL atualizada
- [ ] PDF de teste impresso e validado pelo cliente
- [ ] Credenciais entregues ao cliente em handoff documentado
- [ ] Treinamento básico de uso (30min)
- [ ] Pagamento da última parcela liberado

---

**FIM DO BUILD.md**
