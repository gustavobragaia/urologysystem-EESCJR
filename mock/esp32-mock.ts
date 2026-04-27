const URL_BACKEND = process.env.BACKEND_URL ?? 'http://localhost:3000';
const ENDPOINT = `${URL_BACKEND}/api/coleta/dados`;

// Gera curva realista de urofluxometria:
// pré-micção → subida senoidal → pico → descida exponencial → 8 zeros → padding até 1000
function gerarCurva(): Array<{ Fl: string; It: string }> {
  const leituras: Array<{ Fl: string; It: string }> = [];
  let indice = 0;

  // Pré-micção: 10 zeros
  for (let i = 0; i < 10; i++) {
    leituras.push({ Fl: '0.000000', It: String(indice++) });
  }

  const pico = 18 + Math.random() * 7;
  const passosSubida = 30 + Math.floor(Math.random() * 20);
  const totalLeituras = 200 + Math.floor(Math.random() * 150);
  const passosDescida = totalLeituras - passosSubida;

  // Subida (curva em senoide)
  for (let i = 0; i < passosSubida; i++) {
    const t = i / passosSubida;
    const fluxo = pico * Math.sin((Math.PI / 2) * t);
    const ruido = (Math.random() - 0.5) * 1.5;
    leituras.push({ Fl: Math.max(0, fluxo + ruido).toFixed(6), It: String(indice++) });
  }

  // Descida (decaimento exponencial)
  for (let i = 0; i < passosDescida; i++) {
    const t = i / passosDescida;
    const fluxo = pico * Math.exp(-2.5 * t);
    const ruido = (Math.random() - 0.5) * 1.0;
    leituras.push({ Fl: Math.max(0, fluxo + ruido).toFixed(6), It: String(indice++) });
  }

  // Sinal de término: 8 zeros
  for (let i = 0; i < 8; i++) {
    leituras.push({ Fl: '0.000000', It: String(indice++) });
  }

  // Padding até 1000 posições
  while (leituras.length < 1000) {
    leituras.push({ Fl: '0.000000', It: String(indice++) });
  }

  return leituras;
}

async function main() {
  const curva = gerarCurva();
  console.log(`📡 Enviando ${curva.length} leituras para ${ENDPOINT}...`);

  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(curva),
    });
    const data = await res.json();
    console.log(`✅ Resposta (${res.status}):`, data);
  } catch (err) {
    console.error('❌ Erro:', err);
    process.exit(1);
  }
}

main();
