import PDFDocument from 'pdfkit';
import { ChartJSNodeCanvas } from 'chartjs-node-canvas';
import { createCanvas, loadImage } from 'canvas';
import path from 'path';
import type { Response } from 'express';

interface ExamePdf {
  id: string;
  dataExame: Date;
  fluxoMaximo: number;
  fluxoMedio: number;
  volumeMiccao: number;
  tempoAteFluxoMax: number;
  tempoTotalMiccao: number;
  volumeResidual: number | null;
}

interface PacientePdf {
  nome: string;
  dataNascimento: string;
  sexo: 'M' | 'F' | 'Outro';
  cpf: string | null;
}

interface LeituraPdf {
  indice: number;
  fluxo: number;
}

const chartCanvas = new ChartJSNodeCanvas({ width: 960, height: 520, backgroundColour: 'white' });

// Aspect ratio of chart: 960/520 ≈ 1.846. At width 515 → height ≈ 279.
const CHART_RENDER_W = 515;
const CHART_RENDER_H = Math.round(CHART_RENDER_W * (520 / 960));

const LOGO_PATH = path.join(process.cwd(), 'assets', 'logo.svg');
const HEADER_H = 72;
const PAGE_W = 515; // A4 usable width (595 - 2*40 margins)

async function renderizarHeaderPdf(): Promise<Buffer> {
  const SCALE = 2; // 2x resolution for crisp rendering
  const canvasW = PAGE_W * SCALE;
  const canvasH = HEADER_H * SCALE;
  const canvas = createCanvas(canvasW, canvasH);
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#193667';
  ctx.fillRect(0, 0, canvasW, canvasH);

  try {
    const img = await loadImage(LOGO_PATH);
    const nativeW = 281, nativeH = 66;
    const logoH = canvasH - 16 * SCALE;
    const logoW = (nativeW / nativeH) * logoH;
    const logoX = (canvasW - logoW) / 2;
    const logoY = (canvasH - logoH) / 2;
    ctx.drawImage(img, logoX, logoY, logoW, logoH);
  } catch {
    // Fallback: white text if SVG rendering is unavailable locally
    ctx.fillStyle = '#FFFFFF';
    ctx.font = `bold ${15 * SCALE}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Dr. Rômulo Nunes — Urofluxometria', canvasW / 2, canvasH / 2);
  }

  return canvas.toBuffer('image/png');
}

async function renderizarGrafico(leiturasArr: LeituraPdf[]): Promise<Buffer> {
  const tempos = leiturasArr.map(l => (l.indice * 0.1).toFixed(1));
  const fluxos = leiturasArr.map(l => l.fluxo);

  let acumulado = 0;
  const volumes = fluxos.map(f => {
    acumulado += f * 0.1;
    return parseFloat(acumulado.toFixed(2));
  });

  return await chartCanvas.renderToBuffer({
    type: 'line',
    data: {
      labels: tempos,
      datasets: [
        {
          label: 'Fluxo (mL/s)',
          data: fluxos,
          borderColor: '#E54C38',
          backgroundColor: 'transparent',
          yAxisID: 'y1',
          tension: 0.3,
          pointRadius: 0,
          borderWidth: 2,
        },
        {
          label: 'Volume acumulado (mL)',
          data: volumes,
          borderColor: '#0067CD',
          backgroundColor: 'transparent',
          yAxisID: 'y2',
          tension: 0.3,
          pointRadius: 0,
          borderWidth: 2,
        },
      ],
    },
    options: {
      animation: false,
      plugins: {
        legend: { display: true, position: 'top' },
      },
      scales: {
        x: {
          title: { display: true, text: 'Tempo (s)', font: { size: 12 } },
          ticks: { maxTicksLimit: 15 },
        },
        y1: {
          type: 'linear',
          position: 'left',
          title: { display: true, text: 'Fluxo (mL/s)', font: { size: 12 } },
          min: 0,
        },
        y2: {
          type: 'linear',
          position: 'right',
          title: { display: true, text: 'Volume (mL)', font: { size: 12 } },
          min: 0,
          grid: { drawOnChartArea: false },
        },
      },
    },
  } as any);
}

function formatarData(dateStr: string): string {
  const [year, month, day] = dateStr.split('-');
  return `${day}/${month}/${year}`;
}

function formatarDataHora(date: Date): string {
  return date.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
}

function calcularIdade(dataNascimento: string): number {
  const hoje = new Date();
  const nasc = new Date(dataNascimento);
  let idade = hoje.getFullYear() - nasc.getFullYear();
  const m = hoje.getMonth() - nasc.getMonth();
  if (m < 0 || (m === 0 && hoje.getDate() < nasc.getDate())) idade--;
  return idade;
}

function desenharTabelaMetricas(doc: typeof PDFDocument.prototype, exame: ExamePdf): void {
  const metricas = [
    { label: 'Fluxo Máximo (Qmax)',    valor: `${exame.fluxoMaximo} mL/s`,   referencia: '15 – 50 mL/s' },
    { label: 'Fluxo Médio (Qavg)',     valor: `${exame.fluxoMedio} mL/s`,    referencia: '10 – 25 mL/s' },
    { label: 'Volume de Micção',       valor: `${exame.volumeMiccao} mL`,    referencia: '150 – 500 mL' },
    { label: 'Tempo até Fluxo Máximo', valor: `${exame.tempoAteFluxoMax} s`, referencia: '3 – 10 s' },
    { label: 'Tempo Total de Micção',  valor: `${exame.tempoTotalMiccao} s`, referencia: '15 – 40 s' },
    {
      label: 'Volume Residual',
      valor: exame.volumeResidual != null ? `${exame.volumeResidual} mL` : 'Não medido',
      referencia: '< 50 mL',
    },
  ];

  const startX = 40;
  const colWidths = [220, 130, 165];
  const rowHeight = 22;
  const headerBg = '#193667';
  const altBg = '#f7f8f9';

  // Cabeçalho
  doc.rect(startX, doc.y, colWidths[0] + colWidths[1] + colWidths[2], rowHeight).fill(headerBg);
  doc.fillColor('#FFFFFF').fontSize(10).font('Helvetica-Bold');
  const headerY = doc.y + 6;
  doc.text('Métrica', startX + 4, headerY, { width: colWidths[0] });
  doc.text('Valor', startX + colWidths[0] + 4, headerY, { width: colWidths[1] });
  doc.text('Faixa de Referência', startX + colWidths[0] + colWidths[1] + 4, headerY, { width: colWidths[2] });
  doc.y = headerY + rowHeight - 6;
  doc.moveDown(0.5);

  metricas.forEach((m, i) => {
    const rowY = doc.y;
    const bg = i % 2 === 0 ? '#FFFFFF' : altBg;
    doc.rect(startX, rowY, colWidths[0] + colWidths[1] + colWidths[2], rowHeight).fill(bg);
    doc.fillColor('#38464B').fontSize(10).font('Helvetica');
    const textY = rowY + 6;
    doc.text(m.label, startX + 4, textY, { width: colWidths[0] });
    doc.text(m.valor, startX + colWidths[0] + 4, textY, { width: colWidths[1] });
    doc.text(m.referencia, startX + colWidths[0] + colWidths[1] + 4, textY, { width: colWidths[2] });

    doc.strokeColor('#dfe2e5').lineWidth(0.5)
      .rect(startX, rowY, colWidths[0] + colWidths[1] + colWidths[2], rowHeight).stroke();
    doc.y = rowY + rowHeight;
  });
}

export async function gerarPdfExame(
  exame: ExamePdf,
  paciente: PacientePdf | null,
  leiturasArr: LeituraPdf[],
  res: Response,
  download: boolean
): Promise<void> {
  const filename = `exame_${exame.id}.pdf`;
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader(
    'Content-Disposition',
    `${download ? 'attachment' : 'inline'}; filename="${filename}"`
  );

  const doc = new PDFDocument({ size: 'A4', margin: 40 });
  doc.pipe(res);

  // ── Header com logo ──────────────────────────────────────────────────────
  const headerBuffer = await renderizarHeaderPdf();
  doc.image(headerBuffer, 40, 40, { width: PAGE_W });
  doc.y = 40 + HEADER_H + 12;

  doc.strokeColor('#dfe2e5').lineWidth(1).moveTo(40, doc.y).lineTo(555, doc.y).stroke();
  doc.moveDown(0.5);

  // ── Título ───────────────────────────────────────────────────────────────
  doc.fontSize(16).fillColor('#232429').font('Helvetica-Bold')
    .text('RELATÓRIO DE UROFLUXOMETRIA', { align: 'center' });
  doc.moveDown(0.8);

  // ── Dados do paciente ────────────────────────────────────────────────────
  doc.fontSize(11).fillColor('#38464B').font('Helvetica');
  if (paciente) {
    doc.text(`Paciente: ${paciente.nome}`);
    doc.text(`Data de nascimento: ${formatarData(paciente.dataNascimento)} (${calcularIdade(paciente.dataNascimento)} anos)`);
    doc.text(`Sexo: ${paciente.sexo === 'M' ? 'Masculino' : paciente.sexo === 'F' ? 'Feminino' : 'Outro'}`);
    if (paciente.cpf) doc.text(`CPF: ${paciente.cpf}`);
  } else {
    doc.text('Paciente: Não vinculado');
  }
  doc.text(`Data do exame: ${formatarDataHora(exame.dataExame)}`);
  doc.moveDown(0.8);

  doc.strokeColor('#dfe2e5').lineWidth(1).moveTo(40, doc.y).lineTo(555, doc.y).stroke();
  doc.moveDown(0.5);

  // ── Gráfico ──────────────────────────────────────────────────────────────
  doc.fontSize(11).fillColor('#232429').font('Helvetica-Bold')
    .text('CURVA DE FLUXO × TEMPO', { align: 'center' });
  doc.moveDown(0.5);

  if (leiturasArr.length > 0) {
    const chartBuffer = await renderizarGrafico(leiturasArr);
    const imageY = doc.y;
    doc.image(chartBuffer, 40, imageY, { width: CHART_RENDER_W });
    // Avança explicitamente além da imagem para evitar sobreposição
    doc.y = imageY + CHART_RENDER_H + 12;
  }

  doc.strokeColor('#dfe2e5').lineWidth(1).moveTo(40, doc.y).lineTo(555, doc.y).stroke();
  doc.moveDown(0.5);

  // ── Métricas ─────────────────────────────────────────────────────────────
  doc.fontSize(11).fillColor('#232429').font('Helvetica-Bold').text('MÉTRICAS');
  doc.moveDown(0.5);
  desenharTabelaMetricas(doc, exame);

  doc.moveDown(0.8);
  doc.strokeColor('#dfe2e5').lineWidth(1).moveTo(40, doc.y).lineTo(555, doc.y).stroke();
  doc.moveDown(0.5);

  // ── Observações ──────────────────────────────────────────────────────────
  doc.fontSize(9).fillColor('#6c757d').font('Helvetica')
    .text(
      'Observações: Os valores são apresentados com referência para auxílio diagnóstico. ' +
      'A interpretação clínica é responsabilidade exclusiva do médico examinador.',
      { align: 'justify' }
    );

  // ── Footer ───────────────────────────────────────────────────────────────
  doc.moveDown(2);
  doc.fontSize(8).fillColor('#6c757d')
    .text(`Gerado em ${formatarDataHora(new Date())}`, { align: 'center' });

  doc.end();
}
