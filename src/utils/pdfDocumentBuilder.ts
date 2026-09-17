import jsPDF from 'jspdf';
import type { Analysis } from '../types';

/**
 * Remove caracteres inválidos, acentos e caracteres de controle para gerar um nome de arquivo seguro.
 */
export function sanitizeFilename(name: string): string {
  if (!name) return 'ProTatica_Relatorio.pdf';
  let clean = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove diacríticos / acentos
    .replace(/[^a-zA-Z0-9_\-\.]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
  if (!clean.toLowerCase().endsWith('.pdf')) {
    clean += '.pdf';
  }
  return clean || 'ProTatica_Relatorio.pdf';
}

/**
 * Sanitiza o texto para fontes padrão Type1 do jsPDF (Helvetica).
 * Remove emojis, surrogate pairs e caracteres fora da tabela Latin-1/WinAnsi,
 * prevenindo que o renderizador de PDF (ex: Chrome/PDFium) falhe ao carregar o documento.
 */
export function cleanPdfText(text: string | null | undefined): string {
  if (!text) return '';
  return String(text)
    // Remove emojis e pares de substitutos Unicode
    .replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, '')
    .replace(/[\u2600-\u27BF\uE000-\uF8FF\uFE00-\uFE0F]/g, '')
    // Converte aspas especiais e travessões em equivalentes seguros
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/[\u2022\u2023]/g, '•')
    // Normaliza quebras de linha
    .replace(/\r\n/g, '\n')
    // Remove caracteres de controle estranhos, preservando acentos latinos e quebras de linha
    .replace(/[^\x20-\x7E\xA0-\xFF\n\t]/g, '')
    .trim();
}

/**
 * Gera o nome padrão do arquivo PDF para a análise.
 * Exemplo: ProTatica_Flamengo_x_Cruzeiro_2026.pdf
 */
export function getAnalysisPdfFilename(analysis: Partial<Analysis>): string {
  const timeA = (analysis.timeA || 'Time_A').trim();
  const timeB = (analysis.timeB || 'Time_B').trim();
  const temporada = analysis.contextoPartida?.temporada;
  const cleanSeason = temporada && temporada !== 'Não identificada' ? `_${temporada.replace(/[^a-zA-Z0-9]/g, '_')}` : '';
  const raw = `ProTatica_${timeA}_x_${timeB}${cleanSeason}.pdf`;
  return sanitizeFilename(raw);
}

/**
 * Construtor central do documento PDF ProTática usando jsPDF.
 * Compatível tanto com ambiente Node.js (backend) quanto Navegador (frontend).
 */
