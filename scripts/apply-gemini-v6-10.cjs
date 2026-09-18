const fs = require('node:fs');
const path = require('node:path');

const serverPath = path.join(process.cwd(), 'server.ts');
let server = fs.readFileSync(serverPath, 'utf8');
let serverChanges = 0;

const replaceServer = (label, oldText, newText) => {
  if (server.includes(newText)) return;
  if (!server.includes(oldText)) {
    console.warn(`[GEMINI_V6_10] Trecho não encontrado em server.ts: ${label}`);
    return;
  }
  server = server.replace(oldText, newText);
  serverChanges += 1;
};

// Pesquisa secundária passa a ser opcional para economizar a cota gratuita.
replaceServer(
  'flag pesquisa secundária',
  `export const GEMINI_FALLBACK_MODEL = sanitizeModelName(
  process.env.GEMINI_FALLBACK_MODEL || 'gemini-3.7-flash'
);`,
  `export const GEMINI_FALLBACK_MODEL = sanitizeModelName(
  process.env.GEMINI_FALLBACK_MODEL || 'gemini-3.7-flash'
);
export const GEMINI_ENABLE_SECONDARY_SEARCH =
  String(process.env.GEMINI_ENABLE_SECONDARY_SEARCH || '').trim().toLowerCase() === 'true';`
);

replaceServer(
  'pesquisa secundária opcional',
  `    try {
      const searchResponse = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: searchPrompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: SEARCH_SCHEMA,
          tools: [{ googleSearch: {} }],
          thinkingConfig: {
            thinkingLevel: ThinkingLevel.LOW,
          },
        }
      });
      searchData = JSON.parse(searchResponse.text || '{}');
      const chunks = searchResponse.candidates?.[0]?.groundingMetadata?.groundingChunks;
      sources = chunks?.map((chunk: any) => ({
        uri: chunk.web?.uri,
        title: chunk.web?.title
      })).filter((s: any) => s.uri) || [];
    } catch (sErr) {
      console.warn('[SEARCH] Aviso na pesquisa secundária:', sErr);
    }`,
  `    if (GEMINI_ENABLE_SECONDARY_SEARCH) {
      try {
        const searchResponse = await ai.models.generateContent({
          model: GEMINI_MODEL,
          contents: searchPrompt,
          config: {
            responseMimeType: 'application/json',
            responseSchema: SEARCH_SCHEMA,
            tools: [{ googleSearch: {} }],
            thinkingConfig: {
              thinkingLevel: ThinkingLevel.LOW,
            },
          }
        });
        searchData = JSON.parse(searchResponse.text || '{}');
        const chunks = searchResponse.candidates?.[0]?.groundingMetadata?.groundingChunks;
        sources = chunks?.map((chunk: any) => ({
          uri: chunk.web?.uri,
          title: chunk.web?.title
        })).filter((s: any) => s.uri) || [];
      } catch (sErr) {
        console.warn('[SEARCH] Aviso na pesquisa secundária:', sErr);
      }
    } else {
      console.log('[SEARCH] Pesquisa secundária desativada para preservar quota; usando vídeo e metadados da fonte.');
    }

    // A URL original do vídeo é sempre uma fonte principal.
    if (verifiedContext.sourceUrl && !sources.some((s: any) => s.uri === verifiedContext.sourceUrl)) {
      sources.unshift({
        uri: verifiedContext.sourceUrl,
        title: verifiedContext.title || 'Vídeo original do YouTube',
      });
    }

    // Fallback de metadados objetivos do próprio título do vídeo.
    // Ex.: "TIME A x TIME B - 12/09 - 15H - CAMPEONATO 2026".
    const sourceTitle = String(verifiedContext.title || '');
    const titleYearMatch = sourceTitle.match(/\\b(20\\d{2})\\b/);
    const titleDateMatch = sourceTitle.match(/\\b(\\d{1,2})[\\/\\.](\\d{1,2})(?:[\\/\\.](\\d{2,4}))?\\b/);
    const titleTimeMatch = sourceTitle.match(/\\b(\\d{1,2})\\s*[hH](?:(\\d{2}))?\\b/);

    if (!searchData.temporada && titleYearMatch) {
      searchData.temporada = titleYearMatch[1];
    }

    if (!searchData.data && titleDateMatch) {
      const dd = titleDateMatch[1].padStart(2, '0');
      const mm = titleDateMatch[2].padStart(2, '0');
      let yyyy = titleDateMatch[3] || titleYearMatch?.[1] || '';
      if (yyyy && yyyy.length === 2) yyyy = \`20\${yyyy}\`;

      const hh = titleTimeMatch?.[1]?.padStart(2, '0') || '';
      const min = titleTimeMatch?.[2]?.padStart(2, '0') || '00';
      searchData.data = \`\${dd}/\${mm}\${yyyy ? '/' + yyyy : ''}\${hh ? ' ' + hh + ':' + min : ''}\`;
    }

    if (!searchData.competicao) {
      const titleSegments = sourceTitle
        .split(/\\s[-–—]\\s/)
        .map((s: string) => s.trim())
        .filter(Boolean);
      const competitionSegment = titleSegments.find((segment: string) =>
        /(campeonato|copa|liga|libertadores|sul[- ]americana|champions|europa|brasileir|capixab[aã]o|paulist|carioca|mineiro|ga[uú]cho)/i.test(segment)
      );
      if (competitionSegment) searchData.competicao = competitionSegment;
    }`
);

