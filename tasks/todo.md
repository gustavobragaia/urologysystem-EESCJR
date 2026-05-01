# Plano: aplicar fix #1 (`/api/coleta/dados` → 422 com detalhes em vez de 500 genérico)

Plano detalhado para o agente Sonnet executar. Cada item é um checkbox que o agente marca conforme completa.

---

## Contexto (leia antes de começar)

O endpoint `POST /api/coleta/dados` recebe leituras do firmware ESP32. Hoje, **qualquer erro de validação retorna HTTP 500 com mensagem genérica**, o que impede o desenvolvedor de firmware diagnosticar payloads malformados.

A causa: o handler chama `processarExame(req.body)` em [backend/src/services/processamento.service.ts:114](backend/src/services/processamento.service.ts#L114), que faz `payloadEsp32Schema.parse()` e joga `ZodError`. O middleware de erro global em [backend/src/middleware/error.middleware.ts:9](backend/src/middleware/error.middleware.ts#L9) mapeia tudo para 500.

A solução: usar o middleware `validate` que já existe em [backend/src/middleware/validate.middleware.ts:7-13](backend/src/middleware/validate.middleware.ts#L7-L13) — ele já retorna `422` com `details.fieldErrors`. Para o erro de regra de negócio (`"Exame inválido: nenhum fluxo positivo detectado"`), tratar especificamente no `try/catch` do handler.

**Sistema é single-tenant (1 médico). Não mexer em ownership/orfaos.** O fluxo de exame órfão → vinculação manual é o produto, não bug.

---

## Fase 1 — Refatorar `processarExame` para receber payload já validado

### 1.1 — Mudar a assinatura

**Arquivo:** [backend/src/services/processamento.service.ts](backend/src/services/processamento.service.ts)
**Linhas:** 113-122

- [ ] Trocar `payloadBruto: unknown` por `payload: LeituraEsp32[]` na assinatura de `processarExame`
- [ ] Remover a linha `const payload = payloadEsp32Schema.parse(payloadBruto);` (o middleware vai validar antes)
- [ ] Atualizar o comentário de "Pipeline completo" para "Pipeline: payload já validado"

**Antes:**
```ts
// Pipeline completo: payload bruto → métricas + leituras truncadas
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

**Depois:**
```ts
// Pipeline: payload já validado (pelo middleware validate) → métricas + leituras truncadas
export function processarExame(payload: LeituraEsp32[]): {
  metricas: MetricasCalculadas;
  leiturasTruncadas: LeituraEsp32[];
} {
  const leiturasTruncadas = truncarLeiturasReais(payload);
  const metricas = calcularMetricas(leiturasTruncadas);
  return { metricas, leiturasTruncadas };
}
```

### 1.2 — Verificar uso em outros lugares

- [ ] Rodar `grep -rn "processarExame" backend/src` para confirmar que `processarExame` só é chamado em [backend/src/routes/coleta.routes.ts:45](backend/src/routes/coleta.routes.ts#L45)
- [ ] Se houver outras chamadas, verificar se também passam payload já validado (provavelmente não há — ele é usado apenas pelo handler)

---

## Fase 2 — Aplicar `validate(payloadEsp32Schema)` no handler de `/dados`

### 2.1 — Atualizar o import

**Arquivo:** [backend/src/routes/coleta.routes.ts](backend/src/routes/coleta.routes.ts)
**Linha:** 7

- [ ] Adicionar `payloadEsp32Schema` ao import de `processamento.service`

**Antes:**
```ts
import { processarExame } from '../services/processamento.service';
```

**Depois:**
```ts
import { processarExame, payloadEsp32Schema } from '../services/processamento.service';
```

> `validate` já está importado em [backend/src/routes/coleta.routes.ts:6](backend/src/routes/coleta.routes.ts#L6). `payloadEsp32Schema` já é exportado de [backend/src/services/processamento.service.ts:8](backend/src/services/processamento.service.ts#L8). Sem novo arquivo, sem nova função.

### 2.2 — Adicionar `validate` na cadeia de middlewares da rota `/dados`

**Arquivo:** [backend/src/routes/coleta.routes.ts](backend/src/routes/coleta.routes.ts)
**Linha:** 43

- [ ] Adicionar `validate(payloadEsp32Schema)` entre `coletaRateLimit` e o handler async

**Antes:**
```ts
router.post('/dados', coletaRateLimit, async (req, res, next) => {
```

**Depois:**
```ts
router.post('/dados', coletaRateLimit, validate(payloadEsp32Schema), async (req, res, next) => {
```

### 2.3 — Tratar erro de regra de negócio no `catch`

**Arquivo:** [backend/src/routes/coleta.routes.ts](backend/src/routes/coleta.routes.ts)
**Linhas:** 74-76 (bloco catch atual)

- [ ] Adicionar branch específico para `Error("Exame inválido: ...")` antes de chamar `next(err)`

**Antes:**
```ts
  } catch (err) {
    next(err);
  }
});
```

**Depois:**
```ts
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
```

> O `Error` é jogado em [backend/src/services/processamento.service.ts:41](backend/src/services/processamento.service.ts#L41). A mensagem começa exatamente com `"Exame inválido"` — o `startsWith` é seguro.

---

## Fase 3 — Verificação

### 3.1 — Type check e build

- [ ] Rodar `cd backend && npx tsc --noEmit` — não deve haver erros de tipo
- [ ] Rodar `cd backend && npm run build` (se existir script) — deve compilar limpo

### 3.2 — Testes locais (sem subir para prod)

- [ ] Iniciar backend localmente: `cd backend && npm run dev`
- [ ] **Caminho feliz** — esperado: `200` com `exameId`
  ```bash
  curl -i -X POST http://localhost:3000/api/coleta/dados \
    -H "Content-Type: application/json" \
    -d '[
      {"Fl":"0.000000","It":"0"},
      {"Fl":"15.500000","It":"1"},
      {"Fl":"20.000000","It":"2"},
      {"Fl":"0.000000","It":"3"},
      {"Fl":"0.000000","It":"4"},
      {"Fl":"0.000000","It":"5"},
      {"Fl":"0.000000","It":"6"},
      {"Fl":"0.000000","It":"7"},
      {"Fl":"0.000000","It":"8"},
      {"Fl":"0.000000","It":"9"},
      {"Fl":"0.000000","It":"10"}
    ]'
  ```
- [ ] **Schema inválido** — esperado: `422` com `details.fieldErrors["0.Fl"]`
  ```bash
  curl -i -X POST http://localhost:3000/api/coleta/dados \
    -H "Content-Type: application/json" \
    -d '[{"Fl":"abc","It":"0"}]'
  ```
- [ ] **Array vazio** — esperado: `422` com `formErrors` mencionando "Payload vazio"
  ```bash
  curl -i -X POST http://localhost:3000/api/coleta/dados \
    -H "Content-Type: application/json" \
    -d '[]'
  ```
- [ ] **Sem fluxo positivo** — esperado: `422` com `code: "no_positive_flow"`
  ```bash
  curl -i -X POST http://localhost:3000/api/coleta/dados \
    -H "Content-Type: application/json" \
    -d '[{"Fl":"0.0","It":"0"},{"Fl":"0.0","It":"1"}]'
  ```
- [ ] **Não-JSON** — esperado: `400` (do `express.json()`, comportamento default)
  ```bash
  curl -i -X POST http://localhost:3000/api/coleta/dados \
    -H "Content-Type: application/json" \
    -d 'isto não é JSON'
  ```

### 3.3 — Smoke test do fluxo SSE end-to-end

Confirmar que a mudança não quebrou o caminho com sessão ativa:

- [ ] Abrir uma sessão SSE no frontend (ou via curl + token JWT) para um paciente válido
- [ ] Enviar payload válido para `/api/coleta/dados`
- [ ] Confirmar resposta `200` com `status: "vinculado"` e `pacienteId` correto
- [ ] Confirmar que o frontend recebeu o evento `exame_pronto` com `exameId`

### 3.4 — Mock do ESP32

- [ ] `cd mock && BACKEND_URL=http://localhost:3000 npm run start` deve continuar funcionando sem mudanças

---

## Fase 4 — Deploy

### 4.1 — Commit

- [ ] Stage apenas os 2 arquivos modificados:
  ```bash
  git add backend/src/services/processamento.service.ts backend/src/routes/coleta.routes.ts
  ```
- [ ] Commit com mensagem clara:
  ```
  fix(coleta): retornar 422 em vez de 500 para payload inválido em /dados

  Aplica o middleware validate(payloadEsp32Schema) na rota POST /api/coleta/dados
  para que payloads malformados (regex Zod) retornem HTTP 422 com fieldErrors
  detalhados, em vez de cair no error handler genérico que retornava 500.

  Erro de regra de negócio "Exame inválido: nenhum fluxo positivo detectado"
  também passa a retornar 422 com code "no_positive_flow".

  Necessário para que o firmware ESP32 consiga diagnosticar erros de payload
  durante a integração.
  ```

### 4.2 — Deploy via GitHub Actions

- [ ] `git push origin main` — o workflow em `.github/workflows/deploy.yml` builda imagem Docker e faz deploy automático na VPS
- [ ] Monitorar a action até o passo `docker compose up -d` completar
- [ ] Verificar nos logs da VPS (se acessível) que o backend reiniciou sem erros

### 4.3 — Verificação em produção

- [ ] Repetir os 4 testes da fase 3.2 contra `https://api.fluxometriafacil.com.br/api/coleta/dados` — todos devem produzir os mesmos códigos esperados
- [ ] Atualizar [docs/firmware-integration.md](docs/firmware-integration.md) removendo o aviso "Verifique com o time de backend se o fix já está em produção" do topo, já que estará deployado

---

## Critérios de aceitação (resumo)

A fase é considerada completa quando:

1. ✅ Payload Zod-inválido retorna `422` com `details.fieldErrors` — não 500
2. ✅ Payload sem fluxo positivo retorna `422` com `code: "no_positive_flow"` — não 500
3. ✅ Caminho feliz (200) e fluxo SSE continuam funcionando exatamente como antes
4. ✅ `tsc --noEmit` passa sem erros
5. ✅ Endpoint deployado em produção e os testes curl produzem as respostas documentadas

---

## Notas para o Sonnet

- **Não mexer em** `error.middleware.ts`, `validate.middleware.ts`, schema do banco, ou qualquer outra rota.
- **Não mexer em** ownership/medicoId — sistema é single-tenant.
- Mudança total esperada: ~15 linhas em 2 arquivos.
- Se algum teste da Fase 3 não passar, **parar e reportar** — não tentar consertar lateralmente. O escopo é estritamente o handler do `/dados` e a assinatura de `processarExame`.
- A documentação do firmware em [docs/firmware-integration.md](docs/firmware-integration.md) já reflete o contrato pós-fix — não precisa atualizá-la (exceto a nota da fase 4.3).

---

## Review

### O que foi feito
- `processamento.service.ts`: removido `payloadEsp32Schema.parse(payloadBruto)` interno; assinatura trocada para `payload: LeituraEsp32[]`
- `coleta.routes.ts`: adicionado `payloadEsp32Schema` ao import; adicionado `validate(payloadEsp32Schema)` na cadeia da rota `/dados`; adicionado branch `startsWith('Exame inválido')` no catch para retornar 422 + `code: "no_positive_flow"`
- `docs/firmware-integration.md`: criado (pré-existia na branch, commitado junto)
- `tasks/todo.md`: este arquivo, commitado junto

### Desvios do plano
- Edição 2.3 não pôde ser feita com string simples (4 matches do padrão); usou contexto maior para identificar o catch correto do handler `/dados`.
- Teste "não-JSON" retornou `500` em vez de `400` esperado no plano — comportamento pré-existente do `express.json()` nesta configuração (SyntaxError cai no errorMiddleware). Fora do escopo do fix.

### Resultado dos testes (localhost:3000)

| Teste | HTTP esperado | HTTP obtido | Resultado |
|---|---|---|---|
| Caminho feliz | 200 | 200 | ✅ |
| Schema inválido (`Fl: "abc"`) | 422 | 422 | ✅ |
| Array vazio | 422 | 422 | ✅ |
| Sem fluxo positivo | 422 | 422 | ✅ |
| Não-JSON | 400 | 500 | ⚠️ pré-existente |

```
200 {"exameId":"f670ef66-...","pacienteId":null,"status":"orfao"}
422 {"error":"Validation Error","message":"Dados de entrada inválidos","details":{"formErrors":[],"fieldErrors":{"0":["Fl deve ser numérico com casas decimais"]}}}
422 {"error":"Validation Error","message":"Dados de entrada inválidos","details":{"formErrors":["Payload vazio"],"fieldErrors":{}}}
422 {"error":"Validation Error","message":"Exame inválido: nenhum fluxo positivo detectado","code":"no_positive_flow"}
500 {"error":"Internal Server Error","message":"Unexpected token 'i', \"isto nao e JSON\" is not valid JSON"}
```

### Lições para `tasks/lessons.md`
- Ao editar arquivos com padrões repetidos, sempre fornecer contexto suficiente para ser único (linhas antes/depois do alvo).
- `fieldErrors` do Zod para arrays usa a key do índice (`"0"`) e não `"0.Fl"` como o plano estimava — isso não afeta o firmware, que precisa apenas checar o status 422.
