# Integração do firmware ESP32 com o backend

Documento de referência para a equipe de firmware do urofluxômetro. Tudo que o ESP32 precisa para enviar dados ao servidor está aqui — não é necessário ler o código TypeScript do backend.

> **Nota de versão:** este documento descreve o contrato HTTP **após** a aplicação do fix de validação (códigos `422` para payload inválido). Verifique com o time de backend se o fix já está em produção antes de validar respostas de erro.

---

## 1. Visão geral

O ESP32 coleta o fluxo do urofluxômetro a 10 Hz, monta um array JSON com até 1000 leituras e envia em uma única requisição POST para o backend.

```
ESP32 ──POST──▶ Backend (VPS) ──SSE──▶ Frontend (médico)
                     │
                     ▼
                  Banco
```

O backend é stateless do ponto de vista do firmware: cada POST é independente. O firmware **não** mantém sessão, **não** envia token, **não** precisa autenticar.

---

## 2. Endpoint

| Item | Valor |
|---|---|
| **URL** | `https://api.fluxometriafacil.com.br/api/coleta/dados` |
| **Método** | `POST` |
| **Auth** | Nenhuma (endpoint público) |
| **Header obrigatório** | `Content-Type: application/json` |
| **Tamanho máximo do body** | 1 MB |
| **Rate limit** | 30 requisições/minuto por IP |
| **TLS** | HTTPS obrigatório (certificado válido, gerenciado pelo servidor) |

---

## 3. Formato do payload

Body é um **array JSON** com 1 a 1000 itens. Cada item tem dois campos:

```json
[
  { "Fl": "0.000000", "It": "0" },
  { "Fl": "18.542371", "It": "1" },
  { "Fl": "21.300000", "It": "2" },
  { "Fl": "0.000000", "It": "999" }
]
```

### Campos

| Campo | Tipo | Regex aceito | Descrição |
|---|---|---|---|
| `Fl` | string | `^\d+\.\d+$` | Fluxo em mL/s. Sempre como string com **ponto decimal obrigatório**. |
| `It` | string | `^\d+$` | Índice da amostra (0, 1, 2, ...). String contendo apenas dígitos. |

#### Exemplos válidos para `Fl`
- `"0.000000"`
- `"18.5"`
- `"21.342"`
- `"0.0"`

#### Exemplos inválidos para `Fl` (causam HTTP 422)
| Valor | Motivo |
|---|---|
| `"18"` | Falta o ponto decimal |
| `18.5` | Não é string (é número) |
| `"-3.2"` | Sinal não permitido |
| `"1,5"` | Vírgula em vez de ponto |
| `".5"` | Falta dígito antes do ponto |
| `"5."` | Falta dígito depois do ponto |

### Convenções (não validadas pelo schema, mas necessárias para o exame ser válido)

1. **Amostragem a 10 Hz.** O backend assume que cada índice corresponde a 100 ms (`tempo = It × 0,1s`).
2. **Padding com zeros.** O firmware pode enviar até 1000 leituras. Após o fim real do exame, completar com `{"Fl": "0.000000", "It": "<próximo_índice>"}` até completar.
3. **Sinal de fim do exame: 8 zeros consecutivos** após o primeiro fluxo positivo. O backend trunca o array nesse ponto. Se o paciente tem uma pausa real durante a micção, garantir que ela seja **menor que 8 amostras consecutivas com fluxo zero** — caso contrário o backend vai considerar que o exame terminou ali.
4. **Pelo menos uma leitura precisa ter `Fl > 0`**. Um payload onde todos os fluxos são zero é rejeitado com HTTP 422.

### Exemplo completo (mínimo válido)

```json
[
  { "Fl": "0.000000", "It": "0" },
  { "Fl": "12.500000", "It": "1" },
  { "Fl": "20.300000", "It": "2" },
  { "Fl": "15.100000", "It": "3" },
  { "Fl": "0.000000", "It": "4" },
  { "Fl": "0.000000", "It": "5" },
  { "Fl": "0.000000", "It": "6" },
  { "Fl": "0.000000", "It": "7" },
  { "Fl": "0.000000", "It": "8" },
  { "Fl": "0.000000", "It": "9" },
  { "Fl": "0.000000", "It": "10" },
  { "Fl": "0.000000", "It": "11" }
]
```

(8 zeros após o último fluxo positivo sinalizam o fim.)

---

## 4. Respostas

### 4.1 — `200 OK` (sucesso)

```json
{
  "exameId": "550e8400-e29b-41d4-a716-446655440000",
  "pacienteId": null,
  "status": "orfao"
}
```

