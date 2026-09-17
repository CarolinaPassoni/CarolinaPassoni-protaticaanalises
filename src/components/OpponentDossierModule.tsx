import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Plus, 
  ShieldAlert, 
  ShieldCheck, 
  CheckSquare, 
  Square, 
  Users, 
  Trash2, 
  Clock, 
  Sparkles, 
  Layers, 
  TrendingUp, 
  AlertTriangle,
  ArrowRight,
  Loader2,
  FileText
} from 'lucide-react';
import { AnalysisHistoryItem } from '../types';
import { getAuthHeaders } from '../services/geminiService';

interface OpponentDossier {
  id: string;
  opponentName: string;
  analyzedMatchesCount: number;
  matchesIds: string[];
  payload: any;
  createdAt: string;
}

interface OpponentDossierModuleProps {
  analyses: AnalysisHistoryItem[];
  onOpenAnalysis: (id: string) => void;
  onNavigate: (view: string) => void;
}

export const OpponentDossierModule: React.FC<OpponentDossierModuleProps> = ({
  analyses,
  onOpenAnalysis,
  onNavigate,
}) => {
  const [dossiers, setDossiers] = useState<OpponentDossier[]>([]);
  const [selectedDossier, setSelectedDossier] = useState<OpponentDossier | null>(null);
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Wizard state
  const [opponentNameInput, setOpponentNameInput] = useState('');
  const [selectedMatchIds, setSelectedMatchIds] = useState<string[]>([]);

  const fetchDossiers = async () => {
    try {
      const res = await fetch('/api/tactical/dossiers', {
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        setDossiers(data.dossiers || []);
        if (data.dossiers && data.dossiers.length > 0 && !selectedDossier) {
          setSelectedDossier(data.dossiers[0]);
        }
      }
    } catch (err) {
      console.error('Erro ao listar dossiês:', err);
    }
  };

  useEffect(() => {
    fetchDossiers();
  }, []);

  const handleToggleMatch = (id: string) => {
    setSelectedMatchIds((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]
    );
  };

  const handleGenerateDossier = async () => {
    if (!opponentNameInput.trim() || selectedMatchIds.length === 0) {
      setError('Por favor, informe o nome do adversário e selecione ao menos 1 partida analisada.');
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      // 1. Generate with Gemini
      const genRes = await fetch('/api/tactical/dossiers/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          opponentName: opponentNameInput.trim(),
          matchIds: selectedMatchIds,
        }),
      });

      if (!genRes.ok) {
        throw new Error('Falha ao gerar dossiê tático com o motor de IA.');
      }

      const genData = await genRes.json();
      const payload = genData.dossier;

      // 2. Save into SQLite
      const saveRes = await fetch('/api/tactical/dossiers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          opponentName: opponentNameInput.trim(),
          analyzedMatchesCount: selectedMatchIds.length,
          matchesIds: selectedMatchIds,
          payload,
        }),
      });

      if (saveRes.ok) {
        const savedData = await saveRes.json();
        setDossiers((prev) => [savedData.dossier, ...prev]);
        setSelectedDossier(savedData.dossier);
        setIsWizardOpen(false);
        setOpponentNameInput('');
        setSelectedMatchIds([]);
      }
    } catch (err: any) {
      setError(err.message || 'Erro inesperado ao gerar dossiê.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDeleteDossier = async (id: string) => {
    if (!confirm('Deseja realmente remover este dossiê?')) return;
    try {
      const res = await fetch(`/api/tactical/dossiers/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        setDossiers((prev) => prev.filter((d) => d.id !== id));
        if (selectedDossier?.id === id) {
          const rem = dossiers.filter((d) => d.id !== id);
          setSelectedDossier(rem.length > 0 ? rem[0] : null);
        }
      }
    } catch (err) {
      console.error('Erro ao deletar dossiê:', err);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="bg-[#2a0101]/80 border border-yellow-500/30 rounded-2xl p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-yellow-400">
            <Search className="h-4 w-4" />
            Mapeamento Estratégico de Oponentes
          </div>
          <h2 className="text-2xl md:text-3xl font-extrabold text-white">
            DOSSIÊ DO ADVERSÁRIO
          </h2>
          <p className="text-xs md:text-sm text-yellow-100/70">
            Consolidação de padrões táticos, vulnerabilidades defensivas e plano de neutralização.
          </p>
        </div>

        <button
          onClick={() => {
            setError(null);
            setIsWizardOpen(true);
          }}
          className="px-4 py-2.5 bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-400 hover:to-yellow-500 text-black font-bold text-xs rounded-xl transition-all shadow-md flex items-center gap-1.5 cursor-pointer shrink-0"
        >
          <Plus className="h-4 w-4" />
          Novo Dossiê
        </button>
      </div>

      {/* Wizard Modal */}
      {isWizardOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-[#1a0000] border border-yellow-500/40 rounded-2xl w-full max-w-xl p-6 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-yellow-900/40 pb-3">
              <h3 className="text-base font-bold text-yellow-200">Gerador de Dossiê Tático do Adversário</h3>
              <button
                onClick={() => setIsWizardOpen(false)}
                className="text-yellow-200/50 hover:text-yellow-100 text-sm"
              >
                ✕
              </button>
            </div>

            {error && (
              <div className="bg-red-950/60 border border-red-500/40 text-red-300 p-3 rounded-xl text-xs">
                {error}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-yellow-200/80 mb-1 uppercase tracking-wider">
                  1. Nome do Adversário *
                </label>
                <input
                  type="text"
                  required
                  value={opponentNameInput}
                  onChange={(e) => setOpponentNameInput(e.target.value)}
                  placeholder="Ex: Santos FC, Manchester City, Boca Juniors..."
                  className="w-full bg-black/40 border border-yellow-900/50 rounded-xl px-3 py-2 text-xs text-yellow-50 focus:border-yellow-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-yellow-200/80 mb-1 uppercase tracking-wider">
                  2. Selecione as Partidas Analisadas ({selectedMatchIds.length} selecionadas) *
                </label>
                <p className="text-[10px] text-yellow-100/50 mb-2">
                  Selecione pelo menos duas partidas do adversário para gerar padrões precisos.
                </p>

                {analyses.length === 0 ? (
                  <div className="p-4 bg-black/30 rounded-xl text-xs text-yellow-100/60 text-center">
                    Nenhuma partida analisada no sistema. Faça análises de vídeo antes de gerar o dossiê.
                  </div>
                ) : (
                  <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                    {analyses.map((a) => {
                      const isChecked = selectedMatchIds.includes(a.id);
                      return (
                        <div
                          key={a.id}
                          onClick={() => handleToggleMatch(a.id)}
                          className={`p-2.5 rounded-xl border flex items-center gap-2.5 cursor-pointer text-xs transition-colors ${
                            isChecked
                              ? 'bg-yellow-950/60 border-yellow-500/60 text-yellow-100'
                              : 'bg-black/30 border-yellow-900/30 text-yellow-200/60 hover:bg-black/50'
                          }`}
                        >
                          {isChecked ? (
                            <CheckSquare className="h-4 w-4 text-yellow-400 shrink-0" />
                          ) : (
                            <Square className="h-4 w-4 text-yellow-200/40 shrink-0" />
                          )}
                          <div className="truncate flex-grow">
                            <span className="font-bold">{a.title}</span>
                            <span className="block text-[10px] text-yellow-200/40">
                              {new Date(a.created_at).toLocaleDateString('pt-BR')} · {a.score || 'Placar N/A'}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="pt-3 border-t border-yellow-900/30 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsWizardOpen(false)}
                className="px-3 py-2 bg-black/40 text-yellow-200 text-xs font-bold rounded-xl border border-yellow-900/40"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isGenerating || !opponentNameInput.trim() || selectedMatchIds.length === 0}
                onClick={handleGenerateDossier}
                className="px-4 py-2 bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-400 hover:to-yellow-500 text-black text-xs font-bold rounded-xl flex items-center gap-1.5 disabled:opacity-40"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Sintetizando Padrões...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>Gerar Dossiê</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dossiers Selection & Display */}
      {dossiers.length === 0 ? (
        <div className="bg-[#2a0101]/60 border border-yellow-900/40 rounded-2xl p-10 text-center space-y-3">
          <Search className="h-10 w-10 text-yellow-500/40 mx-auto" />
          <h3 className="text-base font-bold text-yellow-200">
            Nenhum dossiê de adversário gerado até o momento.
          </h3>
          <p className="text-xs text-yellow-100/60 max-w-md mx-auto">
            Selecione pelo menos duas partidas do adversário para gerar padrões recorrentes e estratégias de enfrentamento.
          </p>
          <button
            onClick={() => setIsWizardOpen(true)}
            className="mt-2 px-4 py-2 bg-yellow-500 text-black font-bold text-xs rounded-xl cursor-pointer"
          >
            Criar Primeiro Dossiê
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar list of dossiers */}
          <div className="space-y-2">
            <span className="text-xs font-bold text-yellow-200/80 uppercase tracking-wider block px-1">
              Dossiês Disponíveis ({dossiers.length})
            </span>
            {dossiers.map((d) => (
              <div
                key={d.id}
                onClick={() => setSelectedDossier(d)}
                className={`p-3.5 rounded-xl border cursor-pointer flex items-center justify-between transition-all ${
                  selectedDossier?.id === d.id
                    ? 'bg-yellow-950/70 border-yellow-500 text-yellow-200 shadow-md'
                    : 'bg-black/30 border-yellow-900/30 text-yellow-100/60 hover:border-yellow-800'
                }`}
              >
                <div className="space-y-0.5 max-w-[80%]">
                  <h4 className="text-xs font-bold truncate text-white">{d.opponentName}</h4>
                  <span className="text-[10px] text-yellow-200/50 font-mono block">
                    {d.analyzedMatchesCount} partida(s) analisada(s)
                  </span>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteDossier(d.id);
                  }}
                  className="text-yellow-100/30 hover:text-red-400 p-1"
                  title="Remover Dossiê"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>

          {/* Dossier Content Viewer */}
          <div className="lg:col-span-3">
            {selectedDossier && selectedDossier.payload && (
              <div className="bg-[#2a0101]/80 border border-yellow-500/30 rounded-2xl p-6 space-y-6 shadow-xl">
                {/* Dossier Top Banner */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-yellow-900/40 pb-4">
                  <div>
                    <span className="text-[10px] font-black text-yellow-500 uppercase tracking-widest">
                      Dossiê Tático Completo
                    </span>
                    <h3 className="text-xl font-extrabold text-white">
                      {selectedDossier.opponentName}
                    </h3>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-bold text-emerald-400 bg-emerald-950/60 px-2 py-1 rounded border border-emerald-500/40">
                      {selectedDossier.analyzedMatchesCount} Jogos Mapeados
                    </span>
                  </div>
                </div>

                {/* Formations & Tactical System */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-black/30 border border-yellow-900/30 rounded-xl p-4 space-y-1.5">
                    <span className="text-[10px] font-bold text-yellow-200/60 uppercase tracking-wider">
                      Formação Mais Utilizada
                    </span>
                    <div className="text-base font-bold text-yellow-300">
                      {selectedDossier.payload.mostUsedFormation || '4-3-3 / 4-2-3-1'}
                    </div>
                  </div>

                  <div className="bg-black/30 border border-yellow-900/30 rounded-xl p-4 space-y-1.5">
                    <span className="text-[10px] font-bold text-yellow-200/60 uppercase tracking-wider">
                      Variações Táticas
                    </span>
                    <div className="text-xs text-yellow-100/90 font-medium">
                      {Array.isArray(selectedDossier.payload.tacticalVariations)
                        ? selectedDossier.payload.tacticalVariations.join(', ')
                        : selectedDossier.payload.tacticalVariations || 'Variações durante transição'}
                    </div>
                  </div>
                </div>

                {/* Tactical Phases */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-black/30 border border-yellow-900/30 rounded-xl p-4 space-y-2">
                    <span className="text-xs font-bold text-yellow-400 uppercase tracking-wider">
                      Saída de Bola & Construção
                    </span>
                    <p className="text-xs text-yellow-50/90 leading-relaxed">
                      {selectedDossier.payload.buildUpPlay || 'Saída sustentada com primeiro volante recuando.'}
                    </p>
                  </div>

                  <div className="bg-black/30 border border-yellow-900/30 rounded-xl p-4 space-y-2">
                    <span className="text-xs font-bold text-yellow-400 uppercase tracking-wider">
                      Comportamento de Pressão
                    </span>
                    <p className="text-xs text-yellow-50/90 leading-relaxed">
                      {selectedDossier.payload.pressingStyle || 'Pressão em bloco médio orientada ao portador da bola.'}
                    </p>
                  </div>

                  <div className="bg-black/30 border border-yellow-900/30 rounded-xl p-4 space-y-2">
                    <span className="text-xs font-bold text-yellow-400 uppercase tracking-wider">
                      Transição Ofensiva (Contra-Ataque)
                    </span>
                    <p className="text-xs text-yellow-50/90 leading-relaxed">
                      {selectedDossier.payload.offensiveTransition || 'Verticalidade imediata buscando pontas em velocidade.'}
                    </p>
                  </div>

                  <div className="bg-black/30 border border-yellow-900/30 rounded-xl p-4 space-y-2">
                    <span className="text-xs font-bold text-yellow-400 uppercase tracking-wider">
                      Transição Defensiva & Recomposição
                    </span>
                    <p className="text-xs text-yellow-50/90 leading-relaxed">
                      {selectedDossier.payload.defensiveTransition || 'Recomposição rápida com vulnerabilidade nas costas dos alas.'}
                    </p>
                  </div>
                </div>

                {/* Strengths & Vulnerabilities */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-emerald-950/20 border border-emerald-500/30 rounded-xl p-4 space-y-2">
                    <span className="text-xs font-black text-emerald-400 uppercase tracking-wider">
                      Pontos Fortes
                    </span>
                    <ul className="text-xs text-emerald-100/90 space-y-1 list-disc list-inside">
                      {Array.isArray(selectedDossier.payload.strengths) ? (
                        selectedDossier.payload.strengths.map((s: string, idx: number) => (
                          <li key={idx}>{s}</li>
                        ))
                      ) : (
                        <li>{selectedDossier.payload.strengths}</li>
                      )}
                    </ul>
                  </div>

                  <div className="bg-red-950/20 border border-red-500/30 rounded-xl p-4 space-y-2">
                    <span className="text-xs font-black text-red-400 uppercase tracking-wider">
                      Vulnerabilidades Exploráveis
                    </span>
                    <ul className="text-xs text-red-100/90 space-y-1 list-disc list-inside">
                      {Array.isArray(selectedDossier.payload.vulnerabilities) ? (
                        selectedDossier.payload.vulnerabilities.map((v: string, idx: number) => (
                          <li key={idx}>{v}</li>
                        ))
                      ) : (
                        <li>{selectedDossier.payload.vulnerabilities}</li>
                      )}
                    </ul>
                  </div>
                </div>

                {/* HOW TO EXPLOIT / COMO ENFRENTAR ESTE ADVERSÁRIO */}
                <div className="bg-gradient-to-br from-yellow-950/50 to-black border-2 border-yellow-500/50 rounded-2xl p-5 space-y-4">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-yellow-400" />
                    <h4 className="text-base font-black text-yellow-200 uppercase tracking-wide">
                      COMO ENFRENTAR ESTE ADVERSÁRIO?
                    </h4>
                  </div>

                  <div className="space-y-3">
                    {Array.isArray(selectedDossier.payload.howToExploit) &&
                    selectedDossier.payload.howToExploit.length > 0 ? (
                      selectedDossier.payload.howToExploit.map((item: any, idx: number) => (
                        <div
                          key={idx}
                          className="bg-black/50 border border-yellow-900/40 rounded-xl p-3.5 space-y-1.5"
                        >
                          <div className="flex items-center justify-between text-[10px]">
                            <span className="text-yellow-400 font-bold">
                              Diretriz #{idx + 1} · {item.occurrencesInMatches || 'Confirmada'}
                            </span>
                            <span className="text-emerald-400 font-bold">
                              Confiança: {item.confidenceLevel || 'Alta'}
                            </span>
                          </div>
                          <p className="text-xs text-yellow-50 font-semibold leading-relaxed">
                            {item.conclusion}
                          </p>
                          {item.relatedEvidence && (
                            <p className="text-[10px] text-yellow-200/60 italic">
                              Evidência: {item.relatedEvidence}
                            </p>
                          )}
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-yellow-100/80">
                        Atrair a pressão adversária e explorar a velocidade nas transições ofensivas atacando o espaço entrelinhas.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
