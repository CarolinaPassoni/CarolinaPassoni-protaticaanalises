const fs = require('node:fs');
const path = require('node:path');

const filePath = path.join(process.cwd(), 'server.ts');
let text = fs.readFileSync(filePath, 'utf8');
let changed = 0;

const replaceOnce = (label, oldText, newText) => {
  if (text.includes(newText)) return;
  if (!text.includes(oldText)) {
    console.warn(`[GEMINI_V6_9_1] Trecho não encontrado: ${label}`);
    return;
  }
  text = text.replace(oldText, newText);
  changed += 1;
};

// SDK enum oficial para controlar raciocínio do Gemini 3.x.
replaceOnce(
  'import ThinkingLevel',
  `import { GoogleGenAI, Type } from '@google/genai';`,
  `import { GoogleGenAI, Type, ThinkingLevel } from '@google/genai';`
);

// Teste de conexão: não limitar a 24 tokens, porque maxOutputTokens inclui
// tokens internos de raciocínio. Um texto não vazio já comprova conectividade.
replaceOnce(
  'teste Gemini robusto',
  `    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: 'Responda exatamente com: PROTATICA_GEMINI_OK',
      config: {
        temperature: 0,
        maxOutputTokens: 24,
      },
    });

    const responseText = String((response as any)?.text || '').trim();
    const ok = responseText.includes('PROTATICA_GEMINI_OK');
    const latencyMs = Date.now() - startedAt;`,
  `    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: 'Responda apenas com OK.',
      config: {
        thinkingConfig: {
          thinkingLevel: ThinkingLevel.LOW,
        },
      },
    });

    const responseText = String((response as any)?.text || '').trim();
    const ok = responseText.length > 0;
    const finishReason = String((response as any)?.candidates?.[0]?.finishReason || '');
    const latencyMs = Date.now() - startedAt;`
);

replaceOnce(
  'log seguro do teste',
  `    console.log(\`[GEMINI_TEST] model=\${GEMINI_MODEL} ok=\${ok} latencyMs=\${latencyMs}\`);`,
  `    console.log(\`[GEMINI_TEST] model=\${GEMINI_MODEL} ok=\${ok} latencyMs=\${latencyMs} finishReason=\${finishReason || 'n/a'}\`);`
);

// Pesquisa secundária: tarefa simples de identificação, raciocínio baixo.
replaceOnce(
  'pesquisa Google thinking low',
  `          responseSchema: SEARCH_SCHEMA,
          tools: [{ googleSearch: {} }]
        }`,
  `          responseSchema: SEARCH_SCHEMA,
          tools: [{ googleSearch: {} }],
          thinkingConfig: {
            thinkingLevel: ThinkingLevel.LOW,
          },
        }`
);

// Análise tática principal: deixa o Gemini raciocinar em nível médio,
// aumenta o teto para evitar JSON cortado e remove temperature baixa.
replaceOnce(
  'análise principal 3.8',
  `        responseMimeType: 'application/json',
        responseSchema: RESPONSE_SCHEMA,
        maxOutputTokens: 8192,
        temperature: 0.1,
      }`,
  `        responseMimeType: 'application/json',
        responseSchema: RESPONSE_SCHEMA,
        maxOutputTokens: 32768,
        thinkingConfig: {
          thinkingLevel: ThinkingLevel.MEDIUM,
        },
      }`
);

// Pergunte ao Jogo: raciocínio baixo, teto maior para não consumir o limite
// apenas com pensamento interno.
replaceOnce(
  'pergunte ao jogo 3.8',
  `      config: {
        maxOutputTokens: 2048,
        temperature: 0.2,
      }`,
  `      config: {
        maxOutputTokens: 8192,
        thinkingConfig: {
          thinkingLevel: ThinkingLevel.LOW,
        },
      }`
);

// Dossiê: estruturado e complexo, raciocínio médio.
replaceOnce(
  'dossiê 3.8',
  `      config: {
        responseMimeType: 'application/json',
        temperature: 0.15,
      }`,
  `      config: {
        responseMimeType: 'application/json',
        maxOutputTokens: 16384,
        thinkingConfig: {
          thinkingLevel: ThinkingLevel.MEDIUM,
        },
      }`
);

if (changed > 0) fs.writeFileSync(filePath, text, 'utf8');
console.log(`[GEMINI_V6_9_1] server.ts: ${changed} ajuste(s) aplicado(s).`);
