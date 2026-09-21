const fs = require('node:fs');
const path = require('node:path');

const filePath = path.join(process.cwd(), 'server.ts');
let text = fs.readFileSync(filePath, 'utf8');
let changed = 0;

const replaceOnce = (label, oldText, newText) => {
  if (text.includes(newText)) return;
  if (!text.includes(oldText)) {
    console.warn(`[V6_10_8] Trecho não encontrado: ${label}`);
    return;
  }
  text = text.replace(oldText, newText);
  changed++;
};

// -----------------------------------------------------------------------------
// 1) Helpers independentes de identidade.
// -----------------------------------------------------------------------------
if (!text.includes('const normalizeIdentityTeamName =')) {
  const marker = '// --- REAL VIDEO & MULTIMODAL ANALYSIS PIPELINE ---';
  const helper = `
const normalizeIdentityTeamName = (value: any): string =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\\u0300-\\u036f]/g, '')
    .toLowerCase()
    .replace(/\\b(futebol|football|clube|club|esporte|esportivo|esportiva|fc|f c|ec|e c|ac|a c|feminino|feminina|women|womens)\\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\\s+/g, ' ')
    .trim();

const isGenericIdentityTeam = (value: any): boolean => {
  const n = normalizeIdentityTeamName(value);
  return !n || ['time a', 'time b', 'mandante', 'visitante', 'nao confirmado', 'nao identificado'].includes(n);
};

const identityTeamCompatible = (a: any, b: any): boolean => {
  const x = normalizeIdentityTeamName(a);
  const y = normalizeIdentityTeamName(b);
  if (!x || !y) return false;
  if (x === y) return true;

  const minLen = Math.min(x.length, y.length);
  if (minLen >= 5 && (x.includes(y) || y.includes(x))) return true;

  const xa = new Set(x.split(' ').filter((t) => t.length >= 3));
  const ya = new Set(y.split(' ').filter((t) => t.length >= 3));
  if (!xa.size || !ya.size) return false;

  let common = 0;
  for (const token of xa) if (ya.has(token)) common++;
  const ratio = common / Math.min(xa.size, ya.size);
  return ratio >= 0.75;
};

const identityPairCompatible = (
  expectedA: any,
  expectedB: any,
  observedA: any,
  observedB: any
): { ok: boolean; swapped: boolean } => {
  const direct =
    identityTeamCompatible(expectedA, observedA) &&
    identityTeamCompatible(expectedB, observedB);

  if (direct) return { ok: true, swapped: false };

  const swapped =
    identityTeamCompatible(expectedA, observedB) &&
    identityTeamCompatible(expectedB, observedA);

  return { ok: swapped, swapped };
};

`;
  if (text.includes(marker)) {
    text = text.replace(marker, helper + marker);
    changed++;
  } else {
    console.warn('[V6_10_8] Marcador do pipeline não encontrado.');
  }
}

// -----------------------------------------------------------------------------
// 2) Schema: identidade observada no vídeo é separada do contexto esperado.
// -----------------------------------------------------------------------------
replaceOnce(
  'schema identidadeVideo',
  `    timeA: { type: Type.STRING },
    timeB: { type: Type.STRING },
    placar: { type: Type.STRING },`,
  `    timeA: { type: Type.STRING },
    timeB: { type: Type.STRING },
    identidadeVideo: {
      type: Type.OBJECT,
      properties: {
        timeAObservado: { type: Type.STRING },
        timeBObservado: { type: Type.STRING },
        confirmado: { type: Type.BOOLEAN },
        evidencia: { type: Type.STRING }
      },
      required: ['timeAObservado', 'timeBObservado', 'confirmado', 'evidencia']
    },
    placar: { type: Type.STRING },`
);

replaceOnce(
  'required identidadeVideo',
  `    'timeA',
    'timeB',
    'placar',`,
  `    'timeA',
    'timeB',
    'identidadeVideo',
    'placar',`
);

// -----------------------------------------------------------------------------
// 3) O título passa a ser "esperado", nunca prova de que a IA viu aquele jogo.
// -----------------------------------------------------------------------------
replaceOnce(
  'contexto esperado',
  `MATCH CONTEXT IDENTIFICADO:
- Time A (Mandante): \${timeA}
- Time B (Visitante): \${timeB}`,
  `IDENTIDADE ESPERADA PELO TÍTULO/METADADOS — AINDA NÃO CONFIRMADA VISUALMENTE:
- Time A esperado: \${timeA}
- Time B esperado: \${timeB}`
);

