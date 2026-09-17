import { mkdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomUUID, randomBytes, scryptSync, timingSafeEqual, createHash } from 'node:crypto';
import Database from 'libsql';

const production = process.env.NODE_ENV === 'production';
const tursoUrl = String(process.env.TURSO_DATABASE_URL || '').trim();
const tursoAuthToken = String(process.env.TURSO_AUTH_TOKEN || '').trim();
const usingRemoteDatabase = Boolean(tursoUrl);

if (production && (!tursoUrl || !tursoAuthToken)) {
  throw new Error(
    'Banco persistente não configurado. Defina TURSO_DATABASE_URL e TURSO_AUTH_TOKEN no Render.'
  );
}

let database: Database;
if (usingRemoteDatabase) {
  database = new Database(tursoUrl, { authToken: tursoAuthToken });
  console.log('[DB] Turso remoto configurado. Os dados não dependem do disco do Render.');
} else {
  const configuredDataDir = String(process.env.DATA_DIR || '').trim();
  const dataDir = configuredDataDir ? resolve(configuredDataDir) : resolve(process.cwd(), 'data');
  if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });
  const dbPath = resolve(dataDir, 'protatica.sqlite');
  database = new Database(dbPath);
  database.exec('PRAGMA journal_mode = WAL;');
  console.log(`[DB] SQLite local de desenvolvimento: ${dbPath}`);
}

export const db = database;
db.exec('PRAGMA foreign_keys = ON;');

