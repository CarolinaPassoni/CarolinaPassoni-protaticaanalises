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

  const { filename, buffer, size, base64 } = buildAnalysisPdfDocument(analysis);

  if (!buffer || buffer.length === 0) {
    console.error('[PDF ERROR] Buffer gerado vazio');
    throw new Error('PDF_EMPTY');
  }


  return {
    buffer,
    filename,
    size,
    base64,
    analysis,
  };
}
