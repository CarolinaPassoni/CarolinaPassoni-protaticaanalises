const fs = require('node:fs');
const path = require('node:path');

const filePath = path.join(process.cwd(), 'server.ts');
let text = fs.readFileSync(filePath, 'utf8');
let changed = 0;

const replaceOnce = (label, oldText, newText) => {
  if (text.includes(newText)) return;
  if (!text.includes(oldText)) {
    console.warn(`[V6_10_6] Trecho não encontrado: ${label}`);
    return;
  }
  text = text.replace(oldText, newText);
  changed++;
};

// 1) Allowlist real de modelos estáveis usados no failover.
replaceOnce(
  'allowlist failover',
  `const VALID_MODELS = new Set([
  'gemini-3.8-flash',
  'gemini-3.7-flash',
  'gemini-3.7-pro',
  'gemini-2.0-flash',
  'gemini-3.1-flash-lite',
  'gemini-flash-latest',
]);`,
  `const VALID_MODELS = new Set([
  'gemini-3.8-flash',
  'gemini-3.7-flash',
  'gemini-3.6-flash',
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-3.7-pro',
  'gemini-2.0-flash',
  'gemini-3.1-flash-lite',
  'gemini-flash-latest',
]);`
);

// 2) Não reescrever 3.6 / 2.5 para 3.8.
replaceOnce(
  'sanitize aceita 3.6 e 2.5',
  `  if (m === 'gemini-2.5-flash' || m === 'gemini-3.6-flash' || m === 'gemini-1.5-flash' || m === 'gemini-1.5-pro' || m === 'gemini-3.5-flash') {
    return 'gemini-3.8-flash';
  }
  if (VALID_MODELS.has(m) || m.startsWith('gemini-3.8-') || m.startsWith('gemini-3.7-') || m.startsWith('gemini-2.0-')) {
    return m;
  }`,
  `  if (m === 'gemini-1.5-flash' || m === 'gemini-1.5-pro') {
    return 'gemini-3.8-flash';
  }
  if (
    VALID_MODELS.has(m) ||
    m.startsWith('gemini-3.8-') ||
    m.startsWith('gemini-3.7-') ||
    m.startsWith('gemini-3.6-') ||
    m.startsWith('gemini-2.5-') ||
    m.startsWith('gemini-2.0-')
  ) {
    return m;
  }`
);

// 3) Plano de modelos diversificado.
replaceOnce(
  'plano global de modelos',
  `export const GEMINI_ENABLE_SECONDARY_SEARCH =
  String(process.env.GEMINI_ENABLE_SECONDARY_SEARCH || '').trim().toLowerCase() === 'true';

const geminiDelay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));`,
  `export const GEMINI_ENABLE_SECONDARY_SEARCH =
  String(process.env.GEMINI_ENABLE_SECONDARY_SEARCH || '').trim().toLowerCase() === 'true';

const getGeminiFailoverPlan = (primaryModel?: string): string[] => {
  const primary = sanitizeModelName(primaryModel || GEMINI_MODEL);

  return Array.from(
    new Set(
      [
        primary,
        'gemini-3.6-flash',
        'gemini-2.5-flash',
        GEMINI_FALLBACK_MODEL,
      ]
        .map((model) => sanitizeModelName(model))
        .filter(Boolean)
    )
  );
};

const adaptGeminiRequestForModel = (request: any, model: string): any => {
  const next = {
    ...request,
    model,
    config: request?.config ? { ...request.config } : undefined,
  };

  if (!next.config) return next;

  // Gemini 2.5 usa thinkingBudget; thinkingLevel é exclusivo dos modelos 3+.
  if (model.startsWith('gemini-2.5-') && next.config.thinkingConfig) {
    const current = next.config.thinkingConfig || {};
    const level = String(current.thinkingLevel || '').toUpperCase();

    let thinkingBudget = 2048;
    if (level === 'MINIMAL') thinkingBudget = 512;
    if (level === 'LOW') thinkingBudget = 1024;
    if (level === 'MEDIUM') thinkingBudget = 4096;
    if (level === 'HIGH') thinkingBudget = 8192;

    next.config = {
      ...next.config,
      thinkingConfig: {
        thinkingBudget,
      },
    };
  }

  return next;
};

const geminiDelay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));`
);