| Campo | Tipo | Significado |
|---|---|---|
| `exameId` | string (UUID) | Identificador do exame salvo no banco |
| `pacienteId` | string (UUID) ou `null` | ID do paciente associado, se houver médico aguardando no momento |
| `status` | `"vinculado"` ou `"orfao"` | `"vinculado"` se algum médico estava aguardando dados; `"orfao"` se ninguém estava |

> Para o firmware, `200 OK` significa **sucesso final** — pode descartar o buffer local.

### 4.2 — `422 Validation Error` (payload inválido)

#### 4.2.a — Erro de schema (formato/regex)

```json
{
  "error": "Validation Error",
  "message": "Dados de entrada inválidos",
  "details": {
    "fieldErrors": {
      "0.Fl": ["Fl deve ser numérico com casas decimais"]
    },
    "formErrors": []
  }
}
```

`details.fieldErrors` indica qual item do array e qual campo falharam (`"0.Fl"` = primeiro item, campo `Fl`).

#### 4.2.b — Erro de regra de negócio (sem fluxo positivo)

```json
{
  "error": "Validation Error",
  "message": "Exame inválido: nenhum fluxo positivo detectado",
  "code": "no_positive_flow"
}
```

> Em ambos os casos, **retry não vai resolver** — o payload está errado. O firmware deve registrar o erro e parar de tentar para esse exame.

### 4.3 — `413 Payload Too Large`

Body passou de 1 MB. Reduzir o número de leituras ou limpar campos desnecessários.

### 4.4 — `429 Too Many Requests`

Excedeu 30 requisições/minuto. Aguardar 60s e tentar de novo.

```json
{
  "error": "Too Many Requests",
  "message": "Limite de coletas atingido. Tente novamente em 1 minuto."
}
```

### 4.5 — `500 Internal Server Error`

Erro inesperado no servidor. Em produção a mensagem é genérica:

```json
{
  "error": "Internal Server Error",
  "message": "Erro interno do servidor"
}
```

Retry com backoff faz sentido neste caso.

---

## 5. Exemplos com `curl`

### 5.1 — Caminho feliz

```bash
curl -i -X POST https://api.fluxometriafacil.com.br/api/coleta/dados \
  -H "Content-Type: application/json" \
  -d '[
    {"Fl":"0.000000","It":"0"},
    {"Fl":"15.500000","It":"1"},
    {"Fl":"20.000000","It":"2"},
    {"Fl":"12.000000","It":"3"},
    {"Fl":"0.000000","It":"4"},
    {"Fl":"0.000000","It":"5"},
    {"Fl":"0.000000","It":"6"},
    {"Fl":"0.000000","It":"7"},
    {"Fl":"0.000000","It":"8"},
    {"Fl":"0.000000","It":"9"},
    {"Fl":"0.000000","It":"10"},
    {"Fl":"0.000000","It":"11"}
  ]'
```

Resposta esperada: `200 OK` com `exameId`.

### 5.2 — Payload inválido (testa erro 422 de schema)

```bash
curl -i -X POST https://api.fluxometriafacil.com.br/api/coleta/dados \
  -H "Content-Type: application/json" \
  -d '[{"Fl":"abc","It":"0"}]'
```

Resposta esperada: `422` com `details.fieldErrors["0.Fl"]`.

### 5.3 — Sem fluxo positivo (testa erro 422 de regra)

```bash
curl -i -X POST https://api.fluxometriafacil.com.br/api/coleta/dados \
  -H "Content-Type: application/json" \
  -d '[{"Fl":"0.0","It":"0"},{"Fl":"0.0","It":"1"}]'
```

Resposta esperada: `422` com `code: "no_positive_flow"`.

### 5.4 — Health check

```bash
curl https://api.fluxometriafacil.com.br/api/health
```

Resposta esperada: `{"status":"ok","timestamp":"...","version":"1.0.0"}`. Útil para verificar conectividade durante boot do ESP32.

---

## 6. Pseudo-código de referência (Arduino/ESP32)

Bibliotecas: `WiFi.h`, `HTTPClient.h`, `ArduinoJson` (v6+).

