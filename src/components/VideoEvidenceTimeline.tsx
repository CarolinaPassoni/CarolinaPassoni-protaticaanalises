import React, { useState } from 'react';
import { 
  Clock, 
  Bookmark, 
  Play, 
  ShieldCheck, 
  Filter, 
  Check, 
  AlertCircle, 
  Eye, 
  Layers,
  Sparkles
} from 'lucide-react';
import { Analysis } from '../types';
import { getAuthHeaders } from '../services/geminiService';

interface VideoEvidenceTimelineProps {
  analysis: Analysis;
  onSeekTimestamp?: (seconds: number) => void;
}

export const VideoEvidenceTimeline: React.FC<VideoEvidenceTimelineProps> = ({
  analysis,
  onSeekTimestamp,
}) => {
  const [activeFilter, setActiveFilter] = useState<string>('TODOS');
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [savingId, setSavingId] = useState<string | null>(null);

  // Normalize moments and timeline events
  const rawEvents: any[] = analysis.linhaDoTempo || 
    (typeof analysis.momentosChave === 'string' 
      ? analysis.momentosChave.split('\n').filter(Boolean) 
      : (analysis as any).momentosChave || []);
  
  // Categorization heuristics
  const getCategory = (desc: string = ''): string => {
    const text = desc.toLowerCase();
    if (text.includes('falta') || text.includes('escanteio') || text.includes('pênalti') || text.includes('penalti') || text.includes('bola parada')) return 'BOLA PARADA';
    if (text.includes('gol') || text.includes('chute') || text.includes('finaliz') || text.includes('trave') || text.includes('cabeceio')) return 'FINALIZAÇÃO';
    if (text.includes('pressão') || text.includes('bloco alto') || text.includes('desarme') || text.includes('recuper')) return 'PRESSÃO';
    if (text.includes('transição') || text.includes('contra-ataque') || text.includes('recomposição')) return 'TRANSIÇÃO';
    if (text.includes('defesa') || text.includes('zaga') || text.includes('lateral') || text.includes('cobertura') || text.includes('vulnerabilidade')) return 'DEFESA';
    if (text.includes('ataque') || text.includes('criação') || text.includes('passe') || text.includes('cruzamento')) return 'ATAQUE';
    return 'GERAL';
  };

  const parsedEvents = rawEvents.map((item: any, idx: number) => {
    let timestampLabel = 'Timestamp não confirmado';
    let timestampSeconds = 0;
    let description = '';

    if (typeof item === 'string') {
      const match = item.match(/^(\d{1,2}:\d{2}(?::\d{2})?|\d+['’]|\d+\s*min)\s*[-—:]?\s*(.*)$/i);
      if (match) {
        timestampLabel = match[1];
        description = match[2] || item;
        // calculate approximate seconds
        const timeParts = timestampLabel.replace(/['’min]/g, '').split(':').map(Number);
        if (timeParts.length === 2) timestampSeconds = timeParts[0] * 60 + timeParts[1];
        else if (timeParts.length === 1) timestampSeconds = timeParts[0] * 60;
      } else {
        description = item;
      }
    } else if (typeof item === 'object' && item !== null) {
      timestampLabel = item.timestamp || item.tempo || item.minuto || 'Timestamp não confirmado';
      description = item.descricao || item.description || item.evento || item.acao || JSON.stringify(item);
      if (item.timestampSeconds) timestampSeconds = item.timestampSeconds;
    }

    const category = getCategory(description);
    return {
      id: `${analysis.analysisId || 'match'}-${idx}`,
      timestampLabel,
      timestampSeconds,
      description,
      category,
      confidence: timestampLabel !== 'Timestamp não confirmado' ? 'Alta' : 'Média',
    };
  });

  const filteredEvents = activeFilter === 'TODOS'
    ? parsedEvents
    : parsedEvents.filter((e) => e.category === activeFilter);

  const handleSaveEvidence = async (event: any) => {
    setSavingId(event.id);
    try {
      const res = await fetch('/api/tactical/evidences', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          analysisId: analysis.analysisId,
          category: event.category,
          title: `${event.category} - ${event.timestampLabel}`,
          timestamp: event.timestampLabel,
          description: event.description,
          team: analysis.timeA || 'Equipe',
          source: 'Vídeo / Transcrição Confirmada',
          confidence: event.confidence,
          videoUrl: analysis.videoUrl || '',
        }),
      });

      if (res.ok) {
        setSavedIds((prev) => new Set([...prev, event.id]));
      }
    } catch (e) {
      console.error('Erro ao salvar evidência:', e);
    } finally {
      setSavingId(null);
    }
  };

  const categories = [
    'TODOS',
    'ATAQUE',
    'DEFESA',
    'PRESSÃO',
    'TRANSIÇÃO',
    'FINALIZAÇÃO',
    'BOLA PARADA',
  ];

  return (
    <div className="bg-[#2a0101]/80 border border-yellow-500/30 rounded-2xl p-5 shadow-xl space-y-4">
      {/* Title & Filter Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-yellow-900/40 pb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-yellow-500/10 text-yellow-400 border border-yellow-500/30">
            <Clock className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-yellow-200 uppercase tracking-wide">
              Linha do Tempo Tática & Evidências
            </h3>
            <p className="text-[11px] text-yellow-100/60">
              Momentos-chave confirmados do jogo organizados por fase e minuto
            </p>
          </div>
        </div>

        <span className="text-[10px] font-mono text-yellow-500/80 bg-yellow-950 px-2 py-0.5 rounded border border-yellow-900/40 w-fit">
          {filteredEvents.length} eventos listados
        </span>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap gap-1.5 pt-1 overflow-x-auto pb-1">
        {categories.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setActiveFilter(cat)}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeFilter === cat
                ? 'bg-yellow-500 text-black shadow-md'
                : 'bg-black/30 text-yellow-200/70 hover:bg-yellow-950/40 hover:text-yellow-100 border border-yellow-900/30'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Timeline List */}
      <div className="space-y-2.5 max-h-[420px] overflow-y-auto pr-1">
        {filteredEvents.length === 0 ? (
          <div className="p-6 text-center text-xs text-yellow-100/60 bg-black/20 rounded-xl border border-yellow-900/20">
            Nenhuma evidência catalogada nesta categoria para o trecho analisado.
          </div>
        ) : (
          filteredEvents.map((evt) => {
            const isSaved = savedIds.has(evt.id);
            return (
              <div
                key={evt.id}
                className="bg-black/40 hover:bg-yellow-950/20 border border-yellow-900/30 hover:border-yellow-500/40 rounded-xl p-3.5 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
              >
                <div className="space-y-1 flex-grow">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`text-xs font-black font-mono px-2 py-0.5 rounded ${
                        evt.timestampLabel !== 'Timestamp não confirmado'
                          ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30'
                          : 'bg-yellow-950/60 text-yellow-100/50 border border-yellow-900/30'
                      }`}
                    >
                      {evt.timestampLabel}
                    </span>

                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-black/50 text-yellow-400/80 border border-yellow-900/30 uppercase">
                      {evt.category}
                    </span>

                    <span className="text-[10px] text-emerald-400 font-medium flex items-center gap-1">
                      <ShieldCheck className="h-3 w-3" />
                      {evt.confidence}
                    </span>
                  </div>

                  <p className="text-xs text-yellow-50/90 font-medium pt-1">
                    {evt.description}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center pt-2 sm:pt-0">
                  {onSeekTimestamp && evt.timestampSeconds > 0 && (
                    <button
                      type="button"
                      onClick={() => onSeekTimestamp(evt.timestampSeconds)}
                      className="px-2.5 py-1.5 bg-yellow-500/15 hover:bg-yellow-500/30 text-yellow-300 text-xs font-bold rounded-lg border border-yellow-500/30 flex items-center gap-1 transition-all cursor-pointer"
                      title="Ir para o momento no vídeo"
                    >
                      <Play className="h-3 w-3 fill-current" />
                      <span>Ir ao Lance</span>
                    </button>
                  )}

                  <button
                    type="button"
                    disabled={isSaved || savingId === evt.id}
                    onClick={() => handleSaveEvidence(evt)}
                    className={`px-2.5 py-1.5 text-xs font-bold rounded-lg border flex items-center gap-1 transition-all cursor-pointer ${
                      isSaved
                        ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
                        : 'bg-black/40 hover:bg-yellow-900/40 border-yellow-900/40 text-yellow-200'
                    }`}
                  >
                    {isSaved ? (
                      <>
                        <Check className="h-3 w-3" />
                        <span>Salva</span>
                      </>
                    ) : (
                      <>
                        <Bookmark className="h-3 w-3" />
                        <span>Salvar Evidência</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