// O próprio Gemini 3.8 recebe a URL pública do YouTube como vídeo.
replaceServer(
  'evidência visual nativa',
  `    // Separação estrita de evidências
    const hasVisualEvidence = Boolean(evidence.hasRealVideoFrames && evidence.frames.length > 0);
    const hasTranscriptEvidence = Boolean(evidence.hasTranscript && evidence.transcriptSegments.length > 0);
    const isIdentityConfirmed = Boolean(verifiedContext.videoId && (verifiedContext.title || verifiedContext.sourceUrl));`,
  `    // Separação estrita de evidências.
    // Para YouTube público, o Gemini recebe o vídeo diretamente via fileData.
    const useNativeYouTubeVideo = Boolean(
      !localVideoPath &&
      verifiedContext.sourceUrl &&
      /^https?:\\/\\/(?:www\\.)?(?:youtube\\.com|youtu\\.be)\\//i.test(verifiedContext.sourceUrl)
    );
    const hasVisualEvidence = Boolean(
      useNativeYouTubeVideo ||
      (evidence.hasRealVideoFrames && evidence.frames.length > 0)
    );
    const hasTranscriptEvidence = Boolean(evidence.hasTranscript && evidence.transcriptSegments.length > 0);
    const isIdentityConfirmed = Boolean(verifiedContext.videoId && (verifiedContext.title || verifiedContext.sourceUrl));

    console.log(
      \`[GEMINI_VIDEO] nativeYouTube=\${useNativeYouTubeVideo} start=\${startSec}s end=\${endSec}s\`
    );`
);

replaceServer(
  'cobertura nativa',
  `      coverageRatio: Math.round(coverageRatio * 100) / 100
    };

    // Limiares para validação das seções visuais
    const enoughForTacticalShape = hasVisualEvidence && frameCount >= 6 && visualCoverage.coverageRatio >= 0.20;
    const enoughForVisualScouting = hasVisualEvidence && frameCount >= 8 && visualCoverage.coverageRatio >= 0.20;`,
  `      coverageRatio: useNativeYouTubeVideo ? 1 : Math.round(coverageRatio * 100) / 100,
      nativeYouTubeVideo: useNativeYouTubeVideo
    };

    // Quando o vídeo é enviado nativamente ao Gemini, a evidência visual não
    // depende da extração local de storyboards.
    const enoughForTacticalShape =
      useNativeYouTubeVideo ||
      (hasVisualEvidence && frameCount >= 6 && visualCoverage.coverageRatio >= 0.20);
    const enoughForVisualScouting =
      useNativeYouTubeVideo ||
      (hasVisualEvidence && frameCount >= 8 && visualCoverage.coverageRatio >= 0.20);`
);

replaceServer(
  'heatmap nativo',
  `      heatmap: (hasVisualEvidence && frameCount >= 6 ? 'partial' : 'unverified') as 'verified' | 'partial' | 'unverified',`,
  `      heatmap: (useNativeYouTubeVideo || (hasVisualEvidence && frameCount >= 6) ? 'partial' : 'unverified') as 'verified' | 'partial' | 'unverified',`
);

