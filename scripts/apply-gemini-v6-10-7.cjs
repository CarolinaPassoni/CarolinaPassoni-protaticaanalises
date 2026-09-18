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
    console.log(`[V6_10_7] ${relativePath}: atualizado.`);
  } else {
    console.warn(`[V6_10_7] ${relativePath}: nenhum ajuste aplicado.`);
  }
};

// -----------------------------------------------------------------------------
// BACKEND: cooldown por modelo + uma rodada por requisição + Retry-After.
// -----------------------------------------------------------------------------
patchTextFile('server.ts', (text) => {
  // 1) Prioriza 3.6 e 3.7 antes de voltar ao 3.8, que atingiu cota no teste real.
  text = text.replace(
`      [
        primary,
        'gemini-3.6-flash',
        GEMINI_FALLBACK_MODEL,
        'gemini-flash-latest',
      ]`,
`      [
        'gemini-3.6-flash',
        GEMINI_FALLBACK_MODEL,
        primary,
      ]`
  );

  // 2) Helpers de cooldown/retry.
  if (!text.includes('const geminiModelCooldownUntil = new Map<string, number>();')) {
    const marker = 'const generateGeminiResilient = async (';
    const idx = text.indexOf(marker);
    if (idx >= 0) {
      const helper = `
const geminiModelCooldownUntil = new Map<string, number>();

const getGeminiRetryAfterSeconds = (err: any): number => {
  const message = String(err?.message || err?.cause?.message || err || '');

  // Cota diária do Free Tier: não continuar queimando chamadas no mesmo modelo.
  if (/PerDayPerProjectPerModel|GenerateRequestsPerDayPerProjectPerModel/i.test(message)) {
    const now = new Date();
    const nextUtcDay = Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() + 1,
      0, 1, 0
    );
    return Math.max(60, Math.ceil((nextUtcDay - Date.now()) / 1000));
  }

  const retryInfo =
    message.match(/retryDelay[^0-9]*(\\d+)s/i) ||
    message.match(/retry in\\s+([0-9.]+)s/i);

  if (retryInfo) {
    return Math.max(5, Math.ceil(Number(retryInfo[1]) || 0));
  }

  const code = getGeminiErrorCode(err);
  if (code === 429) return 60;
  if ([500, 502, 503, 504].includes(code)) return 45;

  return 45;
};

const setGeminiModelCooldown = (model: string, err: any) => {
  const seconds = getGeminiRetryAfterSeconds(err);
  geminiModelCooldownUntil.set(model, Date.now() + seconds * 1000);
  console.warn(
    \`[GEMINI_COOLDOWN] model=\${model} seconds=\${seconds} code=\${getGeminiErrorCode(err) || 'unknown'}\`
  );
};

const getGeminiNextRetrySeconds = (): number => {
  const now = Date.now();
  const waits = Array.from(geminiModelCooldownUntil.values())
    .filter((until) => until > now)
    .map((until) => Math.ceil((until - now) / 1000));

  return waits.length ? Math.max(5, Math.min(...waits)) : 45;
};

`;
      text = text.slice(0, idx) + helper + text.slice(idx);
    }
  }

  // 3) Uma única rodada por requisição. A repetição passa a ser controlada
  // pelo cliente com espera progressiva.
  text = text.replace(
    'for (let round = 1; round <= 2; round++) {',
    'for (let round = 1; round <= 1; round++) {'
  );

  // 4) Pula modelos ainda em cooldown.
  text = text.replace(
`    for (const model of modelPlan) {
      try {`,
`    for (const model of modelPlan) {
      const cooldownUntil = geminiModelCooldownUntil.get(model) || 0;
      if (cooldownUntil > Date.now()) {
        const remaining = Math.ceil((cooldownUntil - Date.now()) / 1000);
        console.warn(
          \`[GEMINI_COOLDOWN] skip model=\${model} remaining=\${remaining}s label=\${label}\`
        );
        continue;
      }

      try {`
  );

  // 5) Ao receber erro transitório, guarda cooldown antes do próximo modelo.
  text = text.replace(
`        // Em 429/503/timeout, segue imediatamente para o próximo modelo.
        if (transient) continue;`,
`        // Em 429/503/timeout, coloca o modelo em cooldown e segue.
        if (transient) {
          setGeminiModelCooldown(model, err);
          continue;
        }`
  );

  // 6) Retorna ao frontend quanto tempo deve esperar.
  text = text.replace(
`  finalError.status = getGeminiErrorCode(lastError) || 503;
  finalError.cause = lastError;
  throw finalError;`,
`  finalError.status = getGeminiErrorCode(lastError) || 503;
  finalError.retryAfterSeconds = getGeminiNextRetrySeconds();
  finalError.cause = lastError;
  throw finalError;`
  );

  // 7) Inclui retryAfterSeconds no JSON de erro do endpoint /api/analyze.
  text = text.replace(
`        code: quotaRelated ? 'AI_RATE_LIMITED' : 'AI_TEMPORARILY_UNAVAILABLE',
        retryable: true,
      });`,
`        code: quotaRelated ? 'AI_RATE_LIMITED' : 'AI_TEMPORARILY_UNAVAILABLE',
        retryable: true,
        retryAfterSeconds: Math.max(
          5,
          Number(err?.retryAfterSeconds || getGeminiRetryAfterSeconds(err) || 45)
        ),
      });`
  );

  return text;
});

