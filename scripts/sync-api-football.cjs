/* ProTática V6.8 — ciclo automático pós-jogo + validação rígida de vídeo
 *
 * - Sincroniza fixtures oficiais da API-Football no Turso.
 * - Usa apenas competições que o ProTática exibe.
 * - Atualiza logos oficiais, horário, placar e status.
 * - Não transforma jogo finalizado em "analisável" até haver vídeo validado.
 * - Vídeo só é aceito quando: mesmos times + título de highlights/full match +
 *   publicação na janela da data oficial da partida.
 * - Usa cache/cooldown para respeitar o plano Free (100 req/dia).
 */
const LibSQLModule = require('libsql');
const Database = LibSQLModule.default || LibSQLModule;

const API_KEY = String(process.env.API_FOOTBALL_KEY || '').trim();
const BASE_URL = String(process.env.API_FOOTBALL_BASE_URL || 'https://v3.football.api-sports.io').replace(/\/$/, '');
const TURSO_URL = String(process.env.TURSO_DATABASE_URL || '').trim();
const TURSO_TOKEN = String(process.env.TURSO_AUTH_TOKEN || '').trim();
const TZ = 'America/Sao_Paulo';
const production = process.env.NODE_ENV === 'production';
const SYNC_VERSION = '6.8';

if (!production) {
  console.log('[API_FOOTBALL] Ambiente local: sincronização automática ignorada.');
  process.exit(0);
}
if (!TURSO_URL || !TURSO_TOKEN) {
  console.error('[API_FOOTBALL] Turso não configurado.');
  process.exit(1);
}
if (!API_KEY) {
  console.warn('[API_FOOTBALL] API_FOOTBALL_KEY não configurada. Mantendo dados atuais.');
  process.exit(0);
}

const db = new Database(TURSO_URL, { authToken: TURSO_TOKEN });

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const norm = (v) => String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const isoDate = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
const today = () => isoDate(new Date());
const shiftDate = (days) => isoDate(new Date(Date.now() + days * 86400000));
const nowIso = () => new Date().toISOString();

