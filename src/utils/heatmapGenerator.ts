/**
 * PROTÁTICA — Tactical Football Pitch & Heatmap Generator
 * Produces crisp, high-resolution visual heatmaps for Telegram & Reports.
 */

export function generateHeatmapDataUrl(analysis: any): string {
  if (typeof document === 'undefined') {
    // If running in non-browser environment, return fallback data URL or empty
    return '';
  }

  const canvas = document.createElement('canvas');
  canvas.width = 1200;
  canvas.height = 750;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  const timeA = (analysis.timeA || 'Time A').trim();
  const timeB = (analysis.timeB || 'Time B').trim();
  const placar = analysis.placar && analysis.placar !== 'não identificado' ? ` (${analysis.placar})` : '';
  const mc = analysis.estatisticas?.mapaDeCalor || {};

  const parsePercent = (val?: string) => {
    if (!val) return 33;
    const num = parseFloat(String(val).replace('%', ''));
    return Number.isNaN(num) ? 33 : num;
  };

  const defA = parsePercent(mc.timeA?.tercoDefensivo);
  const medA = parsePercent(mc.timeA?.tercoMedio);
  const ofA = parsePercent(mc.timeA?.tercoOfensivo);

  const defB = parsePercent(mc.timeB?.tercoDefensivo);
  const medB = parsePercent(mc.timeB?.tercoMedio);
  const ofB = parsePercent(mc.timeB?.tercoOfensivo);

  // 1. Dark Gradient Background
  const bgGrad = ctx.createLinearGradient(0, 0, 1200, 750);
  bgGrad.addColorStop(0, '#120000');
  bgGrad.addColorStop(0.5, '#1e0101');
  bgGrad.addColorStop(1, '#0a0000');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, 1200, 750);

  // 2. Top Header Banner
  ctx.fillStyle = '#eab308';
  ctx.font = 'bold 26px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('⚽ PROTÁTICA | MAPA DE CALOR TÁTICO', 600, 48);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText(`${timeA} vs ${timeB}${placar}`, 600, 82);

  const ctxInfo = analysis.contextoPartida || {};
  const metaText = [
    ctxInfo.competicao && ctxInfo.competicao !== 'Não identificada' ? ctxInfo.competicao : null,
    ctxInfo.estadio && ctxInfo.estadio !== 'Não identificado' ? ctxInfo.estadio : null,
    ctxInfo.dataJogo && ctxInfo.dataJogo !== 'Não identificada' ? ctxInfo.dataJogo : null,
  ].filter(Boolean).join(' • ');

  if (metaText) {
    ctx.fillStyle = 'rgba(254, 240, 138, 0.7)';
    ctx.font = '14px sans-serif';
    ctx.fillText(metaText, 600, 108);
  }

  // 3. Pitch Coordinates
  const pitchX = 80;
  const pitchY = 130;
  const pitchW = 1040;
  const pitchH = 480;

  // Grass Pitch Background
  const grassGrad = ctx.createLinearGradient(pitchX, pitchY, pitchX + pitchW, pitchY);
  grassGrad.addColorStop(0, '#0c2411');
  grassGrad.addColorStop(0.5, '#0f3318');
  grassGrad.addColorStop(1, '#0c2411');
  ctx.fillStyle = grassGrad;
  ctx.fillRect(pitchX, pitchY, pitchW, pitchH);

  // Thirds Dimensions
  const thirdW = pitchW / 3;

  // Render Time A Heat Overlay (Gold/Yellow) - Top Half of Thirds
  const halfH = pitchH / 2;
  const opDefA = Math.min(0.85, Math.max(0.2, defA / 100));
  const opMedA = Math.min(0.85, Math.max(0.2, medA / 100));
  const opOfA = Math.min(0.85, Math.max(0.2, ofA / 100));

  ctx.fillStyle = `rgba(250, 204, 21, ${opDefA})`;
  ctx.fillRect(pitchX, pitchY, thirdW, halfH);

  ctx.fillStyle = `rgba(250, 204, 21, ${opMedA})`;
  ctx.fillRect(pitchX + thirdW, pitchY, thirdW, halfH);

  ctx.fillStyle = `rgba(250, 204, 21, ${opOfA})`;
  ctx.fillRect(pitchX + thirdW * 2, pitchY, thirdW, halfH);

  // Render Time B Heat Overlay (Red/Crimson) - Bottom Half of Thirds
  const opDefB = Math.min(0.85, Math.max(0.2, defB / 100));
  const opMedB = Math.min(0.85, Math.max(0.2, medB / 100));
  const opOfB = Math.min(0.85, Math.max(0.2, ofB / 100));

  ctx.fillStyle = `rgba(239, 68, 68, ${opDefB})`;
  ctx.fillRect(pitchX, pitchY + halfH, thirdW, halfH);

  ctx.fillStyle = `rgba(239, 68, 68, ${opMedB})`;
  ctx.fillRect(pitchX + thirdW, pitchY + halfH, thirdW, halfH);

  ctx.fillStyle = `rgba(239, 68, 68, ${opOfB})`;
  ctx.fillRect(pitchX + thirdW * 2, pitchY + halfH, thirdW, halfH);

  // Horizontal divider between Team A and Team B sections
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(pitchX, pitchY + halfH);
  ctx.lineTo(pitchX + pitchW, pitchY + halfH);
  ctx.stroke();
  ctx.setLineDash([]);

  // 4. Draw Pitch Markings (White Lines)
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
  ctx.lineWidth = 2;

  // Outer Border
  ctx.strokeRect(pitchX, pitchY, pitchW, pitchH);

  // Halfway line
  ctx.beginPath();
  ctx.moveTo(pitchX + pitchW / 2, pitchY);
  ctx.lineTo(pitchX + pitchW / 2, pitchY + pitchH);
  ctx.stroke();

  // Center Circle
  ctx.beginPath();
  ctx.arc(pitchX + pitchW / 2, pitchY + pitchH / 2, 70, 0, Math.PI * 2);
  ctx.stroke();

  // Center Spot
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(pitchX + pitchW / 2, pitchY + pitchH / 2, 4, 0, Math.PI * 2);
  ctx.fill();

  // Left Penalty Box
  ctx.strokeRect(pitchX, pitchY + (pitchH - 240) / 2, 140, 240);
  // Left 6-Yard Box
  ctx.strokeRect(pitchX, pitchY + (pitchH - 120) / 2, 50, 120);
  // Left Penalty Spot
  ctx.beginPath();
  ctx.arc(pitchX + 100, pitchY + pitchH / 2, 4, 0, Math.PI * 2);
  ctx.fill();

  // Right Penalty Box
  ctx.strokeRect(pitchX + pitchW - 140, pitchY + (pitchH - 240) / 2, 140, 240);
  // Right 6-Yard Box
  ctx.strokeRect(pitchX + pitchW - 50, pitchY + (pitchH - 120) / 2, 50, 120);
  // Right Penalty Spot
  ctx.beginPath();
  ctx.arc(pitchX + pitchW - 100, pitchY + pitchH / 2, 4, 0, Math.PI * 2);
  ctx.fill();

  // Vertical Thirds Dotted Lines
  ctx.strokeStyle = 'rgba(254, 240, 138, 0.6)';
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 6]);
  ctx.beginPath();
  ctx.moveTo(pitchX + thirdW, pitchY);
  ctx.lineTo(pitchX + thirdW, pitchY + pitchH);
  ctx.moveTo(pitchX + thirdW * 2, pitchY);
  ctx.lineTo(pitchX + thirdW * 2, pitchY + pitchH);
  ctx.stroke();
  ctx.setLineDash([]);

  // 5. Labels and Percentages on Pitch
  ctx.textAlign = 'center';

  // Team A Labels (Top Half)
  ctx.fillStyle = '#fef08a';
  ctx.font = 'bold 15px sans-serif';
  ctx.fillText(`🟡 ${timeA}`, pitchX + 120, pitchY + 28);

  ctx.font = 'bold 28px sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(`${mc.timeA?.tercoDefensivo || defA + '%'}`, pitchX + thirdW / 2, pitchY + halfH / 2 + 10);
  ctx.fillText(`${mc.timeA?.tercoMedio || medA + '%'}`, pitchX + thirdW + thirdW / 2, pitchY + halfH / 2 + 10);
  ctx.fillText(`${mc.timeA?.tercoOfensivo || ofA + '%'}`, pitchX + thirdW * 2 + thirdW / 2, pitchY + halfH / 2 + 10);

  // Team B Labels (Bottom Half)
  ctx.fillStyle = '#fca5a5';
  ctx.font = 'bold 15px sans-serif';
  ctx.fillText(`🔴 ${timeB}`, pitchX + 120, pitchY + halfH + 30);

  ctx.font = 'bold 28px sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(`${mc.timeB?.tercoDefensivo || defB + '%'}`, pitchX + thirdW / 2, pitchY + halfH + halfH / 2 + 10);
  ctx.fillText(`${mc.timeB?.tercoMedio || medB + '%'}`, pitchX + thirdW + thirdW / 2, pitchY + halfH + halfH / 2 + 10);
  ctx.fillText(`${mc.timeB?.tercoOfensivo || ofB + '%'}`, pitchX + thirdW * 2 + thirdW / 2, pitchY + halfH + halfH / 2 + 10);

  // 6. Bottom Labels for Thirds
  ctx.fillStyle = 'rgba(254, 240, 138, 0.9)';
  ctx.font = 'bold 16px sans-serif';
  ctx.fillText('TERÇO DEFENSIVO', pitchX + thirdW / 2, pitchY + pitchH + 30);
  ctx.fillText('TERÇO MÉDIO (CONSTRUÇÃO)', pitchX + thirdW + thirdW / 2, pitchY + pitchH + 30);
  ctx.fillText('TERÇO OFENSIVO (FINALIZAÇÃO)', pitchX + thirdW * 2 + thirdW / 2, pitchY + pitchH + 30);

  // 7. Footer Watermark & Source
  ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.font = '13px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('PROTÁTICA • Inteligência e Auditoria Tática', 80, 715);

  ctx.textAlign = 'right';
  ctx.fillText('Transmissão Oficial Telegram', 1120, 715);

  return canvas.toDataURL('image/png');
}
