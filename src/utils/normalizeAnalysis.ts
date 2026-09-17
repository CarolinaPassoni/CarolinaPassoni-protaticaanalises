import type { Analysis, Estatisticas, PlacarAuditoria, PlayerAnalysis, TimelineEvent, ContextoPartida, TeamMetrics, MapaDeCalor } from '../types';

/**
 * Parses numeric or percentage string safely without coercing missing data to 0.
 * Returns null if value is absent, empty, or unparseable.
 */
export function parseOptionalNumber(val: any): number | null {
  if (val === null || val === undefined || val === '') return null;
  const str = String(val).trim().replace('%', '').replace(',', '.');
  const num = parseFloat(str);
  return isNaN(num) ? null : num;
}

/**
 * Checks if a metric string contains valid data (not empty, not purely whitespace).
 */
export function hasValue(val: any): boolean {
  if (val === null || val === undefined) return false;
  const str = String(val).trim();
  return str !== '' && str !== '—' && str !== '-' && str.toLowerCase() !== 'n/d' && str.toLowerCase() !== 'null';
}

/**
 * Formats a display value: if value is null/undefined or empty, returns 'N/D' or specified fallback.
 */
export function formatMetric(val: any, fallback = 'N/D'): string {
  if (!hasValue(val)) return fallback;
  return String(val).trim();
}

/**
 * Safely extracts a score string like "2 x 1" or "2 - 1".
 * Rejects invalid repetitions like "2 x 12 x 12...".
 */
export function sanitizeScore(rawScore: any): string {
  if (!rawScore) return 'Não identificado';
  const str = String(rawScore).trim();
  
  if (str.toLowerCase() === 'não identificado' || str.toLowerCase() === 'n/d' || str === '') {
    return 'Não identificado';
  }

  // Handle repeated concatenated sequences like "2 x 12 x 12 x 1" or "2x12x1"
  const repeatPattern = str.match(/^(\d{1,2})\s*[:xX\-–—]\s*(\d)(?:\1\s*[:xX\-–—]\s*\2|\d*\s*[:xX\-–—]\s*\d*)+/i);
  if (repeatPattern && str.split(/[:xX\-–—]/).length > 2) {
    const firstDigit = repeatPattern[1];
    const secondDigit = repeatPattern[2];
    return `${firstDigit} x ${secondDigit}`;
  }

  // Strict regex for single score match: e.g. "2 x 1", "0 - 0", "3:2", "2x1"
  const singleMatch = str.match(/^(\d{1,2})\s*[:xX\-–—]\s*(\d{1,2})$/);
  if (singleMatch) {
    return `${singleMatch[1]} x ${singleMatch[2]}`;
  }
  
  // Search within text for single clean score pattern
  const matches = str.match(/\b(\d{1,2})\s*[:xX\-–—]\s*(\d{1,2})\b/g);
  if (matches && matches.length === 1) {
    const parts = matches[0].match(/(\d{1,2})\s*[:xX\-–—]\s*(\d{1,2})/);
    if (parts) {
      return `${parts[1]} x ${parts[2]}`;
    }
  }

  // If matches contains repeated sequences, pick the first valid pair
  if (matches && matches.length > 1) {
    const firstPart = matches[0].match(/(\d{1,2})\s*[:xX\-–—]\s*(\d{1,2})/);
    if (firstPart) {
      return `${firstPart[1]} x ${firstPart[2]}`;
    }
  }

  return str;
}

/**
 * Validates possession percentages. Returns parsed numbers if valid and sum is ~100%, else null.
 */
export function validatePossession(posseA: any, posseB: any): { timeA: number | null; timeB: number | null; isIdentified: boolean } {
  const numA = parseOptionalNumber(posseA);
  const numB = parseOptionalNumber(posseB);

  if (numA === null && numB === null) {
    return { timeA: null, timeB: null, isIdentified: false };
  }

  if (numA !== null && numB !== null) {
    // If both sum around 95-105%, it's valid
    const sum = numA + numB;
    if (sum >= 90 && sum <= 110) {
      return { timeA: numA, timeB: numB, isIdentified: true };
    }
  }

  if (numA !== null && numB === null && numA >= 0 && numA <= 100) {
    return { timeA: numA, timeB: 100 - numA, isIdentified: true };
  }

  if (numB !== null && numA === null && numB >= 0 && numB <= 100) {
    return { timeA: 100 - numB, timeB: numB, isIdentified: true };
  }

  return { timeA: numA, timeB: numB, isIdentified: numA !== null || numB !== null };
}

/**
 * Normalizes an entire Analysis object from Gemini or SQLite.
 * NEVER forces 0 or 50% on missing fields.
 */