// --- SCHEMA & MIGRATIONS SYSTEM ---
const syncDatabaseSchema = () => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      display_name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS teams (
      id TEXT PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS analyses (
      id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL,
      video_title TEXT,
      video_url TEXT,
      video_id TEXT,
      team_a TEXT,
      team_b TEXT,
      placar TEXT,
      confidence TEXT,
      strategy TEXT,
      payload_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS player_analyses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      analysis_id TEXT NOT NULL,
      display_name TEXT,
      team TEXT,
      position TEXT,
      shirt_number TEXT,
      identification_type TEXT,
      minutes_observed TEXT,
      confidence TEXT,
      strengths_json TEXT,
      concerns_json TEXT,
      actions_json TEXT,
      summary TEXT,
      FOREIGN KEY (analysis_id) REFERENCES analyses(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS timeline_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      analysis_id TEXT NOT NULL,
      minute TEXT,
      team TEXT,
      type TEXT,
      description TEXT,
      tactical_impact TEXT,
      FOREIGN KEY (analysis_id) REFERENCES analyses(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS telegram_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id TEXT NOT NULL,
      tipo TEXT NOT NULL,
      conteudo_resumido TEXT,
      status TEXT NOT NULL,
      erro TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS auth_sessions (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      expires_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS player_photos_cache (
      nome_normalizado TEXT NOT NULL,
      time TEXT NOT NULL,
      temporada TEXT,
      url TEXT NOT NULL,
      fonte TEXT,
      confidence TEXT,
      confidence_score INTEGER DEFAULT 0,
      manual_verified INTEGER DEFAULT 0,
      photo_key TEXT,
      status TEXT DEFAULT 'verified',
      updated_at TEXT NOT NULL,
      PRIMARY KEY (nome_normalizado, time)
    );

    CREATE TABLE IF NOT EXISTS verification_tokens (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      token_hash TEXT NOT NULL,
      token_type TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      used_at TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS email_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT,
      email TEXT NOT NULL,
      type TEXT NOT NULL,
      status TEXT NOT NULL,
      provider_message_id TEXT,
      error_summary TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS subscription_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT,
      event_type TEXT NOT NULL,
      details_json TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS admin_audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      admin_id TEXT NOT NULL,
      target_user_id TEXT,
      action TEXT NOT NULL,
      reason TEXT,
      details_json TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS training_plans (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      analysis_id TEXT,
      title TEXT NOT NULL,
      problem_identified TEXT NOT NULL,
      objective TEXT NOT NULL,
      duration TEXT NOT NULL,
      players_count TEXT NOT NULL,
      materials TEXT,
      organization TEXT NOT NULL,
      execution TEXT NOT NULL,
      expected_behaviors_json TEXT,
      observation_points_json TEXT,
      progression TEXT,
      regression TEXT,
      next_match_indicators_json TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS tactical_boards (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      title TEXT NOT NULL,
      formation_a TEXT,
      formation_b TEXT,
      payload_json TEXT NOT NULL,
      preview_image TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS saved_evidences (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      analysis_id TEXT,
      category TEXT NOT NULL,
      title TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      description TEXT NOT NULL,
      team TEXT,
      player TEXT,
      source TEXT,
      confidence TEXT,
      video_url TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS team_goals (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      title TEXT NOT NULL,
      target_behavior TEXT NOT NULL,
      current_status TEXT NOT NULL,
      progress_notes_json TEXT,
      target_period TEXT NOT NULL,
      achieved INTEGER DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS teams (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      season TEXT NOT NULL,
      city TEXT,
      shield_url TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS opponent_dossiers (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      opponent_name TEXT NOT NULL,
      analyzed_matches_count INTEGER NOT NULL DEFAULT 1,
      matches_ids_json TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS competitions (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      country TEXT,
      region TEXT,
      logo_url TEXT,
      season TEXT NOT NULL,
      is_active INTEGER DEFAULT 1,
      display_order INTEGER DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS matches (
      id TEXT PRIMARY KEY,
      competition_id TEXT NOT NULL,
      home_team TEXT NOT NULL,
      away_team TEXT NOT NULL,
      home_team_logo TEXT,
      away_team_logo TEXT,
      video_url TEXT,
      match_date TEXT NOT NULL,
      round TEXT,
      stadium TEXT,
      status TEXT DEFAULT 'scheduled',
      analysis_id TEXT,
      is_featured INTEGER DEFAULT 0,
      featured_player_name TEXT,
      featured_player_photo TEXT,
      featured_player_position TEXT,
      featured_player_team TEXT,
      home_score INTEGER,
      away_score INTEGER,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT,
      FOREIGN KEY (competition_id) REFERENCES competitions(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS player_catalog (
      id TEXT PRIMARY KEY,
      normalized_name TEXT NOT NULL,
      display_name TEXT NOT NULL,
      club TEXT NOT NULL,
      position TEXT,
      shirt_number TEXT,
      season TEXT,
      photo_url TEXT,
      photo_source TEXT,
      photo_verified INTEGER DEFAULT 0,
      admin_verified INTEGER DEFAULT 0,
      status TEXT DEFAULT 'unconfirmed',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT
    );
  `);

  // --- IDEMPOTENT USERS TABLE COLUMN SYNCHRONIZATION ---
  const userCols: any[] = db.prepare("PRAGMA table_info(users)").all();
  const colNames = new Set(userCols.map((c) => c.name));

  const addColIfNotExists = (name: string, definition: string) => {
    if (!colNames.has(name)) {
      try {
        db.exec(`ALTER TABLE users ADD COLUMN ${name} ${definition};`);
        colNames.add(name);
        console.log(`[DB Migration] Adicionada coluna '${name}' na tabela users.`);
      } catch (e: any) {
        console.warn(`[DB Migration] Coluna '${name}' já existente ou erro:`, e.message);
      }
    }
  };

  // Add all expected columns for trial, subscription, stripe and administration
  addColIfNotExists('email', 'TEXT');
  addColIfNotExists('role', "TEXT DEFAULT 'user'");
  addColIfNotExists('account_type', "TEXT DEFAULT 'paid'");
  addColIfNotExists('phone', 'TEXT');
  addColIfNotExists('organization', 'TEXT');
  addColIfNotExists('usage_profile', 'TEXT');
  addColIfNotExists('terms_accepted', 'INTEGER DEFAULT 1');
  addColIfNotExists('trial_used', 'INTEGER DEFAULT 0');
  addColIfNotExists('trial_started_at', 'TEXT');
  addColIfNotExists('trial_expires_at', 'TEXT');
  addColIfNotExists('trial_status', "TEXT DEFAULT 'none'");
  addColIfNotExists('subscription_status', "TEXT DEFAULT 'active'");
  addColIfNotExists('subscription_plan', 'TEXT');
  addColIfNotExists('subscription_started_at', 'TEXT');
  addColIfNotExists('subscription_expires_at', 'TEXT');
  addColIfNotExists('converted_from_trial', 'INTEGER DEFAULT 0');
  addColIfNotExists('email_verified', 'INTEGER DEFAULT 1');
  addColIfNotExists('is_blocked', 'INTEGER DEFAULT 0');
  addColIfNotExists('last_login_at', 'TEXT');
  addColIfNotExists('stripe_customer_id', 'TEXT');
  addColIfNotExists('stripe_subscription_id', 'TEXT');
  addColIfNotExists('updated_at', 'TEXT');

  // --- IDEMPOTENT ANALYSES TABLE COLUMN SYNCHRONIZATION ---
  const analysisCols: any[] = db.prepare("PRAGMA table_info(analyses)").all();
  const analysisColNames = new Set(analysisCols.map((c) => c.name));

  const addAnalysisColIfNotExists = (name: string, definition: string) => {
    if (!analysisColNames.has(name)) {
      try {
        db.exec(`ALTER TABLE analyses ADD COLUMN ${name} ${definition};`);
        analysisColNames.add(name);
        console.log(`[DB Migration] Adicionada coluna '${name}' na tabela analyses.`);
      } catch (e: any) {
        console.warn(`[DB Migration] Coluna '${name}' já existente ou erro:`, e.message);
      }
    }
  };

  addAnalysisColIfNotExists('visibility', "TEXT DEFAULT 'private'");
  addAnalysisColIfNotExists('user_id', 'TEXT');

  // --- IDEMPOTENT TEAMS TABLE COLUMN SYNCHRONIZATION ---
  // Older builds created `teams` with only id/name/created_at. Keep existing data
  // and add the fields required by the multi-user "Minha Equipe" module.
  const teamCols: any[] = db.prepare("PRAGMA table_info(teams)").all();
  const teamColNames = new Set(teamCols.map((c) => c.name));
  const addTeamColIfNotExists = (name: string, definition: string) => {
    if (!teamColNames.has(name)) {
      try {
        db.exec(`ALTER TABLE teams ADD COLUMN ${name} ${definition};`);
        teamColNames.add(name);
        console.log(`[DB Migration] Adicionada coluna '${name}' na tabela teams.`);
      } catch (e: any) {
        console.warn(`[DB Migration] Erro ao sincronizar teams.${name}:`, e.message);
      }
    }
  };
  addTeamColIfNotExists('user_id', 'TEXT');
  addTeamColIfNotExists('category', "TEXT DEFAULT 'Profissional'");
  addTeamColIfNotExists('season', "TEXT DEFAULT ''");
  addTeamColIfNotExists('city', 'TEXT');
  addTeamColIfNotExists('shield_url', 'TEXT');
  addTeamColIfNotExists('updated_at', 'TEXT');

  // Remove the legacy UNIQUE(name) constraint. Different users must be able to
  // create teams with the same real-world name without replacing each other's data.
  try {
    const teamsSqlRow: any = db.prepare(`SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'teams'`).get();
    const teamsSql = String(teamsSqlRow?.sql || '');
    if (/name\s+TEXT\s+UNIQUE/i.test(teamsSql)) {
      db.exec('PRAGMA foreign_keys = OFF;');
      db.exec(`
        CREATE TABLE IF NOT EXISTS teams_secure_migration (
          id TEXT PRIMARY KEY,
          user_id TEXT,
          name TEXT NOT NULL,
          category TEXT DEFAULT 'Profissional',
          season TEXT DEFAULT '',
          city TEXT,
          shield_url TEXT,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT
        );
        INSERT OR IGNORE INTO teams_secure_migration (
          id, user_id, name, category, season, city, shield_url, created_at, updated_at
        )
        SELECT id, user_id, name, COALESCE(category, 'Profissional'), COALESCE(season, ''), city, shield_url, created_at, updated_at
        FROM teams;
        DROP TABLE teams;
        ALTER TABLE teams_secure_migration RENAME TO teams;
      `);
      db.exec('PRAGMA foreign_keys = ON;');
      console.log('[DB Migration] Restrição global UNIQUE(name) removida da tabela teams.');
    }
  } catch (e: any) {
    try { db.exec('PRAGMA foreign_keys = ON;'); } catch {}
    console.warn('[DB Migration] Falha ao normalizar tabela teams:', e.message);
  }

  // --- IDEMPOTENT MATCHES TABLE COLUMN SYNCHRONIZATION ---
  // A URL do vídeo é necessária para que "Analisar esta partida" consiga
  // preencher automaticamente o formulário de Nova Análise.
  try {
    const matchCols: any[] = db.prepare("PRAGMA table_info(matches)").all();
    const matchColNames = new Set(matchCols.map((c) => c.name));
    if (!matchColNames.has('video_url')) {
      db.exec('ALTER TABLE matches ADD COLUMN video_url TEXT;');
      console.log('[DB Migration] Adicionada coluna video_url na tabela matches.');
    }
  } catch (e: any) {
    console.warn('[DB Migration] Falha ao sincronizar matches.video_url:', e.message);
  }

  // --- IDEMPOTENT PLAYER PHOTOS CACHE TABLE COLUMN SYNCHRONIZATION ---
  const photoCols: any[] = db.prepare("PRAGMA table_info(player_photos_cache)").all();
  const photoColNames = new Set(photoCols.map((c) => c.name));

  const addPhotoColIfNotExists = (name: string, definition: string) => {
    if (!photoColNames.has(name)) {
      try {
        db.exec(`ALTER TABLE player_photos_cache ADD COLUMN ${name} ${definition};`);
        photoColNames.add(name);
        console.log(`[DB Migration] Adicionada coluna '${name}' na tabela player_photos_cache.`);
      } catch (e: any) {
        console.warn(`[DB Migration] Coluna '${name}' já existente ou erro:`, e.message);
      }
    }
  };

  addPhotoColIfNotExists('temporada', 'TEXT');
  addPhotoColIfNotExists('confidence_score', 'INTEGER DEFAULT 0');
  addPhotoColIfNotExists('manual_verified', 'INTEGER DEFAULT 0');
  addPhotoColIfNotExists('photo_key', 'TEXT');
  addPhotoColIfNotExists('status', "TEXT DEFAULT 'verified'");

  // Create indexes for fast lookup without dropping data
  try {
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
      CREATE INDEX IF NOT EXISTS idx_verification_tokens_hash ON verification_tokens(token_hash);
      CREATE INDEX IF NOT EXISTS idx_competitions_slug ON competitions(slug);
      CREATE INDEX IF NOT EXISTS idx_matches_competition ON matches(competition_id);
      CREATE INDEX IF NOT EXISTS idx_player_catalog_name ON player_catalog(normalized_name);
      CREATE INDEX IF NOT EXISTS idx_analyses_user_created ON analyses(user_id, created_at);
      CREATE INDEX IF NOT EXISTS idx_analyses_visibility ON analyses(visibility);
      CREATE INDEX IF NOT EXISTS idx_teams_user ON teams(user_id);
    `);
  } catch (e: any) {
    console.warn('[DB Migration] Indexes warning:', e.message);
  }

  // Seed default major competitions if none exist
  try {
    const compCount: any = db.prepare('SELECT COUNT(*) as count FROM competitions').get();
    if (compCount?.count === 0) {
      const initialCompetitions = [
        {
          id: 'comp_brasileirao',
          name: 'Brasileirão Série A',
          slug: 'brasileirao-serie-a',
          country: 'Brasil 🇧🇷',
          region: 'América do Sul',
          season: '2026',
          logoUrl: 'https://upload.wikimedia.org/wikipedia/pt/b/b8/Campeonato_Brasileiro_S%C3%A9rie_A_logo.png',
          displayOrder: 1,
        },
        {
          id: 'comp_copa_brasil',
          name: 'Copa do Brasil',
          slug: 'copa-do-brasil',
          country: 'Brasil 🇧🇷',
          region: 'América do Sul',
          season: '2026',
          logoUrl: 'https://upload.wikimedia.org/wikipedia/pt/0/07/Copa_do_Brasil_logo_2023.png',
          displayOrder: 2,
        },
        {
          id: 'comp_libertadores',
          name: 'Copa Libertadores',
          slug: 'copa-libertadores',
          country: 'CONMEBOL 🌎',
          region: 'América do Sul',
          season: '2026',
          logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/Copa_Libertadores_logo.svg/800px-Copa_Libertadores_logo.svg.png',
          displayOrder: 3,
        },
        {
          id: 'comp_sulamericana',
          name: 'Copa Sul-Americana',
          slug: 'copa-sul-americana',
          country: 'CONMEBOL 🌎',
          region: 'América do Sul',
          season: '2026',
          logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4b/Copa_Sudamericana_logo.svg/800px-Copa_Sudamericana_logo.svg.png',
          displayOrder: 4,
        },
        {
          id: 'comp_champions',
          name: 'UEFA Champions League',
          slug: 'uefa-champions-league',
          country: 'UEFA 🏆',
          region: 'Europa',
          season: '2026/27',
          logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f3/UEFA_Champions_League_logo_2.svg/1024px-UEFA_Champions_League_logo_2.svg.png',
          displayOrder: 5,
        },
        {
          id: 'comp_premier_league',
          name: 'Premier League',
          slug: 'premier-league',
          country: 'Inglaterra 🇬🇧',
          region: 'Europa',
          season: '2026/27',
          logoUrl: 'https://upload.wikimedia.org/wikipedia/pt/thumb/f/f2/Premier_League_Logo.svg/800px-Premier_League_Logo.svg.png',
          displayOrder: 6,
        },
        {
          id: 'comp_la_liga',
          name: 'La Liga',
          slug: 'la-liga',
          country: 'Espanha 🇪🇸',
          region: 'Europa',
          season: '2026/27',
          logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0f/LaLiga_EA_Sports_2023_Logo.svg/1024px-LaLiga_EA_Sports_2023_Logo.svg.png',
          displayOrder: 7,
        },
        {
          id: 'comp_serie_a_ita',
          name: 'Serie A Italiana',
          slug: 'serie-a-italiana',
          country: 'Itália 🇮🇹',
          region: 'Europa',
          season: '2026/27',
          logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e9/Serie_A_logo_2021.svg/800px-Serie_A_logo_2021.svg.png',
          displayOrder: 8,
        },
        {
          id: 'comp_bundesliga',
          name: 'Bundesliga',
          slug: 'bundesliga',
          country: 'Alemanha 🇩🇪',
          region: 'Europa',
          season: '2026/27',
          logoUrl: 'https://upload.wikimedia.org/wikipedia/pt/thumb/0/07/Bundesliga_logo_%282017%29.svg/800px-Bundesliga_logo_%282017%29.svg.png',
          displayOrder: 9,
        },
        {
          id: 'comp_ligue_1',
          name: 'Ligue 1',
          slug: 'ligue-1',
          country: 'França 🇫🇷',
          region: 'Europa',
          season: '2026/27',
          logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/49/Ligue1_Uber_Eats_logo.svg/800px-Ligue1_Uber_Eats_logo.svg.png',
          displayOrder: 10,
        },
        {
          id: 'comp_primeira_liga',
          name: 'Primeira Liga',
          slug: 'primeira-liga',
          country: 'Portugal 🇵🇹',
          region: 'Europa',
          season: '2026/27',
          logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0e/Liga_Portugal_logo.svg/800px-Liga_Portugal_logo.svg.png',
          displayOrder: 11,
        },
        {
          id: 'comp_europa_league',
          name: 'UEFA Europa League',
          slug: 'uefa-europa-league',
          country: 'UEFA 🏆',
          region: 'Europa',
          season: '2026/27',
          logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/03/UEFA_Europa_League_logo_%282024%29.svg/800px-UEFA_Europa_League_logo_%282024%29.svg.png',
          displayOrder: 12,
        },
        {
          id: 'comp_copa_do_mundo',
          name: 'Copa do Mundo FIFA',
          slug: 'copa-do-mundo',
          country: 'FIFA 🌍',
          region: 'Mundial',
          season: '2026',
          logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/10/2026_FIFA_World_Cup_emblem.svg/800px-2026_FIFA_World_Cup_emblem.svg.png',
          displayOrder: 13,
        },
        {
          id: 'comp_mundial_clubes',
          name: 'Mundial de Clubes FIFA',
          slug: 'mundial-de-clubes',
          country: 'FIFA 🌍',
          region: 'Mundial',
          season: '2026',
          logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e0/FIFA_Club_World_Cup_2025_logo.svg/800px-FIFA_Club_World_Cup_2025_logo.svg.png',
          displayOrder: 14,
        },
      ];

      const insertComp = db.prepare(`
        INSERT INTO competitions (id, name, slug, country, region, season, logo_url, is_active, display_order)
        VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)
      `);

      for (const comp of initialCompetitions) {
        insertComp.run(comp.id, comp.name, comp.slug, comp.country, comp.region, comp.season, comp.logoUrl, comp.displayOrder);
      }
      console.log('[DB Migration] Competições principais inicializadas com sucesso.');
    }
  } catch (e: any) {
    console.warn('[DB Migration] Erro ao semear competições:', e.message);
  }

  // Seed initial featured matches if matches table is empty
  try {
    const matchCount: any = db.prepare('SELECT COUNT(*) as count FROM matches').get();
    if (matchCount?.count === 0) {
      const initialMatches = [
        {
          id: 'match_fla_pal',
          competition_id: 'comp_brasileirao',
          home_team: 'Flamengo',
          away_team: 'Palmeiras',
          home_team_logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2e/Flamengo_braz_logo.svg/300px-Flamengo_braz_logo.svg.png',
          away_team_logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/10/Palmeiras_logo.svg/300px-Palmeiras_logo.svg.png',
          match_date: 'Hoje • 21:30',
          round: 'Rodada 26',
          stadium: 'Maracanã, Rio de Janeiro',
          status: 'scheduled',
          is_featured: 1,
          featured_player_name: 'Pedro',
          featured_player_position: 'Centroavante',
          featured_player_team: 'Flamengo',
          featured_player_photo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/84/Pedro_Guilherme_Abreu_dos_Santos_2022.jpg/440px-Pedro_Guilherme_Abreu_dos_Santos_2022.jpg',
        },
        {
          id: 'match_rma_mci',
          competition_id: 'comp_champions',
          home_team: 'Real Madrid',
          away_team: 'Manchester City',
          home_team_logo: 'https://upload.wikimedia.org/wikipedia/pt/thumb/9/98/Real_Madrid.png/300px-Real_Madrid.png',
          away_team_logo: 'https://upload.wikimedia.org/wikipedia/pt/thumb/0/02/Manchester_City_FC_badge.png/300px-Manchester_City_FC_badge.png',
          match_date: '12 SET • 16:00',
          round: 'Fase de Liga',
          stadium: 'Santiago Bernabéu, Madrid',
          status: 'scheduled',
          is_featured: 1,
          featured_player_name: 'Vinícius Júnior',
          featured_player_position: 'Ponta esquerda',
          featured_player_team: 'Real Madrid',
          featured_player_photo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f3/Vinicius_Junior_2021.jpg/440px-Vinicius_Junior_2021.jpg',
        },
        {
          id: 'match_ars_liv',
          competition_id: 'comp_premier_league',
          home_team: 'Arsenal',
          away_team: 'Liverpool',
          home_team_logo: 'https://upload.wikimedia.org/wikipedia/pt/thumb/5/53/Arsenal_FC.svg/300px-Arsenal_FC.svg.png',
          away_team_logo: 'https://upload.wikimedia.org/wikipedia/pt/thumb/0/0c/Liverpool_FC.svg/300px-Liverpool_FC.svg.png',
          match_date: 'Domingo • 13:30',
          round: 'Rodada 8',
          stadium: 'Emirates Stadium, Londres',
          status: 'scheduled',
          is_featured: 1,
          featured_player_name: 'Bukayo Saka',
          featured_player_position: 'Ponta direita',
          featured_player_team: 'Arsenal',
          featured_player_photo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4b/Bukayo_Saka_2023.jpg/440px-Bukayo_Saka_2023.jpg',
        },
        {
          id: 'match_bar_bay',
          competition_id: 'comp_champions',
          home_team: 'Barcelona',
          away_team: 'Bayern München',
          home_team_logo: 'https://upload.wikimedia.org/wikipedia/pt/thumb/4/43/FCBarcelona.svg/300px-FCBarcelona.svg.png',
          away_team_logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1b/FC_Bayern_M%C3%BCnchen_logo_%282017%29.svg/300px-FC_Bayern_M%C3%BCnchen_logo_%282017%29.svg.png',
          match_date: 'Quarta • 16:00',
          round: 'Fase de Liga',
          stadium: 'Olímpic Lluís Companys, Barcelona',
          status: 'scheduled',
          is_featured: 1,
          featured_player_name: 'Lamine Yamal',
          featured_player_position: 'Extremo direito',
          featured_player_team: 'Barcelona',
          featured_player_photo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/ca/Lamine_Yamal_2024.jpg/440px-Lamine_Yamal_2024.jpg',
        },
        {
          id: 'match_bot_riv',
          competition_id: 'comp_libertadores',
          home_team: 'Botafogo',
          away_team: 'River Plate',
          home_team_logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/52/Botafogo_de_Futebol_e_Regatas_logo.svg/300px-Botafogo_de_Futebol_e_Regatas_logo.svg.png',
          away_team_logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ac/Escudo_del_C_A_River_Plate.svg/300px-Escudo_del_C_A_River_Plate.svg.png',
          match_date: 'Quinta • 21:30',
          round: 'Semifinal',
          stadium: 'Estádio Nilton Santos, Rio de Janeiro',
          status: 'scheduled',
          is_featured: 1,
          featured_player_name: 'Luiz Henrique',
          featured_player_position: 'Atacante',
          featured_player_team: 'Botafogo',
          featured_player_photo: '',
        }
      ];

      const insertMatch = db.prepare(`
        INSERT INTO matches (
          id, competition_id, home_team, away_team, home_team_logo, away_team_logo,
          match_date, round, stadium, status, is_featured,
          featured_player_name, featured_player_position, featured_player_team, featured_player_photo
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const m of initialMatches) {
        insertMatch.run(
          m.id, m.competition_id, m.home_team, m.away_team, m.home_team_logo, m.away_team_logo,
          m.match_date, m.round, m.stadium, m.status, m.is_featured,
          m.featured_player_name, m.featured_player_position, m.featured_player_team, m.featured_player_photo
        );
      }
      console.log('[DB Migration] Partidas principais inicializadas com sucesso.');
    }
  } catch (e: any) {
    console.warn('[DB Migration] Erro ao semear partidas:', e.message);
  }

  // Seed player catalog initial entries with verified identity
  try {
    const pCount: any = db.prepare('SELECT COUNT(*) as count FROM player_catalog').get();
    if (pCount?.count === 0) {
      const initialCatalog = [
        {
          id: 'p_pedro_fla',
          normalized_name: 'pedro',
          display_name: 'Pedro',
          club: 'Flamengo',
          position: 'Atacante / Centroavante',
          shirt_number: '9',
          season: '2026',
          photo_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/84/Pedro_Guilherme_Abreu_dos_Santos_2022.jpg/440px-Pedro_Guilherme_Abreu_dos_Santos_2022.jpg',
          photo_source: 'Clube Oficial / Wikimedia Sports',
          photo_verified: 1,
          admin_verified: 1,
          status: 'confirmed',
        },
        {
          id: 'p_vinicius_rma',
          normalized_name: 'vinicius junior',
          display_name: 'Vinícius Júnior',
          club: 'Real Madrid',
          position: 'Ponta esquerda',
          shirt_number: '7',
          season: '2026/27',
          photo_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f3/Vinicius_Junior_2021.jpg/440px-Vinicius_Junior_2021.jpg',
          photo_source: 'Site Oficial / UEFA Verified',
          photo_verified: 1,
          admin_verified: 1,
          status: 'confirmed',
        },
        {
          id: 'p_arrascaeta_fla',
          normalized_name: 'arrascaeta',
          display_name: 'Giorgian De Arrascaeta',
          club: 'Flamengo',
          position: 'Meio-campista / Meia Armador',
          shirt_number: '14',
          season: '2026',
          photo_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/06/Giorgian_De_Arrascaeta_2022.jpg/440px-Giorgian_De_Arrascaeta_2022.jpg',
          photo_source: 'Clube Oficial / Federação',
          photo_verified: 1,
          admin_verified: 1,
          status: 'confirmed',
        },
        {
          id: 'p_veiga_pal',
          normalized_name: 'raphael veiga',
          display_name: 'Raphael Veiga',
          club: 'Palmeiras',
          position: 'Meio-campista ofensivo',
          shirt_number: '23',
          season: '2026',
          photo_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d4/Raphael_Veiga_2022.jpg/440px-Raphael_Veiga_2022.jpg',
          photo_source: 'Clube Oficial / CBF',
          photo_verified: 1,
          admin_verified: 1,
          status: 'confirmed',
        },
        {
          id: 'p_debruyne_mci',
          normalized_name: 'kevin de bruyne',
          display_name: 'Kevin De Bruyne',
          club: 'Manchester City',
          position: 'Meio-campista',
          shirt_number: '17',
          season: '2026/27',
          photo_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/40/Kevin_De_Bruyne_201807091.jpg/440px-Kevin_De_Bruyne_201807091.jpg',
          photo_source: 'UEFA / Premier League Verified',
          photo_verified: 1,
          admin_verified: 1,
          status: 'confirmed',
        },
        {
          id: 'p_yamal_bar',
          normalized_name: 'lamine yamal',
          display_name: 'Lamine Yamal',
          club: 'Barcelona',
          position: 'Extremo direito',
          shirt_number: '19',
          season: '2026/27',
          photo_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/ca/Lamine_Yamal_2024.jpg/440px-Lamine_Yamal_2024.jpg',
          photo_source: 'La Liga / UEFA Verified',
          photo_verified: 1,
          admin_verified: 1,
          status: 'confirmed',
        },
      ];

      const insertPlayerCat = db.prepare(`
        INSERT INTO player_catalog (
          id, normalized_name, display_name, club, position, shirt_number, season, photo_url, photo_source, photo_verified, admin_verified, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const p of initialCatalog) {
        insertPlayerCat.run(
          p.id, p.normalized_name, p.display_name, p.club, p.position, p.shirt_number, p.season,
          p.photo_url, p.photo_source, p.photo_verified, p.admin_verified, p.status
        );
      }
      console.log('[DB Migration] Catálogo de jogadores inicializado com fotos confirmadas.');
    }
  } catch (e: any) {
    console.warn('[DB Migration] Erro ao semear catálogo de jogadores:', e.message);
  }

  // Preserve legacy admin accounts with proper role and account_type
  try {
    db.exec(`
      UPDATE users SET role = 'admin', account_type = 'admin'
      WHERE LOWER(username) = 'admin' AND (role IS NULL OR role != 'admin' OR account_type != 'admin');
    `);
  } catch (e: any) {
    console.warn('[DB Migration] Admin role synchronization note:', e.message);
  }

  // Ensure updated_at is populated for existing records
  try {
    db.exec(`
      UPDATE users SET updated_at = created_at WHERE updated_at IS NULL;
    `);
  } catch (e: any) {}
};

syncDatabaseSchema();

// --- PASSWORD HASHING (SCRYPT + SALT WITH LEGACY SHA256 UPGRADE) ---
export const hashPassword = (passwordPlain: string): string => {
  const salt = randomBytes(16).toString('hex');
  const derived = scryptSync(passwordPlain, salt, 64).toString('hex');
  return `scrypt$${salt}$${derived}`;
};

export const verifyPassword = (passwordPlain: string, storedHash: string): boolean => {
  if (!storedHash || !passwordPlain) return false;

  // New scrypt format: scrypt$salt$derived
  if (storedHash.startsWith('scrypt$')) {
    const parts = storedHash.split('$');
    if (parts.length !== 3) return false;
    const salt = parts[1];
    const originalDerived = Buffer.from(parts[2], 'hex');
    const computedDerived = scryptSync(passwordPlain, salt, 64);
    if (originalDerived.length !== computedDerived.length) return false;
    return timingSafeEqual(originalDerived, computedDerived);
  }

  // Legacy SHA256 fallback (hex 64 chars)
  const legacyHash = createHash('sha256').update(String(passwordPlain)).digest('hex');
  const legacyBuffer = Buffer.from(legacyHash, 'hex');
  const storedBuffer = Buffer.from(storedHash, 'hex');
  if (legacyBuffer.length === storedBuffer.length && timingSafeEqual(legacyBuffer, storedBuffer)) {
    return true;
  }

  return false;
};

// Seed initial admin securely. Production must provide ADMIN_INITIAL_PASSWORD.
const seedInitialAdmin = () => {
  const countRow: any = db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'admin' OR LOWER(username) = 'admin'").get();
  if (countRow?.count > 0) return;

  const username = (process.env.ADMIN_INITIAL_USERNAME || 'admin').trim();
  const envPass = process.env.ADMIN_INITIAL_PASSWORD?.trim();
  const isProduction = process.env.NODE_ENV === 'production';

  if ((!envPass || envPass.length < 12) && isProduction) {
    throw new Error('ADMIN_INITIAL_PASSWORD é obrigatório em produção e deve ter pelo menos 12 caracteres.');
  }

  // Development-only random password avoids a permanent hard-coded credential.
  const initialPassword = envPass && envPass.length >= 12
    ? envPass
    : randomBytes(18).toString('base64url');

  const id = randomUUID();
  const passwordHash = hashPassword(initialPassword);
  db.prepare(`
    INSERT INTO users (id, username, display_name, password_hash, role, account_type, email_verified, subscription_status)
    VALUES (?, ?, ?, ?, 'admin', 'admin', 1, 'active')
  `).run(id, username, 'Administrador', passwordHash);

  console.log('=====================================================');
  console.log('[PROTÁTICA SECURITY] Conta inicial de Administrador criada.');
  console.log(`[PROTÁTICA SECURITY] Usuário: ${username}`);
  if (!envPass) {
    console.log(`[PROTÁTICA SECURITY] Senha temporária de DESENVOLVIMENTO: ${initialPassword}`);
    console.log('[PROTÁTICA SECURITY] Defina ADMIN_INITIAL_PASSWORD antes de publicar.');
  }
  console.log('=====================================================');
};

seedInitialAdmin();

// Legacy analyses had no owner. Assign them to an administrator instead of
// exposing them to every authenticated account after the multi-user migration.
try {
  const adminRow: any = db.prepare(`SELECT id FROM users WHERE role = 'admin' ORDER BY created_at ASC LIMIT 1`).get();
  if (adminRow?.id) {
    // Legacy records without an owner are conservatively assigned to the first
    // administrator instead of becoming shared records visible to every account.
    const ownerTables = [
      'analyses',
      'training_plans',
      'tactical_boards',
      'saved_evidences',
      'team_goals',
      'teams',
      'opponent_dossiers',
    ];
    for (const table of ownerTables) {
      db.prepare(`UPDATE ${table} SET user_id = ? WHERE user_id IS NULL OR TRIM(user_id) = ''`).run(adminRow.id);
    }
  }
} catch (e: any) {
  console.warn('[DB Migration] Não foi possível atribuir análises legadas ao administrador:', e.message);
}

export const upsertTeam = (teamName: string) => {
  const name = String(teamName || '').trim();
  if (!name) return null;
  const existing: any = db.prepare('SELECT id FROM teams WHERE name = ?').get(name);
  if (existing?.id) return existing.id;
  const id = randomUUID();
  db.prepare('INSERT INTO teams (id, name) VALUES (?, ?)').run(id, name);
  return id;
};

const toJson = (value: any) => JSON.stringify(value ?? []);
const fromJson = (value: any, fallback = []) => {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
};

export const verifyAccessPassword = (passwordPlain: string) => {
  try {
    const rows: any[] = db.prepare('SELECT id, username, email, display_name, role, account_type, password_hash FROM users').all();
    for (const row of rows) {
      if (verifyPassword(passwordPlain, row.password_hash)) {
        // Upgrade legacy hash if needed
        if (!row.password_hash.startsWith('scrypt$')) {
          const upgraded = hashPassword(passwordPlain);
          db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(upgraded, row.id);
        }
        return {
          id: row.id,
          username: row.username,
          email: row.email || row.username,
          displayName: row.display_name,
          display_name: row.display_name,
          role: row.role || 'user',
          account_type: row.account_type || 'paid',
        };
      }
    }
    return null;
  } catch (err) {
    console.error('Error verifying access password:', err);
    return null;
  }
};

export const verifyUserCredentials = (username: string, passwordPlain: string) => {
  try {
    const row: any = db.prepare(`
      SELECT id, username, email, display_name, role, account_type, password_hash,
             email_verified, trial_status, trial_started_at, trial_expires_at,
             subscription_status, subscription_expires_at, subscription_plan, is_blocked
      FROM users
      WHERE UPPER(username) = UPPER(?) OR UPPER(email) = UPPER(?)
      LIMIT 1
    `).get(username.trim(), username.trim());
    if (!row) return null;

    if (verifyPassword(passwordPlain, row.password_hash)) {
      // Transparent upgrade to scrypt if legacy
      if (!row.password_hash.startsWith('scrypt$')) {
        const upgraded = hashPassword(passwordPlain);
        db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(upgraded, row.id);
      }
      return {
        id: row.id,
        username: row.username,
        email: row.email || row.username,
        displayName: row.display_name,
        display_name: row.display_name,
        role: row.role || 'user',
        account_type: row.account_type || 'paid',
        email_verified: Number(row.email_verified),
        trial_status: row.trial_status || 'none',
        trial_started_at: row.trial_started_at,
        trial_expires_at: row.trial_expires_at,
        subscription_status: row.subscription_status || 'active',
        subscription_expires_at: row.subscription_expires_at,
        subscription_plan: row.subscription_plan,
        is_blocked: Number(row.is_blocked || 0),
      };
    }


    return null;
  } catch (err) {
    console.error('Error verifying user credentials:', err);
    return null;
  }
};

export const findUserByUsername = (username: string) => {
  try {
    const row: any = db.prepare('SELECT * FROM users WHERE UPPER(username) = UPPER(?) OR UPPER(email) = UPPER(?) LIMIT 1')
      .get(username.trim(), username.trim());
    if (!row) return null;
    return {
      ...row,
      displayName: row.display_name || row.username,
      display_name: row.display_name || row.username,
      email: row.email || row.username,
    };
  } catch (err) {
    console.error('Error finding user by username:', err);
    return null;
  }
};

export const createUserWithPassword = (username: string, displayName: string, passwordPlain: string) => {
  try {
    const passwordHash = hashPassword(passwordPlain);
    const existing = findUserByUsername(username);
    if (existing) {
      db.prepare('UPDATE users SET password_hash = ?, display_name = ? WHERE id = ?').run(passwordHash, displayName.trim(), existing.id);
      return existing.id;
    } else {
      const id = randomUUID();
      db.prepare(`
        INSERT INTO users (id, username, display_name, password_hash)
        VALUES (?, ?, ?, ?)
      `).run(id, username.trim(), displayName.trim(), passwordHash);
      return id;
    }
  } catch (err) {
    console.error('Error creating user with password:', err);
    throw err;
  }
};

// --- AUTH SESSION MANAGEMENT ---
const hashSessionToken = (token: string) => createHash('sha256').update(token.trim()).digest('hex');

export const createAuthSession = (userId: string, durationDays = 30): string => {
  const rawToken = randomBytes(32).toString('hex');
  const tokenHash = hashSessionToken(rawToken);
  const expiresDate = new Date();
  expiresDate.setDate(expiresDate.getDate() + durationDays);
  const expiresAt = expiresDate.toISOString();

  db.prepare(`
    INSERT INTO auth_sessions (token, user_id, expires_at)
    VALUES (?, ?, ?)
  `).run(tokenHash, userId, expiresAt);

  return rawToken;
};

export const verifyAuthSessionToken = (token: string) => {
  if (!token) return null;
  try {
    const nowIso = new Date().toISOString();
    const rawToken = token.trim();
    const tokenHash = hashSessionToken(rawToken);
    let row: any = db.prepare(`
      SELECT s.token, s.expires_at, u.id, u.username, u.email, u.display_name, u.role, u.account_type, u.trial_status, u.trial_expires_at, u.subscription_status, u.subscription_expires_at, u.subscription_plan, u.email_verified, u.is_blocked
      FROM auth_sessions s
      JOIN users u ON u.id = s.user_id
      WHERE s.token = ? AND s.expires_at > ?
      LIMIT 1
    `).get(tokenHash, nowIso);

    // Backward compatibility: accept a legacy raw token once and migrate it to a hash.
    if (!row) {
      row = db.prepare(`
        SELECT s.token, s.expires_at, u.id, u.username, u.email, u.display_name, u.role, u.account_type, u.trial_status, u.trial_expires_at, u.subscription_status, u.subscription_expires_at, u.subscription_plan, u.email_verified, u.is_blocked
        FROM auth_sessions s
        JOIN users u ON u.id = s.user_id
        WHERE s.token = ? AND s.expires_at > ?
        LIMIT 1
      `).get(rawToken, nowIso);
      if (row) {
        try { db.prepare('UPDATE auth_sessions SET token = ? WHERE token = ?').run(tokenHash, rawToken); } catch {}
      }
    }

    if (!row) return null;
    return {
      id: row.id,
      username: row.username,
      email: row.email || row.username,
      displayName: row.display_name || row.username,
      display_name: row.display_name || row.username,
      role: row.role || 'user',
      account_type: row.account_type || 'paid',
      trial_status: row.trial_status || 'none',
      trial_expires_at: row.trial_expires_at,
      subscription_status: row.subscription_status || 'active',
      subscription_expires_at: row.subscription_expires_at,
      subscription_plan: row.subscription_plan,
      email_verified: row.email_verified,
      is_blocked: row.is_blocked,
    };
  } catch (err) {
    console.error('Error verifying session token:', err);
    return null;
  }
};

export const deleteAuthSession = (token: string): boolean => {
  try {
    const rawToken = token.trim();
    const tokenHash = hashSessionToken(rawToken);
    db.prepare('DELETE FROM auth_sessions WHERE token = ? OR token = ?').run(tokenHash, rawToken);
    return true;
  } catch (err) {
    console.error('Error deleting auth session:', err);
    return false;
  }
};

// --- PLAYER PHOTO CACHE ---
export const getPlayerPhotoCache = (nomeNormalizado: string, time?: string, temporada?: string) => {
  try {
    const cleanN = (nomeNormalizado || '').trim().toUpperCase();
    const cleanT = (time || '').trim().toUpperCase();
    const cleanS = (temporada || '').trim().toUpperCase();

    if (!cleanN) return null;

    // 1. Search with exact name, team, and season if provided
    if (cleanT && cleanS) {
      const rowWithSeason: any = db.prepare(`
        SELECT url, fonte, confidence, confidence_score, manual_verified, updated_at, status
        FROM player_photos_cache
        WHERE UPPER(nome_normalizado) = ? AND UPPER(time) = ? AND UPPER(temporada) = ?
        LIMIT 1
      `).get(cleanN, cleanT, cleanS);

      if (rowWithSeason) {
        if (!rowWithSeason.manual_verified && (rowWithSeason.status === 'legacy_unverified' || (rowWithSeason.confidence_score !== undefined && rowWithSeason.confidence_score < 6 && rowWithSeason.confidence === 'baixa'))) {
          return null;
        }
        return rowWithSeason;
      }
    }

    // 2. Search with exact name and team
    if (cleanT) {
      const rowWithTeam: any = db.prepare(`
        SELECT url, fonte, confidence, confidence_score, manual_verified, updated_at, status
        FROM player_photos_cache
        WHERE UPPER(nome_normalizado) = ? AND UPPER(time) = ?
        ORDER BY manual_verified DESC, confidence_score DESC, updated_at DESC
        LIMIT 1
      `).get(cleanN, cleanT);

      if (rowWithTeam) {
        if (!rowWithTeam.manual_verified && (rowWithTeam.status === 'legacy_unverified' || (rowWithTeam.confidence_score !== undefined && rowWithTeam.confidence_score < 6 && rowWithTeam.confidence === 'baixa'))) {
          return null;
        }
        return rowWithTeam;
      }
    }

    // 3. Fallback only if manual_verified
    const manualRow: any = db.prepare(`
      SELECT url, fonte, confidence, confidence_score, manual_verified, updated_at, status
      FROM player_photos_cache
      WHERE UPPER(nome_normalizado) = ? AND manual_verified = 1
      ORDER BY updated_at DESC
      LIMIT 1
    `).get(cleanN);

    return manualRow || null;
  } catch (err) {
    console.error('Error fetching player photo cache:', err);
    return null;
  }
};

export const setPlayerPhotoCache = (
  nomeNormalizado: string,
  time: string,
  temporada = '',
  url: string,
  fonte = 'web',
  confidence = 'media',
  confidenceScore = 0,
  manualVerified = false
) => {
  try {
    const nowIso = new Date().toISOString();
    const cleanN = (nomeNormalizado || '').trim();
    const cleanT = (time || '').trim();
    const cleanS = (temporada || '').trim();
    const cleanUrl = (url || '').trim();
    if (!cleanN || !cleanT || !cleanUrl) return false;

    const photoKey = `${cleanN.toLowerCase()}::${cleanT.toLowerCase()}::${cleanS.toLowerCase()}`;
    const status = manualVerified ? 'manual_verified' : (confidenceScore >= 6 ? 'verified' : 'unverified');

    db.prepare(`
      INSERT OR REPLACE INTO player_photos_cache (
        nome_normalizado, time, temporada, url, fonte, confidence, confidence_score, manual_verified, photo_key, status, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      cleanN,
      cleanT,
      cleanS,
      cleanUrl,
      fonte,
      confidence,
      confidenceScore,
      manualVerified ? 1 : 0,
      photoKey,
      status,
      nowIso
    );
    return true;
  } catch (err) {
    console.error('Error setting player photo cache:', err);
    return false;
  }
};

export const deletePlayerPhotoCache = (nomeNormalizado: string, time?: string) => {
  try {
    const cleanN = (nomeNormalizado || '').trim();
    const cleanT = (time || '').trim();
    if (cleanT) {
      db.prepare(`
        DELETE FROM player_photos_cache
        WHERE UPPER(nome_normalizado) = UPPER(?) AND UPPER(time) = UPPER(?)
      `).run(cleanN, cleanT);
    } else {
      db.prepare(`
        DELETE FROM player_photos_cache
        WHERE UPPER(nome_normalizado) = UPPER(?)
      `).run(cleanN);
    }
    return true;
  } catch (err) {
    console.error('Error deleting player photo cache:', err);
    return false;
  }
};

// --- ANALYSIS PERSISTENCE ---
export const saveAnalysis = (analysis: any, userId?: string) => {
  const id = analysis.analysisId || randomUUID();
  const createdAt = analysis.createdAt || new Date().toISOString();
  let confidenceVal = (analysis.verificacaoAuditoria?.nivelConfianca || analysis.placarAuditoria?.confianca || '').trim().toLowerCase();
  if (!['alta', 'media', 'baixa'].includes(confidenceVal)) {
    const playerConf = Array.isArray(analysis.analiseJogadores) && analysis.analiseJogadores.length > 0
      ? analysis.analiseJogadores[0].nivelConfianca?.trim().toLowerCase()
      : null;
    if (playerConf && ['alta', 'media', 'baixa'].includes(playerConf)) {
      confidenceVal = playerConf;
    } else {
      confidenceVal = 'baixa'; // Sensible default is 'baixa', never assume 'alta'
    }
  }

  db.prepare(`
    INSERT OR REPLACE INTO analyses (
      id, created_at, video_title, video_url, video_id, team_a, team_b, placar, confidence, strategy, payload_json, user_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    createdAt,
    analysis.videoTitle || '',
    analysis.videoUrl || '',
    analysis.videoId || '',
    analysis.timeA || '',
    analysis.timeB || '',
    analysis.placar || '',
    confidenceVal,
    analysis.verificacaoAuditoria?.estrategiaAnalise || '',
    JSON.stringify({ ...analysis, analysisId: id, createdAt }),
    userId || analysis.userId || null
  );

  db.prepare('DELETE FROM player_analyses WHERE analysis_id = ?').run(id);
  db.prepare('DELETE FROM timeline_events WHERE analysis_id = ?').run(id);

  const insertPlayer = db.prepare(`
    INSERT INTO player_analyses (
      analysis_id, display_name, team, position, shirt_number, identification_type, minutes_observed, confidence, strengths_json, concerns_json, actions_json, summary
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const player of Array.isArray(analysis.analiseJogadores) ? analysis.analiseJogadores : []) {
    insertPlayer.run(
      id,
      player.nome || '',
      player.time || '',
      player.posicao || '',
      player.camisa || '',
      player.identificacao || '',
      player.minutosObservados || '',
      player.nivelConfianca || 'baixa',
      toJson(player.pontosFortes),
      toJson(player.pontosAtencao),
      toJson(player.acoesPercebidas),
      player.analise || ''
    );
  }

  const insertEvent = db.prepare(`
    INSERT INTO timeline_events (analysis_id, minute, team, type, description, tactical_impact)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  for (const event of Array.isArray(analysis.linhaDoTempo) ? analysis.linhaDoTempo : []) {
    insertEvent.run(id, event.minuto || '', event.time || '', event.tipo || '', event.descricao || '', event.impactoTatico || '');
  }

  return { id, createdAt };
};

export const listAnalyses = (limit = 20, userId?: string) => {
  const maxLimit = Math.max(1, Math.min(limit, 100));
  const rows: any[] = userId
    ? db.prepare(`
        SELECT id, created_at, video_title, team_a, team_b, placar, confidence
        FROM analyses
        WHERE user_id = ?
        ORDER BY datetime(created_at) DESC
        LIMIT ?
      `).all(userId, maxLimit)
    : db.prepare(`
        SELECT id, created_at, video_title, team_a, team_b, placar, confidence
        FROM analyses
        ORDER BY datetime(created_at) DESC
        LIMIT ?
      `).all(maxLimit);

  return rows.map((row) => {
    let conf = (row.confidence || '').trim().toLowerCase();
    if (!['alta', 'media', 'baixa'].includes(conf)) conf = 'baixa';
    return {
      id: row.id,
      createdAt: row.created_at,
      videoTitle: row.video_title,
      timeA: row.team_a,
      timeB: row.team_b,
      placar: row.placar,
      confidence: conf,
    };
  });
};

export const getAnalysisById = (id: string, userId?: string) => {
  const row: any = userId
    ? db.prepare('SELECT payload_json FROM analyses WHERE id = ? AND user_id = ?').get(id, userId)
    : db.prepare('SELECT payload_json FROM analyses WHERE id = ?').get(id);
  if (!row?.payload_json) return null;
  try {
    const analysis = JSON.parse(row.payload_json);
    if (analysis) analysis.analysisId = id;
    return analysis;
  } catch {
    return null;
  }
};

export const getPublicAnalysisById = (id: string) => {
  const row: any = db.prepare(`
    SELECT payload_json FROM analyses
    WHERE id = ? AND visibility IN ('public', 'featured')
    LIMIT 1
  `).get(id);
  if (!row?.payload_json) return null;
  try {
    const analysis = JSON.parse(row.payload_json);
    if (analysis) analysis.analysisId = id;
    return analysis;
  } catch {
    return null;
  }
};

export const deleteAnalysisFromDb = (id: string, userId?: string) => {
  const owned: any = userId
    ? db.prepare('SELECT id FROM analyses WHERE id = ? AND user_id = ?').get(id, userId)
    : db.prepare('SELECT id FROM analyses WHERE id = ?').get(id);
  if (!owned) return false;
  db.prepare('DELETE FROM player_analyses WHERE analysis_id = ?').run(id);
  db.prepare('DELETE FROM timeline_events WHERE analysis_id = ?').run(id);
  if (userId) db.prepare('DELETE FROM analyses WHERE id = ? AND user_id = ?').run(id, userId);
  else db.prepare('DELETE FROM analyses WHERE id = ?').run(id);
  return true;
};

export const listAllFullAnalyses = (userId?: string) => {
  const rows: any[] = userId
    ? db.prepare(`SELECT payload_json FROM analyses WHERE user_id = ? ORDER BY datetime(created_at) ASC`).all(userId)
    : db.prepare(`SELECT payload_json FROM analyses ORDER BY datetime(created_at) ASC`).all();
  return rows.map((row) => {
    try { return JSON.parse(row.payload_json); } catch { return null; }
  }).filter(Boolean);
};

export const countAnalysesForUserSince = (userId: string, sinceIso: string): number => {
  if (!userId) return 0;
  const row: any = db.prepare(`
    SELECT COUNT(*) AS count FROM analyses
    WHERE user_id = ? AND datetime(created_at) >= datetime(?)
  `).get(userId, sinceIso);
  return Number(row?.count || 0);
};

export const enrichAnalysisFromDb = (analysis: any) => {
  if (!analysis?.analysisId) return analysis;
  const players: any[] = db.prepare(`
    SELECT display_name, team, position, shirt_number, identification_type, minutes_observed, confidence, strengths_json, concerns_json, actions_json, summary
    FROM player_analyses WHERE analysis_id = ? ORDER BY id ASC
  `).all(analysis.analysisId);

  if (players.length > 0) {
    analysis.analiseJogadores = players.map((player) => ({
      nome: player.display_name,
      time: player.team,
      posicao: player.position,
      camisa: player.shirt_number,
      identificacao: player.identification_type,
      minutosObservados: player.minutes_observed,
      nivelConfianca: player.confidence || 'baixa',
      pontosFortes: fromJson(player.strengths_json),
      pontosAtencao: fromJson(player.concerns_json),
      acoesPercebidas: fromJson(player.actions_json),
      analise: player.summary,
    }));
  }

  const events: any[] = db.prepare(`
    SELECT minute, team, type, description, tactical_impact
    FROM timeline_events WHERE analysis_id = ? ORDER BY id ASC
  `).all(analysis.analysisId);

  if (events.length > 0) {
    analysis.linhaDoTempo = events.map((event) => ({
      minuto: event.minute,
      time: event.team,
      tipo: event.type,
      descricao: event.description,
      impactoTatico: event.tactical_impact,
    }));
  }

  return analysis;
};

export const getSetting = (key: string): string | null => {
  try {
    const row: any = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
    return row ? row.value : null;
  } catch {
    return null;
  }
};

export const setSetting = (key: string, value: string): void => {
  try {
    db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, value);
  } catch (err) {
    console.error('Error setting db variable:', err);
  }
};

export const listAllUsers = () => {
  try {
    const rows: any[] = db.prepare('SELECT id, username, display_name, created_at FROM users ORDER BY created_at DESC').all();
    return rows.map(r => ({
      id: r.id,
      username: r.username,
      displayName: r.display_name,
      createdAt: r.created_at
    }));
  } catch (err) {
    console.error('Error listing all users:', err);
    return [];
  }
};

export const deleteUserFromDb = (id: string) => {
  try {
    db.prepare('DELETE FROM users WHERE id = ?').run(id);
    return true;
  } catch (err) {
    console.error('Error deleting user:', err);
    return false;
  }
};

export const updateUserPasswordInDb = (id: string, newPasswordPlain: string) => {
  try {
    const passwordHash = hashPassword(newPasswordPlain);
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(passwordHash, id);
    return true;
  } catch (err) {
    console.error('Error updating user password:', err);
    return false;
  }
};

export const logTelegramMessage = (data: {
  chat_id: string;
  tipo: string;
  conteudo_resumido?: string;
  status: 'sucesso' | 'erro' | string;
  erro?: string;
}) => {
  try {
    db.prepare(`
      INSERT INTO telegram_messages (chat_id, tipo, conteudo_resumido, status, erro)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      data.chat_id || 'desconhecido',
      data.tipo || 'mensagem',
      data.conteudo_resumido || '',
      data.status || 'sucesso',
      data.erro || null
    );
    return true;
  } catch (err) {
    console.error('Error logging telegram message:', err);
    return false;
  }
};

export const listTelegramMessages = (limit = 50) => {
  try {
    const rows: any[] = db.prepare(`
      SELECT id, chat_id, tipo, conteudo_resumido, status, erro, created_at
      FROM telegram_messages
      ORDER BY datetime(created_at) DESC, id DESC
      LIMIT ?
    `).all(Math.max(1, Math.min(limit, 200)));
    return rows;
  } catch (err) {
    console.error('Error listing telegram messages:', err);
    return [];
  }
};

export const clearTelegramMessages = () => {
  try {
    db.prepare('DELETE FROM telegram_messages').run();
    return true;
  } catch (err) {
    console.error('Error clearing telegram messages:', err);
    return false;
  }
};

// ==================== SUBSCRIPTION, TRIAL & ACCESS HELPERS ====================

export const findUserByEmail = (email: string) => {
  try {
    const cleanEmail = email.trim().toLowerCase();
    const row: any = db.prepare('SELECT * FROM users WHERE LOWER(email) = ? OR LOWER(username) = ?').get(cleanEmail, cleanEmail);
    return row || null;
  } catch (err) {
    console.error('Error finding user by email:', err);
    return null;
  }
};

export const findUserById = (id: string) => {
  try {
    const row: any = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    return row || null;
  } catch (err) {
    console.error('Error finding user by id:', err);
    return null;
  }
};

export const createTrialUser = (data: {
  name: string;
  email: string;
  phone?: string;
  organization?: string;
  usageProfile?: string;
}) => {
  const userId = 'usr_' + randomUUID();
  const cleanEmail = data.email.trim().toLowerCase();
  // Generate random initial temporary password hash
  const initialTempHash = hashPassword(randomUUID() + Date.now());

  db.prepare(`
    INSERT INTO users (
      id, username, email, display_name, password_hash, role,
      account_type, phone, organization, usage_profile, terms_accepted,
      trial_used, trial_status, subscription_status, email_verified, is_blocked,
      created_at, updated_at
    ) VALUES (
      ?, ?, ?, ?, ?, 'user',
      'trial', ?, ?, ?, 1,
      1, 'pending_verification', 'active', 0, 0,
      CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    )
  `).run(
    userId,
    cleanEmail,
    cleanEmail,
    data.name.trim(),
    initialTempHash,
    data.phone?.trim() || null,
    data.organization?.trim() || null,
    data.usageProfile?.trim() || 'Treinador'
  );

  return findUserById(userId);
};

export const createVerificationToken = (userId: string, tokenType: 'trial_verify' | 'set_password' | 'password_reset', expiresInHours = 24) => {
  // Invalidate any previously active tokens of this type for this user
  try {
    db.prepare(`
      UPDATE verification_tokens
      SET used_at = datetime('now')
      WHERE user_id = ? AND token_type = ? AND used_at IS NULL
    `).run(userId, tokenType);
  } catch (err) {
    console.error('Error invalidating previous tokens:', err);
  }

  const tokenId = 'tok_' + randomUUID();
  const rawToken = randomBytes(32).toString('hex');
  const tokenHash = createHash('sha256').update(rawToken).digest('hex');

  db.prepare(`
    INSERT INTO verification_tokens (id, user_id, token_hash, token_type, expires_at, created_at)
    VALUES (?, ?, ?, ?, datetime('now', '+' || ? || ' hours'), datetime('now'))
  `).run(tokenId, userId, tokenHash, tokenType, expiresInHours);

  return { tokenId, rawToken, tokenHash };
};

export const inspectVerificationToken = (rawToken: string, tokenType: string) => {
  if (!rawToken || !rawToken.trim()) {
    return { present: false, found: false, alreadyUsed: false, expired: false, valid: false, row: null };
  }

  try {
    const tokenHash = createHash('sha256').update(rawToken.trim()).digest('hex');
    const row: any = db.prepare(`
      SELECT *, (datetime('now') > datetime(expires_at)) as is_expired
      FROM verification_tokens
      WHERE token_hash = ? AND token_type = ?
      ORDER BY created_at DESC
      LIMIT 1
    `).get(tokenHash, tokenType);

    if (!row) {
      return { present: true, found: false, alreadyUsed: false, expired: false, valid: false, row: null };
    }

    const alreadyUsed = Boolean(row.used_at);
    const expired = Boolean(row.is_expired);
    const valid = !alreadyUsed && !expired;

    return {
      present: true,
      found: true,
      alreadyUsed,
      expired,
      valid,
      row: valid ? row : null,
    };
  } catch (err) {
    console.error('Error inspecting verification token:', err);
    return { present: true, found: false, alreadyUsed: false, expired: false, valid: false, row: null };
  }
};

export const validateVerificationToken = (rawToken: string, tokenType: string) => {
  try {
    const tokenHash = createHash('sha256').update(rawToken.trim()).digest('hex');
    const row: any = db.prepare(`
      SELECT * FROM verification_tokens
      WHERE token_hash = ? AND token_type = ? AND used_at IS NULL AND datetime('now') <= datetime(expires_at)
    `).get(tokenHash, tokenType);
    return row || null;
  } catch (err) {
    console.error('Error validating verification token:', err);
    return null;
  }
};

export const verifyAndConsumeToken = (rawToken: string, tokenType: string) => {
  const tokenHash = createHash('sha256').update(rawToken).digest('hex');
  const row: any = db.prepare(`
    SELECT * FROM verification_tokens
    WHERE token_hash = ? AND token_type = ? AND used_at IS NULL AND datetime('now') <= datetime(expires_at)
  `).get(tokenHash, tokenType);

  if (!row) {
    return null;
  }

  // Mark token as used
  db.prepare(`
    UPDATE verification_tokens SET used_at = datetime('now') WHERE id = ?
  `).run(row.id);

  return row;
};

export const activateTrialAfterVerification = (userId: string) => {
  db.prepare(`
    UPDATE users SET
      email_verified = 1,
      trial_status = 'active',
      account_type = 'trial',
      subscription_status = 'active',
      trial_started_at = datetime('now'),
      trial_expires_at = datetime('now', '+7 days'),
      updated_at = datetime('now')
    WHERE id = ?
  `).run(userId);

  return findUserById(userId);
};

export const activateTrialWithPassword = (userId: string, plainPassword: string, tokenId?: string | null) => {
  const hash = hashPassword(plainPassword);

  // 1. Update user password, verify email, and activate trial for 7 days starting NOW
  db.prepare(`
    UPDATE users SET
      password_hash = ?,
      email_verified = 1,
      trial_status = 'active',
      account_type = 'trial',
      subscription_status = 'active',
      trial_started_at = datetime('now'),
      trial_expires_at = datetime('now', '+7 days'),
      updated_at = datetime('now')
    WHERE id = ?
  `).run(hash, userId);

  // 2. Invalidate / consume verification token
  if (tokenId) {
    db.prepare(`
      UPDATE verification_tokens
      SET used_at = datetime('now')
      WHERE id = ?
    `).run(tokenId);
  } else {
    db.prepare(`
      UPDATE verification_tokens
      SET used_at = datetime('now')
      WHERE user_id = ? AND token_type IN ('trial_verify', 'set_password') AND used_at IS NULL
    `).run(userId);
  }

  return findUserById(userId);
};

export const updateUserPassword = (userId: string, plainPassword: string) => {
  const hash = hashPassword(plainPassword);
  db.prepare(`
    UPDATE users SET
      password_hash = ?,
      updated_at = datetime('now')
    WHERE id = ?
  `).run(hash, userId);

  return true;
};

export const logSubscriptionEvent = (userId: string, eventType: string, details?: any) => {
  try {
    db.prepare(`
      INSERT INTO subscription_events (user_id, event_type, details_json, created_at)
      VALUES (?, ?, ?, datetime('now'))
    `).run(userId, eventType, details ? JSON.stringify(details) : null);
  } catch (err) {
    console.error('Error logging subscription event:', err);
  }
};

export const logAdminAudit = (adminId: string, targetUserId: string | null, action: string, reason?: string, details?: any) => {
  try {
    db.prepare(`
      INSERT INTO admin_audit_logs (admin_id, target_user_id, action, reason, details_json, created_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'))
    `).run(adminId, targetUserId, action, reason || null, details ? JSON.stringify(details) : null);
  } catch (err) {
    console.error('Error logging admin audit:', err);
  }
};

export const activatePaidSubscription = (userId: string, planId: string, durationDays: number, convertedFromTrial = false) => {
  db.prepare(`
    UPDATE users SET
      account_type = 'paid',
      subscription_plan = ?,
      subscription_status = 'active',
      subscription_started_at = COALESCE(subscription_started_at, datetime('now')),
      subscription_expires_at = datetime(
        CASE
          WHEN subscription_expires_at IS NOT NULL AND datetime(subscription_expires_at) > datetime('now')
            THEN subscription_expires_at
          ELSE datetime('now')
        END,
        '+' || ? || ' days'
      ),
      converted_from_trial = CASE WHEN ? = 1 THEN 1 ELSE converted_from_trial END,
      trial_status = 'expired',
      updated_at = datetime('now')
    WHERE id = ?
  `).run(planId, durationDays, convertedFromTrial ? 1 : 0, userId);

  logSubscriptionEvent(userId, 'subscription_activated', { planId, durationDays, convertedFromTrial });
  return findUserById(userId);
};

export const adminExtendTrial = (userId: string, additionalDays: number, adminId: string, reason?: string) => {
  const user = findUserById(userId);
  if (!user) return null;

  // Extend from current expiration date or now if already expired
  const now = new Date();
  let baseDate = now;
  if (user.trial_expires_at) {
    const currentExp = new Date(user.trial_expires_at);
    if (currentExp > now) {
      baseDate = currentExp;
    }
  }

  const newExpDate = new Date(baseDate.getTime() + additionalDays * 24 * 60 * 60 * 1000);
  const newExpIso = newExpDate.toISOString().replace('T', ' ').substring(0, 19);

  db.prepare(`
    UPDATE users SET
      account_type = 'trial',
      trial_status = 'active',
      trial_expires_at = ?,
      updated_at = datetime('now')
    WHERE id = ?
  `).run(newExpIso, userId);

  logAdminAudit(adminId, userId, 'extend_trial', reason, { additionalDays, newExpiration: newExpIso });
  logSubscriptionEvent(userId, 'trial_extended', { additionalDays, newExpiration: newExpIso, adminId });

  return findUserById(userId);
};

export const adminToggleBlockUser = (userId: string, block: boolean, adminId: string, reason?: string) => {
  db.prepare(`
    UPDATE users SET
      is_blocked = ?,
      updated_at = datetime('now')
    WHERE id = ?
  `).run(block ? 1 : 0, userId);

  logAdminAudit(adminId, userId, block ? 'block_user' : 'unblock_user', reason, { is_blocked: block });
  return findUserById(userId);
};

export const listAllSubscriptionsAdmin = (filter?: string) => {
  try {
    let sql = `
      SELECT id, username, email, display_name, role, account_type, phone, organization,
             usage_profile, trial_used, trial_started_at, trial_expires_at, trial_status,
             subscription_status, subscription_plan, subscription_started_at, subscription_expires_at,
             converted_from_trial, email_verified, is_blocked, last_login_at, created_at, updated_at
      FROM users
      ORDER BY datetime(created_at) DESC
    `;
    const users: any[] = db.prepare(sql).all();

    return users.map(u => {
      const now = new Date().getTime();
      let calculatedStatus = 'trial_active';

      if (u.is_blocked) {
        calculatedStatus = 'blocked';
      } else if (u.role === 'admin') {
        calculatedStatus = 'admin';
      } else if (u.account_type === 'paid') {
        if (u.subscription_expires_at && now > new Date(u.subscription_expires_at).getTime()) {
          calculatedStatus = 'paid_expired';
        } else if (u.subscription_status === 'cancelled') {
          calculatedStatus = 'cancelled';
        } else {
          calculatedStatus = 'paid_active';
        }
      } else {
        if (u.trial_status === 'pending_verification') {
          calculatedStatus = 'pending_verification';
        } else if (u.trial_expires_at && now > new Date(u.trial_expires_at).getTime()) {
          calculatedStatus = 'trial_expired';
        } else {
          calculatedStatus = 'trial_active';
        }
      }

      return {
        ...u,
        calculatedStatus
      };
    }).filter(u => {
      if (!filter || filter === 'all') return true;
      if (filter === 'trial_active') return u.calculatedStatus === 'trial_active';
      if (filter === 'trial_expired') return u.calculatedStatus === 'trial_expired';
      if (filter === 'paid_active') return u.calculatedStatus === 'paid_active';
      if (filter === 'paid_expired') return u.calculatedStatus === 'paid_expired';
      if (filter === 'cancelled') return u.calculatedStatus === 'cancelled';
      if (filter === 'blocked') return u.calculatedStatus === 'blocked';
      return true;
    });
  } catch (err) {
    console.error('Error listing subscriptions for admin:', err);
    return [];
  }
};

export const listSubscriptionEvents = (limit = 100) => {
  try {
    const rows: any[] = db.prepare(`
      SELECT se.id, se.user_id, se.event_type, se.details_json, se.created_at,
             u.username, u.email, u.display_name
      FROM subscription_events se
      LEFT JOIN users u ON u.id = se.user_id
      ORDER BY datetime(se.created_at) DESC
      LIMIT ?
    `).all(limit);
    return rows;
  } catch (err) {
    console.error('Error listing subscription events:', err);
    return [];
  }
};

export const listEmailLogs = (limit = 100) => {
  try {
    const rows: any[] = db.prepare(`
      SELECT id, user_id, email, type, status, provider_message_id, error_summary, created_at
      FROM email_logs
      ORDER BY datetime(created_at) DESC
      LIMIT ?
    `).all(limit);
    return rows;
  } catch (err) {
    console.error('Error listing email logs:', err);
    return [];
  }
};

// --- TRAINING PLANS REPOSITORY ---
export const saveTrainingPlan = (plan: {
  id?: string;
  userId?: string;
  analysisId?: string;
  title: string;
  problemIdentified: string;
  objective: string;
  duration: string;
  playersCount: string;
  materials?: string;
  organization: string;
  execution: string;
  expectedBehaviors: string[];
  observationPoints: string[];
  progression?: string;
  regression?: string;
  nextMatchIndicators: string[];
}) => {
  const planId = plan.id || randomUUID();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT OR REPLACE INTO training_plans (
      id, user_id, analysis_id, title, problem_identified, objective, duration,
      players_count, materials, organization, execution, expected_behaviors_json,
      observation_points_json, progression, regression, next_match_indicators_json,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    planId,
    plan.userId || null,
    plan.analysisId || null,
    plan.title,
    plan.problemIdentified,
    plan.objective,
    plan.duration,
    plan.playersCount,
    plan.materials || '',
    plan.organization,
    plan.execution,
    JSON.stringify(plan.expectedBehaviors || []),
    JSON.stringify(plan.observationPoints || []),
    plan.progression || '',
    plan.regression || '',
    JSON.stringify(plan.nextMatchIndicators || []),
    now,
    now
  );
  return { ...plan, id: planId, createdAt: now, updatedAt: now };
};

export const listTrainingPlans = (userId?: string) => {
  try {
    let rows: any[];
    if (userId) {
      rows = db.prepare(`
        SELECT * FROM training_plans
        WHERE user_id = ?
        ORDER BY datetime(created_at) DESC
      `).all(userId);
    } else {
      rows = db.prepare(`
        SELECT * FROM training_plans
        ORDER BY datetime(created_at) DESC
      `).all();
    }
    return rows.map((r) => ({
      id: r.id,
      userId: r.user_id,
      analysisId: r.analysis_id,
      title: r.title,
      problemIdentified: r.problem_identified,
      objective: r.objective,
      duration: r.duration,
      playersCount: r.players_count,
      materials: r.materials,
      organization: r.organization,
      execution: r.execution,
      expectedBehaviors: JSON.parse(r.expected_behaviors_json || '[]'),
      observationPoints: JSON.parse(r.observation_points_json || '[]'),
      progression: r.progression,
      regression: r.regression,
      nextMatchIndicators: JSON.parse(r.next_match_indicators_json || '[]'),
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
  } catch (err) {
    console.error('Error listing training plans:', err);
    return [];
  }
};

export const deleteTrainingPlan = (id: string, userId?: string) => {
  try {
    if (userId) {
      db.prepare(`DELETE FROM training_plans WHERE id = ? AND user_id = ?`).run(id, userId);
    } else {
      db.prepare(`DELETE FROM training_plans WHERE id = ?`).run(id);
    }
    return true;
  } catch (err) {
    console.error('Error deleting training plan:', err);
    return false;
  }
};

// --- TACTICAL BOARDS REPOSITORY ---
export const saveTacticalBoard = (board: {
  id?: string;
  userId?: string;
  title: string;
  formationA: string;
  formationB: string;
  payload: any;
  previewImage?: string;
}) => {
  const boardId = board.id || randomUUID();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT OR REPLACE INTO tactical_boards (
      id, user_id, title, formation_a, formation_b, payload_json, preview_image, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    boardId,
    board.userId || null,
    board.title,
    board.formationA,
    board.formationB,
    JSON.stringify(board.payload),
    board.previewImage || null,
    now,
    now
  );
  return { ...board, id: boardId, createdAt: now, updatedAt: now };
};

export const listTacticalBoards = (userId?: string) => {
  try {
    let rows: any[];
    if (userId) {
      rows = db.prepare(`
        SELECT * FROM tactical_boards
        WHERE user_id = ?
        ORDER BY datetime(created_at) DESC
      `).all(userId);
    } else {
      rows = db.prepare(`
        SELECT * FROM tactical_boards
        ORDER BY datetime(created_at) DESC
      `).all();
    }
    return rows.map((r) => ({
      id: r.id,
      userId: r.user_id,
      title: r.title,
      formationA: r.formation_a,
      formationB: r.formation_b,
      payload: JSON.parse(r.payload_json || '{}'),
      previewImage: r.preview_image,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
  } catch (err) {
    console.error('Error listing tactical boards:', err);
    return [];
  }
};

export const deleteTacticalBoard = (id: string, userId?: string) => {
  try {
    if (userId) {
      db.prepare(`DELETE FROM tactical_boards WHERE id = ? AND user_id = ?`).run(id, userId);
    } else {
      db.prepare(`DELETE FROM tactical_boards WHERE id = ?`).run(id);
    }
    return true;
  } catch (err) {
    console.error('Error deleting tactical board:', err);
    return false;
  }
};

// --- SAVED EVIDENCES REPOSITORY ---
export const saveEvidenceItem = (evidence: {
  id?: string;
  userId?: string;
  analysisId?: string;
  category: string;
  title: string;
  timestamp: string;
  description: string;
  team?: string;
  player?: string;
  source?: string;
  confidence?: string;
  videoUrl?: string;
}) => {
  const evidenceId = evidence.id || randomUUID();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT OR REPLACE INTO saved_evidences (
      id, user_id, analysis_id, category, title, timestamp, description,
      team, player, source, confidence, video_url, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    evidenceId,
    evidence.userId || null,
    evidence.analysisId || null,
    evidence.category || 'personalizado',
    evidence.title,
    evidence.timestamp,
    evidence.description,
    evidence.team || '',
    evidence.player || '',
    evidence.source || 'visual',
    evidence.confidence || 'alta',
    evidence.videoUrl || '',
    now
  );
  return { ...evidence, id: evidenceId, createdAt: now };
};

export const listSavedEvidences = (userId?: string, category?: string) => {
  try {
    let query = `SELECT * FROM saved_evidences WHERE 1=1`;
    const params: any[] = [];
    if (userId) {
      query += ` AND user_id = ?`;
      params.push(userId);
    }
    if (category && category !== 'all') {
      query += ` AND category = ?`;
      params.push(category);
    }
    query += ` ORDER BY datetime(created_at) DESC`;
    const rows: any[] = db.prepare(query).all(...params);
    return rows.map((r) => ({
      id: r.id,
      userId: r.user_id,
      analysisId: r.analysis_id,
      category: r.category,
      title: r.title,
      timestamp: r.timestamp,
      description: r.description,
      team: r.team,
      player: r.player,
      source: r.source,
      confidence: r.confidence,
      videoUrl: r.video_url,
      createdAt: r.created_at,
    }));
  } catch (err) {
    console.error('Error listing saved evidences:', err);
    return [];
  }
};

export const deleteSavedEvidence = (id: string, userId?: string) => {
  try {
    if (userId) {
      db.prepare(`DELETE FROM saved_evidences WHERE id = ? AND user_id = ?`).run(id, userId);
    } else {
      db.prepare(`DELETE FROM saved_evidences WHERE id = ?`).run(id);
    }
    return true;
  } catch (err) {
    console.error('Error deleting evidence:', err);
    return false;
  }
};

// --- TEAM GOALS REPOSITORY ---
export const saveTeamGoal = (goal: {
  id?: string;
  userId?: string;
  title: string;
  targetBehavior: string;
  currentStatus: string;
  progressHistory?: any[];
  targetPeriod: string;
  achieved?: boolean;
}) => {
  const goalId = goal.id || randomUUID();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT OR REPLACE INTO team_goals (
      id, user_id, title, target_behavior, current_status, progress_notes_json,
      target_period, achieved, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    goalId,
    goal.userId || null,
    goal.title,
    goal.targetBehavior,
    goal.currentStatus || 'moderado',
    JSON.stringify(goal.progressHistory || []),
    goal.targetPeriod || 'Próximos 5 jogos',
    goal.achieved ? 1 : 0,
    now,
    now
  );
  return { ...goal, id: goalId, createdAt: now, updatedAt: now };
};

export const listTeamGoals = (userId?: string) => {
  try {
    let rows: any[];
    if (userId) {
      rows = db.prepare(`
        SELECT * FROM team_goals
        WHERE user_id = ?
        ORDER BY datetime(created_at) DESC
      `).all(userId);
    } else {
      rows = db.prepare(`
        SELECT * FROM team_goals
        ORDER BY datetime(created_at) DESC
      `).all();
    }
    return rows.map((r) => ({
      id: r.id,
      userId: r.user_id,
      title: r.title,
      targetBehavior: r.target_behavior,
      currentStatus: r.current_status,
      progressHistory: JSON.parse(r.progress_notes_json || '[]'),
      targetPeriod: r.target_period,
      achieved: r.achieved === 1,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
  } catch (err) {
    console.error('Error listing team goals:', err);
    return [];
  }
};

export const deleteTeamGoal = (id: string, userId?: string) => {
  try {
    if (userId) {
      db.prepare(`DELETE FROM team_goals WHERE id = ? AND user_id = ?`).run(id, userId);
    } else {
      db.prepare(`DELETE FROM team_goals WHERE id = ?`).run(id);
    }
    return true;
  } catch (err) {
    console.error('Error deleting team goal:', err);
    return false;
  }
};

// --- TEAMS REPOSITORY ---
export const saveTeam = (team: {
  id?: string;
  userId?: string;
  name: string;
  category: string;
  season: string;
  city?: string;
  shieldUrl?: string;
}) => {
  const teamId = team.id || randomUUID();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT OR REPLACE INTO teams (
      id, user_id, name, category, season, city, shield_url, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    teamId,
    team.userId || null,
    team.name,
    team.category,
    team.season,
    team.city || '',
    team.shieldUrl || '',
    now,
    now
  );
  return { ...team, id: teamId, createdAt: now, updatedAt: now };
};

export const listTeams = (userId?: string) => {
  try {
    let rows: any[];
    if (userId) {
      rows = db.prepare(`
        SELECT * FROM teams
        WHERE user_id = ?
        ORDER BY datetime(created_at) DESC
      `).all(userId);
    } else {
      rows = db.prepare(`
        SELECT * FROM teams
        ORDER BY datetime(created_at) DESC
      `).all();
    }
    return rows.map((r) => ({
      id: r.id,
      userId: r.user_id,
      name: r.name,
      category: r.category,
      season: r.season,
      city: r.city,
      shieldUrl: r.shield_url,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
  } catch (err) {
    console.error('Error listing teams:', err);
    return [];
  }
};

export const deleteTeam = (id: string, userId?: string) => {
  try {
    if (userId) {
      db.prepare(`DELETE FROM teams WHERE id = ? AND user_id = ?`).run(id, userId);
    } else {
      db.prepare(`DELETE FROM teams WHERE id = ?`).run(id);
    }
    return true;
  } catch (err) {
    console.error('Error deleting team:', err);
    return false;
  }
};

// --- OPPONENT DOSSIERS REPOSITORY ---
export const saveOpponentDossier = (dossier: {
  id?: string;
  userId?: string;
  opponentName: string;
  analyzedMatchesCount: number;
  matchesIds: string[];
  payload: any;
}) => {
  const dossierId = dossier.id || randomUUID();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT OR REPLACE INTO opponent_dossiers (
      id, user_id, opponent_name, analyzed_matches_count, matches_ids_json, payload_json, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    dossierId,
    dossier.userId || null,
    dossier.opponentName,
    dossier.analyzedMatchesCount || 1,
    JSON.stringify(dossier.matchesIds || []),
    JSON.stringify(dossier.payload || {}),
    now,
    now
  );
  return { ...dossier, id: dossierId, createdAt: now, updatedAt: now };
};

export const listOpponentDossiers = (userId?: string) => {
  try {
    let rows: any[];
    if (userId) {
      rows = db.prepare(`
        SELECT * FROM opponent_dossiers
        WHERE user_id = ?
        ORDER BY datetime(created_at) DESC
      `).all(userId);
    } else {
      rows = db.prepare(`
        SELECT * FROM opponent_dossiers
        ORDER BY datetime(created_at) DESC
      `).all();
    }
    return rows.map((r) => ({
      id: r.id,
      userId: r.user_id,
      opponentName: r.opponent_name,
      analyzedMatchesCount: r.analyzed_matches_count,
      matchesIds: JSON.parse(r.matches_ids_json || '[]'),
      payload: JSON.parse(r.payload_json || '{}'),
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
  } catch (err) {
    console.error('Error listing opponent dossiers:', err);
    return [];
  }
};

export const deleteOpponentDossier = (id: string, userId?: string) => {
  try {
    if (userId) {
      db.prepare(`DELETE FROM opponent_dossiers WHERE id = ? AND user_id = ?`).run(id, userId);
    } else {
      db.prepare(`DELETE FROM opponent_dossiers WHERE id = ?`).run(id);
    }
    return true;
  } catch (err) {
    console.error('Error deleting opponent dossier:', err);
    return false;
  }
};

// ==========================================
// --- COMPETITIONS REPOSITORY ---
// ==========================================
export const listCompetitions = (onlyActive = false) => {
  try {
    let query = 'SELECT * FROM competitions';
    if (onlyActive) {
      query += ' WHERE is_active = 1';
    }
    query += ' ORDER BY display_order ASC, name ASC';
    const rows: any[] = db.prepare(query).all();

    return rows.map((r) => {
      // Count matches and available analyses for this competition
      const stats: any = db.prepare(`
        SELECT COUNT(*) as total_matches,
               SUM(CASE WHEN analysis_id IS NOT NULL AND analysis_id != '' THEN 1 ELSE 0 END) as total_analyses
        FROM matches
        WHERE competition_id = ?
      `).get(r.id);

      return {
        id: r.id,
        name: r.name,
        slug: r.slug,
        country: r.country,
        region: r.region,
        logoUrl: r.logo_url,
        season: r.season,
        isActive: Boolean(r.is_active),
        displayOrder: Number(r.display_order || 0),
        matchesCount: Number(stats?.total_matches || 0),
        analysesCount: Number(stats?.total_analyses || 0),
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      };
    });
  } catch (err) {
    console.error('Error listing competitions:', err);
    return [];
  }
};

export const getCompetitionById = (idOrSlug: string) => {
  try {
    const row: any = db.prepare(`
      SELECT * FROM competitions WHERE id = ? OR slug = ? LIMIT 1
    `).get(idOrSlug, idOrSlug);
    if (!row) return null;

    const stats: any = db.prepare(`
      SELECT COUNT(*) as total_matches,
             SUM(CASE WHEN analysis_id IS NOT NULL AND analysis_id != '' THEN 1 ELSE 0 END) as total_analyses
      FROM matches
      WHERE competition_id = ?
    `).get(row.id);

    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      country: row.country,
      region: row.region,
      logoUrl: row.logo_url,
      season: row.season,
      isActive: Boolean(row.is_active),
      displayOrder: Number(row.display_order || 0),
      matchesCount: Number(stats?.total_matches || 0),
      analysesCount: Number(stats?.total_analyses || 0),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  } catch (err) {
    console.error('Error getting competition:', err);
    return null;
  }
};

export const saveCompetition = (comp: {
  id?: string;
  name: string;
  slug?: string;
  country?: string;
  region?: string;
  logoUrl?: string;
  season: string;
  isActive?: boolean;
  displayOrder?: number;
}) => {
  const id = comp.id || `comp_${randomUUID().slice(0, 8)}`;
  const now = new Date().toISOString();
  const slug = comp.slug || comp.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  const isActive = comp.isActive !== undefined ? (comp.isActive ? 1 : 0) : 1;
  const displayOrder = Number(comp.displayOrder || 0);

  db.prepare(`
    INSERT OR REPLACE INTO competitions (
      id, name, slug, country, region, logo_url, season, is_active, display_order, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE((SELECT created_at FROM competitions WHERE id = ?), ?), ?)
  `).run(
    id,
    comp.name,
    slug,
    comp.country || '',
    comp.region || '',
    comp.logoUrl || '',
    comp.season,
    isActive,
    displayOrder,
    id,
    now,
    now
  );

  return getCompetitionById(id);
};

export const deleteCompetition = (id: string) => {
  try {
    db.prepare('DELETE FROM matches WHERE competition_id = ?').run(id);
    db.prepare('DELETE FROM competitions WHERE id = ?').run(id);
    return true;
  } catch (err) {
    console.error('Error deleting competition:', err);
    return false;
  }
};

// ==========================================
// --- MATCHES REPOSITORY ---
// ==========================================
export const listMatches = (filter?: {
  competitionId?: string;
  isFeatured?: boolean;
  status?: string;
  limit?: number;
}) => {
  try {
    let query = `
      SELECT m.*, c.name as competition_name, c.logo_url as competition_logo
      FROM matches m
      LEFT JOIN competitions c ON m.competition_id = c.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (filter?.competitionId) {
      query += ` AND (m.competition_id = ? OR c.slug = ?)`;
      params.push(filter.competitionId, filter.competitionId);
    }
    if (filter?.isFeatured !== undefined) {
      query += ` AND m.is_featured = ?`;
      params.push(filter.isFeatured ? 1 : 0);
    }
    if (filter?.status) {
      query += ` AND m.status = ?`;
      params.push(filter.status);
    }

    query += ` ORDER BY m.is_featured DESC, datetime(m.created_at) DESC`;

    if (filter?.limit) {
      query += ` LIMIT ?`;
      params.push(filter.limit);
    }

    const rows: any[] = db.prepare(query).all(...params);

    return rows.map((r) => ({
      id: r.id,
      competitionId: r.competition_id,
      competitionName: r.competition_name,
      competitionLogo: r.competition_logo,
      homeTeam: r.home_team,
      awayTeam: r.away_team,
      homeTeamLogo: r.home_team_logo,
      awayTeamLogo: r.away_team_logo,
      videoUrl: r.video_url || '',
      matchDate: r.match_date,
      round: r.round,
      stadium: r.stadium,
      status: r.status || 'scheduled',
      analysisId: r.analysis_id || null,
      isFeatured: Boolean(r.is_featured),
      featuredPlayerName: r.featured_player_name,
      featuredPlayerPhoto: r.featured_player_photo,
      featuredPlayerPosition: r.featured_player_position,
      featuredPlayerTeam: r.featured_player_team,
      homeScore: r.home_score !== null ? Number(r.home_score) : null,
      awayScore: r.away_score !== null ? Number(r.away_score) : null,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
  } catch (err) {
    console.error('Error listing matches:', err);
    return [];
  }
};

export const getMatchById = (id: string) => {
  try {
    const r: any = db.prepare(`
      SELECT m.*, c.name as competition_name, c.logo_url as competition_logo
      FROM matches m
      LEFT JOIN competitions c ON m.competition_id = c.id
      WHERE m.id = ?
      LIMIT 1
    `).get(id);
    if (!r) return null;

    return {
      id: r.id,
      competitionId: r.competition_id,
      competitionName: r.competition_name,
      competitionLogo: r.competition_logo,
      homeTeam: r.home_team,
      awayTeam: r.away_team,
      homeTeamLogo: r.home_team_logo,
      awayTeamLogo: r.away_team_logo,
      videoUrl: r.video_url || '',
      matchDate: r.match_date,
      round: r.round,
      stadium: r.stadium,
      status: r.status || 'scheduled',
      analysisId: r.analysis_id || null,
      isFeatured: Boolean(r.is_featured),
      featuredPlayerName: r.featured_player_name,
      featuredPlayerPhoto: r.featured_player_photo,
      featuredPlayerPosition: r.featured_player_position,
      featuredPlayerTeam: r.featured_player_team,
      homeScore: r.home_score !== null ? Number(r.home_score) : null,
      awayScore: r.away_score !== null ? Number(r.away_score) : null,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  } catch (err) {
    console.error('Error getting match by id:', err);
    return null;
  }
};

export const saveMatch = (match: {
  id?: string;
  competitionId: string;
  homeTeam: string;
  awayTeam: string;
  homeTeamLogo?: string;
  awayTeamLogo?: string;
  videoUrl?: string;
  matchDate: string;
  round?: string;
  stadium?: string;
  status?: string;
  analysisId?: string | null;
  isFeatured?: boolean;
  featuredPlayerName?: string;
  featuredPlayerPhoto?: string;
  featuredPlayerPosition?: string;
  featuredPlayerTeam?: string;
  homeScore?: number | null;
  awayScore?: number | null;
}) => {
  const id = match.id || `match_${randomUUID().slice(0, 8)}`;
  const now = new Date().toISOString();
  const isFeatured = match.isFeatured ? 1 : 0;

  db.prepare(`
    INSERT OR REPLACE INTO matches (
      id, competition_id, home_team, away_team, home_team_logo, away_team_logo, video_url,
      match_date, round, stadium, status, analysis_id, is_featured,
      featured_player_name, featured_player_photo, featured_player_position, featured_player_team,
      home_score, away_score, created_at, updated_at
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, COALESCE((SELECT created_at FROM matches WHERE id = ?), ?), ?
    )
  `).run(
    id,
    match.competitionId,
    match.homeTeam,
    match.awayTeam,
    match.homeTeamLogo || '',
    match.awayTeamLogo || '',
    match.videoUrl || '',
    match.matchDate,
    match.round || '',
    match.stadium || '',
    match.status || 'scheduled',
    match.analysisId || null,
    isFeatured,
    match.featuredPlayerName || '',
    match.featuredPlayerPhoto || '',
    match.featuredPlayerPosition || '',
    match.featuredPlayerTeam || '',
    match.homeScore !== undefined ? match.homeScore : null,
    match.awayScore !== undefined ? match.awayScore : null,
    id,
    now,
    now
  );

  return getMatchById(id);
};

export const linkMatchAnalysis = (matchId: string, analysisId: string | null) => {
  try {
    const now = new Date().toISOString();
    db.prepare(`
      UPDATE matches
      SET analysis_id = ?, updated_at = ?
      WHERE id = ?
    `).run(analysisId || null, now, matchId);

    // If analysisId is present, mark the analysis as public/featured so visitors can access it
    if (analysisId) {
      db.prepare(`
        UPDATE analyses
        SET visibility = 'public'
        WHERE id = ? AND (visibility IS NULL OR visibility = 'private')
      `).run(analysisId);
    }
    return getMatchById(matchId);
  } catch (err) {
    console.error('Error linking analysis to match:', err);
    return null;
  }
};

export const deleteMatch = (id: string) => {
  try {
    db.prepare('DELETE FROM matches WHERE id = ?').run(id);
    return true;
  } catch (err) {
    console.error('Error deleting match:', err);
    return false;
  }
};

// ==========================================
// --- PLAYER CATALOG REPOSITORY ---
// ==========================================
export const listPlayerCatalog = (filter?: {
  search?: string;
  club?: string;
  status?: string;
}) => {
  try {
    let query = `SELECT * FROM player_catalog WHERE 1=1`;
    const params: any[] = [];

    if (filter?.search) {
      query += ` AND (UPPER(display_name) LIKE UPPER(?) OR UPPER(normalized_name) LIKE UPPER(?))`;
      params.push(`%${filter.search.trim()}%`, `%${filter.search.trim()}%`);
    }
    if (filter?.club) {
      query += ` AND UPPER(club) LIKE UPPER(?)`;
      params.push(`%${filter.club.trim()}%`);
    }
    if (filter?.status) {
      query += ` AND status = ?`;
      params.push(filter.status);
    }

    query += ` ORDER BY display_name ASC`;
    const rows: any[] = db.prepare(query).all(...params);

    return rows.map((r) => ({
      id: r.id,
      normalizedName: r.normalized_name,
      displayName: r.display_name,
      club: r.club,
      position: r.position,
      shirtNumber: r.shirt_number,
      season: r.season,
      photoUrl: r.photo_url,
      photoSource: r.photo_source,
      photoVerified: Boolean(r.photo_verified),
      adminVerified: Boolean(r.admin_verified),
      status: r.status || 'unconfirmed',
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
  } catch (err) {
    console.error('Error listing player catalog:', err);
    return [];
  }
};

export const getPlayerCatalogEntry = (idOrName: string, club?: string) => {
  try {
    let row: any = null;
    if (club) {
      row = db.prepare(`
        SELECT * FROM player_catalog
        WHERE (id = ? OR UPPER(normalized_name) = UPPER(?)) AND UPPER(club) = UPPER(?)
        LIMIT 1
      `).get(idOrName, idOrName, club);
    } else {
      row = db.prepare(`
        SELECT * FROM player_catalog WHERE id = ? OR UPPER(normalized_name) = UPPER(?) LIMIT 1
      `).get(idOrName, idOrName);
    }
    if (!row) return null;

    return {
      id: row.id,
      normalizedName: row.normalized_name,
      displayName: row.display_name,
      club: row.club,
      position: row.position,
      shirtNumber: row.shirt_number,
      season: row.season,
      photoUrl: row.photo_url,
      photoSource: row.photo_source,
      photoVerified: Boolean(row.photo_verified),
      adminVerified: Boolean(row.admin_verified),
      status: row.status || 'unconfirmed',
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  } catch (err) {
    console.error('Error getting player catalog entry:', err);
    return null;
  }
};

export const savePlayerCatalogEntry = (player: {
  id?: string;
  normalizedName?: string;
  displayName: string;
  club: string;
  position?: string;
  shirtNumber?: string;
  season?: string;
  photoUrl?: string;
  photoSource?: string;
  photoVerified?: boolean;
  adminVerified?: boolean;
  status?: 'confirmed' | 'unconfirmed' | 'admin_verified';
}) => {
  const id = player.id || `p_${randomUUID().slice(0, 8)}`;
  const now = new Date().toISOString();
  const normalizedName = player.normalizedName || player.displayName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  const isPhotoVerified = player.photoVerified ? 1 : 0;
  const isAdminVerified = player.adminVerified ? 1 : 0;
  const status = player.status || (isAdminVerified ? 'admin_verified' : (isPhotoVerified ? 'confirmed' : 'unconfirmed'));

  db.prepare(`
    INSERT OR REPLACE INTO player_catalog (
      id, normalized_name, display_name, club, position, shirt_number, season, photo_url, photo_source, photo_verified, admin_verified, status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE((SELECT created_at FROM player_catalog WHERE id = ?), ?), ?)
  `).run(
    id,
    normalizedName,
    player.displayName,
    player.club,
    player.position || '',
    player.shirtNumber || '',
    player.season || '',
    player.photoUrl || '',
    player.photoSource || '',
    isPhotoVerified,
    isAdminVerified,
    status,
    id,
    now,
    now
  );

  // Sync with player_photos_cache for instant fast lookup
  if (player.photoUrl) {
    setPlayerPhotoCache(
      normalizedName,
      player.club,
      player.season || '',
      player.photoUrl,
      player.photoSource || 'catalog',
      'alta',
      100,
      Boolean(isAdminVerified || isPhotoVerified)
    );
  }

  return getPlayerCatalogEntry(id);
};

export const deletePlayerCatalogEntry = (id: string) => {
  try {
    const entry = getPlayerCatalogEntry(id);
    if (entry) {
      deletePlayerPhotoCache(entry.normalizedName, entry.club);
    }
    db.prepare('DELETE FROM player_catalog WHERE id = ?').run(id);
    return true;
  } catch (err) {
    console.error('Error deleting player catalog entry:', err);
    return false;
  }
};

// ==========================================
// --- ANALYSIS VISIBILITY ---
// ==========================================
export const updateAnalysisVisibility = (analysisId: string, visibility: 'private' | 'public' | 'featured') => {
  try {
    db.prepare(`
      UPDATE analyses SET visibility = ? WHERE id = ?
    `).run(visibility, analysisId);
    return true;
  } catch (err) {
    console.error('Error updating analysis visibility:', err);
    return false;
  }
};

export const listPublicAnalyses = (limit = 30) => {
  try {
    const rows: any[] = db.prepare(`
      SELECT id, created_at, video_title, team_a, team_b, placar, confidence, visibility
      FROM analyses
      WHERE visibility IN ('public', 'featured')
      ORDER BY CASE WHEN visibility = 'featured' THEN 0 ELSE 1 END, datetime(created_at) DESC
      LIMIT ?
    `).all(limit);

    return rows.map((row) => ({
      id: row.id,
      createdAt: row.created_at,
      videoTitle: row.video_title,
      timeA: row.team_a,
      timeB: row.team_b,
      placar: row.placar,
      confidence: row.confidence || 'alta',
      visibility: row.visibility || 'public',
    }));
  } catch (err) {
    console.error('Error listing public analyses:', err);
    return [];
  }
};


