const fs = require('node:fs');
const path = require('node:path');

const patchFile = (relativePath, replacements) => {
  const filePath = path.join(process.cwd(), relativePath);
  let text = fs.readFileSync(filePath, 'utf8');
  let applied = 0;

  for (const { label, oldText, newText } of replacements) {
    if (text.includes(newText)) continue;
    if (!text.includes(oldText)) {
      console.warn(`[ORDER_V6_7] Trecho não encontrado em ${relativePath}: ${label}`);
      continue;
    }
    text = text.replace(oldText, newText);
    applied += 1;
  }

  if (applied) fs.writeFileSync(filePath, text, 'utf8');
  console.log(`[ORDER_V6_7] ${relativePath}: ${applied} ajuste(s) aplicado(s).`);
};

patchFile('src/db-sqlite.ts', [
  {
    label: 'migração de colunas oficiais da partida',
    oldText: `  // --- IDEMPOTENT MATCHES TABLE COLUMN SYNCHRONIZATION ---\n  // A URL do vídeo é necessária para que "Analisar esta partida" consiga\n  // preencher automaticamente o formulário de Nova Análise.\n  try {\n    const matchCols: any[] = db.prepare("PRAGMA table_info(matches)").all();\n    const matchColNames = new Set(matchCols.map((c) => c.name));\n    if (!matchColNames.has('video_url')) {\n      db.exec('ALTER TABLE matches ADD COLUMN video_url TEXT;');\n      console.log('[DB Migration] Adicionada coluna video_url na tabela matches.');\n    }\n  } catch (e: any) {\n    console.warn('[DB Migration] Falha ao sincronizar matches.video_url:', e.message);\n  }`,
    newText: `  // --- IDEMPOTENT MATCHES TABLE COLUMN SYNCHRONIZATION ---\n  // Mantém no schema principal os campos usados pela integração API-Football.\n  try {\n    const matchCols: any[] = db.prepare("PRAGMA table_info(matches)").all();\n    const matchColNames = new Set(matchCols.map((c) => c.name));\n    const addMatchColIfNotExists = (name: string, definition: string) => {\n      if (!matchColNames.has(name)) {\n        db.exec(\`ALTER TABLE matches ADD COLUMN \${name} \${definition};\`);\n        matchColNames.add(name);\n        console.log(\`[DB Migration] Adicionada coluna '\${name}' na tabela matches.\`);\n      }\n    };\n\n    addMatchColIfNotExists('video_url', 'TEXT');\n    addMatchColIfNotExists('external_fixture_id', 'INTEGER');\n    addMatchColIfNotExists('source_provider', 'TEXT');\n    addMatchColIfNotExists('source_verified_at', 'TEXT');\n    addMatchColIfNotExists('kickoff_at', 'TEXT');\n    addMatchColIfNotExists('api_status', 'TEXT');\n    addMatchColIfNotExists('fixture_timezone', 'TEXT');\n    addMatchColIfNotExists('venue_city', 'TEXT');\n    addMatchColIfNotExists('video_source_title', 'TEXT');\n    addMatchColIfNotExists('video_published_at', 'TEXT');\n    addMatchColIfNotExists('video_verified_at', 'TEXT');\n    addMatchColIfNotExists('video_confidence', 'INTEGER DEFAULT 0');\n    addMatchColIfNotExists('video_lookup_attempted_at', 'TEXT');\n\n    db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_matches_external_fixture ON matches(external_fixture_id);');\n    db.exec('CREATE INDEX IF NOT EXISTS idx_matches_kickoff ON matches(kickoff_at);');\n  } catch (e: any) {\n    console.warn('[DB Migration] Falha ao sincronizar campos oficiais de matches:', e.message);\n  }`,
  },
  {
    label: 'ordenação por estado e kickoff oficial',
    oldText: `    query += \` ORDER BY m.is_featured DESC, datetime(m.created_at) DESC\`;`,
    newText: `    query += \`\n      ORDER BY\n        m.is_featured DESC,\n        CASE\n          WHEN m.status = 'live' THEN 0\n          WHEN m.status = 'scheduled' THEN 1\n          WHEN m.status = 'finished_waiting_video' THEN 2\n          WHEN m.status = 'finished' THEN 3\n          ELSE 4\n        END ASC,\n        CASE WHEN m.status IN ('live', 'scheduled') THEN datetime(m.kickoff_at) END ASC,\n        CASE WHEN m.status NOT IN ('live', 'scheduled') THEN datetime(m.kickoff_at) END DESC,\n        datetime(m.created_at) DESC\n    \`;`,
  },
  {
    label: 'expor kickoff oficial na listagem',
    oldText: `      matchDate: r.match_date,\n      round: r.round,`,
    newText: `      matchDate: r.match_date,\n      kickoffAt: r.kickoff_at || null,\n      apiStatus: r.api_status || null,\n      sourceProvider: r.source_provider || null,\n      videoVerifiedAt: r.video_verified_at || null,\n      videoConfidence: Number(r.video_confidence || 0),\n      round: r.round,`,
  },
]);

patchFile('src/components/MatchesModule.tsx', [
  {
    label: 'texto de busca automática após partida encerrada',
    oldText: `{match.videoUrl ? 'Fonte localizada' : match.status === 'scheduled' ? 'Busca automática após o término' : match.status === 'live' ? 'Aguardando término da partida' : 'Fonte automática ao analisar'}`,
    newText: `{match.videoUrl ? 'Fonte localizada' : match.status === 'scheduled' ? 'Busca automática após o término' : match.status === 'live' ? 'Aguardando término da partida' : match.status === 'finished_waiting_video' ? 'Buscando vídeo validado' : 'Fonte automática ao analisar'}`,
  },
]);
