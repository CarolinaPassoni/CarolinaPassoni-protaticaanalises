const fs = require('node:fs');
const path = require('node:path');

const patchFile = (relativePath, replacements) => {
  const filePath = path.join(process.cwd(), relativePath);
  let text = fs.readFileSync(filePath, 'utf8');
  let changed = 0;

  for (const { label, oldText, newText } of replacements) {
    if (text.includes(newText)) continue;
    if (!text.includes(oldText)) {
      console.warn(`[V6_10_3] Trecho não encontrado em ${relativePath}: ${label}`);
      continue;
    }
    text = text.replace(oldText, newText);
    changed++;
  }

  if (changed > 0) fs.writeFileSync(filePath, text, 'utf8');
  console.log(`[V6_10_3] ${relativePath}: ${changed} ajuste(s) aplicado(s).`);
};

// -----------------------------------------------------------------------------
// 1) NORMALIZAÇÃO CENTRAL: placeholders deixam de ser dados.
// -----------------------------------------------------------------------------
patchFile('src/utils/normalizeAnalysis.ts', [
  {
    label: 'hasValue robusto',
    oldText: `export function hasValue(val: any): boolean {
  if (val === null || val === undefined) return false;
  const str = String(val).trim();
  return str !== '' && str !== '—' && str !== '-' && str.toLowerCase() !== 'n/d' && str.toLowerCase() !== 'null';
}`,
    newText: `const INVALID_METRIC_TOKENS = [
  '',
  '—',
  '-',
  'n/d',
  'nd',
  'n.a.',
  'n/a',
  'null',
  'undefined',
  'nao disponivel',
  'indisponivel',
  'nao identificado',
  'sem dados',
  'sem informacao',
  'nao encontrado',
];

const normalizeComparableText = (val: any): string =>
  String(val ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\\u0300-\\u036f]/g, '');

export function hasValue(val: any): boolean {
  if (val === null || val === undefined) return false;

  const normalized = normalizeComparableText(val);
  if (!normalized) return false;

  return !INVALID_METRIC_TOKENS.some((token) =>
    normalized === token || normalized.includes(token)
  );
}`,
  },
  {
    label: 'sanitizador de percentual do heatmap',
    oldText: `export function formatMetric(val: any, fallback = 'N/D'): string {
  if (!hasValue(val)) return fallback;
  return String(val).trim();
}`,
    newText: `export function formatMetric(val: any, fallback = 'N/D'): string {
  if (!hasValue(val)) return fallback;
  return String(val).trim();
}

/**
 * Heatmap por terços é dado quantitativo. Aceita apenas números de 0 a 100,
 * com ou sem %, e normaliza para formato percentual.
 * Frases qualitativas nunca entram nos cards/diagramas de percentual.
 */
export function normalizeHeatPercent(val: any): string | undefined {
  if (!hasValue(val)) return undefined;

  const raw = String(val).trim().replace(',', '.');
  const match = raw.match(/^(\\d{1,3}(?:\\.\\d{1,2})?)\\s*%?$/);
  if (!match) return undefined;

  const num = Number(match[1]);
  if (!Number.isFinite(num) || num < 0 || num > 100) return undefined;

  const formatted = Number.isInteger(num)
    ? String(num)
    : String(Math.round(num * 10) / 10);

  return \`\${formatted}%\`;
}`,
  },
  {
    label: 'heatmap estritamente percentual',
    oldText: `  // Normalize Heatmap: only include if real non-zero thirds exist
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
  }`,
    newText: `  // Normalize Heatmap: somente percentuais válidos entram no mapa.
  let mapaDeCalorNormalized: { timeA?: MapaDeCalor; timeB?: MapaDeCalor } | undefined = undefined;
  if (rawStats.mapaDeCalor) {
    const rawCalorA = rawStats.mapaDeCalor.timeA;
    const rawCalorB = rawStats.mapaDeCalor.timeB;

    const aDef = normalizeHeatPercent(rawCalorA?.tercoDefensivo);
    const aMed = normalizeHeatPercent(rawCalorA?.tercoMedio);
    const aOf = normalizeHeatPercent(rawCalorA?.tercoOfensivo);

    const bDef = normalizeHeatPercent(rawCalorB?.tercoDefensivo);
    const bMed = normalizeHeatPercent(rawCalorB?.tercoMedio);
    const bOf = normalizeHeatPercent(rawCalorB?.tercoOfensivo);

    const hasA = Boolean(aDef || aMed || aOf);
    const hasB = Boolean(bDef || bMed || bOf);

    if (hasA || hasB) {
      mapaDeCalorNormalized = {
        timeA: hasA ? {
          tercoDefensivo: aDef,
          tercoMedio: aMed,
          tercoOfensivo: aOf,
        } : undefined,
        timeB: hasB ? {
          tercoDefensivo: bDef,
          tercoMedio: bMed,
          tercoOfensivo: bOf,
        } : undefined,
      };
    }
  }`,
  },
]);

