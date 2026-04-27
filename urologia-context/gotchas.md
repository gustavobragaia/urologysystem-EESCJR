# Gotchas Críticos

## ESP32
- `Fl` e `It` são **strings** → sempre `parseFloat(l.Fl)` / `parseInt(l.It)`
- Array sempre tem **1000 posições** → truncar nos 8 zeros consecutivos após primeiro fluxo > 0
- Posição 0 sempre `Fl="0.000000"` → protocolo, não ausência de fluxo
- Sem retry, sem auth no POST → rate limit + sistema de exames órfãos

## SSE
- **Single process obrigatório** — Map é em memória; nunca PM2 cluster, Docker replicas
- **`X-Accel-Buffering: no`** nos headers SSE → crítico para nginx/Caddy não bufferizar
- **`flush_interval -1`** no Caddyfile → sem isso frontend nunca recebe eventos
- **EventSource não suporta headers customizados** → auth via `?token=` na query string
- **Cleanup em `res.on('close')`** → senão acumula sessões zumbi no Map
- **Ping `: \n\n` a cada 30s** → manter conexão viva em proxies/firewalls

## Supabase / Drizzle
- **`prepare: false`** no `postgres.js` → PgBouncer transaction mode quebra prepared statements
- **`auth.getUser(token)`** → sempre assíncrono, nunca pular
- **SERVICE_ROLE_KEY** no INSERT de exames → ESP32 não tem auth; backend usa service role para bypassar RLS
- **`auth.uid()` retorna NULL** se não autenticado → cuidado nas policies RLS

## PDF / chartjs-node-canvas
- **`window.open()` não envia headers** → rota `/api/exames/:id/pdf` aceita `?token=`
- **chartjs-node-canvas precisa de fontes do sistema** → usar `node:20-bookworm-slim` (não Alpine) no Dockerfile

## Vite
- **Prefixo `VITE_`** obrigatório para expor env vars ao client bundle
- **Proxy opcional** em `vite.config.ts` para evitar CORS no desenvolvimento

## shadcn/ui
- Cores default precisam ser **substituídas manualmente** pelos tokens da paleta após `npx shadcn-ui add`
- `<Toaster />` do Sonner vem do `components/ui/sonner.tsx` gerado pelo shadcn
