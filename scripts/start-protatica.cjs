const { spawn, spawnSync } = require('node:child_process');
const path = require('node:path');

const runBlocking = (script) => {
  const result = spawnSync(process.execPath, [path.join(process.cwd(), script)], {
    stdio: 'inherit',
    env: process.env,
    timeout: 30000,
  });

  if (result.error) {
    console.warn(`[BOOT] Aviso em ${script}: ${result.error.message}`);
    return;
  }

  if (result.status !== 0) {
    console.warn(`[BOOT] ${script} terminou com status ${result.status}; servidor continuará subindo.`);
  }
};

runBlocking('scripts/validate-match-integrity.cjs');

const server = spawn(process.execPath, [path.join(process.cwd(), 'dist/server.cjs')], {
  stdio: 'inherit',
  env: process.env,
});

let syncRunning = false;
let activeSync = null;

const periodicSync = () => {
  if (syncRunning) {
    console.log('[SYNC_SUPERVISOR] Sincronização anterior ainda em andamento; ciclo ignorado.');
    return;
  }

  syncRunning = true;

  const child = spawn(process.execPath, [path.join(process.cwd(), 'scripts/sync-api-football.cjs')], {
    stdio: 'inherit',
    env: process.env,
  });

  activeSync = child;

  const timeout = setTimeout(() => {
    if (!child.killed) {
      console.warn('[SYNC_SUPERVISOR] Timeout de 5 minutos; encerrando sincronização externa.');
      child.kill('SIGTERM');
    }
  }, 5 * 60 * 1000);
  timeout.unref();

  const finish = () => {
    clearTimeout(timeout);
    syncRunning = false;
    if (activeSync === child) activeSync = null;
  };

  child.on('exit', finish);
  child.on('error', finish);
};

const initialTimer = setTimeout(periodicSync, 2000);
initialTimer.unref();

const timer = setInterval(periodicSync, 30 * 60 * 1000);
timer.unref();

const shutdown = (signal) => {
  try { clearTimeout(initialTimer); } catch {}
  try { clearInterval(timer); } catch {}
  try {
    if (activeSync && !activeSync.killed) activeSync.kill('SIGTERM');
  } catch {}

  if (!server.killed) server.kill(signal);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

server.on('exit', (code, signal) => {
  if (signal) {
    try { process.kill(process.pid, signal); } catch {}
    return;
  }
  process.exit(code ?? 0);
});