// -----------------------------------------------------------------------------
// 2) PROMPT: não pedir mais "Não disponível" como valor de métrica.
// -----------------------------------------------------------------------------
patchFile('server.ts', [
  {
    label: 'regras de métricas sem placeholders',
    oldText: `5. ESTATÍSTICAS & POSSE DE BOLA: NÃO INVENTE NÚMEROS. Só preencha posse, finalizações, finalizações no alvo, passes certos, faltas, desarmes, escanteios e impedimentos quando o valor estiver explicitamente observado no vídeo/transcrição ou confirmado por fonte confiável da partida. Quando não houver evidência suficiente, use 'Não disponível'.
6. MAPA DE CALOR & TERÇOS: Trate a distribuição espacial como observação qualitativa. Só informe percentuais se puderem ser derivados de evidência visual suficiente; caso contrário, use 'Não disponível'.
7. INDICADORES AVANÇADOS: NÃO estime xG nem outras métricas avançadas por plausibilidade. Informe xG, grandes chances e passes no terço final apenas quando houver fonte/medição explícita. Sem evidência, use 'Não disponível'.`,
    newText: `5. ESTATÍSTICAS & POSSE DE BOLA: NÃO INVENTE NÚMEROS. Só preencha posse, finalizações, finalizações no alvo, passes certos, faltas, desarmes, escanteios e impedimentos quando o valor estiver explicitamente observado no vídeo/transcrição ou confirmado por fonte confiável da partida. Quando não houver evidência suficiente, OMITA o campo/objeto correspondente. NUNCA escreva "Não disponível", "N/D", "não identificado" ou frases no lugar de um número.
6. MAPA DE CALOR & TERÇOS: Os campos tercoDefensivo, tercoMedio e tercoOfensivo são EXCLUSIVAMENTE quantitativos. Quando houver evidência suficiente, use APENAS percentual curto no formato "32%". Não coloque descrições qualitativas nesses campos. Se não for possível quantificar, OMITA mapaDeCalor ou o respectivo campo.
7. INDICADORES AVANÇADOS: NÃO estime xG nem outras métricas avançadas por plausibilidade. Informe xG, grandes chances e passes no terço final somente quando houver medição explícita. Sem evidência, OMITA o campo correspondente; NUNCA use texto de placeholder como valor.`,
  },
]);

