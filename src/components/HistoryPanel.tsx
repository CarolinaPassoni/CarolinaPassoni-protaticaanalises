import React from 'react';
import type { AnalysisHistoryItem } from '../types';
import { Trash2 } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

interface HistoryPanelProps {
  items: AnalysisHistoryItem[];
  activeId?: string;
  onOpen: (id: string) => void;
  onDelete?: (id: string) => void;
  isLoading?: boolean;
}

const formatDate = (value?: string, language: string = 'pt') => {
  if (!value) return language === 'pt' ? 'sem data' : language === 'en' ? 'no date' : 'sin fecha';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(language === 'pt' ? 'pt-BR' : language === 'en' ? 'en-US' : 'es-ES');
};

const HistoryPanel: React.FC<HistoryPanelProps> = ({ items, activeId, onOpen, onDelete, isLoading = false }) => {
  const { t, language } = useLanguage();

  const handleDeleteClick = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (onDelete && window.confirm(language === 'pt' ? 'Tem certeza de que deseja remover esta análise permanentemente do banco?' : language === 'en' ? 'Are you sure you want to permanently remove this analysis from the database?' : '¿Está seguro de que desea eliminar permanentemente este análisis de la base de datos?')) {
      onDelete(id);
    }
  };

  return (
    <div className="bg-[#2a0101]/60 rounded-xl shadow-2xl border border-yellow-900/50 p-4 md:p-5 print:hidden">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div>
          <h3 className="text-yellow-200 font-bold text-lg">
            {language === 'pt' ? 'Banco de análises' : language === 'en' ? 'Analysis Bank' : 'Banco de Análisis'}
          </h3>
          <p className="text-yellow-300/70 text-sm">
            {language === 'pt' ? 'Histórico salvo no SQLite local.' : language === 'en' ? 'History saved in local SQLite.' : 'Historial guardado en SQLite local.'}
          </p>
        </div>
        <span className="text-xs uppercase tracking-wider text-yellow-400/70">
          {items.length} {language === 'pt' ? 'registro(s)' : language === 'en' ? 'record(s)' : 'registro(s)'}
        </span>
      </div>

      {items.length === 0 ? (
        <div className="text-yellow-100/70 text-sm border border-yellow-900/30 rounded-lg p-4 bg-black/20">
          {language === 'pt' ? 'Nenhuma análise salva ainda. Faça uma análise para registrar a partida no banco local.' : language === 'en' ? 'No analysis saved yet. Make an analysis to register the match in the local database.' : 'Ningún análisis guardado aún. Realice un análisis para registrar el partido en la base de datos local.'}
        </div>
      ) : (
        <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
          {items.map((item) => {
            const isActive = item.id === activeId;
            return (
              <div key={item.id} className="relative group">
                <button
                  type="button"
                  onClick={() => onOpen(item.id)}
                  disabled={isLoading}
                  className={`w-full text-left rounded-lg border p-4 transition-colors pr-10 ${isActive ? 'border-yellow-500 bg-yellow-900/20' : 'border-yellow-900/30 bg-black/20 hover:bg-black/30'}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="text-yellow-105 font-semibold leading-snug break-words">{item.videoTitle || `${item.timeA || 'Time A'} x ${item.timeB || 'Time B'}`}</div>
                      <div className="text-yellow-300/70 text-xs mt-1">{formatDate(item.createdAt, language)}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-yellow-200 font-bold">{item.placar || '—'}</div>
                      <div className="text-[10px] text-yellow-300/60 uppercase tracking-widest">{item.confidence || 'alta'}</div>
                    </div>
                  </div>
                  <div className="mt-2 text-sm text-yellow-101/80">{item.timeA || 'Time A'} x {item.timeB || 'Time B'}</div>
                </button>
                
                {onDelete && (
                  <button
                    type="button"
                    onClick={(e) => handleDeleteClick(e, item.id)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 focus:opacity-100 p-2 text-yellow-500/60 hover:text-red-500 hover:bg-red-950/40 rounded-md transition-all duration-200 cursor-pointer"
                    title={language === 'pt' ? 'Excluir do histórico' : language === 'en' ? 'Delete from history' : 'Eliminar del historial'}
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default HistoryPanel;