// 4) Failover imediato no 503/429, com segunda rodada curta apenas se todos falharem.
replaceOnce(
  'generateGeminiResilient v6.10.6',
  `const generateGeminiResilient = async (
  ai: GoogleGenAI,
  request: any,
  label: string
): Promise<{ response: any; modelUsed: string }> => {
  const primary = String(request?.model || GEMINI_MODEL);
  const fallback = GEMINI_FALLBACK_MODEL;
  const modelPlan = Array.from(new Set([primary, fallback].filter(Boolean)));

  let lastError: any = null;

  for (const model of modelPlan) {
    const isPrimary = model === primary;
    // 503/5xx: duas novas tentativas no principal; fallback depois.
    // 429: muda de modelo após a primeira tentativa para evitar insistir
    // em uma cota possivelmente esgotada daquele modelo.
    const delays = isPrimary
      ? (label === 'match-analysis' ? [0, 3000] : [0, 1600, 3800])
      : [0, 1800];

    for (let attempt = 0; attempt < delays.length; attempt++) {
      if (delays[attempt] > 0) await geminiDelay(delays[attempt]);

      try {
        const response = await ai.models.generateContent({
          ...request,
          model,
        });

        if (model !== primary || attempt > 0) {
          console.log(
            \`[GEMINI_RETRY] label=\${label} success=true model=\${model} attempt=\${attempt + 1}\`
          );
        }

        return { response, modelUsed: model };
      } catch (err: any) {
        lastError = err;
        const code = getGeminiErrorCode(err);

        console.warn(
          \`[GEMINI_RETRY] label=\${label} success=false model=\${model} attempt=\${attempt + 1} code=\${code || 'unknown'}\`
        );

        if (!isTransientGeminiError(err)) throw err;

        // Em 429 não insistimos repetidamente no mesmo modelo.
        if (code === 429) break;
      }
    }
  }

  const finalError: any = new Error(
    'A inteligência artificial está temporariamente indisponível após tentativas automáticas.'
  );
  finalError.code = 'GEMINI_TEMPORARILY_UNAVAILABLE';
  finalError.status = getGeminiErrorCode(lastError) || 503;
  finalError.cause = lastError;
  throw finalError;
};`,
  `const generateGeminiResilient = async (
  ai: GoogleGenAI,
  request: any,
  label: string
): Promise<{ response: any; modelUsed: string }> => {
  const primary = sanitizeModelName(String(request?.model || GEMINI_MODEL));
  const modelPlan = getGeminiFailoverPlan(primary);

  let lastError: any = null;

  // Primeira rodada: troca IMEDIATAMENTE de modelo em 429/503/timeout.
  // Segunda rodada: só acontece se todos os modelos falharem.
  for (let round = 1; round <= 2; round++) {
    if (round === 2) {
      await geminiDelay(5000);
      console.warn(
        \`[GEMINI_FAILOVER] label=\${label} iniciando segunda rodada após falha de todos os modelos\`
      );
    }

    for (const model of modelPlan) {
      try {
        const adaptedRequest = adaptGeminiRequestForModel(request, model);
        const response = await ai.models.generateContent(adaptedRequest);

        console.log(
          \`[GEMINI_FAILOVER] label=\${label} success=true model=\${model} round=\${round}\`
        );

        return { response, modelUsed: model };
      } catch (err: any) {
        lastError = err;
        const code = getGeminiErrorCode(err);
        const transient = isTransientGeminiError(err);

        console.warn(
          \`[GEMINI_FAILOVER] label=\${label} success=false model=\${model} round=\${round} code=\${code || 'unknown'} transient=\${transient}\`
        );

        // Em 429/503/timeout, segue imediatamente para o próximo modelo.
        if (transient) continue;

        // Erro específico de compatibilidade de um modelo: tenta o próximo.
        const message = String(err?.message || err || '').toLowerCase();
        const modelSpecific =
          /thinkinglevel|thinkingbudget|unsupported|not supported|model.*not found|invalid model/.test(message);

        if (modelSpecific) continue;

        // Erros de requisição que afetariam todos os modelos não devem gerar
        // quatro chamadas iguais.
        throw err;
      }
    }
  }

  const finalError: any = new Error(
    'A inteligência artificial está temporariamente indisponível após tentativas em múltiplos modelos.'
  );
  finalError.code = 'GEMINI_TEMPORARILY_UNAVAILABLE';
  finalError.status = getGeminiErrorCode(lastError) || 503;
  finalError.cause = lastError;
  throw finalError;
};`
);

// 5) O recálculo de métricas usa a mesma cadeia diversificada.
replaceOnce(
  'modelos do recálculo',
  `  const models = Array.from(new Set([
    GEMINI_MODEL,
    sanitizeModelName(process.env.GEMINI_FALLBACK_MODEL || 'gemini-3.7-flash'),
  ].filter(Boolean)));`,
  `  const models = getGeminiFailoverPlan(GEMINI_MODEL);`
);

// 6) Métricas: em falha transitória, segue para o próximo modelo; não fica preso.
replaceOnce(
  'loop métricas resiliente',
  `    } catch (err: any) {
      lastError = err;
      const message = String(err?.message || err);
      console.warn(
        \`[SEGMENT_METRICS] model=\${model} success=false error=\${message.slice(0, 220)}\`
      );
    }`,
  `    } catch (err: any) {
      lastError = err;
      const code = getGeminiErrorCode(err);
      const message = String(err?.message || err);

      console.warn(
        \`[SEGMENT_METRICS] model=\${model} success=false code=\${code || 'unknown'} error=\${message.slice(0, 220)}\`
      );

      // 429/503/timeout: passa imediatamente para o próximo modelo.
      if (isTransientGeminiError(err)) continue;

      // Se um modelo específico não suportar a configuração, tenta o próximo.
      if (/unsupported|not supported|model.*not found|invalid model/i.test(message)) continue;
    }`
);

// 7) Log de boot mostra cadeia real.
replaceOnce(
  'log failover',
  `console.log(\`[GEMINI] configured=\${Boolean(getGeminiApiKey())} model=\${GEMINI_MODEL} fallback=\${GEMINI_FALLBACK_MODEL} secondarySearch=\${GEMINI_ENABLE_SECONDARY_SEARCH}\`);`,
  `console.log(
  \`[GEMINI] configured=\${Boolean(getGeminiApiKey())} model=\${GEMINI_MODEL} failover=\${getGeminiFailoverPlan(GEMINI_MODEL).join('>')} secondarySearch=\${GEMINI_ENABLE_SECONDARY_SEARCH}\`
);`
);

if (changed > 0) fs.writeFileSync(filePath, text, 'utf8');
console.log(`[V6_10_6] server.ts: ${changed} ajuste(s) aplicado(s).`);
