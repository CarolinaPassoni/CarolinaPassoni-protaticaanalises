const fs = require('node:fs');
const path = require('node:path');

const apply = (relativePath, replacements) => {
  const filePath = path.join(process.cwd(), relativePath);
  let text = fs.readFileSync(filePath, 'utf8');
  let changed = 0;

  for (const item of replacements) {
    if (text.includes(item.newText)) continue;
    if (!text.includes(item.oldText)) {
      console.warn(`[UI_V6_6] Trecho não localizado em ${relativePath}: ${item.label}`);
      continue;
    }
    text = text.replace(item.oldText, item.newText);
    changed += 1;
  }

  if (changed > 0) fs.writeFileSync(filePath, text, 'utf8');
  console.log(`[UI_V6_6] ${relativePath}: ${changed} ajuste(s) aplicado(s).`);
};

apply('src/components/MatchesModule.tsx', [
  {
    label: 'placar somente após início',
    oldText: `{match.homeScore !== null && match.awayScore !== null ? (`,
    newText: `{match.status !== 'scheduled' && match.homeScore !== null && match.awayScore !== null ? (`,
  },
  {
    label: 'estado do rodapé',
    oldText: `{match.status === 'live' ? 'PARTIDA EM ANDAMENTO' : 'AGUARDANDO VÍDEO DA PARTIDA'}`,
    newText: `{match.status === 'scheduled' ? 'PARTIDA AGENDADA' : match.status === 'live' ? 'PARTIDA EM ANDAMENTO' : 'AGUARDANDO VÍDEO DA PARTIDA'}`,
  },
  {
    label: 'texto da fonte para jogo futuro',
    oldText: `{match.videoUrl ? 'Fonte localizada' : 'Fonte automática ao analisar'}`,
    newText: `{match.videoUrl ? 'Fonte localizada' : match.status === 'scheduled' ? 'Busca automática após o término' : match.status === 'live' ? 'Aguardando término da partida' : 'Fonte automática ao analisar'}`,
  },
  {
    label: 'bloqueio do botão manual antes do término',
    oldText: `type="button"\n                      onClick={() => handleSetVideoUrl(match)}\n                      className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5 text-[10px] font-bold text-amber-300 hover:bg-amber-500/20"`,
    newText: `type="button"\n                      onClick={() => handleSetVideoUrl(match)}\n                      disabled={match.status === 'scheduled' || match.status === 'live'}\n                      className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5 text-[10px] font-bold text-amber-300 hover:bg-amber-500/20 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-amber-500/10"`,
  },
  {
    label: 'texto do botão manual',
    oldText: `{match.videoUrl ? 'Ajustar fonte' : 'Definir manualmente'}`,
    newText: `{match.videoUrl ? 'Ajustar fonte' : (match.status === 'scheduled' || match.status === 'live') ? 'Após o término' : 'Definir manualmente'}`,
  },
]);

apply('src/components/HomeDashboard.tsx', [
  {
    label: 'estado correto na home',
    oldText: `{match.status === 'live' ? 'PARTIDA EM ANDAMENTO' : 'AGUARDANDO VÍDEO'}`,
    newText: `{match.status === 'scheduled' ? 'PARTIDA AGENDADA' : match.status === 'live' ? 'PARTIDA EM ANDAMENTO' : 'AGUARDANDO VÍDEO'}`,
  },
]);

apply('src/components/CompetitionsModule.tsx', [
  {
    label: 'estado correto por competição',
    oldText: `{match.status === 'live' ? 'EM ANDAMENTO' : 'AGUARDANDO VÍDEO'}`,
    newText: `{match.status === 'scheduled' ? 'PARTIDA AGENDADA' : match.status === 'live' ? 'EM ANDAMENTO' : 'AGUARDANDO VÍDEO'}`,
  },
]);
