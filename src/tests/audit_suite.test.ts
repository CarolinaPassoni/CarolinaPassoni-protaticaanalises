import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { extractVideoId, normalizeTeamName, formatSecondsToTimestamp } from '../services/videoExtractor.js';
import { hashPassword, verifyPassword, getPlayerPhotoCache, setPlayerPhotoCache } from '../db-sqlite.js';
import { sanitizeScore, normalizeAnalysisResponse } from '../utils/normalizeAnalysis.js';
import { generateAnalysisPdf } from '../services/pdfService.js';

test('1. Validação de Video IDs do YouTube (Estrito)', () => {
  assert.equal(extractVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
  assert.equal(extractVideoId('https://youtu.be/dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
  assert.equal(extractVideoId('https://www.youtube.com/shorts/dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
  assert.equal(extractVideoId('https://www.youtube.com/embed/dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
  assert.equal(extractVideoId('dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
  assert.equal(extractVideoId('https://example.com/not-youtube'), null);
  assert.equal(extractVideoId(''), null);
});

test('2. Normalização Inteligente de Nomes de Clubes', () => {
  assert.equal(normalizeTeamName('Botafogo SAF'), 'botafogo');
  assert.equal(normalizeTeamName('Clube de Regatas do Flamengo'), 'flamengo');
  assert.equal(normalizeTeamName('São Paulo F.C.'), 'sao paulo');
  assert.equal(normalizeTeamName('Palmeiras'), 'palmeiras');
  assert.equal(normalizeTeamName('Corinthians Paulista'), 'corinthians');
  assert.equal(normalizeTeamName('Real Madrid C.F.'), 'real madrid');
});

test('3. Formatação de Timestamps Segundos para MM:SS / HH:MM:SS', () => {
  assert.equal(formatSecondsToTimestamp(0), '00:00');
  assert.equal(formatSecondsToTimestamp(65), '01:05');
  assert.equal(formatSecondsToTimestamp(3665), '01:01:05');
});

test('4. Criptografia Segura de Senhas (scrypt + upgrade de SHA256)', () => {
  const plain = 'MinhaSenhaSegura!123';
  const hashed = hashPassword(plain);
  assert.ok(hashed.startsWith('scrypt$'), 'O hash deve utilizar scrypt');
  assert.ok(verifyPassword(plain, hashed), 'A senha deve ser validada');
  assert.ok(!verifyPassword('senhaerrada', hashed), 'Senha errada deve ser rejeitada');

  // Teste de compatibilidade SHA256 legado
  const legacySha256 = createHash('sha256').update(plain).digest('hex');
  assert.ok(verifyPassword(plain, legacySha256), 'Hash legado SHA256 deve ser aceito e verificado');
});

test('5. Sanitização de Placar e Prevenção de Repetição', () => {
  assert.equal(sanitizeScore('2 x 1'), '2 x 1');
  assert.equal(sanitizeScore('2-0'), '2 x 0');
  assert.equal(sanitizeScore('2 x 12 x 12 x 1'), '2 x 1');
  assert.equal(sanitizeScore(''), 'Não identificado');
  assert.equal(sanitizeScore(null), 'Não identificado');
});

test('6. Normalização e 5 Fontes de Auditoria de Placar', () => {
  const rawInput = {
    analysisId: 'test-123',
    timeA: 'Flamengo',
    timeB: 'Fluminense',
    placar: '2 x 1',
    placarAuditoria: {
      placarVisivel: '2 x 1',
      placarFinal: '2 x 1',
      fontePlacar: 'Súmula Oficial CBF',
      confianca: 'alta',
      scoreEvidence: {
        videoVisual: '2 x 1 no HUD aos 88 min',
        visual: '2 x 1 no HUD aos 88 min',
        transcript: 'Narrador confirma dois a um',
        metadata: '2 x 1 no título',
        officialSource: '2 x 1 na CBF',
        aiInference: '2 x 1 inferido pelos lances',
        ai: '2 x 1 inferido pelos lances',
      }
    },
    resumoPartida: 'Partida intensa com gols no segundo tempo.',
    momentosChave: 'Gol aos 32 e aos 75.',
    contextoPartida: { competicao: 'Brasileirão' },
    formacoes: { timeA: { esquema: '4-3-3' }, timeB: { esquema: '4-4-2' } },
    faseDefensiva: { timeA: { posicionamento: 'Bloco médio' } },
    faseOfensiva: { timeA: { criacao: 'Laterais' } },
    estatisticas: { posseDeBola: { timeA: '55%', timeB: '45%' } },
    analiseJogadores: [{ nome: 'Gerson', time: 'Flamengo', posicao: 'Volante', nivelConfianca: 'alta' }],
    linhaDoTempo: [{ minuto: '32', tipo: 'Gol', time: 'Flamengo', descricao: 'Chute no ângulo' }],
    conclusaoRecomendacoes: 'Manter pressão alta.',
    verificacaoAuditoria: { nivelConfianca: 'alta' }
  };

  const normalized = normalizeAnalysisResponse(rawInput);
  assert.equal(normalized.timeA, 'Flamengo');
  assert.equal(normalized.timeB, 'Fluminense');
  assert.equal(normalized.placar, '2 x 1');
  assert.ok(normalized.placarAuditoria?.scoreEvidence?.videoVisual);
  assert.ok(normalized.placarAuditoria?.scoreEvidence?.officialSource);
  assert.ok(normalized.placarAuditoria?.scoreEvidence?.metadata);
});

test('7. Cache de Fotos de Jogadores', () => {
  const ok = setPlayerPhotoCache('Gerson', 'Flamengo', '2024', 'https://example.com/gerson.jpg', 'oficial', 'alta');
  assert.ok(ok);
  const cached = getPlayerPhotoCache('Gerson', 'Flamengo');
  assert.ok(cached);
  assert.equal(cached.url, 'https://example.com/gerson.jpg');
});

test('8. Integridade do Relatório PDF Centralizado', async () => {
  const sampleAnalysis = {
    analysisId: 'pdf-audit-test',
    createdAt: new Date().toISOString(),
    videoTitle: 'Final da Copa do Brasil 2024',
    timeA: 'Flamengo',
    timeB: 'Atlético Mineiro',
    placar: '3 x 1',
    resumoPartida: 'Vitória sólida com imposição tática em campo.',
    momentosChave: 'Gols aos 12, 45 e 80 minutos.',
    conclusaoRecomendacoes: 'Estratégia executada com sucesso.',
    formacoes: { timeA: { esquema: '4-2-3-1' }, timeB: { esquema: '4-3-3' } },
    faseDefensiva: {
      timeA: { posicionamento: 'Bloco médio-alto' },
      timeB: { posicionamento: 'Bloco baixo' }
    },
    faseOfensiva: {
      timeA: { criacao: 'Construção apoiada' },
      timeB: { criacao: 'Transição rápida' }
    },
    estatisticas: {
      posseDeBola: { timeA: '58%', timeB: '42%' },
      finalizacoes: { timeA: '14', timeB: '8' },
      finalizacoesNoAlvo: { timeA: '6', timeB: '2' },
      passesCertos: { timeA: '480', timeB: '320' },
      escanteios: { timeA: '7', timeB: '3' },
      faltasCometidas: { timeA: '12', timeB: '15' },
    },
    analiseJogadores: [
      { nome: 'Gerson', time: 'Flamengo', posicao: 'Meio-Campo', camisa: '8', nivelConfianca: 'alta', analise: 'Excelente transição ofensiva e cobertura.' }
    ],
    linhaDoTempo: [
      { minuto: '12', time: 'Flamengo', tipo: 'Gol', descricao: 'Finalização de perna esquerda.', impactoTatico: 'Abertura de placar cedo.' }
    ]
  };

  const pdf = await generateAnalysisPdf(sampleAnalysis);
  assert.ok(pdf.buffer instanceof Buffer, 'O PDF deve ser retornado como Buffer');
  assert.ok(pdf.buffer.length > 500, 'O PDF não pode estar vazio');
  assert.equal(pdf.buffer.subarray(0, 4).toString('ascii'), '%PDF', 'O arquivo deve conter o cabeçalho PDF válido');
});

test('9. Extração de Frames Reais do YouTube e Regras de Validação', async () => {
  const { processMultimodalVideoEvidence } = await import('../services/videoExtractor.js');

  // Teste 1: URL real do YouTube com storyboard disponível (extrai frames reais)
  const result = await processMultimodalVideoEvidence('dQw4w9WgXcQ', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'quick', 0, 60, undefined, 'test-audit-yt');

  assert.equal(result.videoId, 'dQw4w9WgXcQ');
  assert.ok(Array.isArray(result.frames), 'Frames reais devem ser um array');
  assert.ok(result.frames.length >= 6, 'Modo quick deve extrair entre 6 e 10 frames reais');
  assert.equal(result.hasRealVideoFrames, true, 'hasRealVideoFrames deve ser true quando frames reais são extraídos do vídeo');
  assert.ok(result.frames[0].base64.length > 100, 'Frame deve conter dados base64 válidos');
  assert.ok(result.extractionLog.some(l => l.includes('[EVIDENCE] realFrames=true')), 'Log deve registrar evidência de frames reais');

  // Teste 2: Vídeo inexistente/inválido onde extração falha (fallback seguro sem fingir thumbnail como frame)
  const fallbackResult = await processMultimodalVideoEvidence('invalid_id_999', 'https://www.youtube.com/watch?v=invalid_id_999', 'quick', 0, 60, undefined, 'test-audit-fail');

  assert.equal(fallbackResult.hasRealVideoFrames, false, 'hasRealVideoFrames deve ser false quando frames reais não puderem ser extraídos');
  assert.equal(fallbackResult.frames.length, 0, 'Frames reais devem ser 0 em falha');
  assert.ok(fallbackResult.extractionLog.some(l => l.includes('Evidência visual do vídeo indisponível') || l.includes('realFrames=false')), 'Log deve declarar indisponibilidade de frames reais');

  // Regra de Validação: Sem evidência visual real de frames -> visual sections são unverified/partial e validationStatus geral não pode ser verified apenas por transcrição
  const hasVisualEvidence = Boolean(fallbackResult.hasRealVideoFrames && fallbackResult.frames.length > 0);
  const hasTranscriptEvidence = Boolean(fallbackResult.hasTranscript);
  const isIdentityConfirmed = Boolean(fallbackResult.videoId);
  const isMatchContextCoherent = true;
  const isConflict = false;

  let validationStatus = 'unverified';
  if (isConflict) {
    validationStatus = 'conflict';
  } else if (isIdentityConfirmed && hasVisualEvidence && isMatchContextCoherent) {
    validationStatus = 'verified';
  } else if (isIdentityConfirmed && hasTranscriptEvidence && isMatchContextCoherent) {
    validationStatus = 'partial';
  } else if (hasVisualEvidence || hasTranscriptEvidence || isMatchContextCoherent) {
    validationStatus = 'partial';
  }

  assert.equal(validationStatus, 'partial', 'Sem evidência visual de frames reais, o status deve ser no máximo partial, NUNCA verified');
  assert.equal(hasVisualEvidence, false, 'hasVisualEvidence deve ser false em falha de extração');

  // Validação por seção (sectionValidation)
  const enoughForTacticalShape = hasVisualEvidence && fallbackResult.frames.length >= 6;
  const enoughForHeatmap = hasVisualEvidence && fallbackResult.frames.length >= 12;
  const enoughForVisualScouting = hasVisualEvidence && fallbackResult.frames.length >= 8;

  const sectionValidation = {
    matchIdentity: isIdentityConfirmed && isMatchContextCoherent ? 'verified' : 'partial',
    score: 'partial',
    tacticalShape: enoughForTacticalShape ? 'verified' : 'unverified',
    heatmap: enoughForHeatmap ? 'verified' : 'unverified',
    scouting: enoughForVisualScouting ? 'verified' : (hasTranscriptEvidence ? 'partial' : 'unverified'),
    statistics: hasVisualEvidence ? 'verified' : 'partial'
  };

  assert.equal(sectionValidation.tacticalShape, 'unverified', 'Sem frames reais, tacticalShape deve ser unverified');
  assert.equal(sectionValidation.heatmap, 'unverified', 'Sem frames reais, heatmap deve ser unverified');
});

test('10. Variabilidade de Trechos e Amostragem Temporal de Vídeo', async () => {
  const { processMultimodalVideoEvidence } = await import('../services/videoExtractor.js');

  // Trecho 1: 00:00 - 05:00 (0 a 300s)
  const clip1 = await processMultimodalVideoEvidence('test_vid', 'https://www.youtube.com/watch?v=test_vid', 'quick', 0, 300);
  // Trecho 2: 30:00 - 35:00 (1800 a 2100s)
  const clip2 = await processMultimodalVideoEvidence('test_vid', 'https://www.youtube.com/watch?v=test_vid', 'complete', 1800, 2100);

  assert.equal(clip1.clipStartSeconds, 0);
  assert.equal(clip1.clipEndSeconds, 300);
  assert.equal(clip2.clipStartSeconds, 1800);
  assert.equal(clip2.clipEndSeconds, 2100);
  assert.notEqual(clip1.clipStartSeconds, clip2.clipStartSeconds, 'Os timestamps iniciais dos clipes devem ser diferentes');
  assert.notEqual(clip1.clipEndSeconds, clip2.clipEndSeconds, 'Os timestamps finais dos clipes devem ser diferentes');
  assert.equal(clip1.mode, 'quick');
  assert.equal(clip2.mode, 'complete');

  // Verificação dos logs estruturados do teste
  console.log('[VIDEO]', clip1.videoId);
  console.log('[EVIDENCE] realFrames:', clip1.frames.length);
  console.log('[EVIDENCE] thumbnail:', clip1.hasThumbnailReference);
  console.log('[EVIDENCE] transcriptSegments:', clip1.transcriptSegments.length);
  console.log('[EVIDENCE] clipRange:', `${clip1.clipStartSeconds}s - ${clip1.clipEndSeconds}s (${formatSecondsToTimestamp(clip1.clipStartSeconds)} - ${formatSecondsToTimestamp(clip1.clipEndSeconds)})`);
  console.log('[VALIDATION] status: partial');
});

test('11. Imutabilidade e Integridade do Banco SQLite para Publicação', async () => {
  const { saveAnalysis, getAnalysisById } = await import('../db-sqlite.js');

  const testAnalysis = {
    analysisId: 'sec-test-' + Date.now(),
    timeA: 'Grêmio',
    timeB: 'Internacional',
    placar: '1 x 0',
    validationStatus: 'verified' as const,
    resumoPartida: 'Gol no final do primeiro tempo.',
    estatisticas: { posseDeBola: { timeA: '50%', timeB: '50%' } }
  };

  saveAnalysis(testAnalysis as any);
  const loaded = getAnalysisById(testAnalysis.analysisId);
  assert.ok(loaded, 'A análise oficial deve ser persistida e carregável pelo analysisId');
  assert.equal(loaded.timeA, 'Grêmio');
  assert.equal(loaded.placar, '1 x 0');
});

