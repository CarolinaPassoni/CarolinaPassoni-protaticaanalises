const fs = require('node:fs');
const path = require('node:path');

let totalChanges = 0;

const patchTextFile = (relativePath, mutator) => {
  const filePath = path.join(process.cwd(), relativePath);
  let text = fs.readFileSync(filePath, 'utf8');
  const before = text;
  text = mutator(text);

  if (text !== before) {
    fs.writeFileSync(filePath, text, 'utf8');
    totalChanges++;
    console.log(`[V6_10_9] ${relativePath}: atualizado.`);
  } else {
    console.warn(`[V6_10_9] ${relativePath}: nenhum ajuste aplicado.`);
  }
};

// ============================================================================
// NORMALIZAÇÃO: texto "indisponível" não é análise tática.
// ============================================================================
patchTextFile('src/utils/normalizeAnalysis.ts', (text) => {
  if (!text.includes('const cleanTacticalNarrative =')) {
    const marker = '  // Normalize Phases\n';
    const helper = `  const cleanTacticalNarrative = (value: any): string | undefined => {
    if (!hasValue(value)) return undefined;
    const clean = String(value).trim();
    const normalized = clean
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\\u0300-\\u036f]/g, '');

    if (
      normalized.includes('nao disponivel') ||
      normalized.includes('indisponivel') ||
      normalized.includes('nao identificado') ||
      normalized.includes('evidencia insuficiente') ||
      normalized === 'n/d'
    ) {
      return undefined;
    }

    return clean;
  };

`;
    if (text.includes(marker)) {
      text = text.replace(marker, helper + marker);
    }
  }

  const replacements = [
    ['rawDef.timeA?.posicionamento || undefined', 'cleanTacticalNarrative(rawDef.timeA?.posicionamento)'],
    ['rawDef.timeA?.compactacao_pressao || undefined', 'cleanTacticalNarrative(rawDef.timeA?.compactacao_pressao)'],
    ['rawDef.timeA?.transicao || undefined', 'cleanTacticalNarrative(rawDef.timeA?.transicao)'],
    ['rawDef.timeB?.posicionamento || undefined', 'cleanTacticalNarrative(rawDef.timeB?.posicionamento)'],
    ['rawDef.timeB?.compactacao_pressao || undefined', 'cleanTacticalNarrative(rawDef.timeB?.compactacao_pressao)'],
    ['rawDef.timeB?.transicao || undefined', 'cleanTacticalNarrative(rawDef.timeB?.transicao)'],
    ['rawOf.timeA?.saidaDeBola || undefined', 'cleanTacticalNarrative(rawOf.timeA?.saidaDeBola)'],
    ['rawOf.timeA?.criacao || undefined', 'cleanTacticalNarrative(rawOf.timeA?.criacao)'],
    ['rawOf.timeA?.finalizacao_movimentacao || undefined', 'cleanTacticalNarrative(rawOf.timeA?.finalizacao_movimentacao)'],
    ['rawOf.timeB?.saidaDeBola || undefined', 'cleanTacticalNarrative(rawOf.timeB?.saidaDeBola)'],
    ['rawOf.timeB?.criacao || undefined', 'cleanTacticalNarrative(rawOf.timeB?.criacao)'],
    ['rawOf.timeB?.finalizacao_movimentacao || undefined', 'cleanTacticalNarrative(rawOf.timeB?.finalizacao_movimentacao)'],
  ];

  for (const [oldText, newText] of replacements) {
    text = text.replace(oldText, newText);
  }

  return text;
});

