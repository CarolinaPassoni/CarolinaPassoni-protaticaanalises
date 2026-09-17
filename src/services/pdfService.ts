import { mkdirSync, writeFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import type { Analysis } from '../types.js';
import { getAnalysisById, enrichAnalysisFromDb } from '../db-sqlite.js';
import { buildAnalysisPdfDocument, sanitizeFilename, getAnalysisPdfFilename } from '../utils/pdfDocumentBuilder.js';

export { sanitizeFilename, getAnalysisPdfFilename };

/**
 * Serviço central de backend para geração e isolamento do Relatório PDF.
 * Usado pelo endpoint GET /api/analyses/:id/pdf e pelo envio ao Telegram via backend.
 */
export async function generateAnalysisPdf(analysisOrId: Analysis | string): Promise<{
  buffer: Buffer;
  filename: string;
  size: number;
  tempPath?: string;
  base64: string;
  analysis: Analysis;
}> {
  console.log('[PDF] iniciando geração');

  let analysis: Analysis;
  let analysisId = '';

  if (typeof analysisOrId === 'string') {
    analysisId = analysisOrId.trim();
    console.log('[PDF] analysisId:', analysisId);
    const raw = getAnalysisById(analysisId);
    if (!raw) {
      console.error('[PDF ERROR] Análise não encontrada no SQLite para o ID:', analysisId);
      throw new Error('Análise não encontrada.');
    }
    analysis = enrichAnalysisFromDb(raw);
  } else {
    analysis = analysisOrId;
    analysisId = analysis.analysisId || '';
    console.log('[PDF] analysisId:', analysisId || 'em memória');
  }

  const { doc, filename, buffer, size, base64 } = buildAnalysisPdfDocument(analysis);

  if (!buffer || buffer.length === 0) {
    console.error('[PDF ERROR] Buffer gerado vazio');
    throw new Error('PDF_EMPTY');
  }

  let tempPath: string | undefined;

  try {
    const safeId = analysisId ? analysisId.replace(/[^a-zA-Z0-9_\-]/g, '_') : 'temp';
    const tempDir = join('/tmp', 'protatica', safeId);
    mkdirSync(tempDir, { recursive: true });
    
    tempPath = join(tempDir, filename);
    writeFileSync(tempPath, buffer);

    const stat = statSync(tempPath);
    if (stat.size === 0) {
      console.error('[PDF ERROR] Arquivo temporário criado com tamanho 0:', tempPath);
      throw new Error('PDF_EMPTY_FILE');
    }

    console.log('[PDF] caminho temporário:', tempPath);
    console.log('[PDF] tamanho gerado:', stat.size, 'bytes');
  } catch (fsErr: any) {
    console.warn('[PDF] Aviso ao gravar arquivo em disco:', fsErr.message);
  }

  return {
    buffer,
    filename,
    size,
    tempPath,
    base64,
    analysis,
  };
}
