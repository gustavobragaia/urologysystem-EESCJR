# Sistema de Urofluxometria — Dr. Rômulo Nunes

**Desenvolvedor:** GBS Media · CNPJ 49.544.746/0001-55  
**Cliente:** Dr. Rômulo Nunes — Urologista e Cirurgião Robótico  
**Versão:** 1.0

---

## Setup de desenvolvimento

### Pré-requisitos
- Node.js 20 LTS
- Conta no [Supabase](https://supabase.com) (free tier)

### 1. Configurar variáveis de ambiente

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
# Preencher com as keys do projeto Supabase
```

### 2. Instalar dependências

```bash
npm run dev:backend    # Backend na porta 3000
npm run dev:frontend   # Frontend na porta 5173
```

### 3. Configurar banco (primeira vez)

```bash
cd backend
npx drizzle-kit push   # Cria tabelas no Supabase
```

Depois aplicar o SQL de índices + triggers + RLS da seção 6.3/6.4 do BUILD.md no SQL Editor do Supabase.

### 4. Testar com o mock do ESP32

Com o backend rodando:
```bash
cd mock && npm install
BACKEND_URL=http://localhost:3000 npm run start
```

---

## Arquitetura

```
ESP32 (dispositivo) → POST /api/coleta/dados → Backend (VPS Contabo + Docker)
                                                      ↓ SSE
                                              Frontend (Vercel) ← médico (browser)
                                                      ↓
                                              Supabase (Postgres + Auth)
```

Ver [BUILD.md](./BUILD.md) para spec completa.

---

## Deploy

- **Backend:** push na `main` dispara GitHub Actions → build Docker → push GHCR → SSH deploy na VPS
- **Frontend:** push na `main` dispara Vercel automaticamente
- **Banco:** Supabase free tier (gerenciado)

---

## Contexto do projeto

Ver [urologia-context/](./urologia-context/) para progresso, gotchas e referências de ambiente.
# urologysystem-EESCJR
