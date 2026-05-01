import type { Response } from 'express';

interface SSESession {
  res: Response;
  medicoId: string;
  pacienteId: string;
  iniciadoEm: Date;
  pingInterval: NodeJS.Timeout;
}

// Map global em memória — single-process obrigatório (nunca usar PM2 cluster ou Docker replicas)
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
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  // Evento inicial para confirmar ao frontend
  enviarEvento(res, 'aguardando', { pacienteId });

  // Ping de keepalive a cada 30s
  const pingInterval = setInterval(() => {
    try { res.write(': ping\n\n'); } catch {}
  }, PING_INTERVAL_MS);

  // Timeout absoluto de 10 min
  const timeoutId = setTimeout(() => {
    enviarEvento(res, 'timeout', { mensagem: 'Sessão expirada após 10 minutos' });
    finalizarSessao(pacienteId);
  }, TIMEOUT_MS);

  sessoes.set(pacienteId, { res, medicoId, pacienteId, iniciadoEm: new Date(), pingInterval });

  console.log(`[SSE] Sessão registrada — pacienteId: ${pacienteId}, total ativo: ${sessoes.size}`);

  // Cleanup quando o cliente desconecta.
  // Guarda referência local a 'res' para evitar race condition:
  // se uma nova sessão for registrada antes deste close disparar,
  // não deletamos a nova sessão.
  res.on('close', () => {
    clearTimeout(timeoutId);
    const sessaoAtual = sessoes.get(pacienteId);
    if (sessaoAtual && sessaoAtual.res === res) {
      finalizarSessao(pacienteId);
      console.log(`[SSE] Sessão encerrada — pacienteId: ${pacienteId}`);
    }
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

export function obterSessao(pacienteId: string): SSESession | undefined {
  return sessoes.get(pacienteId);
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
  try {
    res.write(`event: ${evento}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  } catch {}
}