// -----------------------------------------------------------------------------
// FRONTEND: fila de repetição automática sem percentual falso.
// -----------------------------------------------------------------------------
patchTextFile('src/services/geminiService.ts', (text) => {
  const start = text.indexOf('export async function analyzeFootballMatch(');
  if (start < 0) return text;

  // analyzeFootballMatch é a última função do arquivo nas versões atuais.
  const replacement = `export async function analyzeFootballMatch(
  request: AnalysisRequest,
  onProgress?: (step: string, pct: number | null) => void
): Promise<Analysis> {
  const progressTimers: any[] = [];
  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  if (onProgress) {
    onProgress('Enviando o trecho do vídeo para a inteligência artificial...', null);

    progressTimers.push(setTimeout(() => {
      onProgress('Processando o conteúdo visual do vídeo...', null);
    }, 15000));

    progressTimers.push(setTimeout(() => {
      onProgress('Analisando organização tática, eventos e transições...', null);
    }, 60000));

    progressTimers.push(setTimeout(() => {
      onProgress('A análise continua em processamento. Não feche esta tela...', null);
    }, 180000));
  }

  const sendRequest = async (): Promise<Response> => {
    if (request.type === 'file') {
      const formData = new FormData();
      formData.append('videoFile', request.file);
      formData.append('mode', request.mode || 'quick');
      formData.append('clipStartSeconds', String(request.clipStartSeconds || 0));
      formData.append('clipEndSeconds', String(request.clipEndSeconds || 900));

      return fetch('/api/analyze', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: formData,
      });
    }

    const body = {
      type: 'url',
      url: request.url,
      mode: request.mode || 'quick',
      clipStartSeconds: request.clipStartSeconds || 0,
      clipEndSeconds: request.clipEndSeconds || 900,
    };

    return fetch('/api/analyze', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify(body),
    });
  };

  try {
    const maxCycles = 4;
    let lastMessage = 'A inteligência artificial está temporariamente indisponível.';

    for (let cycle = 1; cycle <= maxCycles; cycle++) {
      if (onProgress && cycle > 1) {
        onProgress(
          \`Nova tentativa automática \${cycle}/\${maxCycles} iniciada...\`,
          null
        );
      }

      const response = await sendRequest();

      if (response.ok) {
        const data = await response.json();
        if (onProgress) onProgress('Concluído!', 100);
        return data.analysis;
      }

      const error = await response.json().catch(() => ({}));
      lastMessage = error?.error || 'Erro ao processar análise.';

      const retryable =
        Boolean(error?.retryable) &&
        (response.status === 429 || response.status === 503);

      if (!retryable || cycle >= maxCycles) {
        throw new Error(lastMessage);
      }

      const fallbackDelays = [45, 75, 120, 180];
      const requestedDelay = Number(error?.retryAfterSeconds || 0);
      const waitSeconds = Math.min(
        180,
        Math.max(
          fallbackDelays[Math.min(cycle - 1, fallbackDelays.length - 1)],
          Number.isFinite(requestedDelay) ? requestedDelay : 0
        )
      );

      for (let remaining = waitSeconds; remaining > 0; remaining--) {
        if (onProgress) {
          onProgress(
            \`IA temporariamente ocupada. Nova tentativa automática em \${remaining}s — mantenha esta tela aberta.\`,
            null
          );
        }
        await sleep(1000);
      }
    }

    throw new Error(lastMessage);
  } finally {
    for (const timer of progressTimers) {
      clearTimeout(timer);
    }
  }
}
`;

  return text.slice(0, start) + replacement;
});

console.log(`[V6_10_7] concluído; arquivos modificados=${totalChanges}.`);