const ensureColumn = (table, name, definition) => {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!cols.some(c => c.name === name)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${definition};`);
};

const settingGet = (key) => db.prepare('SELECT value FROM settings WHERE key = ?').get(key)?.value || '';
const settingSet = (key, value) => db.prepare(`
  INSERT INTO settings (key, value) VALUES (?, ?)
  ON CONFLICT(key) DO UPDATE SET value = excluded.value
`).run(key, String(value));

const parseTs = (v) => {
  const n = Date.parse(String(v || ''));
  return Number.isFinite(n) ? n : 0;
};

const COMPETITIONS = [
  { id:'comp_brasileirao', country:'brazil', names:['serie a'], order:1 },
  { id:'comp_copa_brasil', country:'brazil', names:['copa do brasil'], order:2 },
  { id:'comp_libertadores', country:null, names:['copa libertadores','conmebol libertadores'], order:3 },
  { id:'comp_sulamericana', country:null, names:['copa sudamericana','conmebol sudamericana','copa sul americana'], order:4 },
  { id:'comp_champions', country:null, names:['uefa champions league','champions league'], order:5 },
  { id:'comp_premier_league', country:'england', names:['premier league'], order:6 },
  { id:'comp_la_liga', country:'spain', names:['la liga'], order:7 },
  { id:'comp_serie_a_ita', country:'italy', names:['serie a'], order:8 },
  { id:'comp_bundesliga', country:'germany', names:['bundesliga'], order:9 },
  { id:'comp_ligue_1', country:'france', names:['ligue 1'], order:10 },
  { id:'comp_primeira_liga', country:'portugal', names:['primeira liga','liga portugal'], order:11 },
  { id:'comp_europa_league', country:null, names:['uefa europa league','europa league'], order:12 },
  { id:'comp_copa_do_mundo', country:null, names:['world cup','fifa world cup'], order:13 },
  { id:'comp_mundial_clubes', country:null, names:['fifa club world cup','club world cup'], order:14 },
];

const compFor = (league) => {
  const name = norm(league?.name);
  const country = norm(league?.country);

  // Correspondência exata por nome normalizado.
  // Evita falsos positivos como "AFC Champions League" sendo tratada
  // como "UEFA Champions League", ou torneios de base/femininos como World Cup.
  return COMPETITIONS.find(
    c => (!c.country || country === c.country) && c.names.some(n => name === n)
  );
};

const FINISHED = new Set(['FT','AET','PEN']);
const LIVE = new Set(['1H','HT','2H','ET','BT','P','INT','LIVE']);
const INVALID_FEATURE = new Set(['PST','CANC','ABD','AWD','WO','SUSP']);

const mapStatus = (short, hasVerifiedVideo) => {
  if (FINISHED.has(short)) return hasVerifiedVideo ? 'finished' : 'finished_waiting_video';
  if (LIVE.has(short)) return 'live';
  return 'scheduled';
};

const formatMatchDate = (iso) => {
  const d = new Date(iso);
  const day = new Intl.DateTimeFormat('pt-BR', { timeZone: TZ, day: '2-digit' }).format(d);
  const month = new Intl.DateTimeFormat('pt-BR', { timeZone: TZ, month: 'short' }).format(d).replace('.', '').toUpperCase();
  const time = new Intl.DateTimeFormat('pt-BR', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false }).format(d);
  return `${day} ${month} • ${time}`;
};

const teamAliases = (name) => {
  const n = norm(name);
  const aliases = {
    'manchester city':['manchester city','man city','mancity'],
    'manchester united':['manchester united','man united','man utd'],
    'real madrid':['real madrid','real madrid cf'],
    'barcelona':['barcelona','fc barcelona','barca'],
    'bayern munich':['bayern munich','bayern munchen','bayern'],
    'bayern munchen':['bayern munich','bayern munchen','bayern'],
    'paris saint germain':['paris saint germain','psg'],
    'internazionale':['internazionale','inter milan','inter'],
    'flamengo':['flamengo','cr flamengo'],
    'palmeiras':['palmeiras','se palmeiras'],
    'atletico mineiro':['atletico mineiro','atletico mg','galo'],
    'athletico paranaense':['athletico paranaense','athletico pr'],
  };
  return Array.from(new Set([n, ...(aliases[n] || [])]));
};

const teamInTitle = (title, team) => {
  const t = ` ${norm(title)} `;
  const aliases = teamAliases(team);
  if (aliases.some(a => a && t.includes(` ${a} `))) return true;
  const ignored = new Set(['fc','cf','sc','ac','ec','club','clube','football','futebol','de','do','da']);
  const tokens = norm(team).split(' ').filter(x => x.length >= 3 && !ignored.has(x));
  if (!tokens.length) return false;
  const hit = tokens.filter(x => t.includes(` ${x} `)).length;
  return hit / tokens.length >= 0.67;
};

const extractPublishDate = async (url) => {
  try {
    const r = await fetch(url, { headers: {
      'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131 Safari/537.36',
      'Accept-Language':'pt-BR,pt;q=0.9,en;q=0.8'
    }});
    if (!r.ok) return null;
    const html = await r.text();
    const m = html.match(/"publishDate":"(\d{4}-\d{2}-\d{2})"/) || html.match(/"uploadDate":"(\d{4}-\d{2}-\d{2})"/);
    return m?.[1] || null;
  } catch { return null; }
};

const dateDiffDays = (a, b) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86400000);

const findVerifiedVideo = async (fixture) => {
  const fDate = String(fixture.fixture?.date || '').slice(0,10);
  if (!fDate) return null;
  // Só tentamos vídeos de partidas muito recentes; antigas ficam disponíveis apenas se já foram validadas antes.
  const age = dateDiffDays(fDate, today());
  if (age < 0 || age > 3) return null;

  let play;
  try { play = await import('play-dl'); } catch { return null; }
  const searchFn = play.search || play.default?.search;
  if (typeof searchFn !== 'function') return null;

  const home = fixture.teams?.home?.name || '';
  const away = fixture.teams?.away?.name || '';
  const league = fixture.league?.name || '';
  const year = fDate.slice(0,4);
  const queries = [
    `${home} ${away} ${league} highlights ${year}`,
    `${home} ${away} melhores momentos ${year}`,
    `${home} ${away} full match ${year}`,
  ];
  const merged = new Map();
  for (const q of queries) {
    try {
      const rows = await searchFn(q, { limit: 8, source: { youtube: 'video' } });
      for (const v of rows || []) {
        const url = String(v?.url || (v?.id ? `https://www.youtube.com/watch?v=${v.id}` : '')).trim();
        if (url && !merged.has(url)) merged.set(url, v);
      }
    } catch (e) {
      console.warn('[VIDEO_VERIFY] Busca parcial falhou:', q, e?.message || e);
    }
  }

  const candidates = Array.from(merged.values()).filter(v => {
    const title = String(v?.title || '');
    const nt = norm(title);
    const duration = Number(v?.durationInSec || 0);
    const contentSignal = /highlights|melhores momentos|extended highlights|full match|jogo completo|partida completa|resumen/.test(nt);
    return teamInTitle(title, home) && teamInTitle(title, away) && contentSignal && duration >= 60 && !/shorts| short /.test(nt);
  }).slice(0, 6);

  let best = null;
  for (const v of candidates) {
    const url = String(v?.url || (v?.id ? `https://www.youtube.com/watch?v=${v.id}` : '')).trim();
    const published = await extractPublishDate(url);
    if (!published) continue; // política rígida: sem data publicada, não aceita.
    const delta = dateDiffDays(fDate, published);
    if (delta < 0 || delta > 3) continue; // nunca aceita vídeo antigo de outro confronto.

    const title = String(v?.title || '');
    const leagueSignal = norm(title).includes(norm(league));
    const score = 90 + (delta === 0 ? 5 : 0) + (leagueSignal ? 3 : 0);
    if (!best || score > best.confidence) {
      best = { url, title, publishedAt: published, confidence: Math.min(99, score) };
    }
    await sleep(120);
  }
  return best;
};

