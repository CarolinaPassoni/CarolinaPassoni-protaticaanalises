const fs = require('node:fs');
const path = require('node:path');

const patchFile = (relativePath, replacements) => {
  const filePath = path.join(process.cwd(), relativePath);
  let text = fs.readFileSync(filePath, 'utf8');
  let changed = 0;

  for (const { label, oldText, newText } of replacements) {
    if (text.includes(newText)) continue;
    if (!text.includes(oldText)) {
      console.warn(`[V6_10_5] Trecho não encontrado em ${relativePath}: ${label}`);
      continue;
    }
    text = text.replace(oldText, newText);
    changed++;
  }

  if (changed > 0) fs.writeFileSync(filePath, text, 'utf8');
  console.log(`[V6_10_5] ${relativePath}: ${changed} ajuste(s) aplicado(s).`);
};

// ============================================================================
// 1) TURSO: atualização do payload sem trocar dono/created_at.
// ============================================================================
patchFile('src/db-sqlite.ts', [
  {
    label: 'updateAnalysisPayload',
    oldText: `export const getPublicAnalysisById = (id: string) => {`,
    newText: `export const updateAnalysisPayload = (id: string, analysis: any) => {
  if (!id || !analysis) return false;

  const existing: any = db.prepare(
    'SELECT created_at FROM analyses WHERE id = ?'
  ).get(id);

  if (!existing) return false;

  const createdAt = analysis.createdAt || existing.created_at || new Date().toISOString();
  const payload = {
    ...analysis,
    analysisId: id,
    createdAt,
  };

  let confidenceVal = String(
    payload.verificacaoAuditoria?.nivelConfianca ||
    payload.placarAuditoria?.confianca ||
    'baixa'
  ).trim().toLowerCase();

  if (!['alta', 'media', 'baixa'].includes(confidenceVal)) confidenceVal = 'baixa';

  db.prepare(\`
    UPDATE analyses
       SET video_title = ?,
           video_url = ?,
           video_id = ?,
           team_a = ?,
           team_b = ?,
           placar = ?,
           confidence = ?,
           strategy = ?,
           payload_json = ?
     WHERE id = ?
  \`).run(
    payload.videoTitle || '',
    payload.videoUrl || '',
    payload.videoId || '',
    payload.timeA || '',
    payload.timeB || '',
    payload.placar || '',
    confidenceVal,
    payload.verificacaoAuditoria?.estrategiaAnalise || '',
    JSON.stringify(payload),
    id
  );

  return true;
};

export const getPublicAnalysisById = (id: string) => {`,
  },
]);

