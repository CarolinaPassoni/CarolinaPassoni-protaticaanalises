export function extractVideoId(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const raw = value.trim();
  const valid = (id: string | null | undefined) => id && /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null;
  if (valid(raw)) return raw;
  try {
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) return null;
    const host = url.hostname.toLowerCase();
    if (host === 'youtu.be' || host === 'www.youtu.be') return valid(url.pathname.split('/')[1]);
    if (!['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtube-nocookie.com', 'www.youtube-nocookie.com'].includes(host)) return null;
    if (url.pathname === '/watch') return valid(url.searchParams.get('v'));
    const parts = url.pathname.split('/').filter(Boolean);
    return ['shorts', 'embed', 'live', 'v'].includes(parts[0]) ? valid(parts[1]) : null;
  } catch { return null; }
}

export function teamsFromVideoTitle(title: string): { timeA: string; timeB: string } | null {
  // A dash separates programme/competition metadata; it is not proof of a matchup.
  for (const segment of title.split(/\s[-–—]\s|[|:]/)) {
    const match = segment.match(/^(.+?)\s+(?:x|×|vs\.?|versus|contra)\s+(.+)$/i);
    if (!match) continue;
    const clean = (value: string) => value
      .replace(/[^\p{L}\p{N}\s.'’-]/gu, ' ')
      .replace(/^(?:ao vivo|assista|melhores momentos|jogo completo|gols|resumo|highlights)\s*/i, '')
      .replace(/\s+(?:ao vivo|melhores momentos|highlights|jogo completo|\d{1,2}[/.]\d{1,2}).*$/i, '')
      .trim();
    const timeA = clean(match[1]);
    const timeB = clean(match[2]);
    const isMetadata = (name: string) => /^(?:estadual|campeonato(?:\s|$)|copa$|final$|semifinal$|ao vivo$|futebol$)/i.test(name);
    if (timeA && timeB && !isMetadata(timeA) && !isMetadata(timeB)) return { timeA, timeB };
  }
  return null;
}

export function parseClipRange(start: unknown, end: unknown) {
  const startSec = Number(start ?? 0);
  const endSec = Number(end ?? 900);
  if (!Number.isFinite(startSec) || !Number.isFinite(endSec) || startSec < 0 || endSec <= startSec || endSec - startSec > 10800) {
    throw Object.assign(new Error('Informe um trecho válido: início a partir de zero, fim maior que início e duração máxima de 3 horas.'), { status: 400 });
  }
  return { startSec, endSec };
}
