import React, { useState, useEffect } from 'react';
import { 
  Target, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Calendar, 
  Shield, 
  TrendingUp,
  Award,
  ArrowRight,
  Filter
} from 'lucide-react';
import { AnalysisHistoryItem } from '../types';
import { getAuthHeaders } from '../services/geminiService';

export interface TeamGoal {
  id: string;
  userId?: string;
  title: string;
  targetBehavior: string;
  currentStatus: 'ATIVA' | 'ATINGIDA' | 'PAUSADA' | 'CANCELADA' | string;
  progressHistory: Array<{ date: string; note: string; achievedScore?: string }>;
  targetPeriod: string;
  achieved: boolean;
  createdAt: string;
  updatedAt?: string;
}

interface TeamGoalsModuleProps {
  analyses: AnalysisHistoryItem[];
  onNavigate: (view: string) => void;
}

export const TeamGoalsModule: React.FC<TeamGoalsModuleProps> = ({
  analyses,
  onNavigate,
}) => {
  const [goals, setGoals] = useState<TeamGoal[]>([]);
  const [isNewGoalOpen, setIsNewGoalOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('TODAS');

  // Form State
  const [title, setTitle] = useState('');
  const [targetBehavior, setTargetBehavior] = useState('');
  const [targetPeriod, setTargetPeriod] = useState('Próximos 3 Jogos');
  const [teamName, setTeamName] = useState('');
  const [initialStatus, setInitialStatus] = useState('ATIVA');

  const fetchGoals = async () => {
    try {
      const res = await fetch('/api/tactical/goals', {
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        setGoals(data.goals || []);
      }
    } catch (err) {
      console.error('Erro ao buscar metas:', err);
    }
  };

  useEffect(() => {
    fetchGoals();
  }, []);

  const handleSaveGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !targetBehavior.trim()) return;

    try {
      const res = await fetch('/api/tactical/goals', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          title: title.trim(),
          targetBehavior: `${teamName ? `[${teamName}] ` : ''}${targetBehavior.trim()}`,
          targetPeriod,
          currentStatus: initialStatus,
          progressHistory: [
            {
              date: new Date().toLocaleDateString('pt-BR'),
              note: 'Meta cadastrada no Centro de Inteligência ProTática.',
            },
          ],
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setGoals((prev) => [data.goal, ...prev]);
        setIsNewGoalOpen(false);
        setTitle('');
        setTargetBehavior('');
        setTeamName('');
      }
    } catch (err) {
      console.error('Erro ao salvar meta:', err);
    }
  };

  const handleToggleStatus = async (goal: TeamGoal, newStatus: string) => {
    try {
      const isAchieved = newStatus === 'ATINGIDA';
      const updatedHistory = [
        ...(goal.progressHistory || []),
        {
          date: new Date().toLocaleDateString('pt-BR'),
          note: `Status alterado para: ${newStatus}`,
        },
      ];

      const res = await fetch('/api/tactical/goals', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          ...goal,
          currentStatus: newStatus,
          achieved: isAchieved,
          progressHistory: updatedHistory,
        }),
      });

      if (res.ok) {
        setGoals((prev) =>
          prev.map((g) =>
            g.id === goal.id
              ? { ...g, currentStatus: newStatus, achieved: isAchieved, progressHistory: updatedHistory }
              : g
          )
        );
      }
    } catch (err) {
      console.error('Erro ao atualizar meta:', err);
    }
  };

  const handleDeleteGoal = async (id: string) => {
    if (!confirm('Deseja realmente remover esta meta?')) return;
    try {
      const res = await fetch(`/api/tactical/goals/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        setGoals((prev) => prev.filter((g) => g.id !== id));
      }
    } catch (err) {
      console.error('Erro ao remover meta:', err);
    }
  };

  const filteredGoals = statusFilter === 'TODAS'
    ? goals
    : goals.filter((g) => g.currentStatus === statusFilter);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ATINGIDA':
        return 'bg-emerald-950/80 text-emerald-300 border-emerald-500/40';
      case 'ATIVA':
        return 'bg-amber-950/80 text-amber-300 border-amber-500/40';
      case 'PAUSADA':
        return 'bg-blue-950/80 text-blue-300 border-blue-500/40';
      case 'CANCELADA':
        return 'bg-red-950/80 text-red-300 border-red-500/40';
      default:
        return 'bg-yellow-950 text-yellow-300 border-yellow-800/40';
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="bg-[#2a0101]/80 border border-yellow-500/30 rounded-2xl p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-yellow-400">
            <Target className="h-4 w-4" />
            Objetivos Táticos & Indicadores
          </div>
          <h2 className="text-2xl md:text-3xl font-extrabold text-white">
            METAS DE EVOLUÇÃO
          </h2>
          <p className="text-xs md:text-sm text-yellow-100/70">
            Defina metas coletivas ou setoriais e acompanhe o atingimento com base nas partidas analisadas.
          </p>
        </div>

        <button
          onClick={() => setIsNewGoalOpen(true)}
          className="px-4 py-2.5 bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-400 hover:to-yellow-500 text-black font-bold text-xs rounded-xl transition-all shadow-md flex items-center gap-1.5 cursor-pointer shrink-0"
        >
          <Plus className="h-4 w-4" />
          Nova Meta
        </button>
      </div>

      {/* New Goal Modal */}
      {isNewGoalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-[#1a0000] border border-yellow-500/40 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-yellow-900/40 pb-3">
              <h3 className="text-base font-bold text-yellow-200">Cadastrar Nova Meta Tática</h3>
              <button
                onClick={() => setIsNewGoalOpen(false)}
                className="text-yellow-200/50 hover:text-yellow-100 text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveGoal} className="space-y-3.5">
              <div>
                <label className="block text-[11px] font-bold text-yellow-200/80 mb-1 uppercase tracking-wider">
                  Título da Meta *
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ex: Redução de gols sofridos em transição"
                  className="w-full bg-black/40 border border-yellow-900/50 rounded-xl px-3 py-2 text-xs text-yellow-50 focus:border-yellow-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-yellow-200/80 mb-1 uppercase tracking-wider">
                  Equipe / Categoria (Opcional)
                </label>
                <input
                  type="text"
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  placeholder="Ex: Equipe Principal / Sub-20"
                  className="w-full bg-black/40 border border-yellow-900/50 rounded-xl px-3 py-2 text-xs text-yellow-50 focus:border-yellow-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-yellow-200/80 mb-1 uppercase tracking-wider">
                  Comportamento Esperado / Indicador *
                </label>
                <textarea
                  rows={3}
                  required
                  value={targetBehavior}
                  onChange={(e) => setTargetBehavior(e.target.value)}
                  placeholder="Ex: Não sofrer mais de 2 finalizações perigosas originadas de contra-ataques por jogo..."
                  className="w-full bg-black/40 border border-yellow-900/50 rounded-xl px-3 py-2 text-xs text-yellow-50 focus:border-yellow-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-yellow-200/80 mb-1 uppercase tracking-wider">
                    Período / Prazo
                  </label>
                  <input
                    type="text"
                    value={targetPeriod}
                    onChange={(e) => setTargetPeriod(e.target.value)}
                    placeholder="Ex: Próximos 5 Jogos"
                    className="w-full bg-black/40 border border-yellow-900/50 rounded-xl px-3 py-2 text-xs text-yellow-50 focus:border-yellow-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-yellow-200/80 mb-1 uppercase tracking-wider">
                    Status Inicial
                  </label>
                  <select
                    value={initialStatus}
                    onChange={(e) => setInitialStatus(e.target.value)}
                    className="w-full bg-black/40 border border-yellow-900/50 rounded-xl px-3 py-2 text-xs text-yellow-50 focus:border-yellow-500 focus:outline-none"
                  >
                    <option value="ATIVA">ATIVA</option>
                    <option value="ATINGIDA">ATINGIDA</option>
                    <option value="PAUSADA">PAUSADA</option>
                  </select>
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsNewGoalOpen(false)}
                  className="px-3 py-2 bg-black/40 text-yellow-200 text-xs font-bold rounded-xl border border-yellow-900/40"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-gradient-to-r from-yellow-500 to-yellow-600 text-black text-xs font-bold rounded-xl"
                >
                  Salvar Meta
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex gap-2 border-b border-yellow-900/30 pb-3 overflow-x-auto">
        {['TODAS', 'ATIVA', 'ATINGIDA', 'PAUSADA', 'CANCELADA'].map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => setStatusFilter(status)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              statusFilter === status
                ? 'bg-yellow-500 text-black shadow-md'
                : 'bg-black/30 text-yellow-200/70 border border-yellow-900/30 hover:bg-yellow-950/40'
            }`}
          >
            {status}
          </button>
        ))}
      </div>

      {/* Goals Grid */}
      {filteredGoals.length === 0 ? (
        <div className="bg-[#2a0101]/60 border border-yellow-900/40 rounded-2xl p-10 text-center space-y-3">
          <Target className="h-10 w-10 text-yellow-500/40 mx-auto" />
          <h3 className="text-base font-bold text-yellow-200">
            Nenhuma meta encontrada neste filtro.
          </h3>
          <p className="text-xs text-yellow-100/60 max-w-md mx-auto">
            Cadastre metas de curto e médio prazo para orientar o departamento de análise e a comissão técnica.
          </p>
          <button
            onClick={() => setIsNewGoalOpen(true)}
            className="mt-2 px-4 py-2 bg-yellow-500 text-black font-bold text-xs rounded-xl cursor-pointer"
          >
            Cadastrar Primeira Meta
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredGoals.map((g) => (
            <div
              key={g.id}
              className="bg-[#2a0101]/80 border border-yellow-900/40 rounded-2xl p-5 space-y-4 shadow-lg hover:border-yellow-500/40 transition-colors flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${getStatusBadge(g.currentStatus)}`}>
                      {g.currentStatus}
                    </span>
                    <h3 className="text-sm font-bold text-white pt-1">
                      {g.title}
                    </h3>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleDeleteGoal(g.id)}
                    className="text-yellow-100/30 hover:text-red-400 p-1"
                    title="Remover Meta"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                <div className="bg-black/30 border border-yellow-900/20 rounded-xl p-3 text-xs text-yellow-100/90 leading-relaxed">
                  {g.targetBehavior}
                </div>

                <div className="flex items-center justify-between text-[10px] text-yellow-200/60 font-mono">
                  <span>Prazo: {g.targetPeriod}</span>
                  <span>Criada: {new Date(g.createdAt).toLocaleDateString('pt-BR')}</span>
                </div>
              </div>

              {/* Status Update Quick Buttons */}
              <div className="pt-3 border-t border-yellow-900/30 flex items-center justify-between gap-2">
                <span className="text-[10px] text-yellow-200/50">Mudar status:</span>
                <div className="flex gap-1.5">
                  {g.currentStatus !== 'ATINGIDA' && (
                    <button
                      type="button"
                      onClick={() => handleToggleStatus(g, 'ATINGIDA')}
                      className="px-2.5 py-1 bg-emerald-950/60 hover:bg-emerald-900/80 border border-emerald-500/40 text-emerald-300 text-[10px] font-bold rounded-lg transition-colors cursor-pointer"
                    >
                      Atingida ✓
                    </button>
                  )}
                  {g.currentStatus !== 'ATIVA' && (
                    <button
                      type="button"
                      onClick={() => handleToggleStatus(g, 'ATIVA')}
                      className="px-2.5 py-1 bg-amber-950/60 hover:bg-amber-900/80 border border-amber-500/40 text-amber-300 text-[10px] font-bold rounded-lg transition-colors cursor-pointer"
                    >
                      Reativar
                    </button>
                  )}
                  {g.currentStatus !== 'PAUSADA' && (
                    <button
                      type="button"
                      onClick={() => handleToggleStatus(g, 'PAUSADA')}
                      className="px-2.5 py-1 bg-blue-950/60 hover:bg-blue-900/80 border border-blue-500/40 text-blue-300 text-[10px] font-bold rounded-lg transition-colors cursor-pointer"
                    >
                      Pausar
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