// ============================================================================
// 2) SERVER: import, extrator de métricas e endpoint de recálculo.
// ============================================================================
patchFile('server.ts', [
  {
    label: 'import updateAnalysisPayload',
    oldText: `  getAnalysisById,
  getPublicAnalysisById,`,
    newText: `  getAnalysisById,
  updateAnalysisPayload,
  getPublicAnalysisById,`,
  },
  {
    label: 'helper de métricas do vídeo',
    oldText: `export const getGeminiApiKey = (): string => {`,
    newText: `const SEGMENT_METRICS_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    posseDeBola: {
      type: Type.OBJECT,
      properties: {
        timeA: { type: Type.NUMBER },
        timeB: { type: Type.NUMBER },
      },
      required: ['timeA', 'timeB'],
    },
    finalizacoes: {
      type: Type.OBJECT,
      properties: {
        timeA: { type: Type.NUMBER },
        timeB: { type: Type.NUMBER },
      },
      required: ['timeA', 'timeB'],
    },
    finalizacoesNoAlvo: {
      type: Type.OBJECT,
      properties: {
        timeA: { type: Type.NUMBER },
        timeB: { type: Type.NUMBER },
      },
      required: ['timeA', 'timeB'],
    },
    grandesChances: {
      type: Type.OBJECT,
      properties: {
        timeA: { type: Type.NUMBER },
        timeB: { type: Type.NUMBER },
      },
      required: ['timeA', 'timeB'],
    },
    xGEstimado: {
      type: Type.OBJECT,
      properties: {
        timeA: { type: Type.NUMBER },
        timeB: { type: Type.NUMBER },
      },
      required: ['timeA', 'timeB'],
    },
    mapaDeCalor: {
      type: Type.OBJECT,
      properties: {
        timeA: {
          type: Type.OBJECT,
          properties: {
            tercoDefensivo: { type: Type.NUMBER },
            tercoMedio: { type: Type.NUMBER },
            tercoOfensivo: { type: Type.NUMBER },
          },
          required: ['tercoDefensivo', 'tercoMedio', 'tercoOfensivo'],
        },
        timeB: {
          type: Type.OBJECT,
          properties: {
            tercoDefensivo: { type: Type.NUMBER },
            tercoMedio: { type: Type.NUMBER },
            tercoOfensivo: { type: Type.NUMBER },
          },
          required: ['tercoDefensivo', 'tercoMedio', 'tercoOfensivo'],
        },
      },
      required: ['timeA', 'timeB'],
    },
    confianca: { type: Type.NUMBER },
    observacoes: { type: Type.STRING },
  },
  required: [
    'posseDeBola',
    'finalizacoes',
    'finalizacoesNoAlvo',
    'grandesChances',
    'xGEstimado',
    'mapaDeCalor',
    'confianca',
    'observacoes',
  ],
};

const clampNumber = (value: any, min: number, max: number): number => {
  const n = Number(value);
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
};

const normalizePair100 = (aRaw: any, bRaw: any): [number, number] => {
  const a = Math.max(0, Number(aRaw) || 0);
  const b = Math.max(0, Number(bRaw) || 0);
  const total = a + b;

  if (total <= 0) return [50, 50];

  const aPct = Math.round((a / total) * 100);
  return [aPct, 100 - aPct];
};

const normalizeTriple100 = (xRaw: any, yRaw: any, zRaw: any): [number, number, number] => {
  const x = Math.max(0, Number(xRaw) || 0);
  const y = Math.max(0, Number(yRaw) || 0);
  const z = Math.max(0, Number(zRaw) || 0);
  const total = x + y + z;

  if (total <= 0) return [33, 34, 33];

  const a = Math.round((x / total) * 100);
  const b = Math.round((y / total) * 100);
  const c = 100 - a - b;

  return [Math.max(0, a), Math.max(0, b), Math.max(0, c)];
};

const parseAnalysisSegmentRange = (analysis: any): { startSec: number; endSec: number } => {
  const raw = String(
    analysis?.verificacaoAuditoria?.trechoAnalisado ||
    analysis?.verificacaoAuditoria?.segmentosAnalisados ||
    ''
  );

  const match = raw.match(/(\\d+)s\\s*-\\s*(\\d+)s/i);
  let startSec = match ? Number(match[1]) : 0;
  let endSec = match ? Number(match[2]) : 300;

  if (!Number.isFinite(startSec) || startSec < 0) startSec = 0;
  if (!Number.isFinite(endSec) || endSec <= startSec) endSec = startSec + 300;

  // O recálculo é uma etapa de métricas, não uma segunda análise tática completa.
  // Limitamos a 15 min por chamada para preservar estabilidade/cota.
  endSec = Math.min(endSec, startSec + 900);

  return { startSec, endSec };
};

const extractSegmentMetricsFromVideo = async ({
  apiKey,
  videoUrl,
  timeA,
  timeB,
  startSec,
  endSec,
}: {
  apiKey: string;
  videoUrl: string;
  timeA: string;
  timeB: string;
  startSec: number;
  endSec: number;
}) => {
  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: { 'User-Agent': 'aistudio-build' },
      timeout: 600000,
    },
  });

  const duration = Math.max(1, endSec - startSec);
  const fps = duration <= 300 ? 1 : 0.5;

  const prompt = \`
Você é o módulo de métricas visuais do ProTática.

Analise SOMENTE o trecho do vídeo entre \${startSec}s e \${endSec}s.
Times:
- Time A: \${timeA}
- Time B: \${timeB}

OBJETIVO:
Gerar métricas DO TRECHO ANALISADO, e não da partida inteira.

REGRAS:
1. POSSE DE BOLA:
   - estime o tempo de controle visível de cada equipe durante jogo ativo;
   - ignore replays, intervalos longos, tela de escalação e interrupções sem bola em jogo;
   - retorne dois números percentuais que somem 100.

2. FINALIZAÇÕES:
   - conte tentativas de chute observadas no trecho;
   - não duplique um lance quando a transmissão mostrar replay;
   - finalizações no alvo nunca podem ser maiores que finalizações.

3. GRANDES CHANCES:
   - conte somente oportunidades claramente perigosas observadas no trecho;
   - não duplique replays.

4. xG ESTIMADO IA:
   - isto NÃO é xG oficial;
   - estime apenas a partir das finalizações observadas, considerando distância, ângulo, pressão, tipo de assistência e situação do goleiro;
   - some os valores aproximados por equipe;
   - use valor decimal entre 0 e 5.

5. MAPA POR TERÇOS:
   - estime, para cada equipe, em que terço do campo a bola esteve durante SUAS posses controladas;
   - os três valores de cada equipe devem somar 100;
   - considere o sentido de ataque de cada time no trecho;
   - terço defensivo = próximo ao próprio gol;
   - terço ofensivo = próximo ao gol adversário.

6. CONFIANÇA:
   - 0 a 100, refletindo qualidade visual e clareza para contar/estimar as métricas.

7. NÃO use estatísticas externas da partida.
8. NÃO use memória de outros jogos.
9. Todos os números referem-se SOMENTE ao trecho \${startSec}s–\${endSec}s.
10. Retorne apenas o JSON do schema solicitado.
\`;

  const models = Array.from(new Set([
    GEMINI_MODEL,
    sanitizeModelName(process.env.GEMINI_FALLBACK_MODEL || 'gemini-3.7-flash'),
  ].filter(Boolean)));

  let lastError: any = null;

  for (const model of models) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: [
          {
            fileData: {
              fileUri: videoUrl,
              mimeType: 'video/*',
            },
            videoMetadata: {
              startOffset: \`\${Math.floor(startSec)}s\`,
              endOffset: \`\${Math.floor(endSec)}s\`,
              fps,
            },
          },
          { text: prompt },
        ],
        config: {
          responseMimeType: 'application/json',
          responseSchema: SEGMENT_METRICS_SCHEMA,
          maxOutputTokens: 4096,
        },
      });

      const text = String((response as any)?.text || '').trim();
      if (!text) throw new Error('Gemini não retornou métricas.');

      const parsed = JSON.parse(text);
      return { data: parsed, modelUsed: model };
    } catch (err: any) {
      lastError = err;
      const message = String(err?.message || err);
      console.warn(
        \`[SEGMENT_METRICS] model=\${model} success=false error=\${message.slice(0, 220)}\`
      );
    }
  }

  throw lastError || new Error('Não foi possível calcular as métricas do trecho.');
};

const applySegmentMetricsToAnalysis = (
  analysis: any,
  metrics: any,
  startSec: number,
  endSec: number,
  modelUsed: string
) => {
  const [posA, posB] = normalizePair100(
    metrics?.posseDeBola?.timeA,
    metrics?.posseDeBola?.timeB
  );

  const shotsA = Math.max(0, Math.round(Number(metrics?.finalizacoes?.timeA) || 0));
  const shotsB = Math.max(0, Math.round(Number(metrics?.finalizacoes?.timeB) || 0));

  const targetA = Math.min(
    shotsA,
    Math.max(0, Math.round(Number(metrics?.finalizacoesNoAlvo?.timeA) || 0))
  );
  const targetB = Math.min(
    shotsB,
    Math.max(0, Math.round(Number(metrics?.finalizacoesNoAlvo?.timeB) || 0))
  );

  const bigA = Math.min(
    shotsA,
    Math.max(0, Math.round(Number(metrics?.grandesChances?.timeA) || 0))
  );
  const bigB = Math.min(
    shotsB,
    Math.max(0, Math.round(Number(metrics?.grandesChances?.timeB) || 0))
  );

  const xgA = clampNumber(metrics?.xGEstimado?.timeA, 0, 5);
  const xgB = clampNumber(metrics?.xGEstimado?.timeB, 0, 5);

  const [aDef, aMid, aAtt] = normalizeTriple100(
    metrics?.mapaDeCalor?.timeA?.tercoDefensivo,
    metrics?.mapaDeCalor?.timeA?.tercoMedio,
    metrics?.mapaDeCalor?.timeA?.tercoOfensivo
  );

  const [bDef, bMid, bAtt] = normalizeTriple100(
    metrics?.mapaDeCalor?.timeB?.tercoDefensivo,
    metrics?.mapaDeCalor?.timeB?.tercoMedio,
    metrics?.mapaDeCalor?.timeB?.tercoOfensivo
  );

  analysis.estatisticas = {
    ...(analysis.estatisticas || {}),
    posseDeBola: {
      timeA: \`\${posA}%\`,
      timeB: \`\${posB}%\`,
    },
    finalizacoes: {
      timeA: String(shotsA),
      timeB: String(shotsB),
    },
    finalizacoesNoAlvo: {
      timeA: String(targetA),
      timeB: String(targetB),
    },
    mapaDeCalor: {
      timeA: {
        tercoDefensivo: \`\${aDef}%\`,
        tercoMedio: \`\${aMid}%\`,
        tercoOfensivo: \`\${aAtt}%\`,
      },
      timeB: {
        tercoDefensivo: \`\${bDef}%\`,
        tercoMedio: \`\${bMid}%\`,
        tercoOfensivo: \`\${bAtt}%\`,
      },
    },
  };

  analysis.indicadoresAvancados = {
    ...(analysis.indicadoresAvancados || {}),
    grandesChances: {
      timeA: String(bigA),
      timeB: String(bigB),
    },
    xG: {
      timeA: xgA.toFixed(2),
      timeB: xgB.toFixed(2),
    },
  };

  analysis.verificacaoAuditoria = {
    ...(analysis.verificacaoAuditoria || {}),
    metricasOrigem: 'estimativa_visual_trecho',
    metricasTrecho: \`\${startSec}s - \${endSec}s\`,
    metricasModelo: modelUsed,
    metricasConfianca: String(
      Math.round(clampNumber(metrics?.confianca, 0, 100))
    ),
    metricasObservacoes:
      String(metrics?.observacoes || '').trim() ||
      'Métricas estimadas visualmente a partir do trecho analisado.',
  };

  return analysis;
};

export const getGeminiApiKey = (): string => {`,
  },
  {
    label: 'prompt principal gera métricas estimadas do trecho',
    oldText: `5. ESTATÍSTICAS & POSSE DE BOLA: NÃO INVENTE NÚMEROS. Só preencha posse, finalizações, finalizações no alvo, passes certos, faltas, desarmes, escanteios e impedimentos quando o valor estiver explicitamente observado no vídeo/transcrição ou confirmado por fonte confiável da partida. Quando não houver evidência suficiente, OMITA o campo/objeto correspondente. NUNCA escreva "Não disponível", "N/D", "não identificado" ou frases no lugar de um número.
6. MAPA DE CALOR & TERÇOS: Os campos tercoDefensivo, tercoMedio e tercoOfensivo são EXCLUSIVAMENTE quantitativos. Quando houver evidência suficiente, use APENAS percentual curto no formato "32%". Não coloque descrições qualitativas nesses campos. Se não for possível quantificar, OMITA mapaDeCalor ou o respectivo campo.
7. INDICADORES AVANÇADOS: NÃO estime xG nem outras métricas avançadas por plausibilidade. Informe xG, grandes chances e passes no terço final somente quando houver medição explícita. Sem evidência, OMITA o campo correspondente; NUNCA use texto de placeholder como valor.`,
    newText: `5. MÉTRICAS DO TRECHO DE VÍDEO:
   Quando o vídeo estiver disponível nativamente para análise, gere métricas visuais estimadas SOMENTE para ESTE TRECHO:
   - posseDeBola: estime o tempo de controle visível de cada time; os dois percentuais devem somar 100;
   - finalizacoes: conte chutes/tentativas observados, sem duplicar replays;
   - finalizacoesNoAlvo: conte chutes no alvo observados; nunca maior que finalizacoes;
   - escanteios, faltas, impedimentos: conte somente eventos claramente observados.
   Se não houver evidência visual suficiente, omita a métrica em vez de inventar.
   IMPORTANTE: esses números são do TRECHO analisado, não da partida completa.
6. MAPA DE CALOR & TERÇOS:
   Quando houver vídeo nativo, faça uma estimativa territorial do TRECHO para cada time, baseada na localização da bola durante suas posses controladas.
   Para cada equipe, tercoDefensivo + tercoMedio + tercoOfensivo deve somar 100%.
   Use apenas percentuais curtos como "28%", "44%", "28%".
   Se não houver evidência visual suficiente, omita o mapa.
   Nunca coloque frases qualitativas nos campos dos terços.
7. INDICADORES AVANÇADOS:
   Quando houver vídeo nativo:
   - grandesChances: conte oportunidades claramente perigosas observadas no TRECHO, sem duplicar replay;
   - xG: forneça um xG IA APROXIMADO DO TRECHO, baseado apenas nas finalizações visíveis (distância, ângulo, pressão e situação do goleiro).
   Este xG NÃO é estatística oficial nem modelo calibrado de provedor externo.
   Sem evidência suficiente, omita o campo.
   Nunca use "Não disponível", "N/D" ou texto de placeholder como valor numérico.`,
  },
  {
    label: 'marca métricas de análises novas',
    oldText: `    parsed.timeA = timeA;
    parsed.timeB = timeB;

    if (!parsed.contextoPartida) parsed.contextoPartida = {};`,
    newText: `    parsed.timeA = timeA;
    parsed.timeB = timeB;

    if (!parsed.verificacaoAuditoria) parsed.verificacaoAuditoria = {};
    if (useNativeYouTubeVideo) {
      parsed.verificacaoAuditoria.metricasOrigem = 'estimativa_visual_trecho';
      parsed.verificacaoAuditoria.metricasTrecho = \`\${startSec}s - \${endSec}s\`;
      parsed.verificacaoAuditoria.metricasModelo = GEMINI_MODEL;
      parsed.verificacaoAuditoria.metricasObservacoes =
        'Posse, ocupação por terços e xG são estimativas visuais do trecho; contagens representam eventos observados no trecho, não estatísticas oficiais da partida completa.';
    }

    if (!parsed.contextoPartida) parsed.contextoPartida = {};`,
  },
  {
    label: 'endpoint recalcular métricas',
    oldText: `app.delete('/api/analyses', requireAuth, (req, res) => {`,
    newText: `app.post(
  '/api/analyses/:id/recalculate-metrics',
  requireAuth,
  requireActiveSubscription,
  requirePlanAtLeast('intelligence'),
  async (req, res) => {
    const user = (req as any).user;
    const ownerScope = getAnalysisOwnerScope(user);
    const id = String(req.params.id || '').trim();

    if (!id) return res.status(400).json({ error: 'ID da análise é obrigatório.' });

    try {
      const analysis = getAnalysisById(id, ownerScope);
      if (!analysis) return res.status(404).json({ error: 'Análise não encontrada.' });

      const videoUrl = String(analysis.videoUrl || '').trim();
      if (!/^https?:\\/\\/(?:www\\.)?(?:youtube\\.com|youtu\\.be)\\//i.test(videoUrl)) {
        return res.status(400).json({
          error: 'O recálculo automático de métricas requer uma URL pública do YouTube.',
        });
      }

      const apiKey = getGeminiApiKey();
      if (!apiKey) {
        return res.status(500).json({ error: 'Gemini não configurada no servidor.' });
      }

      const { startSec, endSec } = parseAnalysisSegmentRange(analysis);

      console.log(
        \`[SEGMENT_METRICS] analysisId=\${id} videoId=\${analysis.videoId || 'n/a'} range=\${startSec}-\${endSec}\`
      );

      const { data, modelUsed } = await extractSegmentMetricsFromVideo({
        apiKey,
        videoUrl,
        timeA: analysis.timeA || 'Time A',
        timeB: analysis.timeB || 'Time B',
        startSec,
        endSec,
      });

      const updated = applySegmentMetricsToAnalysis(
        analysis,
        data,
        startSec,
        endSec,
        modelUsed
      );

      const saved = updateAnalysisPayload(id, updated);
      if (!saved) {
        return res.status(500).json({ error: 'Falha ao atualizar a análise no banco.' });
      }

      console.log(
        \`[SEGMENT_METRICS] analysisId=\${id} success=true model=\${modelUsed} confidence=\${updated.verificacaoAuditoria?.metricasConfianca}\`
      );

      return res.json({
        ok: true,
        analysis: enrichAnalysisFromDb(updated),
        metrics: {
          origin: 'estimativa_visual_trecho',
          startSec,
          endSec,
          modelUsed,
          confidence: updated.verificacaoAuditoria?.metricasConfianca,
        },
      });
    } catch (err: any) {
      console.error('[SEGMENT_METRICS] Falha:', err);

      return res.status(502).json({
        error:
          'Não foi possível recalcular as métricas do vídeo agora. Tente novamente em alguns minutos.',
      });
    }
  }
);

app.delete('/api/analyses', requireAuth, (req, res) => {`,
  },
]);