```cpp
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

const char* BACKEND_URL = "https://api.fluxometriafacil.com.br/api/coleta/dados";

// Buffer das leituras coletadas em memória (até 1000 amostras)
struct Leitura { float fluxo; uint16_t indice; };
Leitura buffer[1000];
size_t leiturasColetadas = 0;

// Monta JSON e envia. Retorna o status HTTP (ou -1 em erro de rede).
int enviarExame() {
  // Capacidade conservadora: 1000 itens × ~50 bytes/item + overhead
  DynamicJsonDocument doc(64 * 1024);
  JsonArray arr = doc.to<JsonArray>();

  for (size_t i = 0; i < leiturasColetadas; i++) {
    JsonObject item = arr.createNestedObject();
    char flStr[16];
    snprintf(flStr, sizeof(flStr), "%.6f", buffer[i].fluxo); // sempre com ponto decimal
    item["Fl"] = flStr;

    char itStr[8];
    snprintf(itStr, sizeof(itStr), "%u", buffer[i].indice);
    item["It"] = itStr;
  }

  String payload;
  serializeJson(doc, payload);

  HTTPClient http;
  http.begin(BACKEND_URL);
  http.addHeader("Content-Type", "application/json");
  http.setTimeout(30000); // 30s

  int statusCode = http.POST(payload);
  String response = http.getString();
  http.end();

  Serial.printf("HTTP %d | resposta: %s\n", statusCode, response.c_str());
  return statusCode;
}

// Pseudo-loop de envio com retry
void enviarComRetry() {
  const int delays[] = {0, 1000, 5000, 30000, 120000}; // 0s, 1s, 5s, 30s, 2min
  bool jaEnviado = false;

  for (int tentativa = 0; tentativa < 5 && !jaEnviado; tentativa++) {
    delay(delays[tentativa]);

    int status = enviarExame();

    if (status == 200) {
      Serial.println("Exame enviado com sucesso.");
      leiturasColetadas = 0; // limpa buffer
      jaEnviado = true;
    } else if (status == 422 || status == 413) {
      Serial.println("Payload rejeitado pelo servidor — não retentar.");
      // logar internamente, não tentar de novo
      break;
    } else if (status == 429) {
      Serial.println("Rate limit — aguardando 60s.");
      delay(60000);
    } else {
      Serial.println("Erro 5xx ou rede — vai retentar com backoff.");
    }
  }
}
```

---

## 7. Política de retry recomendada

| Status HTTP recebido | Ação |
|---|---|
| `200` | Sucesso — descartar buffer local. **Não retentar.** |
| `422` | Payload errado — **não retentar**, logar erro local. |
| `413` | Body muito grande — **não retentar**, reduzir/limpar leituras. |
| `429` | Aguardar 60s, retentar. |
| `5xx` | Backoff exponencial: 1s → 5s → 30s → 2min. Máximo de 4-5 tentativas. |
| Sem resposta (timeout/rede) | Mesmo backoff de 5xx. |

### Atenção: o backend NÃO detecta duplicatas

Se o ESP32 enviar o exame, o servidor processar com sucesso, mas a resposta HTTP não chegar (timeout no firmware), um retry vai criar **um exame duplicado** no banco.

**Mitigação no firmware:** só retentar quando **nenhuma resposta HTTP foi recebida**. Se chegou qualquer status code (mesmo um 5xx), considerar que o servidor processou ou está ciente — **não retentar nesse caso**.

---

## 8. Limites e checklist de pré-produção

### Limites

| Limite | Valor |
|---|---|
| Itens no array | 1 a 1000 |
| Tamanho do body | ≤ 1 MB |
| Requisições por IP | 30/minuto |
| Timeout HTTP recomendado no firmware | 30s |

### Checklist antes de embarcar em campo

- [ ] Validar localmente que `Fl` é serializado **sempre com ponto decimal** (`%.6f` em `snprintf`)
- [ ] Validar localmente que `It` é string contendo só dígitos (sem zeros à esquerda desnecessários — apenas `"0"` literal)
- [ ] Testar payload válido contra `/api/health` e `/api/coleta/dados` com sucesso
- [ ] Testar 1 caso de payload inválido e confirmar que o firmware **não** entra em loop de retry
- [ ] Testar perda de Wi-Fi durante envio: confirmar que o buffer não é descartado antes do `200 OK`
- [ ] Confirmar que o relógio do ESP32 está sincronizado (NTP) — não é exigido pelo backend, mas ajuda no debugging
- [ ] Confirmar que o certificado HTTPS do servidor é aceito pelo `WiFiClientSecure` (raiz CA atualizada)
- [ ] Logar localmente: timestamp do envio, status HTTP, primeiros 200 chars da resposta — facilita diagnóstico em campo

---

## 9. Suporte

Em caso de comportamento inesperado:
- Ler o status HTTP e o body completo da resposta — eles indicam exatamente o que o servidor entendeu.
- Para erros 5xx persistentes: contatar o time de backend com o `exameId` (se houver) ou o timestamp aproximado da requisição.
- Para erros 422: o `details.fieldErrors` ou o `code` indica o problema — corrigir no firmware antes de retentar.
