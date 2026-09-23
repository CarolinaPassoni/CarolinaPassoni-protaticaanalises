const { mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { spawnSync } = require('node:child_process');
const dir = mkdtempSync(join(tmpdir(), 'protatica-tests-'));
try {
  const result = spawnSync(process.execPath, ['--import', 'tsx', '--test', '--test-concurrency=1', 'src/tests/audit_suite.test.ts', 'src/tests/regression.test.ts'], {
    stdio: 'inherit', env: { ...process.env, NODE_ENV: 'test', DATA_DIR: dir,
      TURSO_DATABASE_URL: '', TURSO_AUTH_TOKEN: '', DOTENV_CONFIG_PATH: join(dir, 'no-env'),
      ADMIN_INITIAL_PASSWORD: 'OnlyForIsolatedTests123!', GEMINI_API_KEY: '',
      RUN_NETWORK_TESTS: process.argv.includes('--network') ? 'true' : 'false',
    },
  });
  process.exitCode = result.status ?? 1;
} finally { rmSync(dir, { recursive: true, force: true }); }