// -----------------------------------------------------------------------------
// 3) FRONTEND: limpa análises antigas e evita cards quebrados.
// -----------------------------------------------------------------------------
patchFile('src/components/AnalysisDisplay.tsx', [
  {
    label: 'import sanitizadores',
    oldText: `import { AskYourGameChat } from './AskYourGameChat';`,
    newText: `import { AskYourGameChat } from './AskYourGameChat';
import { hasValue, normalizeHeatPercent } from '../utils/normalizeAnalysis';`,
  },
  {
    label: 'helpers seguros de exibição',
    oldText: `const parsePercent = (val: string) => {
  return parseFloat(val.replace('%', '')) || 0;
};
const parseIntSimple = (val: string) => {
  return parseInt(val, 10) || 0;
};`,
    newText: `const parsePercent = (val: string) => {
  if (!hasValue(val)) return 0;
  return parseFloat(String(val).replace('%', '').replace(',', '.')) || 0;
};
const parseIntSimple = (val: string) => {
  if (!hasValue(val)) return 0;
  return parseInt(String(val), 10) || 0;
};

const safeMetric = (value: any, fallback = '—'): string =>
  hasValue(value) ? String(value).trim() : fallback;

const safePair = (a: any, b: any, fallback = 'Não disponível'): string => {
  const left = safeMetric(a);
  const right = safeMetric(b);
  if (left === '—' && right === '—') return fallback;
  return \`\${left} - \${right}\`;
};`,
  },
  {
    label: 'estatísticas tabela limpa lado A',
    oldText: `{(stats?.[row.key] as any)?.timeA || '—'}`,
    newText: `{safeMetric((stats?.[row.key] as any)?.timeA)}`,
  },
  {
    label: 'estatísticas tabela limpa lado B',
    oldText: `{(stats?.[row.key] as any)?.timeB || '—'}`,
    newText: `{safeMetric((stats?.[row.key] as any)?.timeB)}`,
  },
  {
    label: 'filtro indicadores avançados',
    oldText: `      return v && typeof v === 'object' && !Array.isArray(v) && ((v as any).timeA || (v as any).timeB);`,
    newText: `      return v && typeof v === 'object' && !Array.isArray(v) &&
        (hasValue((v as any).timeA) || hasValue((v as any).timeB));`,
  },
  {
    label: 'indicador lado A limpo',
    oldText: `{v.timeA || '—'}`,
    newText: `{safeMetric(v.timeA)}`,
  },
  {
    label: 'indicador lado B limpo',
    oldText: `{v.timeB || '—'}`,
    newText: `{safeMetric(v.timeB)}`,
  },
  {
    label: 'dados derivados e heatmap seguro',
    oldText: `  const possessionData = [
    { name: teamAName, value: parsePercent(analysis.estatisticas?.posseDeBola?.timeA || '0%') },
    { name: teamBName, value: parsePercent(analysis.estatisticas?.posseDeBola?.timeB || '0%') },
  ];

  const shotsData = [`,
    newText: `  const possessionData = [
    { name: teamAName, value: parsePercent(analysis.estatisticas?.posseDeBola?.timeA || '') },
    { name: teamBName, value: parsePercent(analysis.estatisticas?.posseDeBola?.timeB || '') },
  ];

  const heatmapA = analysis.estatisticas?.mapaDeCalor?.timeA;
  const heatmapB = analysis.estatisticas?.mapaDeCalor?.timeB;
  const hasHeatmapThirds = Boolean(
    normalizeHeatPercent(heatmapA?.tercoDefensivo) ||
    normalizeHeatPercent(heatmapA?.tercoMedio) ||
    normalizeHeatPercent(heatmapA?.tercoOfensivo) ||
    normalizeHeatPercent(heatmapB?.tercoDefensivo) ||
    normalizeHeatPercent(heatmapB?.tercoMedio) ||
    normalizeHeatPercent(heatmapB?.tercoOfensivo)
  );

  const shotsData = [`,
  },
  {
    label: 'posse A sem placeholder gigante',
    oldText: `{analysis.estatisticas?.posseDeBola?.timeA || 'N/D'}`,
    newText: `{safeMetric(analysis.estatisticas?.posseDeBola?.timeA, 'Não disponível')}`,
  },
  {
    label: 'posse B sem placeholder gigante',
    oldText: `{analysis.estatisticas?.posseDeBola?.timeB || 'N/D'}`,
    newText: `{safeMetric(analysis.estatisticas?.posseDeBola?.timeB, 'Não disponível')}`,
  },
  {
    label: 'card finalizações',
    oldText: `{(analysis.estatisticas?.finalizacoes?.timeA || '0')} - {(analysis.estatisticas?.finalizacoes?.timeB || '0')}`,
    newText: `{safePair(analysis.estatisticas?.finalizacoes?.timeA, analysis.estatisticas?.finalizacoes?.timeB)}`,
  },
  {
    label: 'card no alvo',
    oldText: `{(analysis.estatisticas?.finalizacoesNoAlvo?.timeA || '0')} - {(analysis.estatisticas?.finalizacoesNoAlvo?.timeB || '0')}`,
    newText: `{safePair(analysis.estatisticas?.finalizacoesNoAlvo?.timeA, analysis.estatisticas?.finalizacoesNoAlvo?.timeB)}`,
  },
  {
    label: 'card xG',
    oldText: `{(analysis.indicadoresAvancados?.xG?.timeA || '—')} - {(analysis.indicadoresAvancados?.xG?.timeB || '—')}`,
    newText: `{safePair(analysis.indicadoresAvancados?.xG?.timeA, analysis.indicadoresAvancados?.xG?.timeB)}`,
  },
  {
    label: 'card grandes chances',
    oldText: `{(analysis.indicadoresAvancados?.grandesChances?.timeA || '—')} - {(analysis.indicadoresAvancados?.grandesChances?.timeB || '—')}`,
    newText: `{safePair(analysis.indicadoresAvancados?.grandesChances?.timeA, analysis.indicadoresAvancados?.grandesChances?.timeB)}`,
  },
  {
    label: 'terços apenas quando quantitativos',
    oldText: `{analysis.estatisticas?.mapaDeCalor?.timeA && (`,
    newText: `{hasHeatmapThirds && (`,
  },
  {
    label: 'terço A defensivo',
    oldText: `{analysis.estatisticas.mapaDeCalor.timeA.tercoDefensivo || '—'}`,
    newText: `{normalizeHeatPercent(heatmapA?.tercoDefensivo) || '—'}`,
  },
  {
    label: 'terço B defensivo',
    oldText: `{analysis.estatisticas.mapaDeCalor.timeB?.tercoDefensivo || '—'}`,
    newText: `{normalizeHeatPercent(heatmapB?.tercoDefensivo) || '—'}`,
  },
  {
    label: 'terço A médio',
    oldText: `{analysis.estatisticas.mapaDeCalor.timeA.tercoMedio || '—'}`,
    newText: `{normalizeHeatPercent(heatmapA?.tercoMedio) || '—'}`,
  },
  {
    label: 'terço B médio',
    oldText: `{analysis.estatisticas.mapaDeCalor.timeB?.tercoMedio || '—'}`,
    newText: `{normalizeHeatPercent(heatmapB?.tercoMedio) || '—'}`,
  },
  {
    label: 'terço A ofensivo',
    oldText: `{analysis.estatisticas.mapaDeCalor.timeA.tercoOfensivo || '—'}`,
    newText: `{normalizeHeatPercent(heatmapA?.tercoOfensivo) || '—'}`,
  },
  {
    label: 'terço B ofensivo',
    oldText: `{analysis.estatisticas.mapaDeCalor.timeB?.tercoOfensivo || '—'}`,
    newText: `{normalizeHeatPercent(heatmapB?.tercoOfensivo) || '—'}`,
  },
]);

