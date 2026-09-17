import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { randomUUID } from 'node:crypto';

export interface ExtractedFrame {
  timestampSeconds: number;
  timestampFormatted: string;
  base64: string;
  mimeType: string;
}

export interface ExtractedTranscriptSegment {
  startSeconds: number;
  durationSeconds: number;
  timestampFormatted: string;
  text: string;
}

export interface VideoExtractionResult {
  videoId: string;
  sourceUrl: string;
  clipStartSeconds: number;
  clipEndSeconds: number;
  mode: 'quick' | 'detailed' | 'complete';
  requestedFramesCount?: number;
  frames: ExtractedFrame[];
  thumbnailFrame?: ExtractedFrame;
  transcriptSegments: ExtractedTranscriptSegment[];
  transcriptFullText: string;
  hasRealVideoFrames: boolean;
  hasThumbnailReference: boolean;
  hasTranscript: boolean;
  hasVisualFrames: boolean;
  extractionLog: string[];
}

export const formatSecondsToTimestamp = (seconds: number): string => {
  const s = Math.max(0, Math.floor(seconds));
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  if (hrs > 0) {
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

export const extractVideoId = (rawUrl: string): string | null => {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  const str = rawUrl.trim();
  if (!str) return null;

  try {
    const safeUrl = /^https?:\/\//i.test(str) ? str : `https://${str}`;
    const u = new URL(safeUrl);

    // 1. Check search parameter 'v' (e.g. youtube.com/watch?v=ID)
    const vParam = u.searchParams.get('v');
    if (vParam) {
      const cleanV = vParam.split(/[?&#]/)[0].trim();
      if (/^[a-zA-Z0-9_-]{11}$/.test(cleanV)) return cleanV;
    }

    // 2. Check youtu.be shortlinks (e.g. youtu.be/ID)
    if (u.hostname.toLowerCase().includes('youtu.be')) {
      const pathSeg = u.pathname.split('/').filter(Boolean)[0];
      if (pathSeg) {
        const cleanSeg = pathSeg.split(/[?&#]/)[0].trim();
        if (/^[a-zA-Z0-9_-]{11}$/.test(cleanSeg)) return cleanSeg;
      }
    }

    // 3. Check segments like /shorts/ID, /embed/ID, /live/ID, /v/ID
    const parts = u.pathname.split('/').filter(Boolean);
    const pickAfter = (segment: string) => {
      const idx = parts.findIndex((p) => p.toLowerCase() === segment.toLowerCase());
      if (idx >= 0 && parts[idx + 1]) {
        return parts[idx + 1].split(/[?&#]/)[0].trim();
      }
      return null;
    };

    const pathId = pickAfter('shorts') || pickAfter('embed') || pickAfter('live') || pickAfter('v');
    if (pathId && /^[a-zA-Z0-9_-]{11}$/.test(pathId)) {
      return pathId;
    }

    // 4. If direct 11-char ID
    if (/^[a-zA-Z0-9_-]{11}$/.test(str)) {
      return str;
    }
  } catch {
    const directMatch = str.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?|shorts|live)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i);
    if (directMatch && directMatch[1]) {
      return directMatch[1];
    }
  }

  return null;
};

/**
 * Normalização inteligente de clubes de futebol
 */
export const normalizeTeamName = (rawName: string): string => {
  if (!rawName) return '';
  let str = rawName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove acentos
    .toLowerCase()
    .trim();

  // Remove sufixos e prefixos corporativos/esportivos comuns
  str = str
    .replace(/\b(saf|s\.a\.f|f\.c|fc|e\.c|ec|sc|s\.c|c\.r|cr|clube de regatas|sociedade esportiva|associacao atletica|futebol clube|esporte clube|atletico clube)\b/g, '')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Apelidos e mapeamentos comuns no futebol brasileiro e internacional
  const teamAliases: Record<string, string> = {
    'flamengo': 'flamengo',
    'mengao': 'flamengo',
    'mengo': 'flamengo',
    'corinthians': 'corinthians',
    'timao': 'corinthians',
    'palmeiras': 'palmeiras',
    'verdao': 'palmeiras',
    'sao paulo': 'sao paulo',
    'tricolor paulista': 'sao paulo',
    'santos': 'santos',
    'peixe': 'santos',
    'gremio': 'gremio',
    'internacional': 'internacional',
    'inter': 'internacional',
    'colorado': 'internacional',
    'atletico mineiro': 'atletico mineiro',
    'atletico mg': 'atletico mineiro',
    'galo': 'atletico mineiro',
    'cruzeiro': 'cruzeiro',
    'raposa': 'cruzeiro',
    'botafogo': 'botafogo',
    'glorioso': 'botafogo',
    'vasco': 'vasco',
    'vasco da gama': 'vasco',
    'fluminense': 'fluminense',
    'flu': 'fluminense',
    'bahia': 'bahia',
    'vitoria': 'vitoria',
    'fortaleza': 'fortaleza',
    'ceara': 'ceara',
    'athletico paranaense': 'athletico paranaense',
    'athletico pr': 'athletico paranaense',
    'furacao': 'athletico paranaense',
    'coritiba': 'coritiba',
    'coxa': 'coritiba',
    'real madrid': 'real madrid',
    'barcelona': 'barcelona',
    'barca': 'barcelona',
    'manchester city': 'manchester city',
    'man city': 'manchester city',
    'manchester united': 'manchester united',
    'man united': 'manchester united',
    'liverpool': 'liverpool',
    'arsenal': 'arsenal',
    'chelsea': 'chelsea',
    'bayern': 'bayern de munique',
    'bayern munchen': 'bayern de munique',
    'psg': 'paris saint-germain',
    'paris saint germain': 'paris saint-germain',
  };

  for (const [alias, normalized] of Object.entries(teamAliases)) {
    if (str === alias || str.includes(alias)) {
      return normalized;
    }
  }

  return str;
};

/**
 * Tenta buscar legendas / transcrição do YouTube via timedtext API
 */
export const fetchYouTubeTranscript = async (
  videoId: string,
  clipStartSeconds: number,
  clipEndSeconds: number
): Promise<{ segments: ExtractedTranscriptSegment[]; fullText: string }> => {
  const segments: ExtractedTranscriptSegment[] = [];

  try {
    // 1. Obter a página do vídeo para localizar as URLs de timedtext
    const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const pageRes = await fetch(watchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8'
      }
    });

    if (pageRes.ok) {
      const html = await pageRes.text();
      const captionsMatch = html.match(/"captionTracks":\s*(\[[^\]]+\])/);

      if (captionsMatch && captionsMatch[1]) {
        const captionTracks = JSON.parse(captionsMatch[1]);
        // Prioriza pt, pt-BR, es, en
        let preferredTrack = captionTracks.find((t: any) => t.languageCode?.startsWith('pt')) ||
                             captionTracks.find((t: any) => t.languageCode?.startsWith('es')) ||
                             captionTracks.find((t: any) => t.languageCode?.startsWith('en')) ||
                             captionTracks[0];

        if (preferredTrack?.baseUrl) {
          const captionRes = await fetch(`${preferredTrack.baseUrl}&fmt=json3`);
          if (captionRes.ok) {
            const data: any = await captionRes.json();
            if (Array.isArray(data?.events)) {
              for (const event of data.events) {
                if (!event.segs) continue;
                const startMs = Number(event.tStartMs) || 0;
                const durMs = Number(event.dDurationMs) || 0;
                const startSec = startMs / 1000;
                const durSec = durMs / 1000;

                // Filtra pelo trecho solicitado
                if (startSec >= clipStartSeconds && startSec <= clipEndSeconds) {
                  const text = event.segs.map((s: any) => s.utf8 || '').join('').trim();
                  if (text && text !== '\n') {
                    segments.push({
                      startSeconds: startSec,
                      durationSeconds: durSec,
                      timestampFormatted: formatSecondsToTimestamp(startSec),
                      text: text.replace(/\n/g, ' ')
                    });
                  }
                }
              }
            }
          }
        }
      }
    }
  } catch (err) {
    console.warn(`[TRANSCRIPT] Falha ao extrair transcrição para ${videoId}:`, err);
  }

  const fullText = segments
    .map((s) => `[${s.timestampFormatted}] ${s.text}`)
    .join('\n');

  return { segments, fullText };
};

/**
 * Extrai frames representativos com ffmpeg a partir de um arquivo local
 */
export const extractFramesFromLocalVideo = (
  videoFilePath: string,
  clipStartSeconds: number,
  clipEndSeconds: number,
  targetFrameCount: number,
  analysisId?: string
): ExtractedFrame[] => {
  const frames: ExtractedFrame[] = [];
  const tempDir = join('/tmp', 'protatica', analysisId || randomUUID());

  try {
    mkdirSync(tempDir, { recursive: true });
    const duration = Math.max(1, clipEndSeconds - clipStartSeconds);
    const count = Math.max(3, Math.min(targetFrameCount, 60));
    const step = duration / (count + 1);

    for (let i = 1; i <= count; i++) {
      const sec = clipStartSeconds + (i * step);
      const outPath = join(tempDir, `frame_${i.toString().padStart(3, '0')}.jpg`);
      try {
        execSync(`ffmpeg -ss ${sec.toFixed(2)} -i "${videoFilePath}" -frames:v 1 -q:v 3 -vf "scale='min(854,iw)':-1" "${outPath}" -y -loglevel error`, {
          timeout: 10000
        });

        if (existsSync(outPath)) {
          const buf = readFileSync(outPath);
          frames.push({
            timestampSeconds: sec,
            timestampFormatted: formatSecondsToTimestamp(sec),
            base64: buf.toString('base64'),
            mimeType: 'image/jpeg'
          });
        }
      } catch (fErr) {
        console.warn(`[FFMPEG] Aviso ao extrair frame no timestamp ${sec}s:`, fErr);
      }
    }
  } catch (err) {
    console.warn('[FFMPEG] Erro na extração de frames locais:', err);
  } finally {
    try {
      if (existsSync(tempDir)) rmSync(tempDir, { recursive: true, force: true });
    } catch {}
  }

  return frames;
};

export interface StoryboardLevel {
  levelIndex: number;
  width: number;
  height: number;
  totalFrames: number;
  cols: number;
  rows: number;
  framesPerSheet: number;
  intervalSec: number;
  nameTemplate: string;
  sigh: string;
  baseUrl: string;
}

export function parseStoryboardSpec(spec: string): StoryboardLevel[] {
  const parts = spec.split('|');
  const baseUrl = parts[0];
  const levels: StoryboardLevel[] = [];

  for (let i = 1; i < parts.length; i++) {
    const p = parts[i];
    const [widthStr, heightStr, countStr, colsStr, rowsStr, intervalStr, nameTemplate, sigh] = p.split('#');
    const width = parseInt(widthStr, 10) || 160;
    const height = parseInt(heightStr, 10) || 90;
    const totalFrames = parseInt(countStr, 10) || 0;
    const cols = parseInt(colsStr, 10) || 5;
    const rows = parseInt(rowsStr, 10) || 5;
    const intervalMs = parseInt(intervalStr, 10) || 2000;
    const intervalSec = intervalMs > 0 ? intervalMs / 1000 : 2;
    const framesPerSheet = cols * rows;
    const levelIndex = i - 1;

    levels.push({
      levelIndex,
      width,
      height,
      totalFrames,
      cols,
      rows,
      framesPerSheet,
      intervalSec,
      nameTemplate: nameTemplate || '',
      sigh: sigh || '',
      baseUrl,
    });
  }

  return levels;
}

/**
 * Extrai frames reais de vídeo do YouTube utilizando o Storyboard Spec oficial do player
 */
export async function extractFramesFromYouTubeVideo(
  videoId: string,
  clipStartSeconds: number,
  clipEndSeconds: number,
  targetFrameCount: number,
  analysisId: string,
  transcriptSegments: ExtractedTranscriptSegment[] = [],
  logs: string[] = []
): Promise<ExtractedFrame[]> {
  const tempDir = join('/tmp', 'protatica', analysisId);
  const frames: ExtractedFrame[] = [];

  try {
    const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const pageRes = await fetch(watchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!pageRes.ok) {
      logs.push(`[YOUTUBE_FETCH] Falha ao acessar página do vídeo: status ${pageRes.status}`);
      return [];
    }

    const html = await pageRes.text();
    const specMatch = html.match(/"playerStoryboardSpecRenderer":\{"spec":"([^"]+)"/);
    if (!specMatch || !specMatch[1]) {
      logs.push('[STORYBOARD] Especificação de frames do vídeo não disponível.');
      return [];
    }

    const cleanSpec = JSON.parse(`"${specMatch[1]}"`);
    const levels = parseStoryboardSpec(cleanSpec);
    if (levels.length === 0) {
      logs.push('[STORYBOARD] Nenhum nível de storyboard identificado.');
      return [];
    }

    // Seleciona a maior resolução disponível com frames válidos
    const bestLevel = levels.slice().reverse().find((l) => l.totalFrames > 0 && l.width >= 160) || levels[levels.length - 1];
    logs.push(`[STORYBOARD] Nível selecionado: ${bestLevel.levelIndex} (${bestLevel.width}x${bestLevel.height}, amostragem: ${bestLevel.intervalSec}s)`);

    mkdirSync(tempDir, { recursive: true });

    const duration = Math.max(1, clipEndSeconds - clipStartSeconds);
    const count = Math.max(3, Math.min(targetFrameCount, 60));

    // Identifica momentos chave da transcrição para enriquecer a amostragem
    const keyEventSeconds: number[] = [];
    const keyEventRegex = /\b(gol|gols|p[eê]nalti|cart[aã]o|vermelho|expuls|falta|chance|finaliza|defesa|travess[aã]o|substitui|impedimento)\b/i;
    for (const seg of transcriptSegments) {
      if (keyEventRegex.test(seg.text) && seg.startSeconds >= clipStartSeconds && seg.startSeconds <= clipEndSeconds) {
        keyEventSeconds.push(seg.startSeconds);
      }
    }

    // Distribuição de timestamps com amostragem uniforme + momentos chave
    const targetTimestampsSet = new Set<number>();
    const uniformStep = duration / (count + 1);
    for (let i = 1; i <= count; i++) {
      targetTimestampsSet.add(Math.round((clipStartSeconds + (i * uniformStep)) * 10) / 10);
    }

    // Se houver lances chave, adiciona até 4 timestamps chave
    for (const kSec of keyEventSeconds.slice(0, 4)) {
      if (targetTimestampsSet.size < count + 4) {
        targetTimestampsSet.add(Math.round(kSec * 10) / 10);
      }
    }

    const targetTimestamps = Array.from(targetTimestampsSet).sort((a, b) => a - b).slice(0, count);
    logs.push(`[FRAME_TIMESTAMPS] requisitados: ${targetTimestamps.map((s) => `${s.toFixed(1)}s`).join(', ')}`);

    const sheetCache = new Map<number, string>();

    for (let idx = 0; idx < targetTimestamps.length; idx++) {
      const targetSec = targetTimestamps[idx];
      const maxFrameIdx = bestLevel.totalFrames > 0 ? bestLevel.totalFrames - 1 : 999;
      const frameIndex = Math.max(0, Math.min(maxFrameIdx, Math.floor(targetSec / bestLevel.intervalSec)));
      const sheetIndex = Math.floor(frameIndex / bestLevel.framesPerSheet);
      const indexInSheet = frameIndex % bestLevel.framesPerSheet;
      const col = indexInSheet % bestLevel.cols;
      const row = Math.floor(indexInSheet / bestLevel.cols);
      const x = col * bestLevel.width;
      const y = row * bestLevel.height;

      let sheetPath = sheetCache.get(sheetIndex);
      if (!sheetPath || !existsSync(sheetPath)) {
        const sheetName = bestLevel.nameTemplate.includes('M$M') || bestLevel.nameTemplate === 'M$M'
          ? `M${sheetIndex}`
          : (sheetIndex === 0 ? 'default' : `M${sheetIndex}`);

        const sheetUrl = bestLevel.baseUrl
          .split('$L').join(String(bestLevel.levelIndex))
          .split('$N').join(sheetName) + (bestLevel.sigh ? `&sigh=${bestLevel.sigh}` : '');

        sheetPath = join(tempDir, `sheet_${sheetIndex}.jpg`);
        try {
          const sRes = await fetch(sheetUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              'Referer': 'https://www.youtube.com/',
            },
            signal: AbortSignal.timeout(8000),
          });

          if (sRes.ok) {
            const buf = Buffer.from(await sRes.arrayBuffer());
            writeFileSync(sheetPath, buf);
            sheetCache.set(sheetIndex, sheetPath);
          } else {
            logs.push(`[STORYBOARD] Aviso: Sheet ${sheetIndex} retornou status ${sRes.status}`);
          }
        } catch (shErr) {
          logs.push(`[STORYBOARD] Erro ao buscar sheet ${sheetIndex}: ${shErr}`);
        }
      }

      if (sheetPath && existsSync(sheetPath)) {
        const framePath = join(tempDir, `frame_${(idx + 1).toString().padStart(3, '0')}.jpg`);
        try {
          execSync(`ffmpeg -i "${sheetPath}" -vf "crop=${bestLevel.width}:${bestLevel.height}:${x}:${y}" "${framePath}" -y -loglevel error`, {
            timeout: 10000,
          });

          if (existsSync(framePath)) {
            const fBuf = readFileSync(framePath);
            frames.push({
              timestampSeconds: targetSec,
              timestampFormatted: formatSecondsToTimestamp(targetSec),
              base64: fBuf.toString('base64'),
              mimeType: 'image/jpeg',
            });
          }
        } catch (cropErr) {
          console.warn(`[FFMPEG] Aviso ao recortar frame ${idx}:`, cropErr);
        }
      }
    }

    logs.push(`[FRAME_EXTRACTION] requested: ${targetFrameCount}, extracted: ${frames.length}`);
    if (frames.length > 0) {
      logs.push(`[EVIDENCE] realFrames=true`);
    }
  } catch (err: any) {
    logs.push(`[STORYBOARD] Erro na extração de frames: ${err.message}`);
  } finally {
    try {
      if (existsSync(tempDir)) {
        rmSync(tempDir, { recursive: true, force: true });
      }
    } catch {}
  }

  return frames;
}

/**
 * Extrai frames e transcrição de acordo com o modo solicitado
 */
export const processMultimodalVideoEvidence = async (
  videoId: string,
  sourceUrl: string,
  mode: 'quick' | 'detailed' | 'complete',
  clipStartSeconds = 0,
  clipEndSeconds = 900,
  localFilePath?: string,
  analysisId?: string
): Promise<VideoExtractionResult> => {
  const currentAnalysisId = analysisId || randomUUID();
  const logs: string[] = [];
  logs.push(`[EXTRACTION START] videoId: ${videoId}, mode: ${mode}, range: ${clipStartSeconds}s - ${clipEndSeconds}s, analysisId: ${currentAnalysisId}`);

  // Define quantidade de frames por modo
  // Rápido: 6-10 frames (padrão 8)
  // Detalhado: 12-24 frames (padrão 16)
  // Completo: 30-60 frames (padrão 32)
  let targetFrameCount = 8;
  if (mode === 'detailed') targetFrameCount = 16;
  if (mode === 'complete') targetFrameCount = 32;

  let frames: ExtractedFrame[] = [];
  let thumbnailFrame: ExtractedFrame | undefined = undefined;
  let hasRealVideoFrames = false;
  let hasThumbnailReference = false;
  let transcriptSegments: ExtractedTranscriptSegment[] = [];
  let transcriptFullText = '';

  // 1. Extração de transcrição do YouTube se houver videoId
  if (videoId && !localFilePath) {
    logs.push(`[TRANSCRIPT] Buscando transcrição oficial/automática para ${videoId}...`);
    const tResult = await fetchYouTubeTranscript(videoId, clipStartSeconds, clipEndSeconds);
    let rawSegments = tResult.segments;

    if (rawSegments.length > 0) {
      if (mode === 'quick') {
        // Modo rápido: amostra representativa de até 30 falas espaçadas
        const maxQuick = 30;
        if (rawSegments.length > maxQuick) {
          const step = rawSegments.length / maxQuick;
          transcriptSegments = Array.from({ length: maxQuick }, (_, i) => rawSegments[Math.floor(i * step)]);
        } else {
          transcriptSegments = rawSegments;
        }
      } else if (mode === 'detailed') {
        // Modo detalhado: até 100 falas
        transcriptSegments = rawSegments.slice(0, 100);
      } else {
        // Modo completo: até 250 falas
        transcriptSegments = rawSegments.slice(0, 250);
      }

      transcriptFullText = transcriptSegments
        .map((s) => `[${s.timestampFormatted}] ${s.text}`)
        .join('\n');

      logs.push(`[TRANSCRIPT] ${transcriptSegments.length} segmentos carregados (modo ${mode}).`);
    } else {
      logs.push(`[TRANSCRIPT] unavailable`);
    }
  }

  // 2. Extração de frames reais: Arquivo local ou URL do YouTube
  if (localFilePath && existsSync(localFilePath)) {
    logs.push(`[VIDEO_SOURCE] Arquivo Local`);
    logs.push(`[FRAMES] Extraindo ${targetFrameCount} frames reais de arquivo local com ffmpeg...`);
    frames = extractFramesFromLocalVideo(localFilePath, clipStartSeconds, clipEndSeconds, targetFrameCount, currentAnalysisId);
    hasRealVideoFrames = frames.length > 0;
    logs.push(`[FRAMES] ${frames.length} frames extraídos com sucesso.`);
  } else if (videoId) {
    logs.push(`[VIDEO_SOURCE] YouTube`);
    logs.push(`[FRAMES] Extraindo ${targetFrameCount} frames reais do YouTube via Storyboard e ffmpeg...`);
    frames = await extractFramesFromYouTubeVideo(
      videoId,
      clipStartSeconds,
      clipEndSeconds,
      targetFrameCount,
      currentAnalysisId,
      transcriptSegments,
      logs
    );
    hasRealVideoFrames = frames.length > 0;
  }

  // 3. Obter thumbnail como referência visual complementar apenas se frames reais falharem ou para metadados
  if (!hasRealVideoFrames && videoId) {
    try {
      const thumbUrl = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
      const tRes = await fetch(thumbUrl);
      if (tRes.ok) {
        const arrayBuf = await tRes.arrayBuffer();
        const buf = Buffer.from(arrayBuf);
        thumbnailFrame = {
          timestampSeconds: clipStartSeconds,
          timestampFormatted: formatSecondsToTimestamp(clipStartSeconds),
          base64: buf.toString('base64'),
          mimeType: 'image/jpeg'
        };
        hasThumbnailReference = true;
        logs.push(`[THUMBNAIL] referência visual carregada`);
      }
    } catch (thErr) {
      logs.push(`[THUMBNAIL] erro ao carregar referência: ${thErr}`);
    }

    logs.push(`[FRAMES] Evidência visual do vídeo indisponível.`);
    logs.push(`[EVIDENCE] realFrames=false`);
  }

  const hasTranscript = transcriptSegments.length > 0;

  return {
    videoId,
    sourceUrl,
    clipStartSeconds,
    clipEndSeconds,
    mode,
    requestedFramesCount: targetFrameCount,
    frames,
    thumbnailFrame,
    transcriptSegments,
    transcriptFullText,
    hasRealVideoFrames,
    hasThumbnailReference,
    hasTranscript,
    hasVisualFrames: hasRealVideoFrames,
    extractionLog: logs
  };
};
