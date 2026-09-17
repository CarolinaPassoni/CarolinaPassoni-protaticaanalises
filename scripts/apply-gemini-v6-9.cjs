const fs = require('node:fs');
const path = require('node:path');

const filePath = path.join(process.cwd(), 'server.ts');
let text = fs.readFileSync(filePath, 'utf8');
let changed = 0;

const replaceOnce = (label, oldText, newText) => {
  if (text.includes(newText)) return;
  if (!text.includes(oldText)) {
    console.warn(`[GEMINI_V6_9] Trecho não encontrado: ${label}`);
    return;
  }
  text = text.replace(oldText, newText);
  changed += 1;
};

replaceOnce(
  'allowlist 3.8',
  `const VALID_MODELS = new Set([\n  'gemini-3.7-flash',`,
  `const VALID_MODELS = new Set([\n  'gemini-3.8-flash',\n  'gemini-3.7-flash',`
);

replaceOnce(
  'default sem variável',
  `if (!modelName) return 'gemini-3.7-flash';`,
  `if (!modelName) return 'gemini-3.8-flash';`
);

replaceOnce(
  'fallback chave inválida',
  `return 'gemini-3.7-flash';\n  }\n  if (m === 'gemini-2.5-flash'`,
  `return 'gemini-3.8-flash';\n  }\n  if (m === 'gemini-2.5-flash'`
);

replaceOnce(
  'migração modelos antigos',
  `return 'gemini-3.7-flash';\n  }\n  if (VALID_MODELS.has(m) || m.startsWith('gemini-3.7-')`,
  `return 'gemini-3.8-flash';\n  }\n  if (VALID_MODELS.has(m) || m.startsWith('gemini-3.8-') || m.startsWith('gemini-3.7-')`
);

replaceOnce(
  'fallback final',
  `  return 'gemini-3.7-flash';\n};\n\nexport const GEMINI_MODEL`,
  `  return 'gemini-3.8-flash';\n};\n\nexport const GEMINI_MODEL`
);

const routeMarker = `// --- REAL VIDEO & MULTIMODAL ANALYSIS PIPELINE ---`;
const routeBlock = `// --- GEMINI ADMIN HEALTH CHECK ---\napp.get('/api/admin/gemini/status', requireAdmin, (_req, res) => {\n  res.json({\n    configured: Boolean(getGeminiApiKey()),\n    model: GEMINI_MODEL,\n  });\n});\n\napp.post('/api/admin/gemini/test', requireAdmin, async (req, res) => {\n  const user = (req as any).user || getAuthUser(req);\n  if (!enforceRateLimit(req, res, \`gemini-test:\${user?.id || 'admin'}\`, 5, 5 * 60)) return;\n\n  const apiKey = getGeminiApiKey();\n  if (!apiKey) {\n    return res.status(500).json({\n      ok: false,\n      configured: false,\n      model: GEMINI_MODEL,\n      error: 'GEMINI_API_KEY não configurada no servidor.',\n    });\n  }\n\n  const startedAt = Date.now();\n  try {\n    const ai = new GoogleGenAI({ apiKey });\n    const response = await ai.models.generateContent({\n      model: GEMINI_MODEL,\n      contents: 'Responda exatamente com: PROTATICA_GEMINI_OK',\n      config: {\n        temperature: 0,\n        maxOutputTokens: 24,\n      },\n    });\n\n    const responseText = String((response as any)?.text || '').trim();\n    const ok = responseText.includes('PROTATICA_GEMINI_OK');\n    const latencyMs = Date.now() - startedAt;\n\n    console.log(\`[GEMINI_TEST] model=\${GEMINI_MODEL} ok=\${ok} latencyMs=\${latencyMs}\`);\n\n    return res.status(ok ? 200 : 502).json({\n      ok,\n      configured: true,\n      model: GEMINI_MODEL,\n      latencyMs,\n      message: ok ? 'Gemini conectada e respondendo.' : 'A Gemini respondeu, mas o teste de consistência falhou.',\n    });\n  } catch (err) {\n    const latencyMs = Date.now() - startedAt;\n    const message = err instanceof Error ? err.message : String(err);\n    console.error(\`[GEMINI_TEST] model=\${GEMINI_MODEL} ok=false latencyMs=\${latencyMs} error=\${message.slice(0, 300)}\`);\n    return res.status(502).json({\n      ok: false,\n      configured: true,\n      model: GEMINI_MODEL,\n      latencyMs,\n      error: 'Falha ao conectar com a API Gemini. Verifique chave, modelo, cota e permissões.',\n    });\n  }\n});\n\n`;

if (!text.includes("/api/admin/gemini/test")) {
  if (!text.includes(routeMarker)) {
    console.warn('[GEMINI_V6_9] Marcador de rotas não encontrado.');
  } else {
    text = text.replace(routeMarker, routeBlock + routeMarker);
    changed += 1;
  }
}

if (!text.includes("[GEMINI] configured=")) {
  const healthMarker = `app.get('/healthz', (_req, res) => {\n  res.status(200).json({ status: 'ok', service: 'protatica' });\n});`;
  if (text.includes(healthMarker)) {
    text = text.replace(
      healthMarker,
      healthMarker + `\n\nconsole.log(\`[GEMINI] configured=\${Boolean(getGeminiApiKey())} model=\${GEMINI_MODEL}\`);`
    );
    changed += 1;
  } else {
    console.warn('[GEMINI_V6_9] Health marker não encontrado para log seguro.');
  }
}

if (changed > 0) fs.writeFileSync(filePath, text, 'utf8');
console.log(`[GEMINI_V6_9] server.ts: ${changed} ajuste(s) aplicado(s).`);
