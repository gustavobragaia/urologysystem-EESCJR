# Progresso da Implementação

**Última atualização:** 2026-04-27
**Status:** IMPLEMENTAÇÃO COMPLETA (Fases 1-19) ✅

## Checklist de Fases

- [x] Fase 1 — Monorepo scaffold
- [x] Fase 2 — Backend: banco de dados (schema.ts, env.ts, drizzle config, db/index.ts)
- [x] Fase 3 — Backend: skeleton Express (server.ts, middlewares, health, swagger)
- [x] Fase 4 — Motor de processamento (processamento.service.ts)
- [x] Fase 5 — SSE service (sse.service.ts)
- [x] Fase 6 — Endpoints de coleta (coleta.routes.ts, exame.service.ts)
- [x] Fase 7 — CRUD pacientes + exames + auth routes
- [x] Fase 8 — PDF service (pdf.service.ts + GET /api/exames/:id/pdf)
- [x] Fase 9 — Mock ESP32 (mock/esp32-mock.ts)
- [x] Fase 10 — Frontend scaffold (Vite, Tailwind v3, shadcn/ui, dependências)
- [x] Fase 11 — Auth e roteamento frontend
- [x] Fase 12 — Páginas de Pacientes
- [x] Fase 13 — Fluxo de Coleta (useColeta + SSE)
- [x] Fase 14 — Exames órfãos
- [x] Fase 15 — Detalhes do exame (gráfico, métricas, PDF)
- [x] Fase 16 — Perfil, 404
- [x] Fase 17 — Containerização (Dockerfile multi-stage + docker-compose.yml)
- [x] Fase 18 — CI/CD (GitHub Actions deploy.yml)
- [x] Fase 19 — Deploy frontend (vercel.json)

## Pendências para o Dev (não código — configuração)

- [ ] Criar projeto no Supabase e anotar URL/keys
- [ ] Criar usuário Dr. Rômulo no Supabase Auth (marcar Auto Confirm User)
- [ ] Copiar backend/.env.example → backend/.env e preencher com as keys reais
- [ ] Rodar `npx drizzle-kit push` para criar as tabelas no banco
- [ ] Aplicar SQL adicional no Supabase SQL Editor (índices + triggers + RLS — seção 6.3 e 6.4 do BUILD.md)
- [ ] Copiar frontend/.env.example → frontend/.env e preencher
- [ ] Registrar domínio e apontar DNS para o IP da VPS Contabo
- [ ] Atualizar `serverPath` no firmware ESP32 com a URL final
- [ ] Configurar Secrets no GitHub (VPS_HOST, VPS_USER, VPS_SSH_KEY)
- [ ] Deploy na Vercel (conectar repo, root dir: frontend, configurar vars VITE_*)

## Notas técnicas

- **canvas/chartjs-node-canvas:** local dev usa Node v22 que não tem binário pré-compilado para canvas.
  O PDF funciona em produção (Docker usa node:20-bookworm-slim + libs instaladas).
  Para testar PDF localmente: rodar o backend dentro do Docker.
- **Tailwind v3:** instalado explicitamente como v3.4.4 (shadcn/ui não suporta v4 ainda).
- **shadcn components:** foram colocados em src/components/ui/ (movidos do @/ literal criado pelo CLI).
