import React, { useState, useEffect } from 'react';
import { User, ShieldCheck } from 'lucide-react';

interface PlayerPhotoProps {
  playerName?: string;
  teamName?: string;
  season?: string;
  position?: string;
  shirtNumber?: string;
  index?: number;
  fallbackUrl?: string;
  className?: string;
  alt?: string;
  manualVerified?: boolean;
}

// In-memory cache across component mounts, keyed by composite (name + team + season)
const photoCache = new Map<string, { url: string | null; score: number; manualVerified: boolean; source: string }>();

/**
 * Cleans identified AI player names removing shirt numbers, paren notes, and extraneous tokens
 */
export function cleanPlayerName(rawName?: string): string {
  if (!rawName) return '';
  return rawName
    .replace(/#\s*\d+/g, '') // remove #10
    .replace(/\b\d+\s*-\s*/g, '') // remove 10 -
    .replace(/\bcamisa\s*\d+/gi, '') // remove camisa 10
    .replace(/\(.*?\)/g, '') // remove (parentheses)
    .replace(/\[.*?\]/g, '') // remove [brackets]
    .replace(/[,\-–—].*$/, '') // cut off after commas/dashes
    .trim();
}

/**
 * Normalizes team name to keep relevant search token
 */
export function cleanTeamName(rawTeam?: string): string {
  if (!rawTeam) return '';
  return rawTeam
    .replace(/\b(futebol|clube|esporte|fc|ec|sc|saf|associacao|associação)\b/gi, '')
    .replace(/[^\w\sÀ-ÿ]/g, '')
    .trim();
}

/**
 * Generates a compound cache key to prevent collision across teams/seasons
 */
export function buildPhotoCacheKey(name: string, team?: string, season?: string): string {
  const cleanN = cleanPlayerName(name).toLowerCase();
  const cleanT = cleanTeamName(team).toLowerCase();
  const cleanS = (season || '').trim().toLowerCase();
  return `${cleanN}::${cleanT}::${cleanS}`;
}

/**
 * List of famous single-name footballers who have high-confidence standalone identities
 */
const KNOWN_SINGLE_NAME_FOOTBALLERS = new Set([
  'pele', 'pelé', 'neymar', 'casemiro', 'rodrygo', 'alisson', 'ederson', 'raphinha',
  'marta', 'formiga', 'cristiane', 'debinha', 'gabigol', 'ronaldo', 'ronaldinho',
  'kaka', 'kaká', 'rivaldo', 'zico', 'romario', 'romário', 'ganso', 'hulk',
  'dida', 'cafu', 'lucio', 'lúcio', 'marcelo', 'paulinho', 'fred', 'richarlison',
  'vinicius', 'endrick', 'estevao', 'estêvão', 'gerson', 'pedro', 'gabriel',
  'veiga', 'dudu', 'weverton', 'calleri', 'lucas', 'arrascaeta', 'everton'
]);

/**
 * Validates if the text is soccer/football athlete related
 */
function isFootballerContext(text?: string): boolean {
  if (!text) return false;
  const lower = text.toLowerCase();
  const footballKeywords = [
    'futebol', 'football', 'soccer', 'jogador', 'jogadora', 'player', 'atleta',
    'futebolista', 'footballer', 'volante', 'atacante', 'meio-campista', 'meia',
    'zagueiro', 'zagueira', 'goleiro', 'goleira', 'lateral', 'forward', 'midfielder',
    'defender', 'goalkeeper', 'striker', 'winger', 'seleção', 'clube', 'club'
  ];
  return footballKeywords.some((kw) => lower.includes(kw));
}

/**
 * Computes the Photo Confidence Score (photoConfidenceScore)
 * Threshold to accept: >= 6
 */
function calculatePhotoScore(
  playerName: string,
  teamName: string | undefined,
  season: string | undefined,
  position: string | undefined,
  wikiTitle: string,
  snippetOrExtract: string
): number {
  let score = 0;
  const lowerTitle = (wikiTitle || '').toLowerCase();
  const lowerText = (snippetOrExtract || '').toLowerCase();
  const cleanP = cleanPlayerName(playerName).toLowerCase();
  const tokens = cleanP.split(/\s+/).filter(Boolean);
  const isSingleName = tokens.length === 1;
  const isKnownSingle = KNOWN_SINGLE_NAME_FOOTBALLERS.has(cleanP);

  // 1. Name Match
  if (!isSingleName) {
    const allTokensMatch = tokens.every(t => lowerTitle.includes(t) || lowerText.includes(t));
    if (allTokensMatch) {
      score += 4; // Exact full name match
    } else if (lowerTitle.includes(tokens[0]) || lowerTitle.includes(tokens[tokens.length - 1])) {
      score += 2;
    }
  } else {
    if (isKnownSingle && lowerTitle.includes(cleanP)) {
      score += 3;
    } else if (lowerTitle.includes(cleanP)) {
      score += 1;
      score -= 5; // Penalty for generic single name without proven context
    } else {
      score -= 5;
    }
  }

  // 2. Team Match
  const cleanT = cleanTeamName(teamName).toLowerCase();
  if (cleanT && cleanT.length >= 3) {
    if (lowerTitle.includes(cleanT) || lowerText.includes(cleanT)) {
      score += 3; // Current club matches
    } else {
      score -= 2; // Team not found in description
    }
  }

  // 3. Season / Year Match
  const cleanS = (season || '').trim();
  if (cleanS && cleanS.length >= 4) {
    if (lowerText.includes(cleanS)) {
      score += 2;
    }
  }

  // 4. Position Match
  if (position) {
    const cleanPos = position.toLowerCase();
    if (lowerText.includes(cleanPos)) {
      score += 1;
    }
  }

  // 5. Sports Context
  if (isFootballerContext(lowerTitle) || isFootballerContext(lowerText)) {
    score += 1;
  } else {
    score -= 5; // Person outside sports context
  }

  return score;
}

/**
 * Fetches player photo from Server Cache or Wikipedia with strict validation & scoring
 */
async function fetchPlayerPhotoWithScoring(
  name: string,
  team?: string,
  season?: string,
  position?: string
): Promise<{ url: string | null; score: number; manualVerified: boolean; source: string }> {
  const cleanedName = cleanPlayerName(name);
  if (!cleanedName || cleanedName.length < 2) {
    return { url: null, score: 0, manualVerified: false, source: 'rejected_short_name' };
  }

  const cacheKey = buildPhotoCacheKey(cleanedName, team, season);
  if (photoCache.has(cacheKey)) {
    return photoCache.get(cacheKey)!;
  }

  // 1. Check Server DB Cache First
  try {
    const srvRes = await fetch(`/api/players/photo?nome=${encodeURIComponent(cleanedName)}&time=${encodeURIComponent(team || '')}&temporada=${encodeURIComponent(season || '')}`);
    if (srvRes.ok) {
      const srvData = await srvRes.json();
      if (srvData?.photo?.url) {
        const isManual = Boolean(srvData.photo.manual_verified);
        const srvScore = srvData.photo.confidence_score || (isManual ? 100 : 8);
        if (isManual || srvScore >= 6) {
          const resObj = { url: srvData.photo.url, score: srvScore, manualVerified: isManual, source: srvData.photo.fonte || 'database' };
          photoCache.set(cacheKey, resObj);
          console.log(`[PHOTO] [CACHE HIT DB] query="${cleanedName}" team="${team}" score=${srvScore} accepted=true manual=${isManual}`);
          return resObj;
        }
      }
    }
  } catch (_) {}

  // 2. Build Structured Query
  const cleanTeam = cleanTeamName(team);
  const currentYear = season || new Date().getFullYear().toString();
  const searchQueries: string[] = [];

  if (cleanTeam) {
    searchQueries.push(`${cleanedName} ${cleanTeam} ${currentYear} futebol`);
    searchQueries.push(`${cleanedName} ${cleanTeam} futebol`);
  }
  searchQueries.push(`${cleanedName} futebolista`);

  let bestPhotoUrl: string | null = null;
  let bestScore = 0;
  let bestSource = 'none';

  for (const query of searchQueries) {
    try {
      const searchRes = await fetch(
        `https://pt.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&utf8=&format=json&origin=*`
      );
      if (searchRes.ok) {
        const searchData = await searchRes.json();
        const results = searchData?.query?.search || [];
        for (const item of results.slice(0, 3)) {
          const sumRes = await fetch(
            `https://pt.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(item.title.replace(/ /g, '_'))}`
          );
          if (sumRes.ok) {
            const sumData = await sumRes.json();
            if (sumData.type !== 'disambiguation') {
              const fullSnippet = `${item.title} ${item.snippet} ${sumData.description || ''} ${sumData.extract || ''}`;
              const score = calculatePhotoScore(cleanedName, team, season, position, item.title, fullSnippet);
              const photoUrl = sumData.originalimage?.source || sumData.thumbnail?.source;

              if (photoUrl && score > bestScore) {
                bestScore = score;
                bestPhotoUrl = photoUrl;
                bestSource = 'pt_wikipedia';
              }
            }
          }
        }
      }
    } catch (_) {}

    if (bestScore >= 6) break;
  }

  // Fallback to EN Wikipedia if not confirmed on PT
  if (bestScore < 6) {
    const enQueries = cleanTeam ? [`${cleanedName} ${cleanTeam} footballer`, `${cleanedName} footballer`] : [`${cleanedName} footballer`];
    for (const query of enQueries) {
      try {
        const searchRes = await fetch(
          `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&utf8=&format=json&origin=*`
        );
        if (searchRes.ok) {
          const searchData = await searchRes.json();
          const results = searchData?.query?.search || [];
          for (const item of results.slice(0, 3)) {
            const sumRes = await fetch(
              `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(item.title.replace(/ /g, '_'))}`
            );
            if (sumRes.ok) {
              const sumData = await sumRes.json();
              if (sumData.type !== 'disambiguation') {
                const fullSnippet = `${item.title} ${item.snippet} ${sumData.description || ''} ${sumData.extract || ''}`;
                const score = calculatePhotoScore(cleanedName, team, season, position, item.title, fullSnippet);
                const photoUrl = sumData.originalimage?.source || sumData.thumbnail?.source;

                if (photoUrl && score > bestScore) {
                  bestScore = score;
                  bestPhotoUrl = photoUrl;
                  bestSource = 'en_wikipedia';
                }
              }
            }
          }
        }
      } catch (_) {}
      if (bestScore >= 6) break;
    }
  }

  const accepted = bestScore >= 6 && Boolean(bestPhotoUrl);
  const finalResult = {
    url: accepted ? bestPhotoUrl : null,
    score: bestScore,
    manualVerified: false,
    source: bestSource,
  };

  // Obligatory log format: [PHOTO]
  console.log(`[PHOTO]\nquery="${searchQueries[0]}"\nsource="${bestSource}"\nscore=${bestScore}\naccepted=${accepted}`);

  photoCache.set(cacheKey, finalResult);

  // Sync back to server cache asynchronously if accepted
  if (accepted && bestPhotoUrl && team) {
    fetch('/api/players/photo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nome: cleanedName,
        time: team,
        temporada: season || '',
        url: bestPhotoUrl,
        fonte: bestSource,
        confidence: bestScore >= 8 ? 'alta' : 'media',
        confidenceScore: bestScore,
      }),
    }).catch(() => {});
  }

  return finalResult;
}