// Inclui o vídeo público diretamente no conjunto multimodal.
replaceServer(
  'vídeo nativo nas partes',
  `    const multimodalParts: any[] = [];

    // Adiciona frames visuais reais ou referência de thumbnail com aviso obrigatório
    if (evidence.frames.length > 0) {`,
  `    const multimodalParts: any[] = [];

    // Caminho preferencial no V6.10: o Gemini 3.8 processa a URL pública
    // do YouTube diretamente, com recorte do trecho escolhido pelo usuário.
    if (useNativeYouTubeVideo) {
      const nativeFps = analysisMode === 'complete' ? 0.1 : 0.2;
      multimodalParts.push({
        fileData: {
          fileUri: verifiedContext.sourceUrl,
          mimeType: 'video/*',
        },
        videoMetadata: {
          startOffset: \`\${Math.max(0, Math.floor(startSec))}s\`,
          endOffset: \`\${Math.max(Math.floor(startSec) + 1, Math.floor(endSec))}s\`,
          fps: nativeFps,
        },
      });
    }

    // Frames locais/storyboard permanecem como evidência complementar/fallback.
    if (evidence.frames.length > 0) {`
);

replaceServer(
  'não usar thumbnail como vídeo quando nativo',
  `    } else if (evidence.thumbnailFrame) {`,
  `    } else if (!useNativeYouTubeVideo && evidence.thumbnailFrame) {`
);

replaceServer(
  'estratégia de auditoria nativa',
  `        estrategiaAnalise: \`Análise Audiovisual Multimodal (\${evidence.frames.length} frames, \${evidence.transcriptSegments.length} falas) com Verificação Secundária\`,
        nivelConfianca: validationStatus === 'verified' ? 'alta' : validationStatus === 'partial' ? 'media' : 'baixa',
        fontesPrincipais: sources.map((s: any) => s.title || s.uri)`,
  `        estrategiaAnalise: useNativeYouTubeVideo
          ? \`Vídeo público do YouTube analisado nativamente pelo Gemini (\${formatSecondsToTimestamp(startSec)}–\${formatSecondsToTimestamp(endSec)}), com metadados da fonte\`
          : \`Análise Audiovisual Multimodal (\${evidence.frames.length} frames, \${evidence.transcriptSegments.length} falas)\`,
        nivelConfianca: validationStatus === 'verified' ? 'alta' : validationStatus === 'partial' ? 'media' : 'baixa',
        fontesPrincipais: sources.map((s: any) => s.title || s.uri)`
);

replaceServer(
  'log de boot com pesquisa',
  `console.log(\`[GEMINI] configured=\${Boolean(getGeminiApiKey())} model=\${GEMINI_MODEL} fallback=\${GEMINI_FALLBACK_MODEL}\`);`,
  `console.log(\`[GEMINI] configured=\${Boolean(getGeminiApiKey())} model=\${GEMINI_MODEL} fallback=\${GEMINI_FALLBACK_MODEL} secondarySearch=\${GEMINI_ENABLE_SECONDARY_SEARCH}\`);`
);

if (serverChanges > 0) fs.writeFileSync(serverPath, server, 'utf8');
console.log(`[GEMINI_V6_10] server.ts: ${serverChanges} ajuste(s) aplicado(s).`);

// Corrige o rótulo de createdAt no relatório: é a data de geração/análise,
// e não a data real da partida.
const displayPath = path.join(process.cwd(), 'src/components/AnalysisDisplay.tsx');
let display = fs.readFileSync(displayPath, 'utf8');
let displayChanges = 0;

const replaceDisplay = (label, oldText, newText) => {
  if (display.includes(newText)) return;
  if (!display.includes(oldText)) {
    console.warn(`[GEMINI_V6_10] Trecho não encontrado em AnalysisDisplay.tsx: ${label}`);
    return;
  }
  display = display.replace(oldText, newText);
  displayChanges += 1;
};

replaceDisplay(
  'pt gerado em',
  `    date: 'Data do Jogo',`,
  `    date: 'Data do Jogo',
    generatedAt: 'Análise gerada em',`
);
replaceDisplay(
  'en generated at',
  `    date: 'Match Date',`,
  `    date: 'Match Date',
    generatedAt: 'Analysis generated at',`
);
replaceDisplay(
  'es generado en',
  `    date: 'Fecha del Partido',`,
  `    date: 'Fecha del Partido',
    generatedAt: 'Análisis generado el',`
);
replaceDisplay(
  'uso createdAt',
  `{analysis.createdAt && <span className="px-2 py-1 rounded-full border border-yellow-900/40 bg-black/20">{loc[currentLang].date}: {formatDateTime(analysis.createdAt)}</span>}`,
  `{analysis.createdAt && <span className="px-2 py-1 rounded-full border border-yellow-900/40 bg-black/20">{loc[currentLang].generatedAt}: {formatDateTime(analysis.createdAt)}</span>}`
);

if (displayChanges > 0) fs.writeFileSync(displayPath, display, 'utf8');
console.log(`[GEMINI_V6_10] AnalysisDisplay.tsx: ${displayChanges} ajuste(s) aplicado(s).`);
