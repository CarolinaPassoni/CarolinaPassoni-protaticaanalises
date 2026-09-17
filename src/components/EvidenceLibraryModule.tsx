import React, { useState, useEffect } from 'react';
import { 
  Bookmark, 
  Trash2, 
  Clock, 
  ShieldCheck, 
  ExternalLink, 
  Layers, 
  Filter, 
  Search,
  Sparkles
} from 'lucide-react';
import { getAuthHeaders } from '../services/geminiService';

export interface TacticalEvidence {
  id: string;
  userId?: string;
  analysisId?: string;
  category: string;
  title: string;
  timestamp: string;
  description: string;
  team?: string;
  source?: string;
  confidence?: string;
  videoUrl?: string;
  createdAt: string;
}

interface EvidenceLibraryModuleProps {
  onOpenAnalysis: (id: string) => void;
  onNavigate: (view: string) => void;
}

export const EvidenceLibraryModule: React.FC<EvidenceLibraryModuleProps> = ({
  onOpenAnalysis,
  onNavigate,
}) => {
  const [evidences, setEvidences] = useState<TacticalEvidence[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>('TODAS');
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const fetchEvidences = async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/tactical/evidences', {
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        setEvidences(data.evidences || []);
      }
    } catch (err) {
      console.error('Erro ao listar biblioteca de evidências:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchEvidences();
  }, []);

  const handleDeleteEvidence = async (id: string) => {
    if (!confirm('Deseja remover este lance da biblioteca de evidências?')) return;
    try {
      const res = await fetch(`/api/tactical/evidences/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        setEvidences((prev) => prev.filter((e) => e.id !== id));
      }
    } catch (err) {
      console.error('Erro ao deletar evidência:', err);
    }
  };

  const categories = [
    'TODAS',
    'ATAQUE',
    'DEFESA',
    'PRESSÃO',
    'TRANSIÇÃO',
    'FINALIZAÇÃO',
    'BOLA PARADA',
  ];

  const filteredEvidences = evidences.filter((e) => {
    const matchesCategory = activeCategory === 'TODAS' || e.category.toUpperCase() === activeCategory;
    const matchesSearch = 
      (e.title || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (e.description || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (e.team || '').toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="bg-[#2a0101]/80 border border-yellow-500/30 rounded-2xl p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-yellow-400">
            <Bookmark className="h-4 w-4" />
            Acervo de Recortes & Momentos-Chave
          </div>
          <h2 className="text-2xl md:text-3xl font-extrabold text-white">
            BIBLIOTECA DE EVIDÊNCIAS
          </h2>
          <p className="text-xs md:text-sm text-yellow-100/70">
            Coleção de lances, comportamentos táticos e ocorrências validadas para palestras e reuniões táticas.
          </p>
        </div>

        {/* Search Input */}
        <div className="relative w-full md:w-72">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-yellow-400/60" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por lance, fase ou time..."
            className="w-full bg-black/40 border border-yellow-900/50 rounded-xl pl-9 pr-3 py-2 text-xs text-yellow-50 placeholder-yellow-200/40 focus:border-yellow-500 focus:outline-none"
          />
        </div>
      </div>

      {/* Category Filter Tabs */}
      <div className="flex flex-wrap gap-1.5 border-b border-yellow-900/30 pb-3">
        {categories.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setActiveCategory(cat)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeCategory === cat
                ? 'bg-yellow-500 text-black shadow-md'
                : 'bg-black/30 text-yellow-200/70 border border-yellow-900/30 hover:bg-yellow-950/40'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Evidences Grid */}
      {filteredEvidences.length === 0 ? (
        <div className="bg-[#2a0101]/60 border border-yellow-900/40 rounded-2xl p-10 text-center space-y-3">
          <Bookmark className="h-10 w-10 text-yellow-500/40 mx-auto" />
          <h3 className="text-base font-bold text-yellow-200">
            Nenhuma evidência tática salva na biblioteca.
          </h3>
          <p className="text-xs text-yellow-100/60 max-w-md mx-auto">
            Ao analisar partidas, clique no botão "Salvar Evidência" na linha do tempo para montar o seu banco de recortes táticos.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredEvidences.map((item) => (
            <div
              key={item.id}
              className="bg-[#2a0101]/80 hover:bg-[#320202] border border-yellow-900/40 hover:border-yellow-500/40 rounded-2xl p-4 transition-all flex flex-col justify-between space-y-3 shadow-md group"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-mono font-bold bg-yellow-500/20 text-yellow-300 px-2 py-0.5 rounded border border-yellow-500/30">
                    {item.timestamp}
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-black/40 text-yellow-400 border border-yellow-900/40 uppercase">
                    {item.category}
                  </span>
                </div>

                <h4 className="text-xs font-bold text-white group-hover:text-yellow-200 line-clamp-1">
                  {item.title}
                </h4>

                <p className="text-xs text-yellow-50/90 font-medium leading-relaxed line-clamp-3">
                  {item.description}
                </p>

                {item.team && (
                  <div className="text-[10px] text-yellow-200/50">
                    Equipe: <strong className="text-yellow-300">{item.team}</strong>
                  </div>
                )}
              </div>

              <div className="pt-2 border-t border-yellow-900/30 flex items-center justify-between text-xs">
                {item.analysisId ? (
                  <button
                    type="button"
                    onClick={() => onOpenAnalysis(item.analysisId!)}
                    className="text-yellow-400 hover:text-yellow-300 font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <span>Ver Análise</span>
                    <ExternalLink className="h-3 w-3" />
                  </button>
                ) : (
                  <span className="text-[10px] text-yellow-200/40">Evidência avulsa</span>
                )}

                <button
                  type="button"
                  onClick={() => handleDeleteEvidence(item.id)}
                  className="text-yellow-100/30 hover:text-red-400 p-1 cursor-pointer"
                  title="Remover Evidência"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
