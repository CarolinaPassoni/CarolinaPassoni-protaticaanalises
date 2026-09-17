/* ProTática V6.4 — integridade compatível com API-Football
 *
 * Mantém as travas contra fixtures demonstrativos/URLs antigas, mas NÃO
 * remove destaques de partidas oficiais sincronizadas pela API-Football.
 */
const LibSQLModule = require('libsql');
const Database = LibSQLModule.default || LibSQLModule;

const url = String(process.env.TURSO_DATABASE_URL || '').trim();
const authToken = String(process.env.TURSO_AUTH_TOKEN || '').trim();
const production = process.env.NODE_ENV === 'production';

if (!production) {
  console.log('[MATCH_INTEGRITY] Ambiente não-produtivo: validação destrutiva ignorada.');
  process.exit(0);
}

if (!url || !authToken) {
  console.error('[MATCH_INTEGRITY] Turso não configurado; abortando inicialização por segurança.');
  process.exit(1);
}

try {
  const db = new Database(url, { authToken });

  db.exec(`
    CREATE TABLE IF NOT EXISTS match_integrity_audit (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      action TEXT NOT NULL,
      match_id TEXT,
      details TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const matchCols = db.prepare(`PRAGMA table_info(matches)`).all();
  const hasSourceProvider = matchCols.some(c => c.name === 'source_provider');

  const demoMatchIds = [
    'match_fla_pal',
    'match_rma_mci',
    'match_ars_liv',
    'match_bar_bay',
    'match_bot_riv',
  ];

  const placeholders = demoMatchIds.map(() => '?').join(',');

  const demos = db.prepare(`
    SELECT id, home_team, away_team, match_date, video_url, status
    FROM matches
    WHERE id IN (${placeholders})
      AND analysis_id IS NULL
  `).all(...demoMatchIds);

  for (const m of demos) {
    db.prepare(`
      INSERT INTO match_integrity_audit (action, match_id, details)
      VALUES (?, ?, ?)
    `).run(
      'DELETE_DEMO_FIXTURE',
      m.id,
      JSON.stringify({
        homeTeam: m.home_team,
        awayTeam: m.away_team,
        matchDate: m.match_date,
        status: m.status,
        hadVideoUrl: Boolean(m.video_url),
      })
    );
  }

  const deleteResult = db.prepare(`
    DELETE FROM matches
    WHERE id IN (${placeholders})
      AND analysis_id IS NULL
  `).run(...demoMatchIds);

  // Partidas ainda não finalizadas não podem manter uma URL de vídeo final
  // sem análise vinculada. Vale inclusive para dados oficiais.
  const pendingWithUrls = db.prepare(`
    SELECT id, home_team, away_team, match_date, status, video_url
    FROM matches
    WHERE analysis_id IS NULL
      AND COALESCE(video_url, '') <> ''
      AND LOWER(COALESCE(status, 'scheduled')) NOT IN ('finished', 'finished_waiting_video')
  `).all();

  for (const m of pendingWithUrls) {
    db.prepare(`
      INSERT INTO match_integrity_audit (action, match_id, details)
      VALUES (?, ?, ?)
    `).run(
      'CLEAR_UNFINISHED_VIDEO_URL',
      m.id,
      JSON.stringify({
        homeTeam: m.home_team,
        awayTeam: m.away_team,
        matchDate: m.match_date,
        status: m.status,
        removedUrl: m.video_url,
      })
    );
  }

  const clearResult = db.prepare(`
    UPDATE matches
       SET video_url = NULL,
           updated_at = CURRENT_TIMESTAMP
     WHERE analysis_id IS NULL
       AND COALESCE(video_url, '') <> ''
       AND LOWER(COALESCE(status, 'scheduled')) NOT IN ('finished', 'finished_waiting_video')
  `).run();

  // Só retiramos dos destaques fixtures manuais/não verificadas.
  // Partidas vindas de api_football podem estar agendadas e devem continuar
  // aparecendo como partidas oficiais, apenas sem botão de análise.
  let unfeatureResult;
  if (hasSourceProvider) {
    unfeatureResult = db.prepare(`
      UPDATE matches
         SET is_featured = 0,
             updated_at = CURRENT_TIMESTAMP
       WHERE analysis_id IS NULL
         AND COALESCE(source_provider, '') <> 'api_football'
         AND LOWER(COALESCE(status, 'scheduled')) NOT IN ('finished', 'finished_waiting_video')
         AND COALESCE(video_url, '') = ''
    `).run();
  } else {
    unfeatureResult = db.prepare(`
      UPDATE matches
         SET is_featured = 0,
             updated_at = CURRENT_TIMESTAMP
       WHERE analysis_id IS NULL
         AND LOWER(COALESCE(status, 'scheduled')) NOT IN ('finished', 'finished_waiting_video')
         AND COALESCE(video_url, '') = ''
    `).run();
  }

  console.log(
    `[MATCH_INTEGRITY] OK: demos removidos=${Number(deleteResult?.changes || 0)}, ` +
    `URLs inválidas limpas=${Number(clearResult?.changes || 0)}, ` +
    `pendentes manuais removidos dos destaques=${Number(unfeatureResult?.changes || 0)}.`
  );

  process.exit(0);
} catch (err) {
  console.error('[MATCH_INTEGRITY] Falha na validação de integridade:', err);
  process.exit(1);
}