// ============================================================================
// 3) FRONTEND: botão de recálculo e identificação da origem.
// ============================================================================
patchFile('src/components/AnalysisDisplay.tsx', [
  {
    label: 'imports do botão',
    oldText: `import { Send, Search, Activity, Target, Flame, Users as UsersIcon, ShieldCheck, Sparkles, Video, MessageSquare } from 'lucide-react';`,
    newText: `import { Send, Search, Activity, Target, Flame, Users as UsersIcon, ShieldCheck, Sparkles, Video, MessageSquare, RefreshCw } from 'lucide-react';`,
  },
  {
    label: 'auth headers',
    oldText: `import { AskYourGameChat } from './AskYourGameChat';
import { hasValue, normalizeHeatPercent } from '../utils/normalizeAnalysis';`,
    newText: `import { AskYourGameChat } from './AskYourGameChat';
import { getAuthHeaders } from '../services/geminiService';
import { hasValue, normalizeHeatPercent } from '../utils/normalizeAnalysis';`,
  },
  {
    label: 'estado recalculo',
    oldText: `  const [isTelegramModalOpen, setIsTelegramModalOpen] = React.useState(false);`,
    newText: `  const [isTelegramModalOpen, setIsTelegramModalOpen] = React.useState(false);
  const [isRecalculatingMetrics, setIsRecalculatingMetrics] = React.useState(false);
  const [metricsMessage, setMetricsMessage] = React.useState('');
  const [, setMetricsRevision] = React.useState(0);`,
  },
  {
    label: 'função recalcular métricas',
    oldText: `  const handleExportPDF = async () => {`,
    newText: `  const handleRecalculateMetrics = async () => {
    if (!analysis.analysisId) {
      setMetricsMessage('Salve a análise antes de recalcular as métricas.');
      return;
    }

    setIsRecalculatingMetrics(true);
    setMetricsMessage('Gemini analisando novamente o trecho para calcular as métricas...');

    try {
      const response = await fetch(
        \`/api/analyses/\${encodeURIComponent(analysis.analysisId)}/recalculate-metrics\`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...getAuthHeaders(),
          },
        }
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || 'Falha ao recalcular métricas.');
      }

      if (data.analysis) {
        Object.assign(analysis as any, data.analysis);
        setMetricsRevision((v) => v + 1);
      }

      setMetricsMessage(
        'Métricas do trecho recalculadas e salvas. Valores marcados como estimativa visual da IA.'
      );
    } catch (err: any) {
      setMetricsMessage(
        err?.message || 'Não foi possível recalcular as métricas agora.'
      );
    } finally {
      setIsRecalculatingMetrics(false);
    }
  };

  const handleExportPDF = async () => {`,
  },
  {
    label: 'flags da origem',
    oldText: `  const contexto = analysis.contextoPartida;
  const verificacao = analysis.verificacaoAuditoria;
  const placarAuditoria = analysis.placarAuditoria;`,
    newText: `  const metricsAudit = analysis.verificacaoAuditoria as any;
  const metricsEstimated = metricsAudit?.metricasOrigem === 'estimativa_visual_trecho';
  const needsMetricRecalc = Boolean(
    analysis.analysisId &&
    analysis.videoUrl &&
    (
      !hasValue(analysis.estatisticas?.posseDeBola?.timeA) ||
      !hasValue(analysis.estatisticas?.posseDeBola?.timeB) ||
      !hasValue(analysis.estatisticas?.finalizacoes?.timeA) ||
      !hasValue(analysis.estatisticas?.finalizacoes?.timeB) ||
      !hasHeatmapThirds
    )
  );

  const contexto = analysis.contextoPartida;
  const verificacao = analysis.verificacaoAuditoria;
  const placarAuditoria = analysis.placarAuditoria;`,
  },
  {
    label: 'botao recalcular',
    oldText: `          <button
            id="btn-telegram-publish"`,
    newText: `          {needsMetricRecalc && (
            <button
              id="btn-recalculate-metrics"
              type="button"
              onClick={handleRecalculateMetrics}
              disabled={isRecalculatingMetrics}
              className="flex items-center gap-1.5 bg-emerald-950/40 hover:bg-emerald-900/50 border border-emerald-500/40 text-emerald-300 hover:text-emerald-200 cursor-pointer font-bold px-3.5 py-2 rounded-lg text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              title="Reprocessar somente as métricas do trecho salvo"
            >
              <RefreshCw className={\`h-4 w-4 \${isRecalculatingMetrics ? 'animate-spin' : ''}\`} />
              <span>{isRecalculatingMetrics ? 'Calculando métricas...' : 'Recalcular métricas do vídeo'}</span>
            </button>
          )}

          <button
            id="btn-telegram-publish"`,
  },
  {
    label: 'mensagem e selo estimativa',
    oldText: `      {/* TRANSLATION LOADING HUD */}`,
    newText: `      {metricsMessage && (
        <div
          data-html2canvas-ignore="true"
          className="rounded-xl border border-emerald-900/40 bg-emerald-950/20 px-4 py-3 text-sm text-emerald-200 print:hidden"
        >
          {metricsMessage}
        </div>
      )}

      {metricsEstimated && (
        <div className="rounded-xl border border-sky-900/40 bg-sky-950/20 px-4 py-3 text-sm text-sky-100">
          <div className="font-bold">Métricas estimadas a partir do vídeo</div>
          <div className="mt-1 text-xs text-sky-200/75">
            Referem-se somente ao trecho {metricsAudit?.metricasTrecho || 'analisado'}.
            Posse, mapa territorial e xG são estimativas visuais do Gemini; não representam
            estatísticas oficiais da partida completa.
            {metricsAudit?.metricasConfianca ? \` Confiança da leitura: \${metricsAudit.metricasConfianca}%.\` : ''}
          </div>
        </div>
      )}

      {/* TRANSLATION LOADING HUD */}`,
  },
  {
    label: 'label xg estimado',
    oldText: `{loc[currentLang].xG || 'xG'}</span>`,
    newText: `{metricsEstimated ? 'xG estimado (IA)' : (loc[currentLang].xG || 'xG')}</span>`,
  },
]);

console.log('[V6_10_5] Métricas visuais do vídeo ativadas.');