replaceOnce(
  'regra de identidade visual',
  `DIRETRIZES FUNDAMENTAIS PARA AS SEÇÕES DA ANÁLISE:
1. FIDELIDADE ABSOLUTA AO VÍDEO ATUAL:`,
  `DIRETRIZES FUNDAMENTAIS PARA AS SEÇÕES DA ANÁLISE:
0. PORTÃO DE IDENTIDADE OBRIGATÓRIO:
   - Antes de qualquer análise tática, identifique VISUALMENTE quais equipes aparecem no vídeo atual.
   - Preencha identidadeVideo.timeAObservado e identidadeVideo.timeBObservado com o que você realmente reconhece no conteúdo visual.
   - NÃO copie automaticamente os nomes da "identidade esperada" acima.
   - Se não houver evidência visual suficiente para confirmar os dois times, use "NÃO CONFIRMADO" nos campos observados e identidadeVideo.confirmado=false.
   - Se o vídeo mostrar equipes diferentes das esperadas, informe os nomes realmente observados e identidadeVideo.confirmado=false.
   - identidadeVideo.evidencia deve dizer brevemente qual evidência visual sustentou a identificação (placar na tela, escudos, uniformes, GC da transmissão etc.).
   - Não produza conteúdo de outro confronto para preencher lacunas.
1. FIDELIDADE ABSOLUTA AO VÍDEO ATUAL:`
);

// -----------------------------------------------------------------------------
// 4) Antes de sobrescrever os nomes, comparar a identidade observada.
// -----------------------------------------------------------------------------
replaceOnce(
  'gate antes da sobrescrita',
  `    // --- ETAPA 5: SANITIZAÇÃO, AUDITORIA DE PLACAR E NORMALIZAÇÃO ---
    parsed.timeA = timeA;
    parsed.timeB = timeB;`,
  `    // --- ETAPA 5: PORTÃO DE IDENTIDADE + SANITIZAÇÃO ---
    // NUNCA sobrescreva os nomes reportados pela IA antes desta validação.
    const aiReportedTimeA = String(parsed.timeA || '').trim();
    const aiReportedTimeB = String(parsed.timeB || '').trim();
    const observedIdentityA = String(parsed.identidadeVideo?.timeAObservado || aiReportedTimeA || '').trim();
    const observedIdentityB = String(parsed.identidadeVideo?.timeBObservado || aiReportedTimeB || '').trim();
    const visualIdentityConfirmed = parsed.identidadeVideo?.confirmado === true;

    const expectedIdentityIsStrict =
      !isGenericIdentityTeam(timeA) &&
      !isGenericIdentityTeam(timeB);

    const identityMatch = identityPairCompatible(
      timeA,
      timeB,
      observedIdentityA,
      observedIdentityB
    );

    console.log(
      \`[IDENTITY_GATE] expected="\${timeA} x \${timeB}" observed="\${observedIdentityA} x \${observedIdentityB}" visualConfirmed=\${visualIdentityConfirmed} pairMatch=\${identityMatch.ok} swapped=\${identityMatch.swapped}\`
    );

    if (expectedIdentityIsStrict && (!visualIdentityConfirmed || !identityMatch.ok)) {
      const identityError: any = new Error(
        \`A análise foi bloqueada porque a identidade visual do jogo não coincide com o vídeo esperado. Esperado: \${timeA} x \${timeB}. Identificado pela IA: \${observedIdentityA || 'não confirmado'} x \${observedIdentityB || 'não confirmado'}.\`
      );
      identityError.code = 'MATCH_IDENTITY_CONFLICT';
      identityError.status = 409;
      identityError.expectedTeams = [timeA, timeB];
      identityError.observedTeams = [observedIdentityA, observedIdentityB];
      throw identityError;
    }

    // Somente depois do portão de identidade os nomes canônicos do título/metadado
    // podem ser usados para padronizar a apresentação.
    parsed.timeA = timeA;
    parsed.timeB = timeB;

    if (!parsed.verificacaoAuditoria) parsed.verificacaoAuditoria = {};
    parsed.verificacaoAuditoria.identityAudit = {
      expectedTimeA: timeA,
      expectedTimeB: timeB,
      observedTimeA: observedIdentityA,
      observedTimeB: observedIdentityB,
      visuallyConfirmed: visualIdentityConfirmed,
      pairMatched: identityMatch.ok,
      swapped: identityMatch.swapped,
      evidence: String(parsed.identidadeVideo?.evidencia || '').trim(),
    };`
);

