const fs = require('node:fs');
const path = require('node:path');

const patchFile = (relativePath, replacements) => {
  const filePath = path.join(process.cwd(), relativePath);
  let text = fs.readFileSync(filePath, 'utf8');
  let changed = 0;

  for (const { label, oldText, newText } of replacements) {
    if (text.includes(newText)) continue;
    if (!text.includes(oldText)) {
      console.warn(`[V6_10_2] Trecho não encontrado em ${relativePath}: ${label}`);
      continue;
    }
    text = text.replace(oldText, newText);
    changed++;
  }

  if (changed > 0) fs.writeFileSync(filePath, text, 'utf8');
  console.log(`[V6_10_2] ${relativePath}: ${changed} ajuste(s) aplicado(s).`);
};

patchFile('server.ts', [
  {
    label: 'timeout Gemini 10 minutos',
    oldText: `  const ai = new GoogleGenAI({ 
    apiKey,
    httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
  });`,
    newText: `  const ai = new GoogleGenAI({ 
    apiKey,
    httpOptions: {
      headers: { 'User-Agent': 'aistudio-build' },
      timeout: 600000,
    }
  });`,
  },
  {
    label: 'falhas de rede como transitórias',
    oldText: `const isTransientGeminiError = (err: any): boolean =>
  [429, 500, 502, 503, 504].includes(getGeminiErrorCode(err));`,
    newText: `const isTransientGeminiError = (err: any): boolean => {
  const code = getGeminiErrorCode(err);
  if ([429, 500, 502, 503, 504].includes(code)) return true;
  const message = String(err?.message || err || '').toLowerCase();
  return /fetch failed|network|timeout|socket|econnreset|etimedout/.test(message);
};`,
  },
  {
    label: 'menos tentativas longas no vídeo',
    oldText: `    const delays = isPrimary ? [0, 1600, 3800] : [0, 1800];`,
    newText: `    const delays = isPrimary
      ? (label === 'match-analysis' ? [0, 3000] : [0, 1600, 3800])
      : [0, 1800];`,
  },
]);

patchFile('src/services/geminiService.ts', [
  {
    label: 'progresso sem percentual fictício',
    oldText: `  let progressInterval: any = null;
  if (onProgress) {
    onProgress('Iniciando análise técnica multimodal...', 5);
    let pct = 5;
    progressInterval = setInterval(() => {
      if (pct < 30) {
        pct += 5;
        onProgress('Extraindo frames visuais e transcrição temporal do vídeo...', pct);
      } else if (pct < 60) {
        pct += 3;
        onProgress('Auditorando lances,HUD e evidências em campo...', pct);
      } else if (pct < 88) {
        pct += 2;
        onProgress('Executando raciocínio tático com Gemini Multimodal...', pct);
      } else {
        onProgress('Consolidando e salvando relatório auditado...', 95);
      }
    }, 2000);
  }`,
    newText: `  const progressTimers: any[] = [];
  if (onProgress) {
    onProgress('Enviando o trecho do vídeo para o Gemini 3.8...', null);

    progressTimers.push(setTimeout(() => {
      onProgress('Gemini 3.8 processando o conteúdo visual do vídeo...', null);
    }, 15000));

    progressTimers.push(setTimeout(() => {
      onProgress('Analisando organização tática, eventos e transições...', null);
    }, 60000));

    progressTimers.push(setTimeout(() => {
      onProgress('A análise de vídeo continua em processamento. Não feche esta tela...', null);
    }, 180000));

    progressTimers.push(setTimeout(() => {
      onProgress('Processamento avançado do vídeo em andamento. Trechos maiores podem levar vários minutos...', null);
    }, 300000));
  }`,
  },
  {
    label: 'limpeza dos timers de progresso',
    oldText: `    if (progressInterval) {
      clearInterval(progressInterval);
    }`,
    newText: `    for (const timer of progressTimers) {
      clearTimeout(timer);
    }`,
  },
]);

patchFile('src/components/LoadingSpinner.tsx', [
  {
    label: 'texto atualizado do processamento',
    oldText: `                O PROTÁTICA está em pleno processamento utilizando IA Multimodal do Gemini 3.5. A busca por referências e auditoria de lances via Google Search está em execução. Note que análises táticas completas podem levar até 2-3 minutos.`,
    newText: `                O PROTÁTICA está enviando o trecho público do YouTube diretamente ao Gemini 3.8 para análise multimodal. A pesquisa secundária está desativada para preservar a cota. O tempo varia conforme a duração do trecho e a demanda da API; mantenha esta tela aberta até a conclusão.`,
  },
]);

patchFile('src/components/UrlInputForm.tsx', [
  {
    label: 'tipo preset 5 minutos',
    oldText: `type ClipPreset = 'first15' | 'first30' | 'first45' | 'second45' | 'fullMatch' | 'custom';`,
    newText: `type ClipPreset = 'first5' | 'first15' | 'first30' | 'first45' | 'second45' | 'fullMatch' | 'custom';`,
  },
  {
    label: 'preset padrão 5 minutos',
    oldText: `    const [clipPreset, setClipPreset] = useState<ClipPreset>('first15');`,
    newText: `    const [clipPreset, setClipPreset] = useState<ClipPreset>('first5');`,
  },
  {
    label: 'opção first5 no mapa',
    oldText: `    const clipOptions = useMemo(() => ({
        first15: { `,
    newText: `    const clipOptions = useMemo(() => ({
        first5: {
            label: language === 'pt' ? 'Teste rápido: primeiros 5 minutos' : language === 'en' ? 'Quick test: first 5 minutes' : 'Prueba rápida: primeros 5 minutos',
            start: 0,
            end: 300,
            hint: language === 'pt' ? 'Recomendado para validar a análise nativa do vídeo com menor tempo de processamento.' : language === 'en' ? 'Recommended to validate native video analysis with shorter processing time.' : 'Recomendado para validar el análisis nativo con menor tiempo de procesamiento.'
        },
        first15: { `,
  },
  {
    label: 'opção first5 no select',
    oldText: `                                >
                                    <option value="first15">{t('clipFirst15')}</option>`,
    newText: `                                >
                                    <option value="first5">{language === 'pt' ? 'Teste rápido: primeiros 5 minutos' : language === 'en' ? 'Quick test: first 5 minutes' : 'Prueba rápida: primeros 5 minutos'}</option>
                                    <option value="first15">{t('clipFirst15')}</option>`,
  },
  {
    label: 'hint de 15 minutos realista',
    oldText: `            hint: language === 'pt' ? 'Mais rápido e recomendado para testar.' : language === 'en' ? 'Fastest and recommended for testing.' : 'Más rápido y recomendado para probar.' `,
    newText: `            hint: language === 'pt' ? 'Análise mais ampla; pode levar vários minutos no processamento nativo.' : language === 'en' ? 'Broader analysis; native processing may take several minutes.' : 'Análisis más amplio; el procesamiento nativo puede tardar varios minutos.' `,
  },
]);

console.log('[V6_10_2] Patch concluído.');
