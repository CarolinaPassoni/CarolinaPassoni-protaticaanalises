import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Send,
  X,
  CheckCircle,
  AlertTriangle,
  FileText,
  Flame,
  CheckSquare,
  Square,
  Loader2,
  BarChart2,
  Shield,
  Activity,
  Users,
  Star,
  Scale
} from 'lucide-react';
import type { Analysis } from '../types';
import { generateHeatmapDataUrl } from '../utils/heatmapGenerator';
import { buildAnalysisPdfDocument } from '../utils/pdfDocumentBuilder';
import { getAuthHeaders } from '../services/geminiService';

interface TelegramPublishModalProps {
  analysis: Analysis;
  isOpen: boolean;
  onClose: () => void;
  reportPdfBase64?: string;
  pdfFilename?: string;
  heatmapDataUrl?: string;
}

interface ContentOptions {
  resumo: boolean;
  estatisticas: boolean;
  tatica: boolean;
  mapaCalor: boolean;
  scouting: boolean;
  comparativo: boolean;
  destaques: boolean;
  pdf: boolean;
}

export const TelegramPublishModal: React.FC<TelegramPublishModalProps> = ({
  analysis,
  isOpen,
  onClose,
  reportPdfBase64,
  pdfFilename,
  heatmapDataUrl,
}) => {
  const [target, setTarget] = useState<'all' | 'channel' | 'vip'>('all');
  const [contents, setContents] = useState<ContentOptions>({
    resumo: true,
    estatisticas: true,
    tatica: true,
    mapaCalor: true,
    scouting: true,
    comparativo: true,
    destaques: true,
    pdf: true,
  });
  const [customNote, setCustomNote] = useState('');
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishingStep, setPublishingStep] = useState<string>('');
  const [result, setResult] = useState<{
    success: boolean;
    deliveredCount: number;
    itemsSent?: string[];
    itemsFailed?: string[];
    errors: string[];
  } | null>(null);

  // Lock body scroll when modal is open and restore on unmount/close
  useEffect(() => {
    if (!isOpen) return;

    const originalOverflow = document.body.style.overflow;
    const originalPaddingRight = document.body.style.paddingRight;

    // Prevent layout shift if scrollbar exists
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isPublishing) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.style.paddingRight = originalPaddingRight;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, isPublishing, onClose]);

  if (!isOpen) return null;

  const toggleContent = (key: keyof ContentOptions) => {
    setContents((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const selectAll = () => {
    setContents({
      resumo: true,
      estatisticas: true,
      tatica: true,
      mapaCalor: true,
      scouting: true,
      comparativo: true,
      destaques: true,
      pdf: true,
    });
  };

  const clearAll = () => {
    setContents({
      resumo: false,
      estatisticas: false,
      tatica: false,
      mapaCalor: false,
      scouting: false,
      comparativo: false,
      destaques: false,
      pdf: false,
    });
  };

  const selectedCount = Object.values(contents).filter(Boolean).length;

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedCount === 0) {
      setResult({
        success: false,
        deliveredCount: 0,
        errors: ['Selecione ao menos 1 tipo de conteúdo para publicar.'],
      });
      return;
    }

    setIsPublishing(true);
    setResult(null);

    try {
      let finalHeatmapUrl = heatmapDataUrl;
      let finalPdfBase64 = reportPdfBase64;

      // 1. Gerar mapa de calor sob demanda se selecionado e não fornecido
      if (contents.mapaCalor && !finalHeatmapUrl) {
        setPublishingStep('Renderizando mapa de calor tático...');
        try {
          finalHeatmapUrl = await generateHeatmapDataUrl(analysis);
        } catch (heatErr) {
          console.warn('[Telegram Modal] Erro ao renderizar mapa de calor no canvas:', heatErr);
        }
      }

      // 2. Gerar PDF vetorial sob demanda se selecionado e não fornecido
      if (contents.pdf && !finalPdfBase64) {
        setPublishingStep('Compilando relatório PDF de auditoria...');
        try {
          const builtPdf = buildAnalysisPdfDocument(analysis);
          finalPdfBase64 = builtPdf.base64;
        } catch (pdfErr) {
          console.warn('[Telegram Modal] Erro ao compilar PDF:', pdfErr);
        }
      }

      setPublishingStep('Transmitindo conteúdos para a Telegram Bot API...');

      const res = await fetch('/api/telegram/publish', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          analysisId: analysis.analysisId,
          analysis,
          target,
          selectedContents: contents,
          reportPdfBase64: contents.pdf ? finalPdfBase64 : undefined,
          pdfFilename: pdfFilename || `ProTatica_${analysis.timeA || 'TimeA'}_x_${analysis.timeB || 'TimeB'}.pdf`,
          heatmapDataUrl: contents.mapaCalor ? finalHeatmapUrl : undefined,
          customNote: customNote.trim() || undefined,
          appUrl: window.location.origin,
        }),
      });

      const data = await res.json();

      // Validação estrita: somente exibe sucesso se Telegram Bot API confirmou a entrega
      if (res.ok && data.success) {
        setResult({
          success: true,
          deliveredCount: data.deliveredCount || 1,
          itemsSent: data.itemsSent || [],
          itemsFailed: data.itemsFailed || [],
          errors: data.errors || [],
        });
      } else {
        setResult({
          success: false,
          deliveredCount: data.deliveredCount || 0,
          itemsSent: data.itemsSent || [],
          itemsFailed: data.itemsFailed || [],
          errors: data.errors && data.errors.length > 0 ? data.errors : [data.error || 'Falha ao validar envio na API do Telegram.'],
        });
      }
    } catch (err: any) {
      setResult({
        success: false,
        deliveredCount: 0,
        errors: [`Erro de comunicação com o servidor: ${err.message}`],
      });
    } finally {
      setIsPublishing(false);
      setPublishingStep('');
    }
  };

  const timeA = analysis.timeA || 'Time A';
  const timeB = analysis.timeB || 'Time B';
  const placar = analysis.placar && analysis.placar !== 'não identificado' ? ` (${analysis.placar})` : '';

  const modalContent = (
    <div
      id="telegram-modal-overlay"
      className="fixed inset-0 w-screen h-[100dvh] z-[99999] flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100vw',
        height: '100dvh',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !isPublishing) {
          onClose();
        }
      }}
    >
      <div
        id="telegram-modal-card"
        className="bg-[#180202] border border-yellow-500/40 rounded-2xl shadow-2xl relative flex flex-col overflow-hidden text-yellow-50"
        style={{
          width: 'min(720px, calc(100vw - 24px))',
          maxHeight: 'calc(100dvh - 32px)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="bg-[#2a0101] border-b border-yellow-900/50 px-5 py-3.5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-yellow-500/10 border border-yellow-500/30 text-yellow-400">
              <Send className="h-4 w-4" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm sm:text-base text-yellow-100 uppercase tracking-wider">
                Publicar no Telegram
              </h3>
              <p className="text-[11px] text-yellow-300/60 font-normal">
                Transmissão completa de relatórios e dados validados
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isPublishing}
            className="text-yellow-200/60 hover:text-yellow-100 hover:bg-white/10 p-2 rounded-lg text-sm transition-colors cursor-pointer disabled:opacity-50"
            aria-label="Fechar modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <form onSubmit={handlePublish} className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <div 
            className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1"
            style={{ overscrollBehavior: 'contain' }}
          >
            {/* Match summary card */}
            <div className="bg-black/40 border border-yellow-900/30 rounded-xl p-3 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-yellow-400 font-bold uppercase tracking-wider">
                  Partida Selecionada
                </span>
                {analysis.verificacaoAuditoria?.nivelConfianca && (
                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase ${
                    analysis.verificacaoAuditoria.nivelConfianca === 'alta'
                      ? 'bg-green-950 text-green-400 border border-green-700/50'
                      : 'bg-yellow-950 text-yellow-400 border border-yellow-700/50'
                  }`}>
                    Confiança {analysis.verificacaoAuditoria.nivelConfianca}
                  </span>
                )}
              </div>
              <div className="text-sm font-bold text-yellow-100">
                ⚽ {timeA} x {timeB}{placar}
              </div>
              <div className="text-[11px] text-yellow-200/60 flex flex-wrap gap-x-3 gap-y-1">
                <span>Competição: {analysis.contextoPartida?.competicao || 'N/D'}</span>
                <span>•</span>
                <span>Data: {analysis.contextoPartida?.dataJogo || 'N/D'}</span>
              </div>
            </div>

            {/* SELEÇÃO DOS 8 CONTEÚDOS */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-yellow-300 uppercase tracking-wider flex items-center gap-1.5">
                  <span>Conteúdo para Publicar</span>
                  <span className="text-[10px] text-yellow-400/80 font-normal">({selectedCount} de 8 selecionados)</span>
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={selectAll}
                    className="text-[11px] font-semibold text-yellow-400 hover:text-yellow-200 hover:underline cursor-pointer flex items-center gap-1"
                  >
                    <CheckSquare className="h-3 w-3" />
                    <span>Selecionar tudo</span>
                  </button>
                  <span className="text-yellow-800">•</span>
                  <button
                    type="button"
                    onClick={clearAll}
                    className="text-[11px] font-semibold text-yellow-400/70 hover:text-yellow-200 hover:underline cursor-pointer flex items-center gap-1"
                  >
                    <Square className="h-3 w-3" />
                    <span>Limpar seleção</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {/* 1. Resumo */}
                <label
                  onClick={() => toggleContent('resumo')}
                  className={`flex items-start gap-2.5 p-2.5 rounded-xl border transition-all cursor-pointer select-none ${
                    contents.resumo
                      ? 'bg-yellow-500/15 border-yellow-500/50 text-yellow-100 shadow-sm'
                      : 'bg-black/30 border-yellow-950/60 text-yellow-200/50 hover:bg-black/50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={contents.resumo}
                    onChange={() => {}}
                    className="mt-0.5 w-4 h-4 rounded border-yellow-800 text-yellow-500 focus:ring-yellow-500 bg-black cursor-pointer"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 text-xs font-bold">
                      <FileText className="h-3.5 w-3.5 text-yellow-400 shrink-0" />
                      <span>Resumo da partida</span>
                    </div>
                    <p className="text-[10px] text-yellow-200/60 mt-0.5 truncate">
                      Texto oficial com gols, contexto e visão geral
                    </p>
                  </div>
                </label>

                {/* 2. Estatísticas */}
                <label
                  onClick={() => toggleContent('estatisticas')}
                  className={`flex items-start gap-2.5 p-2.5 rounded-xl border transition-all cursor-pointer select-none ${
                    contents.estatisticas
                      ? 'bg-yellow-500/15 border-yellow-500/50 text-yellow-100 shadow-sm'
                      : 'bg-black/30 border-yellow-950/60 text-yellow-200/50 hover:bg-black/50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={contents.estatisticas}
                    onChange={() => {}}
                    className="mt-0.5 w-4 h-4 rounded border-yellow-800 text-yellow-500 focus:ring-yellow-500 bg-black cursor-pointer"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 text-xs font-bold">
                      <BarChart2 className="h-3.5 w-3.5 text-yellow-400 shrink-0" />
                      <span>Estatísticas completas</span>
                    </div>
                    <p className="text-[10px] text-yellow-200/60 mt-0.5 truncate">
                      Posse, finalizações, xG, passes, desarmes
                    </p>
                  </div>
                </label>

                {/* 3. Análise Tática */}
                <label
                  onClick={() => toggleContent('tatica')}
                  className={`flex items-start gap-2.5 p-2.5 rounded-xl border transition-all cursor-pointer select-none ${
                    contents.tatica
                      ? 'bg-yellow-500/15 border-yellow-500/50 text-yellow-100 shadow-sm'
                      : 'bg-black/30 border-yellow-950/60 text-yellow-200/50 hover:bg-black/50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={contents.tatica}
                    onChange={() => {}}
                    className="mt-0.5 w-4 h-4 rounded border-yellow-800 text-yellow-500 focus:ring-yellow-500 bg-black cursor-pointer"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 text-xs font-bold">
                      <Shield className="h-3.5 w-3.5 text-yellow-400 shrink-0" />
                      <span>Análise tática</span>
                    </div>
                    <p className="text-[10px] text-yellow-200/60 mt-0.5 truncate">
                      Formações, fases defensiva, ofensiva e transição
                    </p>
                  </div>
                </label>

                {/* 4. Mapa de Calor */}
                <label
                  onClick={() => toggleContent('mapaCalor')}
                  className={`flex items-start gap-2.5 p-2.5 rounded-xl border transition-all cursor-pointer select-none ${
                    contents.mapaCalor
                      ? 'bg-yellow-500/15 border-yellow-500/50 text-yellow-100 shadow-sm'
                      : 'bg-black/30 border-yellow-950/60 text-yellow-200/50 hover:bg-black/50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={contents.mapaCalor}
                    onChange={() => {}}
                    className="mt-0.5 w-4 h-4 rounded border-yellow-800 text-yellow-500 focus:ring-yellow-500 bg-black cursor-pointer"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 text-xs font-bold">
                      <Flame className="h-3.5 w-3.5 text-yellow-400 shrink-0" />
                      <span>Mapa de calor</span>
                    </div>
                    <p className="text-[10px] text-yellow-200/60 mt-0.5 truncate">
                      Imagem gerada do gramado + legenda espacial
                    </p>
                  </div>
                </label>

                {/* 5. Comparativo */}
                <label
                  onClick={() => toggleContent('comparativo')}
                  className={`flex items-start gap-2.5 p-2.5 rounded-xl border transition-all cursor-pointer select-none ${
                    contents.comparativo
                      ? 'bg-yellow-500/15 border-yellow-500/50 text-yellow-100 shadow-sm'
                      : 'bg-black/30 border-yellow-950/60 text-yellow-200/50 hover:bg-black/50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={contents.comparativo}
                    onChange={() => {}}
                    className="mt-0.5 w-4 h-4 rounded border-yellow-800 text-yellow-500 focus:ring-yellow-500 bg-black cursor-pointer"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 text-xs font-bold">
                      <Scale className="h-3.5 w-3.5 text-yellow-400 shrink-0" />
                      <span>Comparativo das equipes</span>
                    </div>
                    <p className="text-[10px] text-yellow-200/60 mt-0.5 truncate">
                      Confronto métrico lado a lado (A vs B)
                    </p>
                  </div>
                </label>

                {/* 6. Scouting */}
                <label
                  onClick={() => toggleContent('scouting')}
                  className={`flex items-start gap-2.5 p-2.5 rounded-xl border transition-all cursor-pointer select-none ${
                    contents.scouting
                      ? 'bg-yellow-500/15 border-yellow-500/50 text-yellow-100 shadow-sm'
                      : 'bg-black/30 border-yellow-950/60 text-yellow-200/50 hover:bg-black/50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={contents.scouting}
                    onChange={() => {}}
                    className="mt-0.5 w-4 h-4 rounded border-yellow-800 text-yellow-500 focus:ring-yellow-500 bg-black cursor-pointer"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 text-xs font-bold">
                      <Users className="h-3.5 w-3.5 text-yellow-400 shrink-0" />
                      <span>Scouting de jogadores</span>
                    </div>
                    <p className="text-[10px] text-yellow-200/60 mt-0.5 truncate">
                      Análise individual, ações e pontos fortes/atenção
                    </p>
                  </div>
                </label>

                {/* 7. Destaques */}
                <label
                  onClick={() => toggleContent('destaques')}
                  className={`flex items-start gap-2.5 p-2.5 rounded-xl border transition-all cursor-pointer select-none ${
                    contents.destaques
                      ? 'bg-yellow-500/15 border-yellow-500/50 text-yellow-100 shadow-sm'
                      : 'bg-black/30 border-yellow-950/60 text-yellow-200/50 hover:bg-black/50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={contents.destaques}
                    onChange={() => {}}
                    className="mt-0.5 w-4 h-4 rounded border-yellow-800 text-yellow-500 focus:ring-yellow-500 bg-black cursor-pointer"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 text-xs font-bold">
                      <Star className="h-3.5 w-3.5 text-yellow-400 shrink-0" />
                      <span>Destaques</span>
                    </div>
                    <p className="text-[10px] text-yellow-200/60 mt-0.5 truncate">
                      Melhor ofensivo, defensivo e momento chave
                    </p>
                  </div>
                </label>

                {/* 8. Relatório PDF */}
                <label
                  onClick={() => toggleContent('pdf')}
                  className={`flex items-start gap-2.5 p-2.5 rounded-xl border transition-all cursor-pointer select-none ${
                    contents.pdf
                      ? 'bg-yellow-500/15 border-yellow-500/50 text-yellow-100 shadow-sm'
                      : 'bg-black/30 border-yellow-950/60 text-yellow-200/50 hover:bg-black/50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={contents.pdf}
                    onChange={() => {}}
                    className="mt-0.5 w-4 h-4 rounded border-yellow-800 text-yellow-500 focus:ring-yellow-500 bg-black cursor-pointer"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 text-xs font-bold">
                      <FileText className="h-3.5 w-3.5 text-yellow-400 shrink-0" />
                      <span>Relatório PDF</span>
                    </div>
                    <p className="text-[10px] text-yellow-200/60 mt-0.5 truncate">
                      Documento vetorial completo para download
                    </p>
                  </div>
                </label>
              </div>
            </div>

            {/* Target selection */}
            <div className="space-y-1.5 pt-1">
              <label className="block text-xs font-bold text-yellow-300 uppercase tracking-wider">
                Destino do Disparo
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setTarget('all')}
                  className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    target === 'all'
                      ? 'bg-yellow-500/20 border-yellow-400 text-yellow-200 shadow-sm font-extrabold'
                      : 'bg-black/40 border-yellow-900/30 text-yellow-200/60 hover:text-yellow-100 hover:bg-black/60'
                  }`}
                >
                  <span>Ambos (Canal + VIP)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTarget('channel')}
                  className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    target === 'channel'
                      ? 'bg-yellow-500/20 border-yellow-400 text-yellow-200 shadow-sm font-extrabold'
                      : 'bg-black/40 border-yellow-900/30 text-yellow-200/60 hover:text-yellow-100 hover:bg-black/60'
                  }`}
                >
                  <span>Canal Público</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTarget('vip')}
                  className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    target === 'vip'
                      ? 'bg-yellow-500/20 border-yellow-400 text-yellow-200 shadow-sm font-extrabold'
                      : 'bg-black/40 border-yellow-900/30 text-yellow-200/60 hover:text-yellow-100 hover:bg-black/60'
                  }`}
                >
                  <span>Grupo VIP</span>
                </button>
              </div>
            </div>

            {/* Custom Note */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-yellow-300 uppercase tracking-wider">
                Comentário / Nota Adicional (Opcional)
              </label>
              <textarea
                rows={2}
                placeholder="ex: Análise exclusiva pós-jogo para membros VIP."
                value={customNote}
                onChange={(e) => setCustomNote(e.target.value)}
                className="w-full bg-black/60 border border-yellow-900/40 rounded-xl px-3.5 py-2 text-xs text-yellow-50 focus:border-yellow-500 focus:outline-none resize-none"
              />
            </div>

            {/* Results Feedback */}
            {result && (
              <div
                className={`p-3.5 rounded-xl text-xs font-semibold space-y-2 ${
                  result.success
                    ? 'bg-green-950/60 border border-green-700/60 text-green-300'
                    : 'bg-red-950/60 border border-red-700/60 text-red-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  {result.success ? (
                    <CheckCircle className="h-4 w-4 shrink-0 text-green-400" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 shrink-0 text-red-400" />
                  )}
                  <span className="font-bold">
                    {result.success
                      ? `Publicação realizada com sucesso no Telegram (${result.deliveredCount} entregas)!`
                      : 'Falha na publicação do Telegram.'}
                  </span>
                </div>

                {result.itemsSent && result.itemsSent.length > 0 && (
                  <div className="text-[11px] text-green-200/80 pl-6 space-y-0.5">
                    <span className="font-bold text-green-300">Itens transmitidos:</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {result.itemsSent.map((item, idx) => (
                        <span key={idx} className="bg-green-900/60 text-green-200 border border-green-700/50 px-2 py-0.5 rounded text-[10px]">
                          ✓ {item}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {result.errors.length > 0 && (
                  <ul className="text-[11px] list-disc list-inside font-mono text-red-300/90 pl-1 space-y-0.5">
                    {result.errors.map((err, idx) => (
                      <li key={idx}>{err}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="bg-[#200101] border-t border-yellow-900/40 px-5 py-3.5 flex items-center justify-between shrink-0">
            <div className="text-[11px] text-yellow-300/70">
              {isPublishing ? (
                <span className="flex items-center gap-1.5 text-yellow-400 animate-pulse">
                  <Activity className="h-3.5 w-3.5 animate-spin" />
                  {publishingStep || 'Processando envio...'}
                </span>
              ) : (
                <span>Ordem estrita de transmissão tática</span>
              )}
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={isPublishing}
                className="px-4 py-2 bg-transparent text-yellow-300 border border-yellow-700/40 font-bold text-xs rounded-xl hover:bg-yellow-900/20 transition-colors cursor-pointer disabled:opacity-50"
              >
                Fechar
              </button>
              <button
                type="submit"
                disabled={isPublishing || selectedCount === 0}
                className="bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-400 hover:to-yellow-500 disabled:opacity-50 text-black font-black text-xs px-5 py-2.5 rounded-xl transition-all cursor-pointer flex items-center gap-2 shadow-md hover:shadow-yellow-500/20"
              >
                {isPublishing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Publicando...</span>
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    <span>Publicar Agora ({selectedCount})</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );

  // Render directly into document.body to break out of any transformed/filtered parents
  if (typeof document !== 'undefined') {
    return createPortal(modalContent, document.body);
  }

  return modalContent;
};
