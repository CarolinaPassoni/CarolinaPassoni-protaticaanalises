const fs = require('node:fs');
const path = require('node:path');

const filePath = path.join(process.cwd(), 'src/db-sqlite.ts');
let text = fs.readFileSync(filePath, 'utf8');

if (!text.includes('const runWithReconnect = <T>')) {
  const start = text.indexOf('let database: Database;');
  const endMarker = "db.exec('PRAGMA foreign_keys = ON;');";
  const end = text.indexOf(endMarker, start);

  if (start < 0 || end < 0) {
    throw new Error('[V6_10_11] Bloco de conexão do banco não localizado.');
  }

  const replacement = `let database: any;

const createDatabaseConnection = () => {
  if (usingRemoteDatabase) {
    return new Database(tursoUrl, { authToken: tursoAuthToken });
  }

  const configuredDataDir = String(process.env.DATA_DIR || '').trim();
  const dataDir = configuredDataDir ? resolve(configuredDataDir) : resolve(process.cwd(), 'data');
  if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });
  const dbPath = resolve(dataDir, 'protatica.sqlite');
  const localDatabase = new Database(dbPath);
  localDatabase.exec('PRAGMA journal_mode = WAL;');
  return localDatabase;
};

database = createDatabaseConnection();

if (usingRemoteDatabase) {
  console.log('[DB] Turso remoto configurado. Os dados não dependem do disco do Render.');
} else {
  const configuredDataDir = String(process.env.DATA_DIR || '').trim();
  const dataDir = configuredDataDir ? resolve(configuredDataDir) : resolve(process.cwd(), 'data');
  const dbPath = resolve(dataDir, 'protatica.sqlite');
  console.log(\`[DB] SQLite local de desenvolvimento: \${dbPath}\`);
}

const isExpiredRemoteStream = (error: any) =>
  usingRemoteDatabase &&
  /stream not found|hrana|closed stream|connection.*closed/i.test(
    String(error?.message || error || '')
  );

const reconnectRemoteDatabase = () => {
  database = createDatabaseConnection();
  console.warn('[DB] Conexão Turso renovada automaticamente.');
};

const runWithReconnect = <T>(operation: () => T): T => {
  try {
    return operation();
  } catch (error) {
    if (!isExpiredRemoteStream(error)) throw error;
    reconnectRemoteDatabase();
    return operation();
  }
};

export const db: any = {
  exec(sql: string) {
    return runWithReconnect(() => database.exec(sql));
  },
  prepare(sql: string) {
    return {
      run: (...args: any[]) =>
        runWithReconnect(() => database.prepare(sql).run(...args)),
      get: (...args: any[]) =>
        runWithReconnect(() => database.prepare(sql).get(...args)),
      all: (...args: any[]) =>
        runWithReconnect(() => database.prepare(sql).all(...args)),
    };
  },
};
`;

  text = text.slice(0, start) + replacement + text.slice(end);
  fs.writeFileSync(filePath, text, 'utf8');
  console.log('[V6_10_11] Reconexão automática do Turso aplicada.');
} else {
  console.log('[V6_10_11] Reconexão automática do Turso já estava aplicada.');
}
