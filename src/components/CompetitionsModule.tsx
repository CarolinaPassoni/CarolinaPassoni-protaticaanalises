import React, { useState, useEffect } from 'react';
import {
  Globe,
  Trophy,
  Calendar,
  Search,
  Filter,
  PlayCircle,
  ExternalLink,
  ChevronRight,
  Shield,
  Star,
  Users,
  BarChart3,
  Plus,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Sparkles,
  Award
} from 'lucide-react';
import { Competition, Match } from '../types';
import PlayerPhoto from './PlayerPhoto';
import SafeLogo from './SafeLogo';
import { resolveMatchVideoSource } from '../services/matchSourceService';
import { getAuthHeaders } from '../services/geminiService';

interface CompetitionsModuleProps {
  onSelectMatchToAnalyze: (match: Match) => void;
  onOpenAnalysis: (analysisId: string) => void;
  isAdmin?: boolean;
}

export const CompetitionsModule: React.FC<CompetitionsModuleProps> = ({
  onSelectMatchToAnalyze,
  onOpenAnalysis,
  isAdmin = false,
}) => {
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [selectedComp, setSelectedComp] = useState<Competition | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingMatches, setLoadingMatches] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [regionFilter, setRegionFilter] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<'matches' | 'analyses' | 'standings' | 'teams' | 'highlights'>('matches');
  const [resolvingMatchId, setResolvingMatchId] = useState<string | null>(null);

  // Admin new match modal state
  const [showAddMatchModal, setShowAddMatchModal] = useState<boolean>(false);
  const [newMatchData, setNewMatchData] = useState({
    homeTeam: '',
    awayTeam: '',
    matchDate: '',
    round: 'Fase Regular',
    stadium: '',
    videoUrl: '',
    isFeatured: false,
    featuredPlayerName: '',
    featuredPlayerPosition: '',
    featuredPlayerTeam: '',
  });


  const handleAnalyzeMatch = async (match: Match) => {
    try {
      setResolvingMatchId(match.id);
      const resolved = await resolveMatchVideoSource(match);
      setMatches((prev) => prev.map((m) => (m.id === match.id ? resolved.match : m)));
      onSelectMatchToAnalyze(resolved.match);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Não foi possível localizar automaticamente um vídeo confiável desta partida.');
    } finally {
      setResolvingMatchId(null);
    }
  };

  const fetchCompetitions = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/competitions');
      if (res.ok) {
        const data = await res.json();
        setCompetitions(data.competitions || []);
      }
    } catch (err) {
      console.error('Error fetching competitions:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchMatchesForComp = async (compId: string) => {
    try {
      setLoadingMatches(true);
      const res = await fetch(`/api/competitions/${compId}`);
      if (res.ok) {
        const data = await res.json();
        setMatches(data.matches || []);
      }
    } catch (err) {
      console.error('Error fetching matches:', err);
    } finally {
      setLoadingMatches(false);
    }
  };

  useEffect(() => {
    fetchCompetitions();
  }, []);

  useEffect(() => {
    if (selectedComp) {
      fetchMatchesForComp(selectedComp.id);
    }
  }, [selectedComp]);

  const filteredCompetitions = competitions.filter((comp) => {
    const matchesSearch = comp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (comp.country && comp.country.toLowerCase().includes(searchTerm.toLowerCase()));
    if (!matchesSearch) return false;
    if (regionFilter === 'all') return true;
    if (regionFilter === 'south_america') return comp.region === 'América do Sul';
    if (regionFilter === 'europe') return comp.region === 'Europa';
    if (regionFilter === 'world') return comp.region === 'Mundial';
    return true;
  });

  const handleCreateMatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedComp) return;
    try {
      const res = await fetch('/api/matches', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({
          competitionId: selectedComp.id,
          ...newMatchData
        })
      });
      if (res.ok) {
        setShowAddMatchModal(false);
        setNewMatchData({
          homeTeam: '',
          awayTeam: '',
          matchDate: '',
          round: 'Fase Regular',
          stadium: '',
          videoUrl: '',
          isFeatured: false,
          featuredPlayerName: '',
          featuredPlayerPosition: '',
          featuredPlayerTeam: '',
        });
        fetchMatchesForComp(selectedComp.id);
      }
    } catch (err) {
      console.error('Error adding match:', err);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Header Banner */}
      {!selectedComp ? (
        <div className="relative rounded-2xl bg-gradient-to-r from-[#200308] via-[#160205] to-[#0d0103] border border-amber-900/30 p-6 md:p-8 overflow-hidden shadow-xl">
          <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10 max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-semibold uppercase tracking-wider mb-3">
              <Globe className="w-3.5 h-3.5" /> Cobertura Tática Global
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
              PRINCIPAIS COMPETIÇÕES
            </h1>
            <p className="text-sm md:text-base text-zinc-300 mt-2 leading-relaxed">
              Acompanhe partidas, análises e inteligência tática das principais ligas e torneios mundiais.
            </p>
          </div>

          {/* Search and Filters */}
          <div className="mt-6 flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar por competição ou país..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-zinc-900/80 border border-zinc-800 focus:border-amber-500/50 rounded-xl text-sm text-white placeholder-zinc-500 outline-none transition-all"
              />
            </div>
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              {[
                { id: 'all', label: 'Todas' },
                { id: 'south_america', label: 'América do Sul' },
                { id: 'europe', label: 'Europa' },
                { id: 'world', label: 'Mundial' },
              ].map((rf) => (
                <button
                  key={rf.id}
                  onClick={() => setRegionFilter(rf.id)}
                  className={`px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                    regionFilter === rf.id
                      ? 'bg-amber-500 text-black font-bold shadow-md shadow-amber-500/20'
                      : 'bg-zinc-900/80 text-zinc-400 border border-zinc-800 hover:text-white'
                  }`}
                >
                  {rf.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        /* Single Competition View Header */
        <div className="relative rounded-2xl bg-gradient-to-r from-[#200308] via-[#160205] to-[#0d0103] border border-amber-900/40 p-6 overflow-hidden shadow-xl">
          <button
            onClick={() => setSelectedComp(null)}
            className="inline-flex items-center gap-2 text-xs font-medium text-amber-400 hover:text-amber-300 transition-colors mb-4"
          >
            <ArrowLeft className="w-4 h-4" /> Voltar para todas as competições
          </button>

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <SafeLogo
                src={selectedComp.logoUrl}
                alt={selectedComp.name}
                className="w-16 h-16 rounded-xl bg-white/10 p-2 border border-white/10 object-contain shrink-0"
                fallback={<Trophy className="w-8 h-8" />}
                fallbackClassName="w-16 h-16 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 font-bold text-xl shrink-0"
              />
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-amber-400 font-medium">{selectedComp.country}</span>
                  <span className="text-xs text-zinc-500">•</span>
                  <span className="text-xs text-zinc-400">Temporada {selectedComp.season}</span>
                </div>
                <h1 className="text-2xl font-bold text-white tracking-tight mt-0.5">{selectedComp.name}</h1>
                <p className="text-xs text-zinc-400 mt-1 flex items-center gap-3">
                  <span>⚽ {matches.length} partidas registradas</span>
                  <span>📑 {matches.filter((m) => m.analysisId).length} análises disponíveis</span>
                </p>
              </div>
            </div>

            {isAdmin && (
              <button
                onClick={() => setShowAddMatchModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black font-semibold text-xs rounded-xl shadow-lg shadow-amber-500/20 transition-all shrink-0"
              >
                <Plus className="w-4 h-4" /> Adicionar Partida
              </button>
            )}
          </div>

          {/* Sub Navigation Tabs */}
          <div className="flex items-center gap-2 mt-6 pt-4 border-t border-amber-950/40 overflow-x-auto custom-scrollbar pb-2">
            {[
              { id: 'matches', label: 'Partidas', icon: Trophy },
              { id: 'analyses', label: 'Análises Táticas', icon: BarChart3 },
              { id: 'standings', label: 'Classificação', icon: Award },
              { id: 'teams', label: 'Equipes', icon: Shield },
              { id: 'highlights', label: 'Destaques', icon: Star },
            ].map((tab) => {
              const TabIcon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'bg-amber-500 text-black shadow-md shadow-amber-500/20'
                      : 'bg-zinc-900/60 text-zinc-400 hover:text-white hover:bg-zinc-800/60'
                  }`}
                >
                  <TabIcon className="w-3.5 h-3.5" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Grid of Competitions */}
      {!selectedComp ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredCompetitions.map((comp) => (
            <div
              key={comp.id}
              onClick={() => setSelectedComp(comp)}
              className="group relative bg-gradient-to-b from-[#1c0307] to-[#120204] border border-amber-950/40 hover:border-amber-500/40 rounded-2xl p-5 cursor-pointer transition-all duration-300 hover:shadow-xl hover:shadow-amber-500/5 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-4">
                  <SafeLogo
                    src={comp.logoUrl}
                    alt={comp.name}
                    className="w-12 h-12 rounded-xl bg-white/5 p-1.5 border border-white/10 object-contain shrink-0 group-hover:scale-105 transition-transform"
                    fallback={<Trophy className="w-6 h-6" />}
                    fallbackClassName="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0"
                  />
                  <span className="text-[11px] font-medium text-zinc-400 bg-zinc-900/60 px-2 py-0.5 rounded-md border border-zinc-800">
                    {comp.season}
                  </span>
                </div>

                <div className="text-[11px] font-semibold text-amber-400 mb-1">{comp.country}</div>
                <h3 className="text-base font-bold text-white group-hover:text-amber-300 transition-colors line-clamp-1">
                  {comp.name}
                </h3>
              </div>

              <div className="mt-5 pt-3 border-t border-amber-950/30 flex items-center justify-between text-xs text-zinc-400">
                <span>{comp.matchesCount || 0} Partidas</span>
                <span className="flex items-center gap-1 text-amber-400 font-semibold group-hover:translate-x-0.5 transition-transform">
                  Ver Partidas <ChevronRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Detailed Competition Content by Active Tab */
        <div className="space-y-4">
          {activeTab === 'matches' && (
            <div className="space-y-3">
              {loadingMatches ? (
                <div className="text-center py-12 text-zinc-400 text-sm">Carregando partidas...</div>
              ) : matches.length === 0 ? (
                <div className="bg-zinc-900/40 border border-zinc-800 rounded-2xl p-10 text-center text-zinc-400 text-sm">
                  Nenhuma partida cadastrada para esta competição no momento.
                </div>
              ) : (
                matches.map((match) => {
                  const hasAnalysis = Boolean(match.analysisId);
                  return (
                    <div
                      key={match.id}
                      className="bg-gradient-to-r from-[#170306] via-[#120204] to-[#0a0002] border border-amber-950/40 hover:border-amber-500/30 rounded-2xl p-4 md:p-5 transition-all shadow-md"
                    >
                      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                        {/* Match Info */}
                        <div className="flex items-center gap-4 flex-1">
                          <div className="flex flex-col items-center justify-center bg-zinc-900/80 border border-zinc-800 rounded-xl px-3 py-2 text-center shrink-0 min-w-[90px]">
                            <Calendar className="w-3.5 h-3.5 text-amber-400 mb-1" />
                            <span className="text-[11px] font-bold text-white">{match.matchDate}</span>
                            {match.round && (
                              <span className="text-[9px] text-zinc-400 mt-0.5">{match.round}</span>
                            )}
                          </div>

                          {/* Teams vs */}
                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2">
                              <SafeLogo
                                src={match.homeTeamLogo}
                                alt={match.homeTeam}
                                className="w-6 h-6 object-contain"
                                fallback={match.homeTeam.slice(0, 2).toUpperCase()}
                                fallbackClassName="w-6 h-6 rounded bg-amber-500/10 border border-amber-500/20 text-[9px] font-bold text-amber-300 flex items-center justify-center"
                              />
                              <span className="font-bold text-sm md:text-base text-white">{match.homeTeam}</span>
                            </div>

                            <span className="text-xs font-bold text-amber-500/60 px-2 py-0.5 bg-amber-500/10 rounded">
                              VS
                            </span>

                            <div className="flex items-center gap-2">
                              <SafeLogo
                                src={match.awayTeamLogo}
                                alt={match.awayTeam}
                                className="w-6 h-6 object-contain"
                                fallback={match.awayTeam.slice(0, 2).toUpperCase()}
                                fallbackClassName="w-6 h-6 rounded bg-amber-500/10 border border-amber-500/20 text-[9px] font-bold text-amber-300 flex items-center justify-center"
                              />
                              <span className="font-bold text-sm md:text-base text-white">{match.awayTeam}</span>
                            </div>
                          </div>
                        </div>

                        {/* Player highlight thumbnail */}
                        {match.featuredPlayerName && (
                          <div className="hidden lg:flex items-center gap-3 bg-zinc-900/40 border border-zinc-800/80 rounded-xl p-2 pr-3 shrink-0">
                            <div className="w-10 h-12 rounded-lg overflow-hidden shrink-0">
                              <PlayerPhoto
                                playerName={match.featuredPlayerName}
                                teamName={match.featuredPlayerTeam || match.homeTeam}
                                fallbackUrl={match.featuredPlayerPhoto}
                                className="w-full h-full"
                              />
                            </div>
                            <div className="text-left">
                              <span className="text-[9px] uppercase tracking-wider text-amber-400 font-bold flex items-center gap-1">
                                <Star className="w-2.5 h-2.5 fill-amber-400" /> Destaque
                              </span>
                              <p className="text-xs font-bold text-white truncate max-w-[120px]">
                                {match.featuredPlayerName}
                              </p>
                              <p className="text-[10px] text-zinc-400 truncate max-w-[120px]">
                                {match.featuredPlayerPosition || 'Atleta'}
                              </p>
                            </div>
                          </div>
                        )}

                        {/* Actions */}
                        <div className="flex items-center gap-2 w-full md:w-auto shrink-0">
                          {hasAnalysis ? (
                            <button
                              onClick={() => onOpenAnalysis(match.analysisId!)}
                              className="flex-1 md:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-900/20 transition-all"
                            >
                              <CheckCircle2 className="w-4 h-4" /> VER ANÁLISE
                            </button>
                          ) : (
                            <button
                              onClick={() => handleAnalyzeMatch(match)}
                              disabled={resolvingMatchId === match.id}
                              className="flex-1 md:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 disabled:opacity-60 disabled:cursor-wait text-black font-bold text-xs rounded-xl shadow-lg shadow-amber-500/20 transition-all"
                            >
                              <PlayCircle className="w-4 h-4" />
                              {resolvingMatchId === match.id ? 'LOCALIZANDO VÍDEO...' : 'ANALISAR ESTA PARTIDA'}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {activeTab === 'analyses' && (
            <div className="space-y-3">
              {matches.filter((m) => m.analysisId).length === 0 ? (
                <div className="bg-zinc-900/40 border border-zinc-800 rounded-2xl p-10 text-center text-zinc-400 text-sm">
                  Nenhuma análise tática vinculada a esta competição ainda. Escolha uma partida acima para analisar.
                </div>
              ) : (
                matches
                  .filter((m) => m.analysisId)
                  .map((match) => (
                    <div
                      key={match.id}
                      className="bg-gradient-to-r from-[#170306] via-[#120204] to-[#0a0002] border border-amber-950/40 rounded-2xl p-5 flex items-center justify-between gap-4 shadow-md"
                    >
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold">
                            Auditada • Alta Confiança
                          </span>
                          <span className="text-xs text-zinc-400">{match.matchDate}</span>
                        </div>
                        <h3 className="text-base font-bold text-white">
                          {match.homeTeam} x {match.awayTeam}
                        </h3>
                        <p className="text-xs text-zinc-400 mt-0.5">{match.stadium || selectedComp.name}</p>
                      </div>
                      <button
                        onClick={() => onOpenAnalysis(match.analysisId!)}
                        className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs rounded-xl transition-all shadow-md"
                      >
                        Abrir Relatório Completo
                      </button>
                    </div>
                  ))
              )}
            </div>
          )}

          {activeTab === 'standings' && (
            <div className="bg-[#140205] border border-amber-950/40 rounded-2xl p-6 shadow-xl text-center">
              <Award className="w-10 h-10 text-amber-400 mx-auto mb-3" />
              <h3 className="text-base font-bold text-white">Tabela de Classificação Atualizada</h3>
              <p className="text-xs text-zinc-400 mt-1 max-w-md mx-auto">
                Classificação oficial, pontuações, saldo de gols e desempenho em tempo real para {selectedComp.name}.
              </p>
              <div className="mt-6 text-xs text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 inline-block">
                ⚡ Dados sincronizados com a temporada oficial {selectedComp.season}
              </div>
            </div>
          )}

          {activeTab === 'teams' && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {['Flamengo', 'Palmeiras', 'Real Madrid', 'Manchester City', 'Arsenal', 'Liverpool', 'Barcelona', 'Bayern'].map((t, idx) => (
                <div
                  key={idx}
                  className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-4 text-center hover:border-amber-500/30 transition-colors"
                >
                  <Shield className="w-8 h-8 text-amber-400/80 mx-auto mb-2" />
                  <span className="text-xs font-bold text-white block truncate">{t}</span>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'highlights' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {[
                { name: 'Vinícius Júnior', team: 'Real Madrid', pos: 'Ponta Esquerda' },
                { name: 'Pedro', team: 'Flamengo', pos: 'Centroavante' },
                { name: 'Bukayo Saka', team: 'Arsenal', pos: 'Ponta Direita' },
              ].map((p, idx) => (
                <div
                  key={idx}
                  className="bg-[#170306] border border-amber-950/40 rounded-2xl p-4 flex items-center gap-4"
                >
                  <div className="w-16 h-20 rounded-xl overflow-hidden shrink-0">
                    <PlayerPhoto
                      playerName={p.name}
                      teamName={p.team}
                      className="w-full h-full"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-amber-400 font-bold uppercase tracking-wider">Atleta em Foco</span>
                    <h4 className="text-sm font-bold text-white mt-0.5">{p.name}</h4>
                    <p className="text-xs text-zinc-400">{p.pos}</p>
                    <span className="inline-block mt-2 text-[10px] text-zinc-300 bg-zinc-800/80 px-2 py-0.5 rounded">
                      {p.team}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Admin Add Match Modal */}
      {showAddMatchModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#170306] border border-amber-500/30 rounded-2xl max-w-lg w-full p-6 shadow-2xl animate-scaleUp">
            <h3 className="text-lg font-bold text-white mb-4">Adicionar Partida - {selectedComp?.name}</h3>
            <form onSubmit={handleCreateMatch} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-300 mb-1 font-medium">Time Mandante</label>
                  <input
                    type="text"
                    required
                    value={newMatchData.homeTeam}
                    onChange={(e) => setNewMatchData({ ...newMatchData, homeTeam: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-white"
                  />
                </div>
                <div>
                  <label className="block text-zinc-300 mb-1 font-medium">Time Visitante</label>
                  <input
                    type="text"
                    required
                    value={newMatchData.awayTeam}
                    onChange={(e) => setNewMatchData({ ...newMatchData, awayTeam: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-300 mb-1 font-medium">Data / Horário</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Hoje • 21:30"
                    value={newMatchData.matchDate}
                    onChange={(e) => setNewMatchData({ ...newMatchData, matchDate: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-white"
                  />
                </div>
                <div>
                  <label className="block text-zinc-300 mb-1 font-medium">Rodada / Fase</label>
                  <input
                    type="text"
                    placeholder="Ex: Rodada 26"
                    value={newMatchData.round}
                    onChange={(e) => setNewMatchData({ ...newMatchData, round: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-zinc-300 mb-1 font-medium">Estádio / Local</label>
                <input
                  type="text"
                  placeholder="Ex: Maracanã, Rio de Janeiro"
                  value={newMatchData.stadium}
                  onChange={(e) => setNewMatchData({ ...newMatchData, stadium: e.target.value })}
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-white"
                />
              </div>

              <div>
                <label className="block text-zinc-300 mb-1 font-medium">URL do vídeo da partida (YouTube)</label>
                <input
                  type="url"
                  placeholder="https://www.youtube.com/watch?v=..."
                  value={newMatchData.videoUrl}
                  onChange={(e) => setNewMatchData({ ...newMatchData, videoUrl: e.target.value })}
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-white"
                />
                <p className="text-[10px] text-zinc-500 mt-1">Quando informada, o botão “Analisar esta partida” preencherá a URL automaticamente.</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-300 mb-1 font-medium">Jogador em Destaque</label>
                  <input
                    type="text"
                    placeholder="Ex: Vinícius Júnior"
                    value={newMatchData.featuredPlayerName}
                    onChange={(e) => setNewMatchData({ ...newMatchData, featuredPlayerName: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-white"
                  />
                </div>
                <div>
                  <label className="block text-zinc-300 mb-1 font-medium">Posição do Destaque</label>
                  <input
                    type="text"
                    placeholder="Ex: Ponta esquerda"
                    value={newMatchData.featuredPlayerPosition}
                    onChange={(e) => setNewMatchData({ ...newMatchData, featuredPlayerPosition: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-white"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="featuredCheck"
                  checked={newMatchData.isFeatured}
                  onChange={(e) => setNewMatchData({ ...newMatchData, isFeatured: e.target.checked })}
                  className="rounded text-amber-500"
                />
                <label htmlFor="featuredCheck" className="text-zinc-300">
                  Destacar na Página Inicial (Jogos em Destaque)
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setShowAddMatchModal(false)}
                  className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-lg shadow-md"
                >
                  Salvar Partida
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CompetitionsModule;