const videoRetryIntervalMs = (fixture) => {
  const kickoffMs = Date.parse(String(fixture?.fixture?.date || ''));
  if (!Number.isFinite(kickoffMs)) return 60 * 60 * 1000;

  const elapsed = Math.max(0, Date.now() - kickoffMs);
  // Logo após o jogo, highlights costumam surgir rapidamente.
  if (elapsed <= 6 * 60 * 60 * 1000) return 30 * 60 * 1000;
  // Durante o primeiro dia, reduzimos a frequência.
  if (elapsed <= 24 * 60 * 60 * 1000) return 90 * 60 * 1000;
  // Depois disso, ainda tentamos por até 3 dias, mas sem excesso.
  return 6 * 60 * 60 * 1000;
};

const apiFetch = async (params) => {
  const u = new URL(`${BASE_URL}/fixtures`);
  for (const [k,v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') u.searchParams.set(k, String(v));
  const r = await fetch(u, { headers: { 'x-apisports-key': API_KEY, 'Accept':'application/json' } });
  const remaining = r.headers.get('x-ratelimit-requests-remaining');
  const data = await r.json().catch(() => null);
  if (!r.ok) throw new Error(`HTTP ${r.status}: ${JSON.stringify(data?.errors || data || {})}`);
  const errors = data?.errors;
  if (errors && ((Array.isArray(errors) && errors.length) || (!Array.isArray(errors) && Object.keys(errors).length))) {
    throw new Error(`API-Football: ${JSON.stringify(errors)}`);
  }
  return { rows: Array.isArray(data?.response) ? data.response : [], remaining };
};

async function main() {
  db.exec(`CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);`);
  ensureColumn('matches','external_fixture_id','INTEGER');
  ensureColumn('matches','source_provider','TEXT');
  ensureColumn('matches','source_verified_at','TEXT');
  ensureColumn('matches','kickoff_at','TEXT');
  ensureColumn('matches','api_status','TEXT');
  ensureColumn('matches','fixture_timezone','TEXT');
  ensureColumn('matches','venue_city','TEXT');
  ensureColumn('matches','video_source_title','TEXT');
  ensureColumn('matches','video_published_at','TEXT');
  ensureColumn('matches','video_verified_at','TEXT');
  ensureColumn('matches','video_confidence','INTEGER DEFAULT 0');
  ensureColumn('matches','video_lookup_attempted_at','TEXT');
  try { db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_matches_external_fixture ON matches(external_fixture_id);'); } catch {}

  const lastSync = settingGet('api_football_last_sync_at');
  const previousSyncVersion = settingGet('api_football_sync_schema_version');
  const cacheFresh = lastSync && Date.now() - parseTs(lastSync) < 25 * 60 * 1000;
  const isSyncMigration = previousSyncVersion !== SYNC_VERSION;

  // Mudanças nas regras de seleção/limpeza precisam de uma sincronização real
  // mesmo que o cache horário ainda esteja válido.
  if (cacheFresh && !isSyncMigration) {
    console.log('[API_FOOTBALL] Cache válido; nova chamada não é necessária.');
    return;
  }
  if (cacheFresh && isSyncMigration) {
    console.log(`[API_FOOTBALL] Cache ignorado para migração de sincronização ${previousSyncVersion || 'legado'} -> ${SYNC_VERSION}.`);
  }

  const localToday = today();

  // Proteção extra do plano Free. Em operação normal o V6.8 consome cerca de
  // 50 chamadas/dia no máximo (3 na carga diária + ~1 a cada 30 min).
  const quotaDate = settingGet('api_football_last_quota_date');
  const quotaRemainingStored = Number(settingGet('api_football_last_remaining_quota') || '999');
  if (!isSyncMigration && quotaDate === localToday && Number.isFinite(quotaRemainingStored) && quotaRemainingStored <= 8) {
    console.warn(`[API_FOOTBALL] Quota protegida: restam ${quotaRemainingStored} chamadas. Sincronização adiada.`);
    return;
  }

  const fullSyncToday = settingGet('api_football_last_full_sync_date') === localToday;

  // Em uma migração de regra, revalidamos obrigatoriamente ontem/hoje/amanhã,
  // mesmo se a carga completa do dia já tiver sido marcada anteriormente.
  const mustRefreshFreeWindow = isSyncMigration || !fullSyncToday;

  console.log(`[API_FOOTBALL] Sincronizando ${mustRefreshFreeWindow ? 'janela Free de 3 dias' : 'jogos de hoje'}...`);

  const datesToFetch = mustRefreshFreeWindow
    ? [-1, 0, 1].map((offset) => shiftDate(offset))
    : [localToday];

  const rowsByFixture = new Map();
  let remaining = null;
  let requestCount = 0;

  for (const date of datesToFetch) {
    try {
      const result = await apiFetch({ date, timezone: TZ });
      requestCount += 1;
      remaining = result.remaining ?? remaining;
      for (const fixture of result.rows) {
        const fixtureId = Number(fixture?.fixture?.id);
        const key = Number.isFinite(fixtureId) ? String(fixtureId) : JSON.stringify(fixture);
        if (!rowsByFixture.has(key)) rowsByFixture.set(key, fixture);
      }
    } catch (err) {
      console.warn(`[API_FOOTBALL] Data ${date} ignorada:`, err?.message || err);
    }
    // pequena pausa para evitar rajadas no provedor
    if (datesToFetch.length > 1) await sleep(120);
  }

  const rows = Array.from(rowsByFixture.values());
  const selected = rows.filter(f => compFor(f.league));
  console.log(`[API_FOOTBALL] Requests=${requestCount}; recebidos=${rows.length}; competições monitoradas=${selected.length}; quota restante=${remaining ?? 'n/d'}.`);

  // Remove somente fixtures que deixaram de existir/ser monitoradas dentro da
  // janela consultada. Não apagamos todas as partidas antes do upsert, pois isso
  // preserva vídeo validado, histórico de tentativas e metadados entre ciclos.
  const cleanupDates = datesToFetch;
  const cleanupPlaceholders = cleanupDates.map(() => '?').join(',');
  const selectedIds = selected
    .map(f => Number(f?.fixture?.id))
    .filter(Number.isFinite)
    .map(id => `api_fixture_${id}`);

  let staleChanges = 0;
  if (selectedIds.length > 0) {
    const selectedPlaceholders = selectedIds.map(() => '?').join(',');
    const staleResult = db.prepare(`
      DELETE FROM matches
       WHERE source_provider = 'api_football'
         AND analysis_id IS NULL
         AND substr(COALESCE(kickoff_at, ''), 1, 10) IN (${cleanupPlaceholders})
         AND id NOT IN (${selectedPlaceholders})
    `).run(...cleanupDates, ...selectedIds);
    staleChanges = Number(staleResult?.changes || 0);
  }
  console.log(`[API_FOOTBALL] Limpeza seletiva: ${staleChanges} registro(s) obsoleto(s) removido(s); históricos preservados.`);

  // Limpa destaques de dados API; serão recalculados com base em hoje.
  db.prepare(`UPDATE matches SET is_featured = 0 WHERE source_provider = 'api_football'`).run();

  let insertedOrUpdated = 0;
  let verifiedVideos = 0;
  let lookups = 0;
  let skippedVideoRetries = 0;

  for (const f of selected) {
    const comp = compFor(f.league);
    if (!comp) continue;
    const compRow = db.prepare('SELECT * FROM competitions WHERE id = ?').get(comp.id);
    if (compRow) {
      db.prepare(`UPDATE competitions SET logo_url=?, season=?, is_active=1, updated_at=CURRENT_TIMESTAMP WHERE id=?`)
        .run(f.league?.logo || compRow.logo_url, String(f.league?.season || compRow.season || ''), comp.id);
    }

    const fixtureId = Number(f.fixture?.id);
    if (!Number.isFinite(fixtureId)) continue;
    const id = `api_fixture_${fixtureId}`;
    const existing = db.prepare('SELECT * FROM matches WHERE id = ?').get(id);
    const short = String(f.fixture?.status?.short || 'NS');
    const localFixtureDate = String(f.fixture?.date || '').slice(0,10);
    const isToday = localFixtureDate === localToday;
    const isFeature = isToday && !INVALID_FEATURE.has(short) ? 1 : 0;

    let videoUrl = existing?.video_url || null;
    let videoTitle = existing?.video_source_title || null;
    let videoPublishedAt = existing?.video_published_at || null;
    let videoVerifiedAt = existing?.video_verified_at || null;
    let videoConfidence = Number(existing?.video_confidence || 0);
    let videoLookupAttemptedAt = existing?.video_lookup_attempted_at || null;

    // Partida ainda não terminou: qualquer URL sem análise é inválida para esta partida atual.
    if (!FINISHED.has(short) && !existing?.analysis_id) {
      videoUrl = null; videoTitle = null; videoPublishedAt = null; videoVerifiedAt = null; videoConfidence = 0;
    }

    // Pós-jogo automático: enquanto não houver vídeo validado, tentamos de novo
    // com frequência progressiva. A busca no YouTube não consome quota da
    // API-Football. Limitamos a 8 partidas por ciclo para evitar rajadas.
    if (FINISHED.has(short) && !existing?.analysis_id && !videoVerifiedAt) {
      const lastAttempt = parseTs(videoLookupAttemptedAt);
      const retryAfter = videoRetryIntervalMs(f);

      if (lookups < 8 && (!lastAttempt || Date.now() - lastAttempt >= retryAfter)) {
        lookups++;
        videoLookupAttemptedAt = nowIso();
        console.log(`[VIDEO_VERIFY] Tentativa ${f.teams?.home?.name} x ${f.teams?.away?.name}; nova janela=${Math.round(retryAfter / 60000)}min.`);
        const verified = await findVerifiedVideo(f);
        if (verified) {
          videoUrl = verified.url;
          videoTitle = verified.title;
          videoPublishedAt = verified.publishedAt;
          videoVerifiedAt = nowIso();
          videoConfidence = verified.confidence;
          verifiedVideos++;
          console.log(`[VIDEO_VERIFY] OK ${f.teams?.home?.name} x ${f.teams?.away?.name} | ${verified.publishedAt} | confiança=${verified.confidence}`);
        }
      } else if (lastAttempt && Date.now() - lastAttempt < retryAfter) {
        skippedVideoRetries++;
      }
    }

    const status = mapStatus(short, Boolean(videoUrl && videoVerifiedAt));
    const matchDate = formatMatchDate(f.fixture?.date);
    const round = String(f.league?.round || '');
    const stadium = String(f.fixture?.venue?.name || '');
    const city = String(f.fixture?.venue?.city || '');
    const nullableScore = (value) => {
      if (value === null || value === undefined || value === '') return null;
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    };
    const scoreHome = nullableScore(f.goals?.home);
    const scoreAway = nullableScore(f.goals?.away);

    db.prepare(`
      INSERT INTO matches (
        id, competition_id, home_team, away_team, home_team_logo, away_team_logo,
        video_url, match_date, round, stadium, status, analysis_id, is_featured,
        home_score, away_score, created_at, updated_at,
        external_fixture_id, source_provider, source_verified_at, kickoff_at, api_status,
        fixture_timezone, venue_city, video_source_title, video_published_at,
        video_verified_at, video_confidence, video_lookup_attempted_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP,
                ?, 'api_football', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        competition_id=excluded.competition_id,
        home_team=excluded.home_team,
        away_team=excluded.away_team,
        home_team_logo=excluded.home_team_logo,
        away_team_logo=excluded.away_team_logo,
        video_url=CASE WHEN matches.analysis_id IS NOT NULL THEN matches.video_url ELSE excluded.video_url END,
        match_date=excluded.match_date,
        round=excluded.round,
        stadium=excluded.stadium,
        status=excluded.status,
        is_featured=excluded.is_featured,
        home_score=excluded.home_score,
        away_score=excluded.away_score,
        updated_at=CURRENT_TIMESTAMP,
        external_fixture_id=excluded.external_fixture_id,
        source_provider='api_football',
        source_verified_at=excluded.source_verified_at,
        kickoff_at=excluded.kickoff_at,
        api_status=excluded.api_status,
        fixture_timezone=excluded.fixture_timezone,
        venue_city=excluded.venue_city,
        video_source_title=CASE WHEN matches.analysis_id IS NOT NULL THEN matches.video_source_title ELSE excluded.video_source_title END,
        video_published_at=CASE WHEN matches.analysis_id IS NOT NULL THEN matches.video_published_at ELSE excluded.video_published_at END,
        video_verified_at=CASE WHEN matches.analysis_id IS NOT NULL THEN matches.video_verified_at ELSE excluded.video_verified_at END,
        video_confidence=CASE WHEN matches.analysis_id IS NOT NULL THEN matches.video_confidence ELSE excluded.video_confidence END,
        video_lookup_attempted_at=excluded.video_lookup_attempted_at
    `).run(
      id, comp.id,
      String(f.teams?.home?.name || ''), String(f.teams?.away?.name || ''),
      String(f.teams?.home?.logo || ''), String(f.teams?.away?.logo || ''),
      videoUrl, matchDate, round, stadium, status, isFeature,
      scoreHome, scoreAway, fixtureId, nowIso(), String(f.fixture?.date || ''), short,
      String(f.fixture?.timezone || TZ), city, videoTitle, videoPublishedAt, videoVerifiedAt,
      videoConfidence, videoLookupAttemptedAt
    );
    insertedOrUpdated++;
  }

  // Não deixa nenhum fixture antigo/manual sem análise competir com a fonte oficial na Home.
  db.prepare(`UPDATE matches SET is_featured=0 WHERE source_provider IS NULL AND analysis_id IS NULL`).run();
  // Limpeza leve: API fixtures muito antigos sem análise deixam de ocupar a tela/banco indefinidamente.
  db.prepare(`DELETE FROM matches WHERE source_provider='api_football' AND analysis_id IS NULL AND kickoff_at < datetime('now','-30 days')`).run();

  settingSet('api_football_last_sync_at', nowIso());
  if (!fullSyncToday) settingSet('api_football_last_full_sync_date', localToday);
  if (remaining != null) {
    settingSet('api_football_last_remaining_quota', remaining);
    settingSet('api_football_last_quota_date', localToday);
  }
  settingSet('api_football_sync_schema_version', SYNC_VERSION);
  console.log(`[API_FOOTBALL] OK: partidas atualizadas=${insertedOrUpdated}; vídeos validados=${verifiedVideos}; buscas de vídeo=${lookups}; retries aguardando janela=${skippedVideoRetries}; versão=${SYNC_VERSION}.`);
}

main()
  .then(() => {
    // Este script roda via spawnSync antes do servidor principal.
    // O cliente libSQL pode manter handles de rede abertos; encerramos
    // explicitamente para não bloquear a subida da porta HTTP no Render.
    process.exit(0);
  })
  .catch(err => {
    console.error('[API_FOOTBALL] Falha na sincronização:', err?.stack || err?.message || err);
    // Não derruba o ProTática por indisponibilidade temporária do provedor.
    process.exit(0);
  });
