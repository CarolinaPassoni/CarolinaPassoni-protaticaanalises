const fs = require('node:fs');
const path = require('node:path');

const filePath = path.join(process.cwd(), 'server.ts');
let text = fs.readFileSync(filePath, 'utf8');
let changed = 0;

const replaceOnce = (label, oldText, newText) => {
  if (text.includes(newText)) return;
  if (!text.includes(oldText)) {
    console.warn(`[GEMINI_V6_9_2] Trecho não encontrado: ${label}`);
    return;
  }
  text = text.replace(oldText, newText);
  changed += 1;
};

// Resiliência centralizada: retry do modelo primário e fallback estável.
replaceOnce(
  'helper de resiliência',
  `export const GEMINI_MODEL = sanitizeModelName(process.env.GEMINI_MODEL);

export const getGeminiApiKey = (): string => {`,
  `export const GEMINI_MODEL = sanitizeModelName(process.env.GEMINI_MODEL);
export const GEMINI_FALLBACK_MODEL = sanitizeModelName(
  process.env.GEMINI_FALLBACK_MODEL || 'gemini-3.7-flash'
);

const geminiDelay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const getGeminiErrorCode = (err: any): number => {
  const direct = Number(
    err?.status ??
    err?.code ??
    err?.error?.code ??
    err?.response?.status
  );
  if (Number.isFinite(direct) && direct > 0) return direct;

  const message = String(err?.message || err || '');
  const match = message.match(/"code"\\s*:\\s*(\\d{3})/) || message.match(/\\b(429|500|502|503|504)\\b/);
  return match ? Number(match[1]) : 0;
};

const isTransientGeminiError = (err: any): boolean =>
  [429, 500, 502, 503, 504].includes(getGeminiErrorCode(err));

const generateGeminiResilient = async (
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
    const delays = isPrimary ? [0, 1600, 3800] : [0, 1800];

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
};

export const getGeminiApiKey = (): string => {`
);

// Análise principal passa pelo retry/fallback.
replaceOnce(
  'análise principal resiliente',
  `    const aiResponse = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: multimodalParts,
      config: {
        responseMimeType: 'application/json',
        responseSchema: RESPONSE_SCHEMA,
        maxOutputTokens: 32768,
        thinkingConfig: {
          thinkingLevel: ThinkingLevel.MEDIUM,
        },
      }
    });

    const rawText = aiResponse.text;`,
  `    const { response: aiResponse, modelUsed: analysisModelUsed } = await generateGeminiResilient(
      ai,
      {
        model: GEMINI_MODEL,
        contents: multimodalParts,
        config: {
          responseMimeType: 'application/json',
          responseSchema: RESPONSE_SCHEMA,
          maxOutputTokens: 32768,
          thinkingConfig: {
            thinkingLevel: ThinkingLevel.MEDIUM,
          },
        },
      },
      'match-analysis'
    );

    const rawText = aiResponse.text;`
);

// Auditoria registra o modelo realmente utilizado, inclusive fallback.
replaceOnce(
  'modelo usado na auditoria',
  `        modeloUsado: GEMINI_MODEL,`,
  `        modeloUsado: analysisModelUsed,`
);

// Pergunte ao Jogo também recebe resiliência.
replaceOnce(
  'pergunte ao jogo resiliente',
  `    const chatResponse = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: [
        { role: 'user', parts: [{ text: systemPrompt }, { text: userPrompt }] }
      ],
      config: {
        maxOutputTokens: 8192,
        thinkingConfig: {
          thinkingLevel: ThinkingLevel.LOW,
        },
      }
    });

    const answer = chatResponse.text || 'Não foi possível gerar a resposta no momento.';`,
  `    const { response: chatResponse } = await generateGeminiResilient(
      ai,
      {
        model: GEMINI_MODEL,
        contents: [
          { role: 'user', parts: [{ text: systemPrompt }, { text: userPrompt }] }
        ],
        config: {
          maxOutputTokens: 8192,
          thinkingConfig: {
            thinkingLevel: ThinkingLevel.LOW,
          },
        },
      },
      'match-ask'
    );

    const answer = chatResponse.text || 'Não foi possível gerar a resposta no momento.';`
);

// Dossiê também recebe fallback.
replaceOnce(
  'dossiê resiliente',
  `    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        responseMimeType: 'application/json',
        maxOutputTokens: 16384,
        thinkingConfig: {
          thinkingLevel: ThinkingLevel.MEDIUM,
        },
      }
    });

    const text = response.text || '{}';`,
  `    const { response } = await generateGeminiResilient(
      ai,
      {
        model: GEMINI_MODEL,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: {
          responseMimeType: 'application/json',
          maxOutputTokens: 16384,
          thinkingConfig: {
            thinkingLevel: ThinkingLevel.MEDIUM,
          },
        },
      },
      'opponent-dossier'
    );

    const text = response.text || '{}';`
);

// Nunca expor JSON cru/erro do provedor ao usuário.
replaceOnce(
  'erro amigável análise',
  `  } catch (err: any) {
    console.error('Erro técnico na análise:', err);
    res.status(500).json({ error: err.message || 'Erro ao processar análise.' });
  } finally {`,
  `  } catch (err: any) {
    console.error('Erro técnico na análise:', err);

    const geminiCode = getGeminiErrorCode(err);
    const retryable = err?.code === 'GEMINI_TEMPORARILY_UNAVAILABLE' || isTransientGeminiError(err);

    if (retryable) {
      const quotaRelated = geminiCode === 429;
      return res.status(quotaRelated ? 429 : 503).json({
        error: quotaRelated
          ? 'O limite temporário de uso da inteligência artificial foi atingido. Aguarde alguns minutos e tente novamente.'
          : 'A inteligência artificial está com alta demanda no momento. O ProTática tentou novamente automaticamente, inclusive com o modelo de contingência. Aguarde alguns minutos e tente novamente.',
        code: quotaRelated ? 'AI_RATE_LIMITED' : 'AI_TEMPORARILY_UNAVAILABLE',
        retryable: true,
      });
    }

    res.status(500).json({ error: 'Não foi possível concluir a análise. Verifique o vídeo e tente novamente.' });
  } finally {`
);

// Log de boot informa fallback sem qualquer segredo.
replaceOnce(
  'log fallback',
  `console.log(\`[GEMINI] configured=\${Boolean(getGeminiApiKey())} model=\${GEMINI_MODEL}\`);`,
  `console.log(\`[GEMINI] configured=\${Boolean(getGeminiApiKey())} model=\${GEMINI_MODEL} fallback=\${GEMINI_FALLBACK_MODEL}\`);`
);

if (changed > 0) fs.writeFileSync(filePath, text, 'utf8');
console.log(`[GEMINI_V6_9_2] server.ts: ${changed} ajuste(s) aplicado(s).`);
