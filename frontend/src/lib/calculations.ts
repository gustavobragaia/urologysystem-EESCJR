export function calcularVolumeAcumulado(fluxos: number[], intervaloS = 0.1): number[] {
  const acumulado: number[] = [];
  let total = 0;
  for (const f of fluxos) {
    total += f * intervaloS;
    acumulado.push(parseFloat(total.toFixed(2)));
  }
  return acumulado;
}