export const PlayerPhoto: React.FC<PlayerPhotoProps> = ({
  playerName,
  teamName,
  season,
  position,
  shirtNumber,
  fallbackUrl,
  className = '',
  alt,
  manualVerified = false,
}) => {
  const cacheKey = buildPhotoCacheKey(playerName || '', teamName, season);

  const [photoData, setPhotoData] = useState<{ url: string | null; score: number; manualVerified: boolean } | null>(() => {
    return photoCache.get(cacheKey) || null;
  });
  const [loading, setLoading] = useState<boolean>(() => !photoCache.has(cacheKey));
  const [hasError, setHasError] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;
    const cleaned = cleanPlayerName(playerName);

    if (!cleaned) {
      setLoading(false);
      setPhotoData(null);
      return;
    }

    const currentKey = buildPhotoCacheKey(cleaned, teamName, season);
    if (photoCache.has(currentKey)) {
      setPhotoData(photoCache.get(currentKey) || null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setHasError(false);

    fetchPlayerPhotoWithScoring(cleaned, teamName, season, position)
      .then((data) => {
        if (isMounted) {
          setPhotoData(data);
          setLoading(false);
        }
      })
      .catch(() => {
        if (isMounted) {
          setPhotoData({ url: null, score: 0, manualVerified: false });
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [playerName, teamName, season, position]);

  const effectiveUrl = photoData?.url || fallbackUrl;
  const isConfirmed = Boolean(effectiveUrl && !hasError && (photoData?.manualVerified || (photoData?.score && photoData.score >= 6)));

  return (
    <div
      className={`relative overflow-hidden bg-gradient-to-b from-[#2a0101] to-[#0a0000] border border-yellow-900/40 rounded-lg flex items-center justify-center ${className}`}
      style={{ aspectRatio: '4/5' }}
    >
      {loading ? (
        <div className="flex flex-col items-center justify-center gap-1.5 p-2 text-yellow-500/70">
          <div className="w-5 h-5 border-2 border-yellow-500/30 border-t-yellow-400 rounded-full animate-spin" />
          <span className="text-[10px] font-mono tracking-wider text-yellow-300/80">Identificando...</span>
        </div>
      ) : isConfirmed ? (
        <div className="relative w-full h-full group">
          <img
            src={effectiveUrl!}
            alt={alt || playerName || 'Foto do Atleta'}
            crossOrigin="anonymous"
            referrerPolicy="no-referrer"
            onError={() => setHasError(true)}
            className="w-full h-full object-contain object-top bg-black/20 transition-transform duration-300"
          />
          {photoData?.manualVerified && (
            <div className="absolute top-1.5 right-1.5 bg-yellow-500/90 text-black p-0.5 rounded shadow" title="Foto confirmada manualmente">
              <ShieldCheck className="w-3.5 h-3.5" />
            </div>
          )}
        </div>
      ) : (
        /* Neutral soccer player silhouette with shirt number and team info */
        <div className="flex flex-col items-center justify-center text-yellow-500/40 p-4 text-center select-none">
          <div className="relative mb-1">
            <User className="w-12 h-12 stroke-[1.2] text-yellow-400/30" />
            {shirtNumber && (
              <span className="absolute -bottom-1 -right-1 bg-yellow-900/80 border border-yellow-500/40 text-yellow-300 text-[9px] font-extrabold px-1.5 py-0.2 rounded-full">
                {shirtNumber}
              </span>
            )}
          </div>
          <span className="text-[10px] uppercase tracking-wider text-yellow-500/50 font-medium">
            Foto não confirmada
          </span>
          {teamName && (
            <span className="text-[9px] text-yellow-600/70 truncate max-w-[120px]">
              {teamName}
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export default PlayerPhoto;

