# Guia de Deploy — Backend na VPS Contabo

## Pré-requisitos

- VPS Contabo com Ubuntu 22.04 (ou Debian 12)
- Domínio registrado apontando para o IP da VPS
- Conta no GitHub com o repositório do projeto
- Projeto Supabase criado e configurado

---

## Parte 1 — Configurar a VPS (uma vez só)

### 1.1 Acesso inicial e pacotes

```bash
ssh root@SEU_IP_VPS

# Atualizar sistema
apt update && apt upgrade -y

# Instalar Docker
curl -fsSL https://get.docker.com | sh
usermod -aG docker $USER  # ou o usuário deploy que você usar
newgrp docker

# Testar
docker run hello-world
```

### 1.2 Instalar Caddy (reverse proxy com HTTPS automático)

```bash
apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
apt update && apt install caddy -y
```

### 1.3 Configurar Caddyfile

```bash
nano /etc/caddy/Caddyfile
```

Conteúdo (substituir `api.seudominio.com.br` pelo domínio real):

```
api.seudominio.com.br {
    reverse_proxy localhost:3000 {
        flush_interval -1
    }
    encode gzip
}
```

> `flush_interval -1` é **obrigatório** para SSE funcionar.

```bash
systemctl reload caddy
systemctl enable caddy
```

### 1.4 Criar pasta da aplicação

```bash
mkdir -p /opt/urofluxometria
```

### 1.5 Criar o `.env` de produção na VPS

```bash
nano /opt/urofluxometria/.env
```

Preencher com os valores reais:

```env
PORT=3000
NODE_ENV=production

SUPABASE_URL=https://PROJECT_REF.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Pooler para produção (PgBouncer transaction mode)
DATABASE_URL=postgresql://postgres.PROJECT_REF:PASSWORD@aws-0-sa-east-1.pooler.supabase.com:6543/postgres

FRONTEND_URL=https://seudominio.vercel.app

ENABLE_SWAGGER=false
```

### 1.6 Criar o `docker-compose.yml` na VPS

```bash
nano /opt/urofluxometria/docker-compose.yml
```

Conteúdo:

```yaml
version: '3.9'
services:
  backend:
    image: ghcr.io/SEU_GITHUB_USER/urofluxometria-backend:latest
    restart: unless-stopped
    ports:
      - "3000:3000"
    env_file: .env
    volumes:
      - ./assets:/app/assets:ro
```

> Substitua `SEU_GITHUB_USER` pelo seu usuário do GitHub.

### 1.7 Copiar a logo para a VPS

```bash
# No seu Mac, rodar:
scp backend/assets/logo.svg root@SEU_IP_VPS:/opt/urofluxometria/assets/logo.svg
```

---

## Parte 2 — Configurar GitHub Secrets

No repositório GitHub: **Settings → Secrets and variables → Actions → New repository secret**

| Secret | Valor |
|--------|-------|
| `VPS_HOST` | IP da VPS (ex: `185.123.x.x`) |
| `VPS_USER` | Usuário SSH (ex: `root` ou `deploy`) |
| `VPS_SSH_KEY` | Conteúdo completo da chave privada SSH (`cat ~/.ssh/id_rsa`) |

Para gerar uma chave SSH dedicada (se não tiver):
```bash
ssh-keygen -t ed25519 -C "github-deploy" -f ~/.ssh/deploy_key
cat ~/.ssh/deploy_key.pub >> ~/.ssh/authorized_keys  # rodar na VPS
# O conteúdo de ~/.ssh/deploy_key vai no secret VPS_SSH_KEY
```

---

## Parte 3 — Primeiro deploy

Após configurar os secrets:

```bash
# No repositório, qualquer push para main que toque backend/ dispara o CI/CD
git push origin main
```

Ou manualmente: GitHub → Actions → **Deploy Backend** → **Run workflow**.

### Verificar deploy:

```bash
# Na VPS
cd /opt/urofluxometria
docker compose ps        # backend deve estar "Up"
docker compose logs -f   # acompanhar logs em tempo real
```

Testar:
```bash
curl https://api.seudominio.com.br/api/health
# Esperado: {"status":"ok","timestamp":"...","version":"1.0.0"}
```

---

## Parte 4 — Deploy do Frontend (Vercel)

1. Ir em [vercel.com](https://vercel.com) → **New Project** → importar o repositório
2. Configurar:
   - **Root Directory:** `frontend`
   - **Framework:** Vite
3. Adicionar variáveis de ambiente:

| Variável | Valor |
|----------|-------|
| `VITE_SUPABASE_URL` | `https://PROJECT_REF.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | `eyJ...` (anon key) |
| `VITE_API_URL` | `https://api.seudominio.com.br` |

4. Deploy → URL gerada automaticamente (ex: `https://urofluxometria.vercel.app`)
5. Atualizar `FRONTEND_URL` no `.env` da VPS com essa URL e reiniciar:

```bash
cd /opt/urofluxometria && docker compose up -d
```

---

## Parte 5 — Atualizar firmware ESP32

Após o deploy do backend, atualizar no firmware:

```cpp
const char* serverPath = "/api/coleta/dados";
const char* serverName = "api.seudominio.com.br";
const int serverPort = 443;  // HTTPS
```

---

## Comandos úteis na VPS

```bash
# Ver logs em tempo real
docker compose -f /opt/urofluxometria/docker-compose.yml logs -f

# Reiniciar o backend
docker compose -f /opt/urofluxometria/docker-compose.yml restart

# Atualizar manualmente (sem CI/CD)
cd /opt/urofluxometria
docker compose pull && docker compose up -d

# Limpar imagens antigas
docker image prune -f
```
