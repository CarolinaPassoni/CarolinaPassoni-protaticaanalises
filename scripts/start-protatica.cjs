const { spawn, spawnSync } = require('node:child_process');
const path = require('node:path');

const runBlocking = (script) => {
  const result = spawnSync(process.execPath, [path.join(process.cwd(), script)], {
    stdio: 'inherit',
    env: process.env,
  });
  if (result.status !== 0) {
    console.error(`[BOOT] Falha em ${script}. Inicialização interrompida.`);
    process.exit(result.status || 1);
  }
};

// 1) limpa fixtures demonstrativos / URLs antigas
runBlocking('scripts/validate-match-integrity.cjs');
// 2) sincroniza a fonte oficial de partidas (com cache e proteção de quota)
runBlocking('scripts/sync-api-football.cjs');

// 3) inicia o servidor principal
const server = spawn(process.execPath, [path.join(process.cwd(), 'dist/server.cjs')], {
  stdio: 'inherit',
  env: process.env,
});

let syncRunning = false;
const periodicSync = () => {
  if (syncRunning) return;
  syncRunning = true;
  const child = spawn(process.execPath, [path.join(process.cwd(), 'scripts/sync-api-football.cjs')], {
    stdio: 'inherit',
    env: process.env,
  });
  child.on('exit', () => { syncRunning = false; });
  child.on('error', () => { syncRunning = false; });
};

// V6.8: a cada 30 minutos. O sincronizador usa cooldown de 25 min e quota guard.
// Em um dia inteiro, o consumo típico máximo fica perto de 50 chamadas,
// ainda abaixo do limite Free de 100/dia.
const timer = setInterval(periodicSync, 30 * 60 * 1000);
timer.unref();

const shutdown = (signal) => {
  try { clearInterval(timer); } catch {}
  if (!server.killed) server.kill(signal);
};
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
server.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 0);
});
