import React, { useState, useEffect } from 'react';
import { 
  Dumbbell, 
  Plus, 
  Trash2, 
  Printer, 
  FileText, 
  Clock, 
  Users, 
  Layers, 
  CheckCircle, 
  TrendingUp, 
  AlertTriangle,
  Loader2,
  Sparkles,
  ArrowRight,
  Edit2
} from 'lucide-react';
import { AnalysisHistoryItem } from '../types';
import { getAuthHeaders } from '../services/geminiService';

export interface TrainingPlan {
  id: string;
  analysisId?: string;
  title: string;
  problemIdentified: string;
  objective: string;
  duration: string;
  playersCount: string;
  materials?: string;
  organization: string;
  execution: string;
  expectedBehaviors: string[];
  observationPoints: string[];
  progression?: string;
  regression?: string;
  nextMatchIndicators: string[];
  createdAt: string;
  updatedAt?: string;
}

interface TrainingPlansModuleProps {
  analyses: AnalysisHistoryItem[];
  initialProblem?: string | null;
  onNavigate: (view: string) => void;
}

export const TrainingPlansModule: React.FC<TrainingPlansModuleProps> = ({
  analyses,
  initialProblem,
  onNavigate,
}) => {
  const [plans, setPlans] = useState<TrainingPlan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<TrainingPlan | null>(null);
  const [isGeneratorOpen, setIsGeneratorOpen] = useState(Boolean(initialProblem));
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Generator Form state
  const [selectedAnalysisId, setSelectedAnalysisId] = useState<string>('');
  const [problemIdentifiedInput, setProblemIdentifiedInput] = useState<string>(initialProblem || '');
  const [customTitleInput, setCustomTitleInput] = useState<string>('');

  const fetchPlans = async () => {
    try {
      const res = await fetch('/api/tactical/training-plans', {
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        setPlans(data.plans || []);
        if (data.plans && data.plans.length > 0 && !selectedPlan) {
          setSelectedPlan(data.plans[0]);
        }
      }
    } catch (err) {
      console.error('Erro ao buscar planos de treino:', err);
    }
  };

  useEffect(() => {
    fetchPlans();
  }, []);

  useEffect(() => {
    if (initialProblem) {
      setProblemIdentifiedInput(initialProblem);
      setIsGeneratorOpen(true);
    }
  }, [initialProblem]);

  const handleGenerateAndSavePlan = async () => {
    if (!problemIdentifiedInput.trim()) {
      setError('Por favor, descreva o problema ou vulnerabilidade identificada.');
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      // 1. Generate plan using Gemini endpoint
      const genRes = await fetch('/api/tactical/training-plans/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          problemIdentified: problemIdentifiedInput.trim(),
          analysisId: selectedAnalysisId || undefined,
          customTitle: customTitleInput.trim() || undefined,
        }),
      });

      if (!genRes.ok) {
        throw new Error('Falha ao gerar proposta metodológica de treino.');
      }

      const genData = await genRes.json();
      const planPayload = genData.plan;

      // 2. Save into SQLite database
      const saveRes = await fetch('/api/tactical/training-plans', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify(planPayload),
      });

      if (saveRes.ok) {
        const savedData = await saveRes.json();
        setPlans((prev) => [savedData.plan, ...prev]);
        setSelectedPlan(savedData.plan);
        setIsGeneratorOpen(false);
        setProblemIdentifiedInput('');
        setCustomTitleInput('');
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao gerar plano de treino.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDeletePlan = async (id: string) => {
    if (!confirm('Deseja realmente remover este plano de treino?')) return;
    try {
      const res = await fetch(`/api/tactical/training-plans/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        setPlans((prev) => prev.filter((p) => p.id !== id));
        if (selectedPlan?.id === id) {
          const rem = plans.filter((p) => p.id !== id);
          setSelectedPlan(rem.length > 0 ? rem[0] : null);
        }
      }
    } catch (err) {
      console.error('Erro ao remover plano de treino:', err);
    }
  };

  const handlePrintPlan = () => {
    window.print();
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="bg-[#2a0101]/80 border border-yellow-500/30 rounded-2xl p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-yellow-400">
            <Dumbbell className="h-4 w-4" />
            Metodologia & Planos de Treino
          </div>
          <h2 className="text-2xl md:text-3xl font-extrabold text-white">
            PLANOS DE TREINAMENTO TÁTICO
          </h2>
          <p className="text-xs md:text-sm text-yellow-100/70">
            Transforme falhas detectadas em sessões de campo completas com objetivos, regras e progressões.
          </p>
        </div>

        <button
          onClick={() => {
            setError(null);
            setIsGeneratorOpen(true);
          }}
          className="px-4 py-2.5 bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-400 hover:to-yellow-500 text-black font-bold text-xs rounded-xl transition-all shadow-md flex items-center gap-1.5 cursor-pointer shrink-0"
        >
          <Plus className="h-4 w-4" />
          Gerar Plano de Treino
        </button>
      </div>

      {/* Generator Modal */}
      {isGeneratorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-[#1a0000] border border-yellow-500/40 rounded-2xl w-full max-w-xl p-6 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-yellow-900/40 pb-3">
              <h3 className="text-base font-bold text-yellow-200">Gerador Metodológico de Treino</h3>
              <button
                onClick={() => setIsGeneratorOpen(false)}
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
                  1. Vincular a uma Partida Analisada (Opcional)
                </label>
                <select
                  value={selectedAnalysisId}
                  onChange={(e) => setSelectedAnalysisId(e.target.value)}
                  className="w-full bg-black/40 border border-yellow-900/50 rounded-xl px-3 py-2 text-xs text-yellow-50 focus:border-yellow-500 focus:outline-none"
                >
                  <option value="">-- Treino Geral / Sem vínculo direto --</option>
                  {analyses.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.title} ({new Date(a.created_at).toLocaleDateString('pt-BR')})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-yellow-200/80 mb-1 uppercase tracking-wider">
                  2. Problema ou Vulnerabilidade a Corrigir *
                </label>
                <textarea
                  rows={3}
                  required
                  value={problemIdentifiedInput}
                  onChange={(e) => setProblemIdentifiedInput(e.target.value)}
                  placeholder="Ex: Espaço deixado nas costas dos laterais após subida ofensiva, ou lentidão na compactação do bloco médio..."
                  className="w-full bg-black/40 border border-yellow-900/50 rounded-xl px-3 py-2 text-xs text-yellow-50 placeholder-yellow-200/40 focus:border-yellow-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-yellow-200/80 mb-1 uppercase tracking-wider">
                  3. Título Personalizado (Opcional)
                </label>
                <input
                  type="text"
                  value={customTitleInput}
                  onChange={(e) => setCustomTitleInput(e.target.value)}
                  placeholder="Ex: Sessão Tática - Recomposição e Cobertura Defensiva"
                  className="w-full bg-black/40 border border-yellow-900/50 rounded-xl px-3 py-2 text-xs text-yellow-50 placeholder-yellow-200/40 focus:border-yellow-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-yellow-900/30 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsGeneratorOpen(false)}
                className="px-3 py-2 bg-black/40 text-yellow-200 text-xs font-bold rounded-xl border border-yellow-900/40"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isGenerating || !problemIdentifiedInput.trim()}
                onClick={handleGenerateAndSavePlan}
                className="px-4 py-2 bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-400 hover:to-yellow-500 text-black text-xs font-bold rounded-xl flex items-center gap-1.5 disabled:opacity-40"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Construindo Plano...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>Gerar e Salvar Plano</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Plans List & Active Plan View */}
      {plans.length === 0 ? (
        <div className="bg-[#2a0101]/60 border border-yellow-900/40 rounded-2xl p-10 text-center space-y-3">
          <Dumbbell className="h-10 w-10 text-yellow-500/40 mx-auto" />
          <h3 className="text-base font-bold text-yellow-200">
            Nenhum plano de treinamento salvo.
          </h3>
          <p className="text-xs text-yellow-100/60 max-w-md mx-auto">
            Utilize os insights e vulnerabilidades detectados em qualquer análise para gerar treinos metodológicos UEFA Pro completos.
          </p>
          <button
            onClick={() => setIsGeneratorOpen(true)}
            className="mt-2 px-4 py-2 bg-yellow-500 text-black font-bold text-xs rounded-xl cursor-pointer"
          >
            Gerar Primeiro Treino
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar Plans List */}
          <div className="space-y-2">
            <span className="text-xs font-bold text-yellow-200/80 uppercase tracking-wider block px-1">
              Treinos Salvos ({plans.length})
            </span>
            {plans.map((p) => (
              <div
                key={p.id}
                onClick={() => setSelectedPlan(p)}
                className={`p-3.5 rounded-xl border cursor-pointer flex items-center justify-between transition-all ${
                  selectedPlan?.id === p.id
                    ? 'bg-yellow-950/70 border-yellow-500 text-yellow-200 shadow-md'
                    : 'bg-black/30 border-yellow-900/30 text-yellow-100/60 hover:border-yellow-800'
                }`}
              >
                <div className="space-y-0.5 max-w-[80%]">
                  <h4 className="text-xs font-bold truncate text-white">{p.title}</h4>
                  <span className="text-[10px] text-yellow-200/50 font-mono block">
                    {p.duration || '25 min'} · {p.playersCount || '16 atletas'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeletePlan(p.id);
                  }}
                  className="text-yellow-100/30 hover:text-red-400 p-1"
                  title="Remover Plano"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>

          {/* Active Plan Detail View */}
          <div className="lg:col-span-3">
            {selectedPlan && (
              <div className="bg-[#2a0101]/80 border border-yellow-500/30 rounded-2xl p-6 space-y-6 shadow-xl">
                {/* Plan Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-yellow-900/40 pb-4">
                  <div className="space-y-1">
                    <span className="text-[10px] font-black text-yellow-500 uppercase tracking-widest">
                      Ficha Metodológica de Treino
                    </span>
                    <h3 className="text-xl font-extrabold text-white">
                      {selectedPlan.title}
                    </h3>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handlePrintPlan}
                      className="px-3 py-2 bg-yellow-950/50 hover:bg-yellow-900/60 border border-yellow-700/40 text-yellow-300 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      <Printer className="h-3.5 w-3.5" />
                      <span>Imprimir / PDF</span>
                    </button>
                  </div>
                </div>

                {/* Problem Identified Banner */}
                <div className="bg-red-950/25 border-l-4 border-l-red-500 border-y border-r border-red-900/30 rounded-xl p-4 space-y-1">
                  <span className="text-[10px] font-bold text-red-400 uppercase tracking-wider">
                    Problema Identificado na Partida
                  </span>
                  <p className="text-xs text-yellow-50 font-medium leading-relaxed">
                    {selectedPlan.problemIdentified}
                  </p>
                </div>

                {/* Main Specs Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-black/30 border border-yellow-900/30 rounded-xl p-3 space-y-1">
                    <span className="text-[10px] text-yellow-200/60 font-bold uppercase">Objetivo Principal</span>
                    <div className="text-xs font-bold text-yellow-300">{selectedPlan.objective}</div>
                  </div>

                  <div className="bg-black/30 border border-yellow-900/30 rounded-xl p-3 space-y-1">
                    <span className="text-[10px] text-yellow-200/60 font-bold uppercase">Duração Estimada</span>
                    <div className="text-xs font-bold text-white">{selectedPlan.duration}</div>
                  </div>

                  <div className="bg-black/30 border border-yellow-900/30 rounded-xl p-3 space-y-1">
                    <span className="text-[10px] text-yellow-200/60 font-bold uppercase">Número de Atletas</span>
                    <div className="text-xs font-bold text-white">{selectedPlan.playersCount}</div>
                  </div>

                  <div className="bg-black/30 border border-yellow-900/30 rounded-xl p-3 space-y-1">
                    <span className="text-[10px] text-yellow-200/60 font-bold uppercase">Materiais Necessários</span>
                    <div className="text-xs font-bold text-yellow-300">{selectedPlan.materials || 'Cones, coletes, bolas'}</div>
                  </div>
                </div>

                {/* Organization and Execution */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-black/30 border border-yellow-900/30 rounded-xl p-4 space-y-2">
                    <span className="text-xs font-bold text-yellow-400 uppercase tracking-wider">
                      Organização do Espaço
                    </span>
                    <p className="text-xs text-yellow-50/90 leading-relaxed whitespace-pre-line">
                      {selectedPlan.organization}
                    </p>
                  </div>

                  <div className="bg-black/30 border border-yellow-900/30 rounded-xl p-4 space-y-2">
                    <span className="text-xs font-bold text-yellow-400 uppercase tracking-wider">
                      Execução & Dinâmica
                    </span>
                    <p className="text-xs text-yellow-50/90 leading-relaxed whitespace-pre-line">
                      {selectedPlan.execution}
                    </p>
                  </div>
                </div>

                {/* Behaviors & Observations */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-emerald-950/20 border border-emerald-500/30 rounded-xl p-4 space-y-2">
                    <span className="text-xs font-black text-emerald-400 uppercase tracking-wider">
                      Comportamentos Esperados
                    </span>
                    <ul className="text-xs text-emerald-100/90 space-y-1 list-disc list-inside">
                      {selectedPlan.expectedBehaviors && selectedPlan.expectedBehaviors.length > 0 ? (
                        selectedPlan.expectedBehaviors.map((b, idx) => (
                          <li key={idx}>{b}</li>
                        ))
                      ) : (
                        <li>Manutenção de compactação e resposta rápida à perda.</li>
                      )}
                    </ul>
                  </div>

                  <div className="bg-yellow-950/20 border border-yellow-500/30 rounded-xl p-4 space-y-2">
                    <span className="text-xs font-black text-yellow-400 uppercase tracking-wider">
                      Pontos de Observação do Treinador
                    </span>
                    <ul className="text-xs text-yellow-100/90 space-y-1 list-disc list-inside">
                      {selectedPlan.observationPoints && selectedPlan.observationPoints.length > 0 ? (
                        selectedPlan.observationPoints.map((o, idx) => (
                          <li key={idx}>{o}</li>
                        ))
                      ) : (
                        <li>Comunicação entre os zagueiros e tempo de pressão no portador.</li>
                      )}
                    </ul>
                  </div>
                </div>

                {/* Progression, Regression and Next Match Indicators */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-black/30 border border-yellow-900/30 rounded-xl p-3.5 space-y-1.5">
                    <span className="text-[10px] font-bold text-yellow-400 uppercase">Progressão (Aumentar Dificuldade)</span>
                    <p className="text-xs text-yellow-100/80">{selectedPlan.progression || 'Reduzir toques ou diminuir espaço de jogo.'}</p>
                  </div>

                  <div className="bg-black/30 border border-yellow-900/30 rounded-xl p-3.5 space-y-1.5">
                    <span className="text-[10px] font-bold text-yellow-400 uppercase">Regressão (Facilitar)</span>
                    <p className="text-xs text-yellow-100/80">{selectedPlan.regression || 'Acrescentar curinga ofensivo para superioridade.'}</p>
                  </div>

                  <div className="bg-black/30 border border-yellow-900/30 rounded-xl p-3.5 space-y-1.5">
                    <span className="text-[10px] font-bold text-emerald-400 uppercase">Indicadores para o Próximo Jogo</span>
                    <p className="text-xs text-emerald-100/80">
                      {selectedPlan.nextMatchIndicators && selectedPlan.nextMatchIndicators.length > 0
                        ? selectedPlan.nextMatchIndicators.join('; ')
                        : 'Redução de finalizações sofridas após transição.'}
                    </p>
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