// -----------------------------------------------------------------------------
// 4) COMPONENTE DO HEATMAP: rejeita texto longo de análises antigas.
// -----------------------------------------------------------------------------
patchFile('src/components/HeatmapDisplay.tsx', [
  {
    label: 'normalização percentual',
    oldText: `const parsePercent = (str?: string) => {
    if (!str) return 0;
    return parseFloat(String(str).replace('%', '')) || 0;
};`,
    newText: `const normalizeHeatPercent = (value?: string): string | undefined => {
    if (value === null || value === undefined) return undefined;
    const raw = String(value).trim().replace(',', '.');
    const match = raw.match(/^(\\d{1,3}(?:\\.\\d{1,2})?)\\s*%?$/);
    if (!match) return undefined;

    const num = Number(match[1]);
    if (!Number.isFinite(num) || num < 0 || num > 100) return undefined;

    return \`\${Number.isInteger(num) ? num : Math.round(num * 10) / 10}%\`;
};

const parsePercent = (str?: string) => {
    const normalized = normalizeHeatPercent(str);
    if (!normalized) return 0;
    return parseFloat(normalized.replace('%', '')) || 0;
};`,
  },
  {
    label: 'hasData percentual',
    oldText: `    const hasData = Boolean(teamData?.tercoDefensivo || teamData?.tercoMedio || teamData?.tercoOfensivo);`,
    newText: `    const safeDef = normalizeHeatPercent(teamData?.tercoDefensivo);
    const safeMed = normalizeHeatPercent(teamData?.tercoMedio);
    const safeOf = normalizeHeatPercent(teamData?.tercoOfensivo);
    const hasData = Boolean(safeDef || safeMed || safeOf);`,
  },
  {
    label: 'remove strings cruas do heatmap',
    oldText: `    const safeDef = teamData?.tercoDefensivo || '—';
    const safeMed = teamData?.tercoMedio || '—';
    const safeOf = teamData?.tercoOfensivo || '—';

    const opDef = Math.max(0.15, Math.min(0.9, (parsePercent(teamData?.tercoDefensivo) || 33) / 100));
    const opMed = Math.max(0.15, Math.min(0.9, (parsePercent(teamData?.tercoMedio) || 33) / 100));
    const opOf = Math.max(0.15, Math.min(0.9, (parsePercent(teamData?.tercoOfensivo) || 33) / 100));`,
    newText: `    const displayDef = safeDef || '—';
    const displayMed = safeMed || '—';
    const displayOf = safeOf || '—';

    const opDef = Math.max(0.15, Math.min(0.9, (parsePercent(safeDef) || 33) / 100));
    const opMed = Math.max(0.15, Math.min(0.9, (parsePercent(safeMed) || 33) / 100));
    const opOf = Math.max(0.15, Math.min(0.9, (parsePercent(safeOf) || 33) / 100));`,
  },
  {
    label: 'display defensivo',
    oldText: `{safeDef}</span>`,
    newText: `{displayDef}</span>`,
  },
  {
    label: 'display médio',
    oldText: `{safeMed}</span>`,
    newText: `{displayMed}</span>`,
  },
  {
    label: 'display ofensivo',
    oldText: `{safeOf}</span>`,
    newText: `{displayOf}</span>`,
  },
]);