export function buildAnalysisPdfDocument(analysis: Analysis): {
  doc: jsPDF;
  filename: string;
  buffer: Buffer;
  size: number;
  base64: string;
} {
  if (!analysis) {
    throw new Error('Objeto de análise não fornecido para compilação do PDF.');
  }

  const timeA = cleanPdfText(analysis.timeA || 'Time A');
  const timeB = cleanPdfText(analysis.timeB || 'Time B');
  const placar = analysis.placar && analysis.placar !== 'não identificado' && analysis.placar !== 'Não identificado' ? cleanPdfText(analysis.placar) : '';
  const ctxInfo = analysis.contextoPartida || {};
  const filename = getAnalysisPdfFilename(analysis);

  const jsPdfCtor = typeof jsPDF === 'function' ? jsPDF : (jsPDF as any).default || (jsPDF as any).jsPDF;
  const doc = new jsPdfCtor({
    orientation: 'p',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;
  let cursorY = margin;

  // Pintor de fundo escuro seguro (RGB nativo, sem oklab)
  const paintBackground = () => {
    doc.setFillColor(18, 0, 0); // Deep Crimson/Black
    doc.rect(0, 0, pageWidth, pageHeight, 'F');
  };

  // Pintor de cabeçalho
  const paintHeader = (pageNum: number) => {
    paintBackground();
    
    // Top Gold Bar
    doc.setFillColor(234, 179, 8);
    doc.rect(0, 0, pageWidth, 4, 'F');

    // Title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(234, 179, 8);
    doc.text('PROTÁTICA | RELATÓRIO DE INTELIGÊNCIA TÁTICA', margin, 14);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(254, 240, 138);
    doc.text('Departamento de Análise de Desempenho, Scouting e Auditoria', margin, 19);

    // Page number
    doc.setFontSize(8);
    doc.setTextColor(161, 161, 170);
    doc.text(`Página ${pageNum}`, pageWidth - margin, 14, { align: 'right' });

    // Header divider line
    doc.setDrawColor(88, 28, 12);
    doc.setLineWidth(0.5);
    doc.line(margin, 22, pageWidth - margin, 22);

    cursorY = 28;
  };

  let currentPage = 1;
  paintHeader(currentPage);

  const checkPageBreak = (neededHeight: number) => {
    if (cursorY + neededHeight > pageHeight - margin - 8) {
      doc.addPage();
      currentPage++;
      paintHeader(currentPage);
    }
  };

  // --- 1. MATCH HERO BANNER (IDENTIFICAÇÃO DA PARTIDA) ---
  doc.setFillColor(42, 1, 1);
  doc.setDrawColor(234, 179, 8);
  doc.setLineWidth(0.3);
  doc.roundedRect(margin, cursorY, contentWidth, 24, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(255, 255, 255);
  doc.text(`${timeA}  ${placar ? `${placar}` : 'x'}  ${timeB}`, margin + contentWidth / 2, cursorY + 9, { align: 'center' });

  const metaParts: string[] = [];
  if (ctxInfo.competicao && ctxInfo.competicao !== 'Não identificada') metaParts.push(`Comp: ${cleanPdfText(ctxInfo.competicao)}`);
  if (ctxInfo.temporada && ctxInfo.temporada !== 'Não identificada') metaParts.push(`Temp: ${cleanPdfText(ctxInfo.temporada)}`);
  if (ctxInfo.dataJogo && ctxInfo.dataJogo !== 'Não identificada') metaParts.push(`Data: ${cleanPdfText(ctxInfo.dataJogo)}`);
  if (ctxInfo.estadio && ctxInfo.estadio !== 'Não identificado') metaParts.push(`Estádio: ${cleanPdfText(ctxInfo.estadio)}`);
  if (ctxInfo.cidade && ctxInfo.cidade !== 'Não identificada') metaParts.push(cleanPdfText(ctxInfo.cidade));

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(254, 240, 138);
  doc.text(metaParts.join('  |  ') || 'Partida Auditada via ProTática V3', margin + contentWidth / 2, cursorY + 17, { align: 'center' });

  cursorY += 30;

  // --- 2. RESUMO GERAL DA PARTIDA ---
  const cleanedResumo = cleanPdfText(analysis.resumoPartida);
  if (cleanedResumo) {
    checkPageBreak(30);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(234, 179, 8);
    doc.text('[1] RESUMO GERAL DA PARTIDA', margin, cursorY);
    cursorY += 5;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(228, 228, 231);
    const splitSummary = doc.splitTextToSize(cleanedResumo, contentWidth);
    doc.text(splitSummary, margin, cursorY);
    cursorY += splitSummary.length * 4.2 + 6;
  }

  // --- 3. MOMENTOS-CHAVE DA PARTIDA ---
  const cleanedMoments = cleanPdfText(analysis.momentosChave);
  if (cleanedMoments && cleanedMoments !== 'Nenhum momento-chave registrado.') {
    checkPageBreak(25);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(234, 179, 8);
    doc.text('[2] MOMENTOS-CHAVE & DESTAQUES CRONOLÓGICOS', margin, cursorY);
    cursorY += 5;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(228, 228, 231);
    const splitMoments = doc.splitTextToSize(cleanedMoments, contentWidth);
    doc.text(splitMoments, margin, cursorY);
    cursorY += splitMoments.length * 4.2 + 6;
  }

  // --- 4. ESTATÍSTICAS E INDICADORES COMPARATIVOS ---
  const est = analysis.estatisticas || {};
  const adv = analysis.indicadoresAvancados || {};
  
  const statItems: { label: string; a: string; b: string }[] = [];
  if (est.posseDeBola?.timeA || est.posseDeBola?.timeB) statItems.push({ label: 'Posse de Bola', a: cleanPdfText(est.posseDeBola?.timeA) || '—', b: cleanPdfText(est.posseDeBola?.timeB) || '—' });
  if (est.finalizacoes?.timeA || est.finalizacoes?.timeB) statItems.push({ label: 'Finalizações', a: cleanPdfText(est.finalizacoes?.timeA) || '—', b: cleanPdfText(est.finalizacoes?.timeB) || '—' });
  if (est.finalizacoesNoAlvo?.timeA || est.finalizacoesNoAlvo?.timeB) statItems.push({ label: 'Finalizações no Gol', a: cleanPdfText(est.finalizacoesNoAlvo?.timeA) || '—', b: cleanPdfText(est.finalizacoesNoAlvo?.timeB) || '—' });
  if (adv.xG?.timeA || adv.xG?.timeB) statItems.push({ label: 'xG (Gols Esperados)', a: cleanPdfText(adv.xG?.timeA) || '—', b: cleanPdfText(adv.xG?.timeB) || '—' });
  if (adv.grandesChances?.timeA || adv.grandesChances?.timeB) statItems.push({ label: 'Grandes Chances', a: cleanPdfText(adv.grandesChances?.timeA) || '—', b: cleanPdfText(adv.grandesChances?.timeB) || '—' });
  if (est.passesCertos?.timeA || est.passesCertos?.timeB) statItems.push({ label: 'Passes Certos', a: cleanPdfText(est.passesCertos?.timeA) || '—', b: cleanPdfText(est.passesCertos?.timeB) || '—' });
  if (est.desarmes?.timeA || est.desarmes?.timeB) statItems.push({ label: 'Desarmes', a: cleanPdfText(est.desarmes?.timeA) || '—', b: cleanPdfText(est.desarmes?.timeB) || '—' });
  if (est.escanteios?.timeA || est.escanteios?.timeB) statItems.push({ label: 'Escanteios', a: cleanPdfText(est.escanteios?.timeA) || '—', b: cleanPdfText(est.escanteios?.timeB) || '—' });
  if (est.faltasCometidas?.timeA || est.faltasCometidas?.timeB) statItems.push({ label: 'Faltas Cometidas', a: cleanPdfText(est.faltasCometidas?.timeA) || '—', b: cleanPdfText(est.faltasCometidas?.timeB) || '—' });
  if (est.impedimentos?.timeA || est.impedimentos?.timeB) statItems.push({ label: 'Impedimentos', a: cleanPdfText(est.impedimentos?.timeA) || '—', b: cleanPdfText(est.impedimentos?.timeB) || '—' });

  if (statItems.length > 0) {
    checkPageBreak(35 + statItems.length * 6);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(234, 179, 8);
    doc.text('[3] ESTATÍSTICAS E INDICADORES COMPARATIVOS', margin, cursorY);
    cursorY += 5;

    // Table Header
    doc.setFillColor(55, 3, 3);
    doc.rect(margin, cursorY, contentWidth, 6, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(254, 240, 138);
    doc.text(timeA, margin + 4, cursorY + 4.2);
    doc.text('MÉTRICA', margin + contentWidth / 2, cursorY + 4.2, { align: 'center' });
    doc.text(timeB, margin + contentWidth - 4, cursorY + 4.2, { align: 'right' });
    cursorY += 6;

    // Table Rows
    statItems.forEach((st, idx) => {
      doc.setFillColor(idx % 2 === 0 ? 30 : 22, 1, 1);
      doc.rect(margin, cursorY, contentWidth, 5.5, 'F');
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(255, 255, 255);
      doc.text(st.a, margin + 4, cursorY + 4);
      doc.setTextColor(254, 240, 138);
      doc.text(st.label, margin + contentWidth / 2, cursorY + 4, { align: 'center' });
      doc.setTextColor(255, 255, 255);
      doc.text(st.b, margin + contentWidth - 4, cursorY + 4, { align: 'right' });
      cursorY += 5.5;
    });
    cursorY += 6;
  }

  // --- 5. MAPA DE CALOR TÁTICO (HEATMAP) ---
  const calorA = est.mapaDeCalor?.timeA;
  const calorB = est.mapaDeCalor?.timeB;
  checkPageBreak(40);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(234, 179, 8);
  doc.text('[4] MAPA DE CALOR E OCUPAÇÃO ESPACIAL POR TERÇOS', margin, cursorY);
  cursorY += 5;

  if (calorA || calorB) {
    const boxWidth = (contentWidth - 6) / 2;
    const boxHeight = 26;

    // Time A Heatmap Box
    doc.setFillColor(35, 2, 2);
    doc.roundedRect(margin, cursorY, boxWidth, boxHeight, 1.5, 1.5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(254, 240, 138);
    doc.text(timeA, margin + 4, cursorY + 5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(228, 228, 231);
    doc.text(`Terço Defensivo: ${cleanPdfText(calorA?.tercoDefensivo) || '—'}`, margin + 4, cursorY + 11);
    doc.text(`Terço Médio: ${cleanPdfText(calorA?.tercoMedio) || '—'}`, margin + 4, cursorY + 16);
    doc.text(`Terço Ofensivo: ${cleanPdfText(calorA?.tercoOfensivo) || '—'}`, margin + 4, cursorY + 21);

    // Time B Heatmap Box
    const boxBX = margin + boxWidth + 6;
    doc.setFillColor(35, 2, 2);
    doc.roundedRect(boxBX, cursorY, boxWidth, boxHeight, 1.5, 1.5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(254, 240, 138);
    doc.text(timeB, boxBX + 4, cursorY + 5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(228, 228, 231);
    doc.text(`Terço Defensivo: ${cleanPdfText(calorB?.tercoDefensivo) || '—'}`, boxBX + 4, cursorY + 11);
    doc.text(`Terço Médio: ${cleanPdfText(calorB?.tercoMedio) || '—'}`, boxBX + 4, cursorY + 16);
    doc.text(`Terço Ofensivo: ${cleanPdfText(calorB?.tercoOfensivo) || '—'}`, boxBX + 4, cursorY + 21);

    cursorY += boxHeight + 6;
  } else {
    doc.setFillColor(35, 2, 2);
    doc.roundedRect(margin, cursorY, contentWidth, 12, 1.5, 1.5, 'F');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(161, 161, 170);
    doc.text('Mapa de calor não disponível para esta análise.', margin + 4, cursorY + 7);
    cursorY += 16;
  }

  // --- 6. PADRÕES TÁTICOS E DINÂMICAS COLETIVAS ---
  const formA = cleanPdfText(analysis.formacoes?.timeA?.esquema);
  const formB = cleanPdfText(analysis.formacoes?.timeB?.esquema);
  const ofTextA = analysis.faseOfensiva?.timeA ? `[${timeA}] ${cleanPdfText([analysis.faseOfensiva.timeA.saidaDeBola, analysis.faseOfensiva.timeA.criacao, analysis.faseOfensiva.timeA.finalizacao_movimentacao].filter(Boolean).join(' '))}` : '';
  const ofTextB = analysis.faseOfensiva?.timeB ? `[${timeB}] ${cleanPdfText([analysis.faseOfensiva.timeB.saidaDeBola, analysis.faseOfensiva.timeB.criacao, analysis.faseOfensiva.timeB.finalizacao_movimentacao].filter(Boolean).join(' '))}` : '';
  const defTextA = analysis.faseDefensiva?.timeA ? `[${timeA}] ${cleanPdfText([analysis.faseDefensiva.timeA.posicionamento, analysis.faseDefensiva.timeA.compactacao_pressao, analysis.faseDefensiva.timeA.transicao].filter(Boolean).join(' '))}` : '';
  const defTextB = analysis.faseDefensiva?.timeB ? `[${timeB}] ${cleanPdfText([analysis.faseDefensiva.timeB.posicionamento, analysis.faseDefensiva.timeB.compactacao_pressao, analysis.faseDefensiva.timeB.transicao].filter(Boolean).join(' '))}` : '';

  if (formA || formB || ofTextA || ofTextB || defTextA || defTextB) {
    checkPageBreak(40);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(234, 179, 8);
    doc.text('[5] PADRÕES TÁTICOS E DINÂMICAS COLETIVAS', margin, cursorY);
    cursorY += 5;

    if (formA || formB) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(254, 240, 138);
      doc.text(`Formação ${timeA}: ${formA || '—'}   |   Formação ${timeB}: ${formB || '—'}`, margin, cursorY);
      cursorY += 5;
    }

    if (ofTextA || ofTextB) {
      checkPageBreak(22);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(234, 179, 8);
      doc.text('Comportamento Ofensivo:', margin, cursorY);
      cursorY += 4;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(228, 228, 231);
      const splitOf = doc.splitTextToSize(`${ofTextA}\n${ofTextB}`.trim(), contentWidth);
      doc.text(splitOf, margin, cursorY);
      cursorY += splitOf.length * 3.8 + 4;
    }

    if (defTextA || defTextB) {
      checkPageBreak(22);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(234, 179, 8);
      doc.text('Comportamento Defensivo & Transições:', margin, cursorY);
      cursorY += 4;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(228, 228, 231);
      const splitDef = doc.splitTextToSize(`${defTextA}\n${defTextB}`.trim(), contentWidth);
      doc.text(splitDef, margin, cursorY);
      cursorY += splitDef.length * 3.8 + 5;
    }
  }

  // --- 7. SCOUTING INDIVIDUAL DE JOGADORES ---
  if (Array.isArray(analysis.analiseJogadores) && analysis.analiseJogadores.length > 0) {
    const validPlayers = analysis.analiseJogadores.filter((p: any) => p && p.nome && p.nome.trim().length >= 2);
    if (validPlayers.length > 0) {
      checkPageBreak(30);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(234, 179, 8);
      doc.text('[6] SCOUTING INDIVIDUAL DE JOGADORES OBSERVADOS', margin, cursorY);
      cursorY += 5;

      validPlayers.forEach((p: any) => {
        checkPageBreak(24);
        doc.setFillColor(35, 2, 2);
        doc.roundedRect(margin, cursorY, contentWidth, 20, 1.5, 1.5, 'F');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.setTextColor(254, 240, 138);
        const pNome = cleanPdfText(p.nome).toUpperCase();
        const pPos = cleanPdfText(p.posicao || 'Posição N/D');
        const pTime = cleanPdfText(p.time || '');
        const pCamisa = p.camisa ? `(#${cleanPdfText(String(p.camisa))})` : '';
        doc.text(`${pNome}  |  ${pPos}  |  ${pTime}  ${pCamisa}`, margin + 4, cursorY + 5);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(212, 212, 216);
        const acoes = Array.isArray(p.acoesPercebidas) ? p.acoesPercebidas.slice(0, 2).map(cleanPdfText).join(' • ') : '';
        const fortes = Array.isArray(p.pontosFortes) ? p.pontosFortes.slice(0, 2).map(cleanPdfText).join(' • ') : '';
        const pAnalise = cleanPdfText(p.analise);
        const summaryText = `${pAnalise || ''} ${acoes ? `Ações: ${acoes}.` : ''} ${fortes ? `Fortes: ${fortes}.` : ''}`.trim();
        const splitPl = doc.splitTextToSize(summaryText, contentWidth - 8);
        doc.text(splitPl.slice(0, 3), margin + 4, cursorY + 10);

        cursorY += 23;
      });
    }
  }

  // --- 8. AUDITORIA DO PLACAR E VERIFICAÇÃO ---
  const audit = analysis.placarAuditoria;
  const verif = analysis.verificacaoAuditoria;
  if (audit || verif) {
    checkPageBreak(35);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(234, 179, 8);
    doc.text('[7] AUDITORIA DO PLACAR E CONFIABILIDADE DE DADOS', margin, cursorY);
    cursorY += 5;

    doc.setFillColor(30, 1, 1);
    doc.roundedRect(margin, cursorY, contentWidth, 24, 1.5, 1.5, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(254, 240, 138);
    doc.text(`Placar Final Confirmado: ${cleanPdfText(audit?.placarFinal || placar || 'Não identificado')}`, margin + 4, cursorY + 5);
    doc.text(`Placar Visível (HUD): ${cleanPdfText(audit?.placarVisivel || '0 x 0')}`, margin + contentWidth / 2, cursorY + 5);
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(228, 228, 231);
    doc.text(`Nível de Confiança: ${cleanPdfText(audit?.confianca || verif?.nivelConfianca || 'alta').toUpperCase()}`, margin + 4, cursorY + 11);
    doc.text(`Estratégia: ${cleanPdfText(verif?.estrategiaAnalise || 'Validação Estrita de Match Context e Anti-Alucinação')}`, margin + 4, cursorY + 16);
    
    const obs = cleanPdfText(audit?.observacoes || verif?.observacoes);
    if (obs) {
      const splitObs = doc.splitTextToSize(`Observações: ${obs}`, contentWidth - 8);
      doc.text(splitObs.slice(0, 1), margin + 4, cursorY + 21);
    }

    cursorY += 28;
  }

  // --- 9. RECOMENDAÇÕES E CONCLUSÃO TÁTICA ---
  const cleanedConcl = cleanPdfText(analysis.conclusaoRecomendacoes);
  if (cleanedConcl) {
    checkPageBreak(25);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(234, 179, 8);
    doc.text('[8] RECOMENDAÇÕES E CONCLUSÕES TÁTICAS', margin, cursorY);
    cursorY += 5;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(228, 228, 231);
    const splitConc = doc.splitTextToSize(cleanedConcl, contentWidth);
    doc.text(splitConc, margin, cursorY);
    cursorY += splitConc.length * 4 + 6;
  }

  // Bottom Footer on all pages
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(161, 161, 170);
    doc.text('PROTÁTICA • Sistema de Inteligência Tática e Scouting com Auditoria de Dados', margin, pageHeight - 6);
    doc.text(`Página ${i} de ${totalPages}`, pageWidth - margin, pageHeight - 6, { align: 'right' });
  }

  // Extrair buffer binário real
  const arrayBuffer = doc.output('arraybuffer');
  const buffer = typeof Buffer !== 'undefined' ? Buffer.from(arrayBuffer) : (new Uint8Array(arrayBuffer) as any);
  const size = buffer.length || (arrayBuffer ? arrayBuffer.byteLength : 0);

  if (!size || size === 0) {
    throw new Error('PDF_EMPTY: Falha na compilação do relatório PDF (tamanho 0).');
  }

  // Validar cabeçalho mágico %PDF-
  let header = '';
  if (typeof Buffer !== 'undefined' && Buffer.isBuffer(buffer)) {
    header = buffer.subarray(0, 5).toString('ascii');
  } else {
    const bytes = new Uint8Array(arrayBuffer).subarray(0, 5);
    header = String.fromCharCode(...bytes);
  }

  if (!header.startsWith('%PDF-')) {
    throw new Error('PDF_HEADER_INVALID: O buffer gerado não contém uma assinatura PDF válida.');
  }

  // Gera base64 limpo sem cabeçalhos adicionais estranhos
  let base64 = '';
  if (typeof Buffer !== 'undefined' && Buffer.isBuffer(buffer)) {
    base64 = `data:application/pdf;base64,${buffer.toString('base64')}`;
  } else {
    const binary = String.fromCharCode(...new Uint8Array(arrayBuffer));
    base64 = `data:application/pdf;base64,${btoa(binary)}`;
  }

  return { doc, filename, buffer, size, base64 };
}

/**
 * Função de Download no Frontend.
 * Solicita o arquivo PDF diretamente ao backend via fetch e realiza o download nativo do Blob.
 */
export async function downloadAnalysisPdf(analysis: Analysis, onProgress?: (msg: string) => void): Promise<{ filename: string }> {
  if (!analysis) {
    throw new Error('Objeto de análise não fornecido.');
  }

  console.log('[PDF] download solicitado:', {
    analysisId: analysis.analysisId,
    match: `${analysis.timeA || 'Time A'} x ${analysis.timeB || 'Time B'}`
  });

  if (onProgress) onProgress('Solicitando relatório PDF ao servidor...');

  try {
    let response: Response;
    
    if (analysis.analysisId) {
      response = await fetch(`/api/analyses/${encodeURIComponent(analysis.analysisId)}/pdf`, {
        method: 'GET',
        headers: { 'Accept': 'application/pdf' },
      });
    } else {
      response = await fetch('/api/analyses/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/pdf' },
        body: JSON.stringify({ analysis }),
      });
    }

    if (!response.ok) {
      let errorDetail = `PDF HTTP ${response.status}`;
      try {
        const errorJson = await response.json();
        if (errorJson.error) errorDetail = errorJson.error;
      } catch {
        const text = await response.text();
        if (text) errorDetail = text.slice(0, 150);
      }
      throw new Error(`Código: PDF_GENERATION_ERROR (${errorDetail})`);
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.toLowerCase().includes('application/pdf')) {
      let bodyPreview = '';
      try {
        bodyPreview = await response.text();
      } catch {}
      throw new Error(`Não foi possível gerar o PDF.\nCódigo: PDF_GENERATION_ERROR (MIME ${contentType}: ${bodyPreview.slice(0, 100)})`);
    }

    const blob = await response.blob();
    if (blob.size === 0) {
      throw new Error('Não foi possível gerar o PDF.\nCódigo: PDF_EMPTY');
    }

    let filename = getAnalysisPdfFilename(analysis);
    const disposition = response.headers.get('content-disposition');
    if (disposition) {
      const match = disposition.match(/filename="?([^";]+)"?/i);
      if (match && match[1]) {
        filename = sanitizeFilename(match[1]);
      }
    }

    if (onProgress) onProgress('Iniciando download no navegador...');

    // Download do Blob sem desestruturar URL
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);

    console.log('[PDF] download concluído:', filename, `(${blob.size} bytes)`);
    return { filename };
  } catch (error: any) {
    console.error('[PDF ERROR] Erro no download do backend, tentando geração de contingência no cliente:', error);
    
    // Fallback de contingência local se o backend estiver inacessível
    try {
      if (onProgress) onProgress('Compilando relatório localmente...');
      const { doc, filename } = buildAnalysisPdfDocument(analysis);
      doc.save(filename);
      console.log('[PDF] sucesso via contingência local:', filename);
      return { filename };
    } catch (fallbackError: any) {
      console.error('[PDF ERROR] Falha também na contingência local:', fallbackError);
      throw new Error(`Não foi possível gerar o PDF.\nCódigo: PDF_GENERATION_ERROR\nDetalhes: ${error?.message || fallbackError?.message}`);
    }
  }
}

/**
 * Exportador legado compatível com componentes existentes.
 */
export async function exportAnalysisPdf(analysis: Analysis): Promise<{ filename: string; base64: string }> {
  const result = await downloadAnalysisPdf(analysis);
  return { filename: result.filename, base64: '' };
}