export function normalizeAnalysisResponse(raw: any): Analysis {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Objeto de análise inválido para normalização.');
  }

  const timeA = String(raw.timeA || 'Time A').trim();
  const timeB = String(raw.timeB || 'Time B').trim();
  const placar = sanitizeScore(raw.placar);

  // Normalize Placar Auditoria
  const rawAudit = raw.placarAuditoria || {};
  const placarFinal = sanitizeScore(rawAudit.placarFinal || placar);
  const placarVisivel = rawAudit.placarVisivel ? sanitizeScore(rawAudit.placarVisivel) : '';
  const confiancaRaw = String(rawAudit.confianca || raw.verificacaoAuditoria?.nivelConfianca || 'baixa').trim().toLowerCase();
  const confianca: 'alta' | 'media' | 'baixa' = ['alta', 'media', 'baixa'].includes(confiancaRaw as any)
    ? (confiancaRaw as any)
    : 'baixa';

  const evidencias: string[] = Array.isArray(rawAudit.evidencias)
    ? rawAudit.evidencias.filter((e: any) => typeof e === 'string' && e.trim() !== '')
    : [];

  const rawScoreEv = rawAudit.scoreEvidence || {};
  const scoreEvidence = {
    videoVisual: rawScoreEv.videoVisual || rawScoreEv.visual || (placarVisivel !== 'Não identificado' && placarVisivel ? placarVisivel : null),
    visual: rawScoreEv.visual || rawScoreEv.videoVisual || (placarVisivel !== 'Não identificado' && placarVisivel ? placarVisivel : null),
    transcript: rawScoreEv.transcript || null,
    metadata: rawScoreEv.metadata || (placarFinal !== 'Não identificado' && placarFinal ? placarFinal : null),
    officialSource: rawScoreEv.officialSource || null,
    aiInference: rawScoreEv.aiInference || rawScoreEv.ai || (placar !== 'Não identificado' ? placar : null),
    ai: rawScoreEv.ai || rawScoreEv.aiInference || (placar !== 'Não identificado' ? placar : null),
  };

  const placarAuditoria: PlacarAuditoria = {
    placarFinal: placarFinal !== 'Não identificado' ? placarFinal : undefined,
    placarVisivel: placarVisivel !== 'Não identificado' ? placarVisivel : undefined,
    fontePlacar: rawAudit.fontePlacar || undefined,
    confianca,
    observacoes: rawAudit.observacoes || undefined,
    evidencias: evidencias.length > 0 ? evidencias : undefined,
    scoreEvidence,
  };

  // Normalize Context
  const rawCtx = raw.contextoPartida || {};
  const contextoPartida: ContextoPartida = {
    competicao: rawCtx.competicao || undefined,
    temporada: rawCtx.temporada || undefined,
    fase: rawCtx.fase || undefined,
    dataJogo: rawCtx.dataJogo || undefined,
    estadio: rawCtx.estadio || undefined,
    cidade: rawCtx.cidade || undefined,
    arbitro: rawCtx.arbitro || undefined,
    publico: rawCtx.publico || undefined,
    condicoesClimaticas: rawCtx.condicoesClimaticas || undefined,
  };

  // Normalize Formations
  const rawForm = raw.formacoes || {};
  const formacoes = {
    timeA: {
      esquema: rawForm.timeA?.esquema || undefined,
      titulares: Array.isArray(rawForm.timeA?.titulares) ? rawForm.timeA.titulares : undefined,
      destaquesFuncionais: rawForm.timeA?.destaquesFuncionais || undefined,
    },
    timeB: {
      esquema: rawForm.timeB?.esquema || undefined,
      titulares: Array.isArray(rawForm.timeB?.titulares) ? rawForm.timeB.titulares : undefined,
      destaquesFuncionais: rawForm.timeB?.destaquesFuncionais || undefined,
    },
  };

  // Normalize Phases
  const rawDef = raw.faseDefensiva || {};
  const faseDefensiva = {
    timeA: {
      posicionamento: rawDef.timeA?.posicionamento || undefined,
      compactacao_pressao: rawDef.timeA?.compactacao_pressao || undefined,
      transicao: rawDef.timeA?.transicao || undefined,
    },
    timeB: {
      posicionamento: rawDef.timeB?.posicionamento || undefined,
      compactacao_pressao: rawDef.timeB?.compactacao_pressao || undefined,
      transicao: rawDef.timeB?.transicao || undefined,
    },
  };

  const rawOf = raw.faseOfensiva || {};
  const faseOfensiva = {
    timeA: {
      saidaDeBola: rawOf.timeA?.saidaDeBola || undefined,
      criacao: rawOf.timeA?.criacao || undefined,
      finalizacao_movimentacao: rawOf.timeA?.finalizacao_movimentacao || undefined,
    },
    timeB: {
      saidaDeBola: rawOf.timeB?.saidaDeBola || undefined,
      criacao: rawOf.timeB?.criacao || undefined,
      finalizacao_movimentacao: rawOf.timeB?.finalizacao_movimentacao || undefined,
    },
  };

  // Normalize Stats: keep values as strings if present, never fabricate 0
  const rawStats = raw.estatisticas || {};
  const normalizeTeamMetric = (m: any): TeamMetrics | undefined => {
    if (!m || typeof m !== 'object') return undefined;
    const hasA = hasValue(m.timeA);
    const hasB = hasValue(m.timeB);
    if (!hasA && !hasB) {
      if (m.unavailableReason) {
        return {
          timeA: undefined,
          timeB: undefined,
          unavailableReason: m.unavailableReason,
          source: m.source,
          confidence: m.confidence,
          verified: false,
        };
      }
      return undefined;
    }
    return {
      timeA: hasA ? String(m.timeA).trim() : undefined,
      timeB: hasB ? String(m.timeB).trim() : undefined,
      source: m.source || undefined,
      confidence: m.confidence || undefined,
      verified: typeof m.verified === 'boolean' ? m.verified : (hasA || hasB),
      unavailableReason: m.unavailableReason || undefined,
    };
  };

  // Normalize Heatmap: only include if real non-zero thirds exist
  let mapaDeCalorNormalized: { timeA?: MapaDeCalor; timeB?: MapaDeCalor } | undefined = undefined;
  if (rawStats.mapaDeCalor) {
    const rawCalorA = rawStats.mapaDeCalor.timeA;
    const rawCalorB = rawStats.mapaDeCalor.timeB;
    const hasA = rawCalorA && (hasValue(rawCalorA.tercoDefensivo) || hasValue(rawCalorA.tercoMedio) || hasValue(rawCalorA.tercoOfensivo));
    const hasB = rawCalorB && (hasValue(rawCalorB.tercoDefensivo) || hasValue(rawCalorB.tercoMedio) || hasValue(rawCalorB.tercoOfensivo));

    if (hasA || hasB) {
      mapaDeCalorNormalized = {
        timeA: hasA ? {
          tercoDefensivo: rawCalorA?.tercoDefensivo ? String(rawCalorA.tercoDefensivo) : undefined,
          tercoMedio: rawCalorA?.tercoMedio ? String(rawCalorA.tercoMedio) : undefined,
          tercoOfensivo: rawCalorA?.tercoOfensivo ? String(rawCalorA.tercoOfensivo) : undefined,
        } : undefined,
        timeB: hasB ? {
          tercoDefensivo: rawCalorB?.tercoDefensivo ? String(rawCalorB.tercoDefensivo) : undefined,
          tercoMedio: rawCalorB?.tercoMedio ? String(rawCalorB.tercoMedio) : undefined,
          tercoOfensivo: rawCalorB?.tercoOfensivo ? String(rawCalorB.tercoOfensivo) : undefined,
        } : undefined,
      };
    }
  }

  const estatisticas: Estatisticas = {
    posseDeBola: normalizeTeamMetric(rawStats.posseDeBola),
    finalizacoes: normalizeTeamMetric(rawStats.finalizacoes),
    finalizacoesNoAlvo: normalizeTeamMetric(rawStats.finalizacoesNoAlvo),
    passesCertos: normalizeTeamMetric(rawStats.passesCertos),
    faltasCometidas: normalizeTeamMetric(rawStats.faltasCometidas),
    desarmes: normalizeTeamMetric(rawStats.desarmes),
    escanteios: normalizeTeamMetric(rawStats.escanteios),
    impedimentos: normalizeTeamMetric(rawStats.impedimentos),
    mapaDeCalor: mapaDeCalorNormalized,
  };

  // Normalize Advanced Indicators
  const indicadoresAvancados: Record<string, TeamMetrics> = {};
  if (raw.indicadoresAvancados && typeof raw.indicadoresAvancados === 'object') {
    for (const [key, metric] of Object.entries(raw.indicadoresAvancados)) {
      const norm = normalizeTeamMetric(metric);
      if (norm) {
        indicadoresAvancados[key] = norm;
      }
    }
  }

  // Normalize Players (Scouting)
  const analiseJogadores: PlayerAnalysis[] = [];
  if (Array.isArray(raw.analiseJogadores)) {
    for (const p of raw.analiseJogadores) {
      if (!p || typeof p !== 'object') continue;
      let nome = String(p.nome || p.confirmedName || p.probableName || '').trim();
      const camisa = p.camisa ? String(p.camisa).trim().replace(/[^\d]/g, '') : (p.shirtNumber ? String(p.shirtNumber).trim().replace(/[^\d]/g, '') : undefined);
      
      if (!nome && camisa) {
        nome = `Jogador nº ${camisa}`;
      } else if (!nome) {
        nome = 'Jogador Observado';
      }

      analiseJogadores.push({
        nome,
        probableName: p.probableName ? String(p.probableName).trim() : undefined,
        confirmedName: p.confirmedName ? String(p.confirmedName).trim() : undefined,
        time: p.time ? String(p.time).trim() : undefined,
        posicao: p.posicao ? String(p.posicao).trim() : undefined,
        camisa,
        identificacao: p.identificacao ? String(p.identificacao).trim() : undefined,
        identificationSource: p.identificationSource || undefined,
        visualConfidence: typeof p.visualConfidence === 'number' ? p.visualConfidence : undefined,
        textualConfidence: typeof p.textualConfidence === 'number' ? p.textualConfidence : undefined,
        minutosObservados: p.minutosObservados ? String(p.minutosObservados).trim() : undefined,
        nivelConfianca: p.nivelConfianca ? String(p.nivelConfianca).trim().toLowerCase() : undefined,
        analise: p.analise ? String(p.analise).trim() : undefined,
        acoesPercebidas: Array.isArray(p.acoesPercebidas) ? p.acoesPercebidas.filter(Boolean) : undefined,
        pontosFortes: Array.isArray(p.pontosFortes) ? p.pontosFortes.filter(Boolean) : undefined,
        pontosAtencao: Array.isArray(p.pontosAtencao) ? p.pontosAtencao.filter(Boolean) : undefined,
        photoUrl: p.photoUrl || undefined,
        photoSource: p.photoSource || undefined,
        photoConfidenceScore: typeof p.photoConfidenceScore === 'number' ? p.photoConfidenceScore : undefined,
        manualVerified: Boolean(p.manualVerified),
      });
    }
  }

  // Normalize Timeline
  const linhaDoTempo: TimelineEvent[] = [];
  if (Array.isArray(raw.linhaDoTempo)) {
    for (const ev of raw.linhaDoTempo) {
      if (!ev || typeof ev !== 'object') continue;
      if (!ev.descricao && !ev.tipo) continue;

      linhaDoTempo.push({
        minuto: ev.minuto ? String(ev.minuto).trim() : undefined,
        time: ev.time ? String(ev.time).trim() : undefined,
        tipo: ev.tipo ? String(ev.tipo).trim() : undefined,
        descricao: ev.descricao ? String(ev.descricao).trim() : undefined,
        impactoTatico: ev.impactoTatico ? String(ev.impactoTatico).trim() : undefined,
      });
    }
  }

  // Verification and audit
  const rawVer = raw.verificacaoAuditoria || {};
  const verificacaoAuditoria = {
    partidaIdentificada: rawVer.partidaIdentificada || `${timeA} x ${timeB}`,
    trechoAnalisado: rawVer.trechoAnalisado || undefined,
    modeloUsado: rawVer.modeloUsado || 'gemini-3.7-flash',
    fontesPrincipais: Array.isArray(rawVer.fontesPrincipais) ? rawVer.fontesPrincipais : undefined,
    observacoes: rawVer.observacoes || undefined,
    nivelConfianca: confianca,
    segmentosAnalisados: rawVer.segmentosAnalisados || undefined,
    estrategiaAnalise: rawVer.estrategiaAnalise || 'Análise de Contexto com Validação via Google Search',
  };

  return {
    analysisId: raw.analysisId,
    createdAt: raw.createdAt || new Date().toISOString(),
    videoTitle: raw.videoTitle || 'Partida de Futebol',
    videoUrl: raw.videoUrl,
    videoId: raw.videoId,
    timeA,
    timeB,
    placar,
    placarAuditoria,
    resumoPartida: raw.resumoPartida || 'Descrição tática não fornecida para este trecho.',
    momentosChave: raw.momentosChave || 'Nenhum momento-chave registrado.',
    contextoPartida,
    formacoes,
    faseDefensiva,
    faseOfensiva,
    estatisticas,
    indicadoresAvancados: Object.keys(indicadoresAvancados).length > 0 ? indicadoresAvancados : undefined,
    analiseJogadores: analiseJogadores.length > 0 ? analiseJogadores : undefined,
    linhaDoTempo: linhaDoTempo.length > 0 ? linhaDoTempo : undefined,
    ajustesTreinadores: raw.ajustesTreinadores || undefined,
    recomendacoesTaticas: raw.recomendacoesTaticas || undefined,
    conclusaoRecomendacoes: raw.conclusaoRecomendacoes || 'Nenhuma recomendação adicional.',
    verificacaoAuditoria,
    sources: Array.isArray(raw.sources) ? raw.sources : undefined,
    sourceFingerprint: raw.sourceFingerprint || undefined,
    validationStatus: raw.validationStatus || undefined,
    sectionValidation: raw.sectionValidation || undefined,
    visualCoverage: raw.visualCoverage || undefined,
    matchFingerprint: raw.matchFingerprint || undefined,
    verifiedVideoContext: raw.verifiedVideoContext || undefined,
  };
}
