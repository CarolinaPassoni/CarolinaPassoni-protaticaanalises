import React, { useState, useEffect } from 'react';
import {
  Video,
  Search,
  UserCheck,
  TrendingUp,
  Dumbbell,
  ShieldCheck,
  ArrowRight,
  Sparkles,
  Compass,
  PlayCircle,
  Globe,
  Trophy,
  Star,
  CheckCircle2,
  Calendar,
  Layers,
  Flame
} from 'lucide-react';
import { AnalysisHistoryItem, Match, Competition } from '../types';
import PlayerPhoto from './PlayerPhoto';
import SafeLogo from './SafeLogo';
import { resolveMatchVideoSource } from '../services/matchSourceService';

interface HomeDashboardProps {
  onNavigate: (view: string, params?: any) => void;
  recentAnalyses: AnalysisHistoryItem[];
  onOpenAnalysis: (id: string) => void;
  onSelectMatchToAnalyze?: (match: Match) => void;
}

export const HomeDashboard: React.FC<HomeDashboardProps> = ({
  onNavigate,
  recentAnalyses,
  onOpenAnalysis,
  onSelectMatchToAnalyze,
}) => {
  const [featuredMatches, setFeaturedMatches] = useState<Match[]>([]);
  const [featuredCompetitions, setFeaturedCompetitions] = useState<Competition[]>([]);
  const [loadingFeatured, setLoadingFeatured] = useState<boolean>(true);
  const [resolvingMatchId, setResolvingMatchId] = useState<string | null>(null);

  useEffect(() => {
    const loadHomeData = async (silent = false) => {
      try {
        if (!silent) setLoadingFeatured(true);
        const [mRes, cRes] = await Promise.all([
          fetch('/api/matches?isFeatured=true'),
          fetch('/api/competitions?onlyActive=true'),
        ]);

        if (mRes.ok) {
          const mData = await mRes.json();
          setFeaturedMatches(mData.matches || []);
        }
        if (cRes.ok) {
          const cData = await cRes.json();
          setFeaturedCompetitions(cData.competitions || []);
        }
      } catch (err) {
        console.error('Error loading home data:', err);
      } finally {
        if (!silent) setLoadingFeatured(false);
      }
    };

    loadHomeData();
    const refreshTimer = window.setInterval(() => loadHomeData(true), 90 * 1000);
    return () => window.clearInterval(refreshTimer);
  }, []);


  const handleAnalyzeFeaturedMatch = async (match: Match) => {
    try {
      setResolvingMatchId(match.id);
      const resolved = await resolveMatchVideoSource(match);
      setFeaturedMatches((prev) => prev.map((m) => (m.id === match.id ? resolved.match : m)));
      if (onSelectMatchToAnalyze) {
        onSelectMatchToAnalyze(resolved.match);
      } else {
        onNavigate('new-analysis', { videoUrl: resolved.match.videoUrl });
      }
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Não foi possível localizar automaticamente o vídeo desta partida.');
    } finally {
      setResolvingMatchId(null);
    }
  };

  return (
    <div className="space-y-8 animate-fadeIn pb-12">
      {/* Hero Welcome Header */}
      <div className="bg-gradient-to-r from-[#200308] via-[#160205] to-[#0d0103] border border-amber-900/40 rounded-3xl p-6 md:p-8 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-10 -left-10 w-72 h-72 bg-amber-600/5 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-bold uppercase tracking-wider">
            <Compass className="h-3.5 w-3.5 text-amber-400" />
            Centro de Inteligência Tática UEFA Pro & CBF Academy
          </div>

          <h2 className="text-2xl md:text-4xl font-extrabold text-white tracking-tight">
            O QUE VOCÊ QUER DESCOBRIR HOJE?
          </h2>

          <p className="text-sm md:text-base text-zinc-300 max-w-2xl leading-relaxed">
            Selecione uma partida de destaque mundial ou execute sua própria análise tática assistida por IA de alta precisão.
          </p>

          <div className="pt-2 flex flex-wrap items-center gap-3">
            <button
              onClick={() => onNavigate('new-analysis')}
              className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-bold text-xs rounded-xl shadow-lg shadow-amber-500/20 transition-all cursor-pointer"
            >
              <Video className="w-4 h-4" />
              ANALISAR NOVA PARTIDA
            </button>
            <button
              onClick={() => onNavigate('competitions')}
              className="flex items-center gap-2 px-4 py-2.5 bg-zinc-900/80 hover:bg-zinc-800 border border-zinc-700 text-zinc-200 text-xs font-semibold rounded-xl transition-all cursor-pointer"
            >
              <Globe className="w-4 h-4 text-amber-400" />
              VER COMPETIÇÕES
            </button>
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 1. JOGOS EM DESTAQUE (Mundiais / Brasileirão) */}
      {/* ======================================================== */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Flame className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base md:text-lg font-bold text-white tracking-tight">
                JOGOS EM DESTAQUE
              </h3>
              <p className="text-xs text-zinc-400">Grandes confrontos com atletas auditados e relatórios táticos</p>
            </div>
          </div>
          <button
            onClick={() => onNavigate('matches')}
            className="text-xs font-semibold text-amber-400 hover:text-amber-300 flex items-center gap-1 cursor-pointer transition-colors"
          >
            Ver todas as partidas
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {featuredMatches.slice(0, 3).map((match) => {
            const hasAnalysis = Boolean(match.analysisId);
            const canAnalyze = Boolean(match.videoUrl) || ['finished', 'finished_waiting_video'].includes(match.status);
            return (
              <div
                key={match.id}
                className="bg-gradient-to-b from-[#1c0307] to-[#120204] border border-amber-950/40 hover:border-amber-500/40 rounded-2xl p-5 flex flex-col justify-between transition-all duration-300 shadow-lg group hover:-translate-y-1"
              >
                <div>
                  {/* Top Bar: Comp & Date */}
                  <div className="flex items-center justify-between gap-2 pb-2.5 mb-3 border-b border-amber-950/30 text-xs">
                    <span className="font-bold text-amber-400 truncate max-w-[140px]">
                      {match.competitionName || 'Competição'}
                    </span>
                    <span className="text-[11px] text-zinc-400 font-mono flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-amber-400/70" />
                      {match.matchDate}
                    </span>
                  </div>

                  {/* Match Teams */}
                  <div className="flex items-center justify-between py-2 text-center">
                    <div className="flex-1">
                      <div className="relative w-10 h-10 rounded-lg bg-zinc-900 mx-auto mb-1 flex items-center justify-center text-xs font-bold text-amber-400 overflow-hidden">
                        <span>{match.homeTeam.slice(0, 3)}</span>
                        {match.homeTeamLogo && (
                          <img
                            src={match.homeTeamLogo}
                            alt=""
                            className="absolute inset-0 w-full h-full object-contain bg-[#170306] p-0.5"
                            onError={(e) => { e.currentTarget.style.display = 'none'; }}
                          />
                        )}
                      </div>
                      <p className="text-xs font-bold text-white truncate">{match.homeTeam}</p>
                    </div>

                    <div className="px-3">
                      <span className="text-[11px] font-black text-amber-500/80 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                        VS
                      </span>
                    </div>

                    <div className="flex-1">
                      <div className="relative w-10 h-10 rounded-lg bg-zinc-900 mx-auto mb-1 flex items-center justify-center text-xs font-bold text-amber-400 overflow-hidden">
                        <span>{match.awayTeam.slice(0, 3)}</span>
                        {match.awayTeamLogo && (
                          <img
                            src={match.awayTeamLogo}
                            alt=""
                            className="absolute inset-0 w-full h-full object-contain bg-[#170306] p-0.5"
                            onError={(e) => { e.currentTarget.style.display = 'none'; }}
                          />
                        )}
                      </div>
                      <p className="text-xs font-bold text-white truncate">{match.awayTeam}</p>
                    </div>
                  </div>

                  {/* Spotlight Player with Verified Photo */}
                  {match.featuredPlayerName && (
                    <div className="mt-3 p-2.5 rounded-xl bg-[#140205] border border-amber-950/40 flex items-center gap-3">
                      <div className="w-10 h-12 rounded-lg overflow-hidden shrink-0">
                        <PlayerPhoto
                          playerName={match.featuredPlayerName}
                          teamName={match.featuredPlayerTeam || match.homeTeam}
                          fallbackUrl={match.featuredPlayerPhoto}
                          className="w-full h-full"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="text-[9px] uppercase tracking-wider text-amber-400 font-bold flex items-center gap-1">
                          <Star className="w-2.5 h-2.5 fill-amber-400" /> Destaque da Partida
                        </span>
                        <p className="text-xs font-bold text-white truncate">{match.featuredPlayerName}</p>
                        <p className="text-[10px] text-zinc-400 truncate">
                          {match.featuredPlayerPosition || 'Atleta'} • {match.featuredPlayerTeam || match.homeTeam}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Bottom Action Button */}
                <div className="mt-4 pt-3 border-t border-amber-950/30">
                  {hasAnalysis ? (
                    <button
                      onClick={() => onOpenAnalysis(match.analysisId!)}
                      className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow transition-all cursor-pointer"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" /> VER ANÁLISE
                    </button>
                  ) : canAnalyze ? (
                    <button
                      onClick={() => handleAnalyzeFeaturedMatch(match)}
                      disabled={resolvingMatchId === match.id}
                      className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-amber-500 hover:bg-amber-400 disabled:opacity-60 disabled:cursor-wait text-black font-bold text-xs rounded-xl shadow transition-all cursor-pointer"
                    >
                      <PlayCircle className="w-3.5 h-3.5" />
                      {resolvingMatchId === match.id ? 'LOCALIZANDO VÍDEO...' : 'ANALISAR ESTA PARTIDA'}
                    </button>
                  ) : (
                    <div className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-zinc-900/70 border border-zinc-800 text-zinc-400 font-bold text-xs rounded-xl">
                      <Calendar className="w-3.5 h-3.5" />
                      {match.status === 'scheduled' ? 'PARTIDA AGENDADA' : match.status === 'live' ? 'PARTIDA EM ANDAMENTO' : 'AGUARDANDO VÍDEO'}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ======================================================== */}
      {/* 2. COMPETIÇÕES EM DESTAQUE */}
      {/* ======================================================== */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Trophy className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base md:text-lg font-bold text-white tracking-tight">
                COMPETIÇÕES EM DESTAQUE
              </h3>
              <p className="text-xs text-zinc-400">Acesse as ligas mundiais de maior prestígio e cobertura</p>
            </div>
          </div>
          <button
            onClick={() => onNavigate('competitions')}
            className="text-xs font-semibold text-amber-400 hover:text-amber-300 flex items-center gap-1 cursor-pointer transition-colors"
          >
            Ver todas (14)
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {featuredCompetitions.slice(0, 6).map((comp) => (
            <div
              key={comp.id}
              onClick={() => onNavigate('competitions')}
              className="bg-[#170306] border border-amber-950/40 hover:border-amber-500/40 rounded-2xl p-4 text-center cursor-pointer transition-all duration-200 group hover:-translate-y-0.5 hover:shadow-lg"
            >
              <SafeLogo
                src={comp.logoUrl}
                alt={comp.name}
                className="w-12 h-12 rounded-xl bg-white/5 p-1.5 border border-white/10 mx-auto object-contain mb-2 group-hover:scale-105 transition-transform"
                fallback={<Trophy className="w-6 h-6" />}
                fallbackClassName="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 mx-auto flex items-center justify-center text-amber-400 mb-2"
              />
              <h4 className="text-xs font-bold text-white group-hover:text-amber-300 transition-colors truncate">
                {comp.name}
              </h4>
              <p className="text-[10px] text-zinc-400 truncate mt-0.5">{comp.country}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ======================================================== */}
      {/* 3. 6 PILARES TÁTICOS (CENTRO DE INTELIGÊNCIA) */}
      {/* ======================================================== */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-base md:text-lg font-bold text-white tracking-tight">
              MÓDULOS DE INTELIGÊNCIA TÁTICA
            </h3>
            <p className="text-xs text-zinc-400">Ferramentas de análise profunda e planejamento</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* CARD 1: ANALISAR UMA PARTIDA */}
          <div
            onClick={() => onNavigate('new-analysis')}
            className="group bg-[#1c0307] hover:bg-[#250409] border border-amber-950/40 hover:border-amber-500/50 rounded-2xl p-5 transition-all duration-200 flex flex-col justify-between cursor-pointer hover:shadow-xl hover:-translate-y-1"
          >
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 group-hover:scale-110 transition-transform">
                <Video className="h-5 w-5" />
              </div>
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-amber-500">Pilar 1 · Diagnóstico</span>
                <h3 className="text-base font-bold text-white group-hover:text-amber-200 transition-colors mt-0.5">
                  🎥 NOVA ANÁLISE DE VÍDEO
                </h3>
                <p className="text-xs text-zinc-300 mt-1.5 leading-relaxed">
                  Gere relatório completo com fases de jogo, dados e índices de confiança.
                </p>
              </div>
            </div>
            <div className="pt-4 mt-3 border-t border-amber-950/30 flex items-center justify-between text-xs font-bold text-amber-300">
              <span>CRIAR ANÁLISE</span>
              <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>

          {/* CARD 2: ESTUDAR UM ADVERSÁRIO */}
          <div
            onClick={() => onNavigate('opponents')}
            className="group bg-[#1c0307] hover:bg-[#250409] border border-amber-950/40 hover:border-amber-500/50 rounded-2xl p-5 transition-all duration-200 flex flex-col justify-between cursor-pointer hover:shadow-xl hover:-translate-y-1"
          >
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 group-hover:scale-110 transition-transform">
                <Search className="h-5 w-5" />
              </div>
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-amber-500">Pilar 2 · Preparação</span>
                <h3 className="text-base font-bold text-white group-hover:text-amber-200 transition-colors mt-0.5">
                  🔎 DOSSIÊ DO ADVERSÁRIO
                </h3>
                <p className="text-xs text-zinc-300 mt-1.5 leading-relaxed">
                  Descubra padrões táticos, vulnerabilidades defensivas e diretrizes de exploração.
                </p>
              </div>
            </div>
            <div className="pt-4 mt-3 border-t border-amber-950/30 flex items-center justify-between text-xs font-bold text-amber-300">
              <span>GERAR DOSSIÊ</span>
              <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>

          {/* CARD 3: AVALIAR UM JOGADOR */}
          <div
            onClick={() => onNavigate('players')}
            className="group bg-[#1c0307] hover:bg-[#250409] border border-amber-950/40 hover:border-amber-500/50 rounded-2xl p-5 transition-all duration-200 flex flex-col justify-between cursor-pointer hover:shadow-xl hover:-translate-y-1"
          >
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 group-hover:scale-110 transition-transform">
                <UserCheck className="h-5 w-5" />
              </div>
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-amber-500">Pilar 3 · Scouting</span>
                <h3 className="text-base font-bold text-white group-hover:text-amber-200 transition-colors mt-0.5">
                  👤 SCOUTING & JOGADORES
                </h3>
                <p className="text-xs text-zinc-300 mt-1.5 leading-relaxed">
                  Identificação auditada com fotos oficiais confirmadas e evolução individual.
                </p>
              </div>
            </div>
            <div className="pt-4 mt-3 border-t border-amber-950/30 flex items-center justify-between text-xs font-bold text-amber-300">
              <span>EXPLORAR ATLETAS</span>
              <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>

          {/* CARD 4: MINHA EQUIPE */}
          <div
            onClick={() => onNavigate('my-team')}
            className="group bg-[#1c0307] hover:bg-[#250409] border border-amber-950/40 hover:border-amber-500/50 rounded-2xl p-5 transition-all duration-200 flex flex-col justify-between cursor-pointer hover:shadow-xl hover:-translate-y-1"
          >
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 group-hover:scale-110 transition-transform">
                <TrendingUp className="h-5 w-5" />
              </div>
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-amber-500">Pilar 4 · Evolução</span>
                <h3 className="text-base font-bold text-white group-hover:text-amber-200 transition-colors mt-0.5">
                  📈 MINHA EQUIPE & EVOLUÇÃO
                </h3>
                <p className="text-xs text-zinc-300 mt-1.5 leading-relaxed">
                  Compare partidas consecutivas, histórico de evolução e compactação tática.
                </p>
              </div>
            </div>
            <div className="pt-4 mt-3 border-t border-amber-950/30 flex items-center justify-between text-xs font-bold text-amber-300">
              <span>VER EVOLUÇÃO</span>
              <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>

          {/* CARD 5: PLANO DE TREINO */}
          <div
            onClick={() => onNavigate('training-plan')}
            className="group bg-[#1c0307] hover:bg-[#250409] border border-amber-950/40 hover:border-amber-500/50 rounded-2xl p-5 transition-all duration-200 flex flex-col justify-between cursor-pointer hover:shadow-xl hover:-translate-y-1"
          >
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 group-hover:scale-110 transition-transform">
                <Dumbbell className="h-5 w-5" />
              </div>
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-amber-500">Pilar 5 · Aplicação</span>
                <h3 className="text-base font-bold text-white group-hover:text-amber-200 transition-colors mt-0.5">
                  🧠 PLANO DE TREINAMENTO
                </h3>
                <p className="text-xs text-zinc-300 mt-1.5 leading-relaxed">
                  Transforme diagnósticos táticos em sessões práticas de campo estruturadas.
                </p>
              </div>
            </div>
            <div className="pt-4 mt-3 border-t border-amber-950/30 flex items-center justify-between text-xs font-bold text-amber-300">
              <span>PLANEJAR TREINO</span>
              <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>

          {/* CARD 6: QUADRO TÁTICO */}
          <div
            onClick={() => onNavigate('tactical-board')}
            className="group bg-[#1c0307] hover:bg-[#250409] border border-amber-950/40 hover:border-amber-500/50 rounded-2xl p-5 transition-all duration-200 flex flex-col justify-between cursor-pointer hover:shadow-xl hover:-translate-y-1"
          >
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 group-hover:scale-110 transition-transform">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-amber-500">Pilar 6 · Estratégia</span>
                <h3 className="text-base font-bold text-white group-hover:text-amber-200 transition-colors mt-0.5">
                  📋 QUADRO TÁTICO
                </h3>
                <p className="text-xs text-zinc-300 mt-1.5 leading-relaxed">
                  Prancheta tática interativa para desenhar jogadas, movimentações e esquemas.
                </p>
              </div>
            </div>
            <div className="pt-4 mt-3 border-t border-amber-950/30 flex items-center justify-between text-xs font-bold text-amber-300">
              <span>ABRIR PRANCHETA</span>
              <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 4. ÚLTIMAS ANÁLISES DO USUÁRIO */}
      {/* ======================================================== */}
      {recentAnalyses && recentAnalyses.length > 0 && (
        <div className="bg-[#170306] border border-amber-950/40 rounded-2xl p-6 space-y-4 shadow-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <PlayCircle className="h-5 w-5 text-amber-400" />
              <h3 className="text-base font-bold text-white">Minhas Últimas Análises</h3>
            </div>
            <button
              onClick={() => onNavigate('matches')}
              className="text-xs font-semibold text-amber-400 hover:text-amber-300 flex items-center gap-1 cursor-pointer"
            >
              Ver histórico completo ({recentAnalyses.length})
              <ArrowRight className="h-3 w-3" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {recentAnalyses.slice(0, 3).map((item) => (
              <div
                key={item.id}
                onClick={() => onOpenAnalysis(item.id)}
                className="bg-black/40 hover:bg-amber-950/30 border border-amber-950/40 hover:border-amber-500/40 rounded-xl p-4 transition-all cursor-pointer flex flex-col justify-between group shadow-sm"
              >
                <div className="space-y-1.5">
                  <div className="flex justify-between items-start gap-2">
                    <span className="text-[10px] font-mono text-zinc-400">
                      {new Date(item.created_at).toLocaleDateString('pt-BR')}
                    </span>
                    {item.score && item.score !== 'não identificado' && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 bg-amber-500/10 text-amber-300 border border-amber-500/30 rounded">
                        {item.score}
                      </span>
                    )}
                  </div>
                  <h4 className="text-xs font-bold text-white group-hover:text-amber-300 line-clamp-2 transition-colors">
                    {item.title}
                  </h4>
                </div>

                <div className="pt-3 mt-2 border-t border-amber-950/30 flex items-center justify-between text-[10px] text-zinc-400">
                  <span className="truncate max-w-[140px]">{item.competition || 'Geral'}</span>
                  <span className="text-amber-400 font-bold group-hover:underline">Abrir Relatório →</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default HomeDashboard;