// ============================================================================
// BACKEND: o passe focado de métricas passa a completar também ataque e defesa.
// ============================================================================
patchTextFile('server.ts', (text) => {
  // --------------------------------------------------------------------------
  // 1) Amplia o SEGMENT_METRICS_SCHEMA com fases táticas obrigatórias.
  // --------------------------------------------------------------------------
  const schemaStart = text.indexOf('const SEGMENT_METRICS_SCHEMA = {');
  const schemaEndMarker = '\n};\n\nconst clampNumber';
  const schemaEnd = schemaStart >= 0 ? text.indexOf(schemaEndMarker, schemaStart) : -1;

  if (schemaStart >= 0 && schemaEnd > schemaStart) {
    let block = text.slice(schemaStart, schemaEnd + 3);

    if (!block.includes('faseDefensiva:')) {
      block = block.replace(
        `    confianca: { type: Type.NUMBER },`,
        `    faseDefensiva: {
      type: Type.OBJECT,
      properties: {
        timeA: {
          type: Type.OBJECT,
          properties: {
            posicionamento: { type: Type.STRING },
            compactacao_pressao: { type: Type.STRING },
            transicao: { type: Type.STRING },
          },
          required: ['posicionamento', 'compactacao_pressao', 'transicao'],
        },
        timeB: {
          type: Type.OBJECT,
          properties: {
            posicionamento: { type: Type.STRING },
            compactacao_pressao: { type: Type.STRING },
            transicao: { type: Type.STRING },
          },
          required: ['posicionamento', 'compactacao_pressao', 'transicao'],
        },
      },
      required: ['timeA', 'timeB'],
    },
    faseOfensiva: {
      type: Type.OBJECT,
      properties: {
        timeA: {
          type: Type.OBJECT,
          properties: {
            saidaDeBola: { type: Type.STRING },
            criacao: { type: Type.STRING },
            finalizacao_movimentacao: { type: Type.STRING },
          },
          required: ['saidaDeBola', 'criacao', 'finalizacao_movimentacao'],
        },
        timeB: {
          type: Type.OBJECT,
          properties: {
            saidaDeBola: { type: Type.STRING },
            criacao: { type: Type.STRING },
            finalizacao_movimentacao: { type: Type.STRING },
          },
          required: ['saidaDeBola', 'criacao', 'finalizacao_movimentacao'],
        },
      },
      required: ['timeA', 'timeB'],
    },
    confianca: { type: Type.NUMBER },`
      );

      block = block.replace(
        `    'mapaDeCalor',
    'confianca',`,
        `    'mapaDeCalor',
    'faseDefensiva',
    'faseOfensiva',
    'confianca',`
      );

      text = text.slice(0, schemaStart) + block + text.slice(schemaEnd + 3);
    }
  }

  // --------------------------------------------------------------------------
  // 2) Prompt focado: exige análise defensiva e ofensiva observável.
  // --------------------------------------------------------------------------
  if (!text.includes('6. FASE DEFENSIVA DO TRECHO:')) {
    text = text.replace(
      `6. CONFIANÇA:
   - 0 a 100, refletindo qualidade visual e clareza para contar/estimar as métricas.

7. NÃO use estatísticas externas da partida.
8. NÃO use memória de outros jogos.
9. Todos os números referem-se SOMENTE ao trecho \${startSec}s–\${endSec}s.
10. Retorne apenas o JSON do schema solicitado.`,
      `6. FASE DEFENSIVA DO TRECHO:
   Para CADA equipe, descreva com base no que é VISUALMENTE observado:
   - posicionamento: altura do bloco, largura/profundidade, linha defensiva, proteção de área e comportamento sem bola;
   - compactacao_pressao: distância entre setores, intensidade e gatilhos de pressão, encaixes, coberturas e comportamento após passe adversário;
   - transicao: reação imediatamente após perder/recuperar a bola, recomposição, proteção de profundidade e contra-pressão.
   Cada campo deve ter uma descrição objetiva de pelo menos 2 frases.
   NÃO escreva "não disponível", "evidência insuficiente" ou equivalente. Descreva somente tendências realmente observadas no trecho.

7. FASE OFENSIVA DO TRECHO:
   Para CADA equipe, descreva:
   - saidaDeBola: estrutura de primeira fase, participação do goleiro/zagueiros/laterais e forma de superar a primeira pressão;
   - criacao: progressão, ocupação de corredores, entrelinhas, amplitude, apoios e padrões de combinação;
   - finalizacao_movimentacao: chegada ao último terço, ataques à área, movimentos de ruptura, cruzamentos e forma de criação das finalizações.
   Cada campo deve ter uma descrição objetiva de pelo menos 2 frases.
   NÃO escreva "não disponível". Use somente comportamentos observados no trecho.

8. CONFIANÇA:
   - 0 a 100, refletindo qualidade visual e clareza para contar/estimar as métricas e comportamentos táticos.

9. NÃO use estatísticas externas da partida.
10. NÃO use memória de outros jogos.
11. Todos os números e descrições referem-se SOMENTE ao trecho \${startSec}s–\${endSec}s.
12. Retorne apenas o JSON do schema solicitado.`
    );
  }

  // --------------------------------------------------------------------------
  // 3) Helper de texto tático limpo.
  // --------------------------------------------------------------------------
  if (!text.includes('const cleanTacticalSupplementText =')) {
    const marker = 'const applySegmentMetricsToAnalysis = (';
    const helper = `const cleanTacticalSupplementText = (value: any): string | undefined => {
  const clean = String(value || '').trim();
  if (!clean) return undefined;

  const normalized = clean
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\\u0300-\\u036f]/g, '');

  if (
    normalized.includes('nao disponivel') ||
    normalized.includes('indisponivel') ||
    normalized.includes('nao identificado') ||
    normalized.includes('evidencia insuficiente') ||
    normalized === 'n/d'
  ) {
    return undefined;
  }

  return clean.length >= 12 ? clean : undefined;
};

`;
    if (text.includes(marker)) {
      text = text.replace(marker, helper + marker);
    }
  }

  // --------------------------------------------------------------------------
  // 4) Merge das fases táticas no mesmo passe que já calcula posse/heatmap.
  // --------------------------------------------------------------------------
  const applyStart = text.indexOf('const applySegmentMetricsToAnalysis = (');
  const applyEnd = applyStart >= 0 ? text.indexOf('\n  return analysis;\n};', applyStart) : -1;

  if (applyStart >= 0 && applyEnd > applyStart) {
    let block = text.slice(applyStart, applyEnd);

    if (!block.includes('analiseTaticaOrigem')) {
      const marker = `  analysis.verificacaoAuditoria = {`;
      const merge = `  const defensiveA = metrics?.faseDefensiva?.timeA || {};
  const defensiveB = metrics?.faseDefensiva?.timeB || {};
  const offensiveA = metrics?.faseOfensiva?.timeA || {};
  const offensiveB = metrics?.faseOfensiva?.timeB || {};

  analysis.faseDefensiva = {
    timeA: {
      posicionamento:
        cleanTacticalSupplementText(defensiveA.posicionamento) ||
        analysis.faseDefensiva?.timeA?.posicionamento,
      compactacao_pressao:
        cleanTacticalSupplementText(defensiveA.compactacao_pressao) ||
        analysis.faseDefensiva?.timeA?.compactacao_pressao,
      transicao:
        cleanTacticalSupplementText(defensiveA.transicao) ||
        analysis.faseDefensiva?.timeA?.transicao,
    },
    timeB: {
      posicionamento:
        cleanTacticalSupplementText(defensiveB.posicionamento) ||
        analysis.faseDefensiva?.timeB?.posicionamento,
      compactacao_pressao:
        cleanTacticalSupplementText(defensiveB.compactacao_pressao) ||
        analysis.faseDefensiva?.timeB?.compactacao_pressao,
      transicao:
        cleanTacticalSupplementText(defensiveB.transicao) ||
        analysis.faseDefensiva?.timeB?.transicao,
    },
  };

  analysis.faseOfensiva = {
    timeA: {
      saidaDeBola:
        cleanTacticalSupplementText(offensiveA.saidaDeBola) ||
        analysis.faseOfensiva?.timeA?.saidaDeBola,
      criacao:
        cleanTacticalSupplementText(offensiveA.criacao) ||
        analysis.faseOfensiva?.timeA?.criacao,
      finalizacao_movimentacao:
        cleanTacticalSupplementText(offensiveA.finalizacao_movimentacao) ||
        analysis.faseOfensiva?.timeA?.finalizacao_movimentacao,
    },
    timeB: {
      saidaDeBola:
        cleanTacticalSupplementText(offensiveB.saidaDeBola) ||
        analysis.faseOfensiva?.timeB?.saidaDeBola,
      criacao:
        cleanTacticalSupplementText(offensiveB.criacao) ||
        analysis.faseOfensiva?.timeB?.criacao,
      finalizacao_movimentacao:
        cleanTacticalSupplementText(offensiveB.finalizacao_movimentacao) ||
        analysis.faseOfensiva?.timeB?.finalizacao_movimentacao,
    },
  };

  analysis.sectionValidation = {
    ...(analysis.sectionValidation || {}),
    possession: 'partial',
    heatmap: 'partial',
    tacticalShape: 'partial',
    statistics: 'partial',
  };

  analysis.verificacaoAuditoria = {
    ...(analysis.verificacaoAuditoria || {}),
    analiseTaticaOrigem: 'video_trecho_focado',
    analiseTaticaTrecho: \`\${startSec}s - \${endSec}s\`,
    analiseTaticaModelo: modelUsed,
  };

`;
      if (block.includes(marker)) {
        block = block.replace(marker, merge + marker);
        text = text.slice(0, applyStart) + block + text.slice(applyEnd);
      }
    }
  }

  // --------------------------------------------------------------------------
  // 5) Completação automática em análises novas quando o retorno principal
  //    vier sem posse, heatmap ou fases táticas.
  // --------------------------------------------------------------------------
  if (!text.includes('[TACTICAL_COMPLETION] start')) {
    const marker = `    if (!parsed.contextoPartida) parsed.contextoPartida = {};`;
    const insertion = `    const tacticalNarrativeOk = (value: any) =>
      Boolean(cleanTacticalSupplementText(value));

    const possessionComplete =
      Number.isFinite(Number(String(parsed?.estatisticas?.posseDeBola?.timeA || '').replace('%', ''))) &&
      Number.isFinite(Number(String(parsed?.estatisticas?.posseDeBola?.timeB || '').replace('%', '')));

    const heatmapComplete = Boolean(
      parsed?.estatisticas?.mapaDeCalor?.timeA?.tercoDefensivo &&
      parsed?.estatisticas?.mapaDeCalor?.timeA?.tercoMedio &&
      parsed?.estatisticas?.mapaDeCalor?.timeA?.tercoOfensivo &&
      parsed?.estatisticas?.mapaDeCalor?.timeB?.tercoDefensivo &&
      parsed?.estatisticas?.mapaDeCalor?.timeB?.tercoMedio &&
      parsed?.estatisticas?.mapaDeCalor?.timeB?.tercoOfensivo
    );

    const defensiveComplete = Boolean(
      tacticalNarrativeOk(parsed?.faseDefensiva?.timeA?.posicionamento) &&
      tacticalNarrativeOk(parsed?.faseDefensiva?.timeA?.compactacao_pressao) &&
      tacticalNarrativeOk(parsed?.faseDefensiva?.timeA?.transicao) &&
      tacticalNarrativeOk(parsed?.faseDefensiva?.timeB?.posicionamento) &&
      tacticalNarrativeOk(parsed?.faseDefensiva?.timeB?.compactacao_pressao) &&
      tacticalNarrativeOk(parsed?.faseDefensiva?.timeB?.transicao)
    );

    const offensiveComplete = Boolean(
      tacticalNarrativeOk(parsed?.faseOfensiva?.timeA?.saidaDeBola) &&
      tacticalNarrativeOk(parsed?.faseOfensiva?.timeA?.criacao) &&
      tacticalNarrativeOk(parsed?.faseOfensiva?.timeA?.finalizacao_movimentacao) &&
      tacticalNarrativeOk(parsed?.faseOfensiva?.timeB?.saidaDeBola) &&
      tacticalNarrativeOk(parsed?.faseOfensiva?.timeB?.criacao) &&
      tacticalNarrativeOk(parsed?.faseOfensiva?.timeB?.finalizacao_movimentacao)
    );

    const needsTacticalCompletion =
      useNativeYouTubeVideo &&
      (!possessionComplete || !heatmapComplete || !defensiveComplete || !offensiveComplete);

    if (needsTacticalCompletion) {
      console.log(
        \`[TACTICAL_COMPLETION] start possession=\${possessionComplete} heatmap=\${heatmapComplete} defensive=\${defensiveComplete} offensive=\${offensiveComplete}\`
      );

      try {
        const completion = await extractSegmentMetricsFromVideo({
          apiKey,
          videoUrl: verifiedContext.sourceUrl,
          timeA,
          timeB,
          startSec,
          endSec,
        });

        applySegmentMetricsToAnalysis(
          parsed,
          completion.data,
          startSec,
          endSec,
          completion.modelUsed
        );

        console.log(
          \`[TACTICAL_COMPLETION] success model=\${completion.modelUsed} range=\${startSec}-\${endSec}\`
        );
      } catch (completionErr: any) {
        console.warn(
          \`[TACTICAL_COMPLETION] warning=\${String(completionErr?.message || completionErr).slice(0, 280)}\`
        );
      }
    }

`;
    if (text.includes(marker)) {
      text = text.replace(marker, insertion + marker);
    } else {
      console.warn('[V6_10_9] marcador de contexto para completion não encontrado.');
    }
  }

  // --------------------------------------------------------------------------
  // 6) Recálculo histórico retorna o payload RELIDO do Turso.
  // --------------------------------------------------------------------------
  text = text.replace(
`      console.log(
        \`[SEGMENT_METRICS] analysisId=\${id} success=true model=\${modelUsed} confidence=\${updated.verificacaoAuditoria?.metricasConfianca}\`
      );

      return res.json({
        ok: true,
        analysis: enrichAnalysisFromDb(updated),`,
`      console.log(
        \`[SEGMENT_METRICS] analysisId=\${id} success=true model=\${modelUsed} confidence=\${updated.verificacaoAuditoria?.metricasConfianca}\`
      );

      const refreshedAnalysis = getAnalysisById(id, ownerScope) || updated;

      return res.json({
        ok: true,
        analysis: enrichAnalysisFromDb(refreshedAnalysis),`
  );

  return text;
});

