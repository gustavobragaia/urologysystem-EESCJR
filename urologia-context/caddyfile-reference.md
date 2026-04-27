# Caddyfile — Configuração de Referência para a VPS

Salvar em `/etc/caddy/Caddyfile` na VPS:

```
api.SEU_DOMINIO.com.br {
    reverse_proxy localhost:3000 {
        flush_interval -1     # CRÍTICO para SSE — desabilita buffering
    }
    encode gzip
}
```

**flush_interval -1 é obrigatório.** Sem isso, o Caddy bufferiza os eventos SSE
e o frontend nunca recebe as notificações do ESP32.

Após editar:
```bash
sudo systemctl reload caddy
```