// -----------------------------------------------------------------------------
// 5) Uma URL/título sozinho não pode virar "verified" antes do retorno da IA.
// -----------------------------------------------------------------------------
if (!text.includes('[IDENTITY_GATE_PRE_AI]')) {
  const oldStatus = `    // Validação granular por seção
    const sectionValidation = {`;
  const newStatus = `    // URL/título e capacidade nativa de abrir o YouTube não provam, sozinhos,
    // que o conteúdo visual corresponde à partida esperada.
    if (useNativeYouTubeVideo && !evidence.hasRealVideoFrames && !hasTranscriptEvidence && validationStatus === 'verified') {
      validationStatus = 'partial';
      console.log('[IDENTITY_GATE_PRE_AI] status downgraded verified -> partial até confirmação visual da IA');
    }

    // Validação granular por seção
    const sectionValidation = {`;
  if (text.includes(oldStatus)) {
    text = text.replace(oldStatus, newStatus);
    changed++;
  } else {
    console.warn('[V6_10_8] Bloco de status pré-IA não encontrado.');
  }
}

// -----------------------------------------------------------------------------
// 6) Após passar o gate, identidade vira verificada.
// -----------------------------------------------------------------------------
if (!text.includes('[IDENTITY_GATE] accepted')) {
  const marker = `    // Verificação de integridade estrita
    if (normalized.videoId !== verifiedContext.videoId || normalized.sourceFingerprint !== sourceFingerprint) {`;
  const inserted = `    if (expectedIdentityIsStrict && visualIdentityConfirmed && identityMatch.ok) {
      normalized.validationStatus = 'verified';
      normalized.sectionValidation = {
        ...(normalized.sectionValidation || {}),
        matchIdentity: 'verified',
      };
      if (normalized.verificacaoAuditoria) {
        normalized.verificacaoAuditoria.nivelConfianca =
          normalized.verificacaoAuditoria.nivelConfianca === 'baixa'
            ? 'media'
            : normalized.verificacaoAuditoria.nivelConfianca;
      }
      console.log('[IDENTITY_GATE] accepted');
    }

    // Verificação de integridade estrita
    if (normalized.videoId !== verifiedContext.videoId || normalized.sourceFingerprint !== sourceFingerprint) {`;

  if (text.includes(marker)) {
    text = text.replace(marker, inserted);
    changed++;
  } else {
    console.warn('[V6_10_8] Marcador de integridade não encontrado.');
  }
}

// -----------------------------------------------------------------------------
// 7) Conflito de identidade vira 409 amigável e nunca entra no retry/fallback.
// -----------------------------------------------------------------------------
if (!text.includes("code: 'MATCH_IDENTITY_CONFLICT'")) {
  const marker = `    console.error('Erro técnico na análise:', err);

    const geminiCode = getGeminiErrorCode(err);`;
  const replacement = `    console.error('Erro técnico na análise:', err);

    if (err?.code === 'MATCH_IDENTITY_CONFLICT') {
      return res.status(409).json({
        error: err.message,
        code: 'MATCH_IDENTITY_CONFLICT',
        retryable: false,
        expectedTeams: err.expectedTeams || [],
        observedTeams: err.observedTeams || [],
      });
    }

    const geminiCode = getGeminiErrorCode(err);`;

  if (text.includes(marker)) {
    text = text.replace(marker, replacement);
    changed++;
  } else {
    console.warn('[V6_10_8] Catch resiliente não encontrado.');
  }
}

if (changed > 0) fs.writeFileSync(filePath, text, 'utf8');
console.log(`[V6_10_8] server.ts: ${changed} ajuste(s) aplicado(s).`);