// ============================================================================
// FRONTEND: o botão passa a completar números + ataque + defesa.
// ============================================================================
patchTextFile('src/components/AnalysisDisplay.tsx', (text) => {
  // Flags táticas para liberar o botão também quando ataque/defesa estiverem vazios.
  if (!text.includes('const hasDefensiveTacticalAnalysis =')) {
    const marker = `  const needsMetricRecalc = Boolean(`;
    const helper = `  const hasDefensiveTacticalAnalysis = Boolean(
    hasValue(analysis.faseDefensiva?.timeA?.posicionamento) &&
    hasValue(analysis.faseDefensiva?.timeA?.compactacao_pressao) &&
    hasValue(analysis.faseDefensiva?.timeA?.transicao) &&
    hasValue(analysis.faseDefensiva?.timeB?.posicionamento) &&
    hasValue(analysis.faseDefensiva?.timeB?.compactacao_pressao) &&
    hasValue(analysis.faseDefensiva?.timeB?.transicao)
  );

  const hasOffensiveTacticalAnalysis = Boolean(
    hasValue(analysis.faseOfensiva?.timeA?.saidaDeBola) &&
    hasValue(analysis.faseOfensiva?.timeA?.criacao) &&
    hasValue(analysis.faseOfensiva?.timeA?.finalizacao_movimentacao) &&
    hasValue(analysis.faseOfensiva?.timeB?.saidaDeBola) &&
    hasValue(analysis.faseOfensiva?.timeB?.criacao) &&
    hasValue(analysis.faseOfensiva?.timeB?.finalizacao_movimentacao)
  );

`;
    if (text.includes(marker)) text = text.replace(marker, helper + marker);
  }

  text = text.replace(
    `      !hasHeatmapThirds`,
    `      !hasHeatmapThirds ||
      !hasDefensiveTacticalAnalysis ||
      !hasOffensiveTacticalAnalysis`
  );

  text = text.replace(
    `Gemini analisando novamente o trecho para calcular as métricas...`,
    `Gemini analisando novamente o trecho para completar métricas, fase ofensiva e fase defensiva...`
  );

  text = text.replace(
    `Métricas do trecho recalculadas e salvas. Valores marcados como estimativa visual da IA.`,
    `Métricas e análise tática do trecho recalculadas e salvas. Posse, mapa de calor, fase ofensiva e fase defensiva foram atualizados a partir do vídeo.`
  );

  text = text.replace(
    `title="Reprocessar somente as métricas do trecho salvo"`,
    `title="Reprocessar métricas, fase ofensiva e fase defensiva do trecho salvo"`
  );

  text = text.replace(
    `{isRecalculatingMetrics ? 'Calculando métricas...' : 'Recalcular métricas do vídeo'}`,
    `{isRecalculatingMetrics ? 'Completando análise...' : 'Completar métricas e análise tática'}`
  );

  // Avisos claros dentro das fases, em vez de área aparentemente quebrada.
  if (!text.includes('Fase defensiva ainda não foi completada')) {
    text = text.replace(
      `<AnalysisCard title={loc[currentLang].defendingPhase} icon={<TacticIcon />}>
            <div className="grid md:grid-cols-2 gap-8">`,
      `<AnalysisCard title={loc[currentLang].defendingPhase} icon={<TacticIcon />}>
            {!hasDefensiveTacticalAnalysis && (
              <div className="mb-5 rounded-xl border border-amber-800/40 bg-amber-950/20 px-4 py-3 text-sm text-amber-200">
                Fase defensiva ainda não foi completada nesta análise. Use “Completar métricas e análise tática” para reprocessar o trecho do vídeo.
              </div>
            )}
            <div className="grid md:grid-cols-2 gap-8">`
    );
  }

  if (!text.includes('Fase ofensiva ainda não foi completada')) {
    text = text.replace(
      `<AnalysisCard title={loc[currentLang].offensivePhase} icon={<TacticIcon />}>
            <div className="grid md:grid-cols-2 gap-8">`,
      `<AnalysisCard title={loc[currentLang].offensivePhase} icon={<TacticIcon />}>
            {!hasOffensiveTacticalAnalysis && (
              <div className="mb-5 rounded-xl border border-amber-800/40 bg-amber-950/20 px-4 py-3 text-sm text-amber-200">
                Fase ofensiva ainda não foi completada nesta análise. Use “Completar métricas e análise tática” para reprocessar o trecho do vídeo.
              </div>
            )}
            <div className="grid md:grid-cols-2 gap-8">`
    );
  }

  return text;
});

console.log(`[V6_10_9] concluído; arquivos modificados=${totalChanges}.`);
