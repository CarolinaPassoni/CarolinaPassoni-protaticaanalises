import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  Plus, 
  Shield, 
  Calendar, 
  MapPin, 
  Trash2, 
  Activity, 
  BarChart3, 
  CheckCircle2, 
  AlertCircle,
  Video,
  Layers,
  ArrowRight,
  Flame,
  Award
} from 'lucide-react';
import { AnalysisHistoryItem } from '../types';
import { getAuthHeaders } from '../services/geminiService';

interface Team {
  id: string;
  name: string;
  category: string;
  season: string;
  city?: string;
  shieldUrl?: string;
  createdAt?: string;
}

interface MyTeamModuleProps {
  analyses: AnalysisHistoryItem[];
  onOpenAnalysis: (id: string) => void;
  onNavigate: (view: string) => void;
}

export const MyTeamModule: React.FC<MyTeamModuleProps> = ({
  analyses,
  onOpenAnalysis,
  onNavigate,
}) => {
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string>('');
  const [timeFilter, setTimeFilter] = useState<'3' | '5' | '10' | 'season'>('5');
  const [isCreatingTeam, setIsCreatingTeam] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Form State
  const [teamName, setTeamName] = useState('');
  const [category, setCategory] = useState('Profissional');
  const [season, setSeason] = useState(new Date().getFullYear().toString());
  const [city, setCity] = useState('');
  const [shieldUrl, setShieldUrl] = useState('');

  const fetchTeams = async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/tactical/teams', {
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        setTeams(data.teams || []);
        if (data.teams && data.teams.length > 0 && !selectedTeamId) {
          setSelectedTeamId(data.teams[0].id);
        }
      }
    } catch (err) {
      console.error('Erro ao buscar equipes:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTeams();
  }, []);

  const handleSaveTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamName.trim()) return;

    try {
      const res = await fetch('/api/tactical/teams', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          name: teamName.trim(),
          category,
          season,
          city: city.trim() || undefined,
          shieldUrl: shieldUrl.trim() || undefined,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setTeams((prev) => [data.team, ...prev]);
        setSelectedTeamId(data.team.id);
        setIsCreatingTeam(false);
        setTeamName('');
        setCity('');
        setShieldUrl('');
      }
    } catch (err) {
      console.error('Erro ao cadastrar equipe:', err);
    }
  };

  const handleDeleteTeam = async (id: string) => {
    if (!confirm('Deseja realmente remover esta equipe?')) return;
    try {
      const res = await fetch(`/api/tactical/teams/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        setTeams((prev) => prev.filter((t) => t.id !== id));
        if (selectedTeamId === id) {
          const remaining = teams.filter((t) => t.id !== id);
          setSelectedTeamId(remaining.length > 0 ? remaining[0].id : '');
        }
      }
    } catch (err) {
      console.error('Erro ao remover equipe:', err);
    }
  };

  const activeTeam = teams.find((t) => t.id === selectedTeamId) || teams[0];

  // Match filtering
  const relevantMatches = analyses.filter((a) => {
    if (!activeTeam) return true;
    const title = (a.title || '').toLowerCase();
    const teamA = (a.teamA || '').toLowerCase();
    const teamB = (a.teamB || '').toLowerCase();
    const target = activeTeam.name.toLowerCase();
    return title.includes(target) || teamA.includes(target) || teamB.includes(target);
  });

  const matchesCountLimit = timeFilter === 'season' ? relevantMatches.length : parseInt(timeFilter);
  const displayedMatches = relevantMatches.slice(0, matchesCountLimit);

  // Real aggregations if available in statistics
  const aggregateStat = (statKey: string) => {
    let total = 0;
    let count = 0;
    for (const match of displayedMatches) {
      const stats = match.estatisticas;
      if (stats && (stats as any)[statKey] !== undefined) {
        const val = parseFloat(String((stats as any)[statKey]).replace('%', ''));
        if (!isNaN(val)) {
          total += val;
          count++;
        }
      }
    }
    if (count === 0) return 'NÃO DISPONÍVEL';
    return (total / count).toFixed(1);
  };

  const possessionAvg = aggregateStat('posseDeBola');
  const shotsAvg = aggregateStat('finalizacoes');
  const shotsOnTargetAvg = aggregateStat('finalizacoesNoAlvo');
  const recoveriesAvg = aggregateStat('recuperacoes');
  const lossesAvg = aggregateStat('perdasDePosse');

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header & Actions */}
      <div className="bg-[#2a0101]/80 border border-yellow-500/30 rounded-2xl p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-yellow-400">
            <TrendingUp className="h-4 w-4" />
            Performance & Evolução da Equipe
          </div>
          <h2 className="text-2xl md:text-3xl font-extrabold text-white">
            MINHA EQUIPE
          </h2>
          <p className="text-xs md:text-sm text-yellow-100/70">
            Acompanhe indicadores consolidados, consistência tática e progresso jogo a jogo.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsCreatingTeam(true)}
            className="px-4 py-2.5 bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-400 hover:to-yellow-500 text-black font-bold text-xs rounded-xl transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            Cadastrar Equipe
          </button>
        </div>
      </div>

      {/* Modal for Creating Team */}
      {isCreatingTeam && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-[#1a0000] border border-yellow-500/40 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-yellow-900/40 pb-3">
              <h3 className="text-base font-bold text-yellow-200">Cadastrar Nova Equipe</h3>
              <button
                onClick={() => setIsCreatingTeam(false)}
                className="text-yellow-200/50 hover:text-yellow-100 text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveTeam} className="space-y-3.5">
              <div>
                <label className="block text-[11px] font-bold text-yellow-200/80 mb-1 uppercase tracking-wider">
                  Nome da Equipe *
                </label>
                <input
                  type="text"
                  required
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  placeholder="Ex: Flamengo, Palmeiras, Real Madrid..."
                  className="w-full bg-black/40 border border-yellow-900/50 rounded-xl px-3 py-2 text-xs text-yellow-50 focus:border-yellow-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-yellow-200/80 mb-1 uppercase tracking-wider">
                    Categoria *
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full bg-black/40 border border-yellow-900/50 rounded-xl px-3 py-2 text-xs text-yellow-50 focus:border-yellow-500 focus:outline-none"
                  >
                    <option value="Profissional">Profissional</option>
                    <option value="Sub-20">Sub-20</option>
                    <option value="Sub-17">Sub-17</option>
                    <option value="Sub-15">Sub-15</option>
                    <option value="Sub-13">Sub-13</option>
                    <option value="Feminino">Feminino</option>
                    <option value="Amador / Várzea">Amador / Várzea</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-yellow-200/80 mb-1 uppercase tracking-wider">
                    Temporada *
                  </label>
                  <input
                    type="text"
                    required
                    value={season}
                    onChange={(e) => setSeason(e.target.value)}
                    placeholder="2026"
                    className="w-full bg-black/40 border border-yellow-900/50 rounded-xl px-3 py-2 text-xs text-yellow-50 focus:border-yellow-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-yellow-200/80 mb-1 uppercase tracking-wider">
                  Cidade / Estado (Opcional)
                </label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="São Paulo, SP"
                  className="w-full bg-black/40 border border-yellow-900/50 rounded-xl px-3 py-2 text-xs text-yellow-50 focus:border-yellow-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-yellow-200/80 mb-1 uppercase tracking-wider">
                  URL do Escudo (Opcional)
                </label>
                <input
                  type="url"
                  value={shieldUrl}
                  onChange={(e) => setShieldUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full bg-black/40 border border-yellow-900/50 rounded-xl px-3 py-2 text-xs text-yellow-50 focus:border-yellow-500 focus:outline-none"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreatingTeam(false)}
                  className="px-3 py-2 bg-black/40 text-yellow-200 text-xs font-bold rounded-xl border border-yellow-900/40"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-gradient-to-r from-yellow-500 to-yellow-600 text-black text-xs font-bold rounded-xl"
                >
                  Salvar Equipe
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Team Selection Bar */}
      {teams.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-2">
          {teams.map((t) => (
            <div
              key={t.id}
              onClick={() => setSelectedTeamId(t.id)}
              className={`px-4 py-2.5 rounded-xl border cursor-pointer flex items-center gap-2.5 transition-all shrink-0 ${
                selectedTeamId === t.id
                  ? 'bg-yellow-950/70 border-yellow-500 text-yellow-200 shadow-md'
                  : 'bg-black/30 border-yellow-900/30 text-yellow-100/60 hover:border-yellow-800'
              }`}
            >
              <Shield className="h-4 w-4 text-yellow-500 shrink-0" />
              <div className="text-left">
                <span className="block text-xs font-bold">{t.name}</span>
                <span className="block text-[10px] text-yellow-200/50 font-mono">
                  {t.category} · {t.season}
                </span>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteTeam(t.id);
                }}
                className="text-yellow-100/30 hover:text-red-400 p-1"
                title="Remover Equipe"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Main Performance Dashboard */}
      {displayedMatches.length === 0 ? (
        <div className="bg-[#2a0101]/60 border border-yellow-900/40 rounded-2xl p-10 text-center space-y-3">
          <Activity className="h-10 w-10 text-yellow-500/40 mx-auto" />
          <h3 className="text-base font-bold text-yellow-200">
            Ainda não existem partidas suficientes para mostrar evolução.
          </h3>
          <p className="text-xs text-yellow-100/60 max-w-md mx-auto">
            Analise partidas da sua equipe ou vincule vídeos analisados para consolidar métricas de posse, transição e pressão.
          </p>
          <button
            onClick={() => onNavigate('new-analysis')}
            className="mt-2 px-4 py-2 bg-yellow-500 text-black font-bold text-xs rounded-xl cursor-pointer"
          >
            Fazer Primeira Análise
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Filter Bar */}
          <div className="bg-[#2a0101]/60 border border-yellow-900/40 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-yellow-500" />
              <span className="text-xs font-bold text-yellow-200 uppercase tracking-wider">
                Filtro de Amostragem:
              </span>
            </div>

            <div className="flex gap-1.5">
              {[
                { id: '3', label: 'Últimos 3 jogos' },
                { id: '5', label: 'Últimos 5 jogos' },
                { id: '10', label: 'Últimos 10 jogos' },
                { id: 'season', label: 'Temporada' },
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setTimeFilter(f.id as any)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    timeFilter === f.id
                      ? 'bg-yellow-500 text-black shadow-md'
                      : 'bg-black/30 text-yellow-200/70 border border-yellow-900/30 hover:bg-yellow-950/40'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Indicators Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-[#2a0101]/60 border border-yellow-900/30 rounded-2xl p-4 space-y-1">
              <span className="text-[10px] font-bold text-yellow-200/60 uppercase tracking-wider">
                Posse de Bola Média
              </span>
              <div className="text-xl font-black text-white">
                {possessionAvg !== 'NÃO DISPONÍVEL' ? `${possessionAvg}%` : 'NÃO DISPONÍVEL'}
              </div>
            </div>

            <div className="bg-[#2a0101]/60 border border-yellow-900/30 rounded-2xl p-4 space-y-1">
              <span className="text-[10px] font-bold text-yellow-200/60 uppercase tracking-wider">
                Finalizações / Jogo
              </span>
              <div className="text-xl font-black text-white">
                {shotsAvg}
              </div>
            </div>

            <div className="bg-[#2a0101]/60 border border-yellow-900/30 rounded-2xl p-4 space-y-1">
              <span className="text-[10px] font-bold text-yellow-200/60 uppercase tracking-wider">
                Finalizações no Alvo
              </span>
              <div className="text-xl font-black text-white">
                {shotsOnTargetAvg}
              </div>
            </div>

            <div className="bg-[#2a0101]/60 border border-yellow-900/30 rounded-2xl p-4 space-y-1">
              <span className="text-[10px] font-bold text-yellow-200/60 uppercase tracking-wider">
                Recuperações de Posse
              </span>
              <div className="text-xl font-black text-white">
                {recoveriesAvg}
              </div>
            </div>

            <div className="bg-[#2a0101]/60 border border-yellow-900/30 rounded-2xl p-4 space-y-1">
              <span className="text-[10px] font-bold text-yellow-200/60 uppercase tracking-wider">
                Perdas de Posse
              </span>
              <div className="text-xl font-black text-white">
                {lossesAvg}
              </div>
            </div>

            <div className="bg-[#2a0101]/60 border border-yellow-900/30 rounded-2xl p-4 space-y-1">
              <span className="text-[10px] font-bold text-yellow-200/60 uppercase tracking-wider">
                Construção / Saída
              </span>
              <div className="text-sm font-bold text-yellow-300">
                {displayedMatches[0]?.faseOfensiva?.saidaDeBola || 'NÃO DISPONÍVEL'}
              </div>
            </div>

            <div className="bg-[#2a0101]/60 border border-yellow-900/30 rounded-2xl p-4 space-y-1">
              <span className="text-[10px] font-bold text-yellow-200/60 uppercase tracking-wider">
                Comportamento de Pressão
              </span>
              <div className="text-sm font-bold text-yellow-300">
                {displayedMatches[0]?.faseDefensiva?.compactacaoEPressao || 'NÃO DISPONÍVEL'}
              </div>
            </div>

            <div className="bg-[#2a0101]/60 border border-yellow-900/30 rounded-2xl p-4 space-y-1">
              <span className="text-[10px] font-bold text-yellow-200/60 uppercase tracking-wider">
                Transição Ofensiva
              </span>
              <div className="text-sm font-bold text-yellow-300">
                {displayedMatches[0]?.faseOfensiva?.criacaoEProgressao || 'NÃO DISPONÍVEL'}
              </div>
            </div>
          </div>

          {/* Matches Included List */}
          <div className="bg-[#2a0101]/60 border border-yellow-900/40 rounded-2xl p-5 space-y-3">
            <h3 className="text-sm font-bold text-yellow-200">
              Partidas Consideradas nesta Amostragem ({displayedMatches.length})
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {displayedMatches.map((m) => (
                <div
                  key={m.id}
                  onClick={() => onOpenAnalysis(m.id)}
                  className="p-3 bg-black/30 hover:bg-yellow-950/30 border border-yellow-900/30 hover:border-yellow-500/40 rounded-xl transition-all cursor-pointer flex justify-between items-center group"
                >
                  <div className="space-y-0.5 max-w-[80%]">
                    <span className="text-[10px] font-mono text-yellow-500/70">
                      {new Date(m.created_at).toLocaleDateString('pt-BR')}
                    </span>
                    <h4 className="text-xs font-bold text-yellow-100 group-hover:text-yellow-300 truncate">
                      {m.title}
                    </h4>
                  </div>
                  <span className="text-xs font-bold text-yellow-400 group-hover:translate-x-1 transition-transform">
                    →
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
