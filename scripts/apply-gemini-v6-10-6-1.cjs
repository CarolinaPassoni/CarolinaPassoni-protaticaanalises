const fs = require('node:fs');
const path = require('node:path');

const filePath = path.join(process.cwd(), 'server.ts');
let text = fs.readFileSync(filePath, 'utf8');
let changed = 0;

const replaceOnce = (label, oldText, newText) => {
  if (text.includes(newText)) return;
  if (!text.includes(oldText)) {
    console.warn(`[V6_10_6_1] Trecho não encontrado: ${label}`);
    return;
  }
  text = text.replace(oldText, newText);
  changed++;
};

// Remove modelos 2.5 da allowlist: a própria API informou que 2.5 Flash
// não está mais disponível para novos usuários.
replaceOnce(
  'allowlist sem 2.5',
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
]);`,
  `const VALID_MODELS = new Set([
  'gemini-3.8-flash',
  'gemini-3.7-flash',
  'gemini-3.6-flash',
  'gemini-3.7-pro',
  'gemini-2.0-flash',
  'gemini-3.1-flash-lite',
  'gemini-flash-latest',
]);`
);

// Não aceitar nomes 2.5 como válidos na sanitização.
replaceOnce(
  'sanitize sem 2.5',
  `    m.startsWith('gemini-3.6-') ||
    m.startsWith('gemini-2.5-') ||
    m.startsWith('gemini-2.0-')`,
  `    m.startsWith('gemini-3.6-') ||
    m.startsWith('gemini-2.0-')`
);

// Failover: 3.8 -> 3.6 -> fallback configurado (3.7) -> alias flash atual.
// Nenhum 2.5 entra no plano.
replaceOnce(
  'plano failover sem 2.5',
  `      [
        primary,
        'gemini-3.6-flash',
        'gemini-2.5-flash',
        GEMINI_FALLBACK_MODEL,
      ]`,
  `      [
        primary,
        'gemini-3.6-flash',
        GEMINI_FALLBACK_MODEL,
        'gemini-flash-latest',
      ]`
);

// Se um modelo devolver 404 / "not available", trata como falha específica
// daquele modelo e segue para o próximo, em vez de abortar toda a análise.
replaceOnce(
  '404 segue para próximo modelo',
  `        const modelSpecific =
          /thinkinglevel|thinkingbudget|unsupported|not supported|model.*not found|invalid model/.test(message);`,
  `        const modelSpecific =
          /thinkinglevel|thinkingbudget|unsupported|not supported|model.*not found|invalid model|not available|no longer available|not_found|\\b404\\b/.test(message);`
);

replaceOnce(
  '404 métricas segue para próximo modelo',
  `      if (/unsupported|not supported|model.*not found|invalid model/i.test(message)) continue;`,
  `      if (/unsupported|not supported|model.*not found|invalid model|not available|no longer available|not_found|\\b404\\b/i.test(message)) continue;`
);

// Log explícito para facilitar auditoria do failover em produção.
if (!text.includes('[GEMINI_FAILOVER_PLAN]')) {
  const marker = `console.log(
  \`[GEMINI] configured=\${Boolean(getGeminiApiKey())} model=\${GEMINI_MODEL} failover=\${getGeminiFailoverPlan(GEMINI_MODEL).join('>')} secondarySearch=\${GEMINI_ENABLE_SECONDARY_SEARCH}\`
);`;

  if (text.includes(marker)) {
    text = text.replace(
      marker,
      marker + `\nconsole.log(\`[GEMINI_FAILOVER_PLAN] \${getGeminiFailoverPlan(GEMINI_MODEL).join(' > ')}\`);`
    );
    changed++;
  }
}

if (changed > 0) fs.writeFileSync(filePath, text, 'utf8');
console.log(`[V6_10_6_1] server.ts: ${changed} ajuste(s) aplicado(s).`);
