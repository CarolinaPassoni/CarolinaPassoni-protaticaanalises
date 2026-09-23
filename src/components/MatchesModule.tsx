import React, { useState, useEffect } from 'react';
import {
  Trophy,
  Calendar,
  Search,
  Filter,
  PlayCircle,
  CheckCircle2,
  Star,
  MapPin,
  Clock,
  Sparkles,
  ExternalLink,
  ChevronRight
} from 'lucide-react';
import { Match, Competition } from '../types';
import PlayerPhoto from './PlayerPhoto';
import SafeLogo from './SafeLogo';
import { resolveMatchVideoSource } from '../services/matchSourceService';
import { getAuthHeaders } from '../services/geminiService';

interface MatchesModuleProps {
  onSelectMatchToAnalyze: (match: Match) => void;
  onOpenAnalysis: (analysisId: string) => void;
  onNavigateToCompetition?: (competitionId: string) => void;
  isAdmin?: boolean;
}

export const MatchesModule: React.FC<MatchesModuleProps> = ({
  onSelectMatchToAnalyze,
  onOpenAnalysis,
  onNavigateToCompetition,
  isAdmin = false,
}) => {
  const [matches, setMatches] = useState<Match[]>([]);
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedCompId, setSelectedCompId] = useState<string>('all');
  const [filterFeatured, setFilterFeatured] = useState<boolean>(false);
  const [resolvingMatchId, setResolvingMatchId] = useState<string | null>(null);

  const fetchData = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const [matchesRes, compRes] = await Promise.all([
        fetch('/api/matches'),
        fetch('/api/competitions'),
      ]);

      if (matchesRes.ok) {
        const data = await matchesRes.json();
        setMatches(data.matches || []);
      }
      if (compRes.ok) {
        const cData = await compRes.json();
        setCompetitions(cData.competitions || []);
      }
    } catch (err) {
      console.error('Error fetching matches:', err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const refreshTimer = window.setInterval(() => fetchData(true), 60 * 1000);
    return () => window.clearInterval(refreshTimer);
  }, []);

  const handleSetVideoUrl = async (match: Match) => {
    const current = match.videoUrl || '';
    const next = window.prompt(
      'Informe a URL do vídeo da partida no YouTube. Deixe vazio para remover o vínculo.',
      current
    );
    if (next === null) return;

    const trimmed = next.trim();
    if (trimmed && !/^https?:\/\/(?:www\.|m\.)?(?:youtube\.com|youtu\.be)\//i.test(trimmed)) {
      window.alert('Use uma URL válida do YouTube.');
      return;
    }

    try {
      const res = await fetch('/api/matches', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ ...match, videoUrl: trimmed }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        window.alert(data.error || 'Não foi possível atualizar a URL do vídeo.');
        return;
      }
      if (data.match) {
        setMatches((prev) => prev.map((m) => (m.id === match.id ? data.match : m)));
      } else {
        await fetchData();
      }
    } catch (err) {
      console.error('Error updating match video URL:', err);
      window.alert('Falha de conexão ao atualizar a URL do vídeo.');
    }
  };


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

  const filteredMatches = matches.filter((m) => {
    const matchesSearch =
      m.homeTeam.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.awayTeam.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (m.competitionName && m.competitionName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (m.featuredPlayerName && m.featuredPlayerName.toLowerCase().includes(searchTerm.toLowerCase()));

    if (!matchesSearch) return false;
    if (selectedCompId !== 'all' && m.competitionId !== selectedCompId) return false;
    if (filterFeatured && !m.isFeatured) return false;
    return true;
  });

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Header Banner */}
      <div className="relative rounded-2xl bg-gradient-to-r from-[#200308] via-[#160205] to-[#0d0103] border border-amber-900/30 p-6 md:p-8 overflow-hidden shadow-xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-semibold uppercase tracking-wider mb-3">
            <Trophy className="w-3.5 h-3.5" /> Grade de Partidas Globais
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
            PARTIDAS & CONFRONTOS
          </h1>
          <p className="text-sm text-zinc-300 mt-2 leading-relaxed">
            Consulte jogos, destaques individuais com fotos auditadas e execute análises táticas aprofundadas.
          </p>
        </div>

        {/* Search and Filters */}
        <div className="mt-6 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar por clube, atleta ou competição..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-zinc-900/80 border border-zinc-800 focus:border-amber-500/50 rounded-xl text-sm text-white placeholder-zinc-500 outline-none transition-all"
            />
          </div>

          <div className="flex items-center gap-2">
            <select
              value={selectedCompId}
              onChange={(e) => setSelectedCompId(e.target.value)}
              className="bg-zinc-900/80 border border-zinc-800 text-xs text-zinc-300 rounded-xl px-3 py-2.5 outline-none focus:border-amber-500/50"
            >
              <option value="all">Todas as Competições</option>
              {competitions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>

            <button
              onClick={() => setFilterFeatured(!filterFeatured)}
              className={`px-3 py-2.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all flex items-center gap-1.5 ${
                filterFeatured
                  ? 'bg-amber-500 text-black font-bold shadow-md shadow-amber-500/20'
                  : 'bg-zinc-900/80 text-zinc-400 border border-zinc-800 hover:text-white'
              }`}
            >
              <Star className={`w-3.5 h-3.5 ${filterFeatured ? 'fill-black' : ''}`} />
              Destaques
            </button>
          </div>
        </div>
      </div>

      {/* Matches Grid */}
      {loading ? (
        <div className="text-center py-16 text-zinc-400 text-sm">Carregando confrontos...</div>
      ) : filteredMatches.length === 0 ? (
        <div className="bg-zinc-900/40 border border-zinc-800 rounded-2xl p-12 text-center text-zinc-400">
          Nenhuma partida encontrada para os critérios selecionados.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredMatches.map((match) => {
            const hasAnalysis = Boolean(match.analysisId);
            const canAnalyze = Boolean(match.videoUrl) || ['finished', 'finished_waiting_video'].includes(match.status);
            return (
              <div
                key={match.id}
                className="bg-gradient-to-b from-[#1c0307] to-[#120204] border border-amber-950/40 hover:border-amber-500/40 rounded-2xl p-5 flex flex-col justify-between transition-all duration-300 shadow-md"
              >
                <div>
                  {/* Top Bar: Comp Name & Round */}
                  <div className="flex items-center justify-between gap-2 pb-3 mb-3 border-b border-amber-950/30 text-xs">
                    <div className="flex items-center gap-2">
                      <SafeLogo
                        src={match.competitionLogo}
                        alt={match.competitionName || 'Competição'}
                        className="w-4 h-4 object-contain"
                        fallback={<Trophy className="w-4 h-4 text-amber-400" />}
                        fallbackClassName="w-4 h-4 flex items-center justify-center"
                      />
                      <span className="font-semibold text-amber-400 truncate max-w-[160px]">
                        {match.competitionName || 'Competição'}
                      </span>
                    </div>

                    <span className="text-zinc-400 text-[11px] flex items-center gap-1 font-mono">
                      <Clock className="w-3 h-3 text-amber-400/80" />
                      {match.matchDate}
                    </span>
                  </div>

                  {/* Versus Teams Layout */}
                  <div className="flex items-center justify-between gap-4 py-2">
                    {/* Home Team */}
                    <div className="flex-1 text-center">
                      <div className="relative w-12 h-12 mx-auto rounded-xl bg-zinc-900/60 p-2 border border-zinc-800 flex items-center justify-center mb-2 overflow-hidden">
                        <span className="text-sm font-bold text-amber-400">{match.homeTeam.slice(0, 3)}</span>
                        {match.homeTeamLogo && (
                          <img
                            src={match.homeTeamLogo}
                            alt=""
                            className="absolute inset-1 w-[calc(100%-0.5rem)] h-[calc(100%-0.5rem)] object-contain bg-[#170306]"
                            onError={(e) => { e.currentTarget.style.display = 'none'; }}
                          />
                        )}
                      </div>
                      <h4 className="font-bold text-sm text-white truncate">{match.homeTeam}</h4>
                    </div>

                    {/* Middle Score / VS */}
                    <div className="text-center shrink-0">
                      {match.status !== 'scheduled' && match.homeScore !== null && match.awayScore !== null ? (
                        <div className="text-lg font-black text-white font-mono bg-zinc-900/80 px-3 py-1 rounded-lg border border-zinc-800">
                          {match.homeScore} x {match.awayScore}
                        </div>
                      ) : (
                        <span className="text-xs font-extrabold text-amber-500/80 bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/20">
                          VS
                        </span>
                      )}
                      {match.stadium && (
                        <p className="text-[10px] text-zinc-500 mt-1.5 truncate max-w-[130px]">
                          {match.stadium}
                        </p>
                      )}
                    </div>

                    {/* Away Team */}
                    <div className="flex-1 text-center">
                      <div className="relative w-12 h-12 mx-auto rounded-xl bg-zinc-900/60 p-2 border border-zinc-800 flex items-center justify-center mb-2 overflow-hidden">
                        <span className="text-sm font-bold text-amber-400">{match.awayTeam.slice(0, 3)}</span>
                        {match.awayTeamLogo && (
                          <img
                            src={match.awayTeamLogo}
                            alt=""
                            className="absolute inset-1 w-[calc(100%-0.5rem)] h-[calc(100%-0.5rem)] object-contain bg-[#170306]"
                            onError={(e) => { e.currentTarget.style.display = 'none'; }}
                          />
                        )}
                      </div>
                      <h4 className="font-bold text-sm text-white truncate">{match.awayTeam}</h4>
                    </div>
                  </div>

                  {/* Player Spotlight Card */}
                  {match.featuredPlayerName && (
                    <div className="mt-4 p-2.5 rounded-xl bg-[#140205] border border-amber-950/40 flex items-center gap-3">
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

                {/* Admin source-video control */}
                {isAdmin && (
                  <div className="mt-4 flex items-center justify-between gap-2 rounded-xl border border-zinc-800 bg-black/30 px-3 py-2">
                    <div className="min-w-0">
                      <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold">Vídeo-fonte</p>
                      <p className={`text-[11px] truncate ${match.videoUrl ? 'text-emerald-400' : 'text-amber-400'}`}>
                        {match.videoUrl ? 'Fonte localizada' : match.status === 'scheduled' ? 'Busca automática após o término' : match.status === 'live' ? 'Aguardando término da partida' : match.status === 'finished_waiting_video' ? 'Buscando vídeo validado' : 'Fonte automática ao analisar'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleSetVideoUrl(match)}
                      disabled={match.status === 'scheduled' || match.status === 'live'}
                      className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5 text-[10px] font-bold text-amber-300 hover:bg-amber-500/20 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-amber-500/10"
                    >
                      <ExternalLink className="w-3 h-3" />
                      {match.videoUrl ? 'Ajustar fonte' : (match.status === 'scheduled' || match.status === 'live') ? 'Após o término' : 'Definir manualmente'}
                    </button>
                  </div>
                )}

                {/* Actions Footer */}
                <div className="mt-5 pt-3 border-t border-amber-950/30 flex items-center justify-between gap-3">
                  {hasAnalysis ? (
                    <button
                      onClick={() => onOpenAnalysis(match.analysisId!)}
                      className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-bold text-xs rounded-xl shadow-md shadow-emerald-900/20 transition-all"
                    >
                      <CheckCircle2 className="w-4 h-4" /> VER ANÁLISE DISPONÍVEL
                    </button>
                  ) : canAnalyze ? (
                    <button
                      onClick={() => handleAnalyzeMatch(match)}
                      disabled={resolvingMatchId === match.id}
                      className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 disabled:opacity-60 disabled:cursor-wait text-black font-bold text-xs rounded-xl shadow-md shadow-amber-500/20 transition-all"
                    >
                      <PlayCircle className="w-4 h-4" />
                      {resolvingMatchId === match.id ? 'LOCALIZANDO VÍDEO...' : 'ANALISAR ESTA PARTIDA'}
                    </button>
                  ) : (
                    <div className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-zinc-900/70 border border-zinc-800 text-zinc-400 font-bold text-xs rounded-xl">
                      <Clock className="w-4 h-4" />
                      {match.status === 'scheduled' ? 'PARTIDA AGENDADA' : match.status === 'live' ? 'PARTIDA EM ANDAMENTO' : 'AGUARDANDO VÍDEO DA PARTIDA'}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default MatchesModule;
