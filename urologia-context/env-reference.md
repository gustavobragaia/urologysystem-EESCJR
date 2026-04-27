# Variáveis de Ambiente — Referência

## Backend (`backend/.env`)

```bash
PORT=3000
NODE_ENV=development

# Supabase
SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...

# Banco (string de conexão direta — usa PgBouncer transaction mode)
DATABASE_URL=postgresql://postgres.xxxx:SENHA@aws-0-sa-east-1.pooler.supabase.com:6543/postgres

# CORS
FRONTEND_URL=http://localhost:5173

# Swagger (em prod: false)
ENABLE_SWAGGER=true
```

## Frontend (`frontend/.env`)

```bash
VITE_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc...
VITE_API_URL=http://localhost:3000
```

## Notas

- `DATABASE_URL` deve usar a string de pooler do Supabase (porta 6543), não a direta (5432)
- `SUPABASE_SERVICE_ROLE_KEY` — NUNCA expor no frontend; usado apenas no backend para INSERT de exames (bypass RLS)
- `VITE_*` — Vite só expõe ao client bundle variáveis com esse prefixo