// -----------------------------------------------------------------------------
// 5) PDF: filtra placeholders e textos inválidos de métricas/heatmap.
// -----------------------------------------------------------------------------
patchFile('src/utils/pdfDocumentBuilder.ts', [
  {
    label: 'helpers do PDF',
    oldText: `export function cleanPdfText(text: string | null | undefined): string {
  if (!text) return '';
  return String(text)
    // Remove emojis e pares de substitutos Unicode
    .replace(/[\\uD800-\\uDBFF][\\uDC00-\\uDFFF]/g, '')
    .replace(/[\\u2600-\\u27BF\\uE000-\\uF8FF\\uFE00-\\uFE0F]/g, '')
    // Converte aspas especiais e travessões em equivalentes seguros
    .replace(/[\\u2018\\u2019]/g, "'")
    .replace(/[\\u201C\\u201D]/g, '"')
    .replace(/[\\u2013\\u2014]/g, '-')
    .replace(/[\\u2022\\u2023]/g, '•')
    // Normaliza quebras de linha
    .replace(/\\r\\n/g, '\\n')
    // Remove caracteres de controle estranhos, preservando acentos latinos e quebras de linha
    .replace(/[^\\x20-\\x7E\\xA0-\\xFF\\n\\t]/g, '')
    .trim();
}`,
    newText: `export function cleanPdfText(text: string | null | undefined): string {
  if (!text) return '';
  return String(text)
    // Remove emojis e pares de substitutos Unicode
    .replace(/[\\uD800-\\uDBFF][\\uDC00-\\uDFFF]/g, '')
    .replace(/[\\u2600-\\u27BF\\uE000-\\uF8FF\\uFE00-\\uFE0F]/g, '')
    // Converte aspas especiais e travessões em equivalentes seguros
    .replace(/[\\u2018\\u2019]/g, "'")
    .replace(/[\\u201C\\u201D]/g, '"')
    .replace(/[\\u2013\\u2014]/g, '-')
    .replace(/[\\u2022\\u2023]/g, '•')
    // Normaliza quebras de linha
    .replace(/\\r\\n/g, '\\n')
    // Remove caracteres de controle estranhos, preservando acentos latinos e quebras de linha
    .replace(/[^\\x20-\\x7E\\xA0-\\xFF\\n\\t]/g, '')
    .trim();
}

const isPdfMetricAvailable = (value: any): boolean => {
  if (value === null || value === undefined) return false;
  const normalized = String(value)
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\\u0300-\\u036f]/g, '');

  if (!normalized) return false;

  const invalid = [
    '—', '-', 'n/d', 'nd', 'n/a', 'null', 'undefined',
    'nao disponivel', 'indisponivel', 'nao identificado',
    'sem dados', 'sem informacao', 'nao encontrado'
  ];

  return !invalid.some((token) => normalized === token || normalized.includes(token));
};

const cleanPdfMetric = (value: any): string =>
  isPdfMetricAvailable(value) ? cleanPdfText(String(value)) : '';

const cleanPdfHeatPercent = (value: any): string => {
  if (!isPdfMetricAvailable(value)) return '';
  const raw = String(value).trim().replace(',', '.');
  const match = raw.match(/^(\\d{1,3}(?:\\.\\d{1,2})?)\\s*%?$/);
  if (!match) return '';

  const num = Number(match[1]);
  if (!Number.isFinite(num) || num < 0 || num > 100) return '';

  return \`\${Number.isInteger(num) ? num : Math.round(num * 10) / 10}%\`;
};`,
  },
  {
    label: 'statItems filtrados',
    oldText: `  const statItems: { label: string; a: string; b: string }[] = [];
  if (est.posseDeBola?.timeA || est.posseDeBola?.timeB) statItems.push({ label: 'Posse de Bola', a: cleanPdfText(est.posseDeBola?.timeA) || '—', b: cleanPdfText(est.posseDeBola?.timeB) || '—' });
  if (est.finalizacoes?.timeA || est.finalizacoes?.timeB) statItems.push({ label: 'Finalizações', a: cleanPdfText(est.finalizacoes?.timeA) || '—', b: cleanPdfText(est.finalizacoes?.timeB) || '—' });
  if (est.finalizacoesNoAlvo?.timeA || est.finalizacoesNoAlvo?.timeB) statItems.push({ label: 'Finalizações no Gol', a: cleanPdfText(est.finalizacoesNoAlvo?.timeA) || '—', b: cleanPdfText(est.finalizacoesNoAlvo?.timeB) || '—' });
  if (adv.xG?.timeA || adv.xG?.timeB) statItems.push({ label: 'xG (Gols Esperados)', a: cleanPdfText(adv.xG?.timeA) || '—', b: cleanPdfText(adv.xG?.timeB) || '—' });
  if (adv.grandesChances?.timeA || adv.grandesChances?.timeB) statItems.push({ label: 'Grandes Chances', a: cleanPdfText(adv.grandesChances?.timeA) || '—', b: cleanPdfText(adv.grandesChances?.timeB) || '—' });
  if (est.passesCertos?.timeA || est.passesCertos?.timeB) statItems.push({ label: 'Passes Certos', a: cleanPdfText(est.passesCertos?.timeA) || '—', b: cleanPdfText(est.passesCertos?.timeB) || '—' });
  if (est.desarmes?.timeA || est.desarmes?.timeB) statItems.push({ label: 'Desarmes', a: cleanPdfText(est.desarmes?.timeA) || '—', b: cleanPdfText(est.desarmes?.timeB) || '—' });
  if (est.escanteios?.timeA || est.escanteios?.timeB) statItems.push({ label: 'Escanteios', a: cleanPdfText(est.escanteios?.timeA) || '—', b: cleanPdfText(est.escanteios?.timeB) || '—' });
  if (est.faltasCometidas?.timeA || est.faltasCometidas?.timeB) statItems.push({ label: 'Faltas Cometidas', a: cleanPdfText(est.faltasCometidas?.timeA) || '—', b: cleanPdfText(est.faltasCometidas?.timeB) || '—' });
  if (est.impedimentos?.timeA || est.impedimentos?.timeB) statItems.push({ label: 'Impedimentos', a: cleanPdfText(est.impedimentos?.timeA) || '—', b: cleanPdfText(est.impedimentos?.timeB) || '—' });`,
    newText: `  const statItems: { label: string; a: string; b: string }[] = [];
  const pushMetric = (label: string, metric: any) => {
    const a = cleanPdfMetric(metric?.timeA);
    const b = cleanPdfMetric(metric?.timeB);
    if (!a && !b) return;
    statItems.push({ label, a: a || '—', b: b || '—' });
  };

  pushMetric('Posse de Bola', est.posseDeBola);
  pushMetric('Finalizações', est.finalizacoes);
  pushMetric('Finalizações no Gol', est.finalizacoesNoAlvo);
  pushMetric('xG (Gols Esperados)', adv.xG);
  pushMetric('Grandes Chances', adv.grandesChances);
  pushMetric('Passes Certos', est.passesCertos);
  pushMetric('Desarmes', est.desarmes);
  pushMetric('Escanteios', est.escanteios);
  pushMetric('Faltas Cometidas', est.faltasCometidas);
  pushMetric('Impedimentos', est.impedimentos);`,
  },
  {
    label: 'heatmap PDF sanitizado',
    oldText: `  const calorA = est.mapaDeCalor?.timeA;
  const calorB = est.mapaDeCalor?.timeB;
  checkPageBreak(40);`,
    newText: `  const calorAOriginal = est.mapaDeCalor?.timeA;
  const calorBOriginal = est.mapaDeCalor?.timeB;

  const calorA = calorAOriginal ? {
    tercoDefensivo: cleanPdfHeatPercent(calorAOriginal.tercoDefensivo),
    tercoMedio: cleanPdfHeatPercent(calorAOriginal.tercoMedio),
    tercoOfensivo: cleanPdfHeatPercent(calorAOriginal.tercoOfensivo),
  } : undefined;

  const calorB = calorBOriginal ? {
    tercoDefensivo: cleanPdfHeatPercent(calorBOriginal.tercoDefensivo),
    tercoMedio: cleanPdfHeatPercent(calorBOriginal.tercoMedio),
    tercoOfensivo: cleanPdfHeatPercent(calorBOriginal.tercoOfensivo),
  } : undefined;

  const hasCalorA = Boolean(calorA && (calorA.tercoDefensivo || calorA.tercoMedio || calorA.tercoOfensivo));
  const hasCalorB = Boolean(calorB && (calorB.tercoDefensivo || calorB.tercoMedio || calorB.tercoOfensivo));

  checkPageBreak(40);`,
  },
  {
    label: 'condição PDF heatmap',
    oldText: `  if (calorA || calorB) {`,
    newText: `  if (hasCalorA || hasCalorB) {`,
  },
]);

console.log('[V6_10_3] Sanitização de métricas concluída.');
