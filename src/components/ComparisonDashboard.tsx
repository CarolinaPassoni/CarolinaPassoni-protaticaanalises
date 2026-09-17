import React, { useEffect, useState, useMemo } from 'react';
import { fetchAllFullAnalyses, deleteAnalysis } from '../services/geminiService';
import type { Analysis } from '../types';
import ErrorBoundary from './ErrorBoundary';
import { useLanguage } from '../context/LanguageContext';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  Printer,
  ChevronRight,
  Trash2,
  Sliders,
  Check,
  Award,
  Circle,
  HelpCircle
} from 'lucide-react';

interface ComparisonDashboardProps {
  onOpenAnalysis: (id: string) => void;
}

interface ProcessedGame {
  id: string;
  date: string;
  opponent: string;
  homeOrAway: 'Home' | 'Away';
  goalsScored: number;
  goalsConceded: number;
  possession: number;
  shots: number;
  shotsOnTarget: number;
  corners: number;
  passesCertos: number;
  desarmes: number;
  faltasCometidas: number;
  result: 'W' | 'D' | 'L'; // Win, Draw, Loss
  points: number;
  videoTitle: string;
  confidence: string;
  analysisObj: Analysis;
}

const parseDateToMs = (dateStr: string): number => {
  if (!dateStr) return 0;
  const cleanStr = dateStr.trim();
  if (cleanStr.includes('T') || cleanStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
    const ms = new Date(cleanStr).getTime();
    if (!isNaN(ms)) return ms;
  }
  const parts = cleanStr.split(/[\/\-]/);
  if (parts.length === 3) {
    let day = parseInt(parts[0], 10);
    let month = parseInt(parts[1], 10) - 1;
    let year = parseInt(parts[2], 10);
    if (parts[0].length === 4) {
      year = parseInt(parts[0], 10);
      month = parseInt(parts[1], 10) - 1;
      day = parseInt(parts[2], 10);
    }
    const d = new Date(year, month, day);
    if (!isNaN(d.getTime())) return d.getTime();
  }
  const msFallback = new Date(cleanStr).getTime();
  return isNaN(msFallback) ? 0 : msFallback;
};

export const ComparisonDashboard: React.FC<ComparisonDashboardProps> = ({ onOpenAnalysis }) => {
  const { language } = useLanguage();
  const [allAnalyses, setAllAnalyses] = useState<Analysis[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filtros de Comparativo
  const [selectedTeam, setSelectedTeam] = useState<string>('');
  const [selectedGames, setSelectedGames] = useState<string[]>([]); // id dos jogos selecionados

  // Seleções para Comparador de Radar
  const [radarGameAId, setRadarGameAId] = useState<string>('');
  const [radarGameBId, setRadarGameBId] = useState<string>('');

  // Carregar dados
  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchAllFullAnalyses();
      setAllAnalyses(data);
      if (data.length > 0) {
        // Encontrar o time mais frequente ou usar o primeiro encontrado como padrão
        const teamsSet = new Set<string>();
        data.forEach(item => {
          if (item.timeA) teamsSet.add(item.timeA);
          if (item.timeB) teamsSet.add(item.timeB);
        });
        const teams = Array.from(teamsSet);
        if (teams.length > 0 && !selectedTeam) {
          setSelectedTeam(teams[0]);
        }
      }
    } catch (e: any) {
      setError(e.message || 'Erro ao carregar comparativos.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Lista dos times disponíveis
  const allTeams = useMemo(() => {
    const teamsSet = new Set<string>();
    allAnalyses.forEach(item => {
      if (item.timeA) teamsSet.add(item.timeA);
      if (item.timeB) teamsSet.add(item.timeB);
    });
    return Array.from(teamsSet).sort();
  }, [allAnalyses]);

  // Processamento de todos os jogos para o time selecionado
  const processedGames: ProcessedGame[] = useMemo(() => {
    if (!selectedTeam) return [];
    
    return allAnalyses
      .filter(item => {
        const teamA = String(item.timeA || '').toLowerCase();
        const teamB = String(item.timeB || '').toLowerCase();
        const selected = selectedTeam.toLowerCase();
        return teamA === selected || teamB === selected;
      })
      .map(item => {
        const isTimeA = String(item.timeA || '').toLowerCase() === selectedTeam.toLowerCase();
        const opponent = isTimeA ? item.timeB : item.timeA;
        const homeOrAway = (isTimeA ? 'Home' : 'Away') as 'Home' | 'Away';
        
        // Parse placar
        let goalsA = 0;
        let goalsB = 0;
        const scoreStr = item.placar || '0-0';
        const parts = scoreStr.split(/[\sxX-]+/).filter(Boolean);
        if (parts.length >= 2) {
          goalsA = parseInt(parts[0], 10) || 0;
          goalsB = parseInt(parts[1], 10) || 0;
        }

        const goalsScored = isTimeA ? goalsA : goalsB;
        const goalsConceded = isTimeA ? goalsB : goalsA;

        let result: 'W' | 'D' | 'L' = 'D';
        let points = 1;
        if (goalsScored > goalsConceded) {
          result = 'W';
          points = 3;
        } else if (goalsScored < goalsConceded) {
          result = 'L';
          points = 0;
        }

        // Parse possession (e.g. "55%")
        const getMetricNum = (obj: any, key: string, fallback = 0) => {
          if (!obj) return fallback;
          const val = String(obj[key] || '').replace('%', '').trim();
          const parsed = parseFloat(val);
          return isNaN(parsed) ? fallback : parsed;
        };

        const possession = isTimeA 
          ? getMetricNum(item.estatisticas?.posseDeBola, 'timeA', 50)
          : getMetricNum(item.estatisticas?.posseDeBola, 'timeB', 50);

        const shots = isTimeA 
          ? getMetricNum(item.estatisticas?.finalizacoes, 'timeA', 0)
          : getMetricNum(item.estatisticas?.finalizacoes, 'timeB', 0);

        const shotsOnTarget = isTimeA 
          ? getMetricNum(item.estatisticas?.finalizacoesNoAlvo, 'timeA', 0)
          : getMetricNum(item.estatisticas?.finalizacoesNoAlvo, 'timeB', 0);

        const corners = isTimeA 
          ? getMetricNum(item.estatisticas?.escanteios, 'timeA', 0)
          : getMetricNum(item.estatisticas?.escanteios, 'timeB', 0);

        const passesCertos = isTimeA 
          ? getMetricNum(item.estatisticas?.passesCertos, 'timeA', 75)
          : getMetricNum(item.estatisticas?.passesCertos, 'timeB', 75);

        const desarmes = isTimeA 
          ? getMetricNum(item.estatisticas?.desarmes, 'timeA', 12)
          : getMetricNum(item.estatisticas?.desarmes, 'timeB', 12);

        const faltasCometidas = isTimeA 
          ? getMetricNum(item.estatisticas?.faltasCometidas, 'timeA', 10)
          : getMetricNum(item.estatisticas?.faltasCometidas, 'timeB', 10);

        // Date extraction
        let date = item.contextoPartida?.dataJogo || '';
        if (!date && item.createdAt) {
          date = item.createdAt.substring(0, 10);
        }

        return {
          id: item.analysisId || '',
          date: date || 'S/D',
          opponent,
          homeOrAway,
          goalsScored,
          goalsConceded,
          possession,
          shots,
          shotsOnTarget,
          corners,
          passesCertos,
          desarmes,
          faltasCometidas,
          result,
          points,
          videoTitle: item.videoTitle,
          confidence: item.verificacaoAuditoria?.nivelConfianca || item.placarAuditoria?.confianca || 'alta',
          analysisObj: item,
        };
      })
      // Classifica em ordem cronológica para ver a evolução
      .sort((a, b) => parseDateToMs(a.date) - parseDateToMs(b.date));
  }, [allAnalyses, selectedTeam]);

  // Inicializa seleção das partidas ao trocar de time
  useEffect(() => {
    if (processedGames.length > 0) {
      setSelectedGames(processedGames.map(g => g.id));
      if (processedGames.length >= 2) {
        setRadarGameAId(processedGames[processedGames.length - 2].id);
        setRadarGameBId(processedGames[processedGames.length - 1].id);
      } else {
        setRadarGameAId(processedGames[0].id);
        setRadarGameBId('');
      }
    } else {
      setSelectedGames([]);
      setRadarGameAId('');
      setRadarGameBId('');
    }
  }, [processedGames]);

  // Filtrado com base nas escolhas ativas do checklist (RF04 / 1.2.2)
  const activeGames = useMemo(() => {
    return processedGames.filter(g => selectedGames.includes(g.id));
  }, [processedGames, selectedGames]);

  // Seleções do checklist
  const handleSelectAll = () => {
    setSelectedGames(processedGames.map(g => g.id));
  };

  const handleSelectNone = () => {
    setSelectedGames([]);
  };

  const handleSelectLast5 = () => {
    const sorted = [...processedGames].sort((a, b) => parseDateToMs(b.date) - parseDateToMs(a.date));
    setSelectedGames(sorted.slice(0, 5).map(g => g.id));
  };

  const toggleSelectGame = (id: string) => {
    setSelectedGames(prev =>
      prev.includes(id) ? prev.filter(gid => gid !== id) : [...prev, id]
    );
  };

  // 1.2.1 - Comparação jogo a jogo (deltas) com o predecessor imediato na lista total do time
  const gameDeltas = useMemo(() => {
    const deltas: Record<string, {
      possession: number;
      shotsOnTarget: number;
      points: number;
      goalsConceded: number;
    }> = {};

    processedGames.forEach((game, idx) => {
      if (idx === 0) {
        deltas[game.id] = { possession: 0, shotsOnTarget: 0, points: 0, goalsConceded: 0 };
      } else {
        const prev = processedGames[idx - 1];
        deltas[game.id] = {
          possession: game.possession - prev.possession,
          shotsOnTarget: game.shotsOnTarget - prev.shotsOnTarget,
          points: game.points - prev.points,
          goalsConceded: game.goalsConceded - prev.goalsConceded,
        };
      }
    });

    return deltas;
  }, [processedGames]);

  // Averages do dataset ativo
  const averages = useMemo(() => {
    if (activeGames.length === 0) return {
      possession: 0,
      shots: 0,
      shotsOnTarget: 0,
      goalsScored: 0,
      goalsConceded: 0,
      pointsPercentage: 0,
      points: 0,
      winCount: 0,
      drawCount: 0,
      lossCount: 0,
      gamesCount: 0
    };

    let totalPossession = 0;
    let totalShots = 0;
    let totalShotsOnTarget = 0;
    let totalGoalsScored = 0;
    let totalGoalsConceded = 0;
    let totalPoints = 0;
    let winCount = 0;
    let drawCount = 0;
    let lossCount = 0;

    activeGames.forEach(g => {
      totalPossession += g.possession;
      totalShots += g.shots;
      totalShotsOnTarget += g.shotsOnTarget;
      totalGoalsScored += g.goalsScored;
      totalGoalsConceded += g.goalsConceded;
      totalPoints += g.points;
      if (g.result === 'W') winCount++;
      else if (g.result === 'D') drawCount++;
      else lossCount++;
    });

    const gamesCount = activeGames.length;
    const maxPossPoints = gamesCount * 3;
    const pointsPercentage = maxPossPoints > 0 ? Math.round((totalPoints / maxPossPoints) * 100) : 0;

    return {
      possession: Math.round((totalPossession / gamesCount) * 10) / 10,
      shots: Math.round((totalShots / gamesCount) * 10) / 10,
      shotsOnTarget: Math.round((totalShotsOnTarget / gamesCount) * 10) / 10,
      goalsScored: Math.round((totalGoalsScored / gamesCount) * 10) / 10,
      goalsConceded: Math.round((totalGoalsConceded / gamesCount) * 10) / 10,
      pointsPercentage,
      points: totalPoints,
      winCount,
      drawCount,
      lossCount,
      gamesCount
    };
  }, [activeGames]);

  // Dicionário de tradução Localizado para o Radar
  const radarLabels = useMemo(() => {
    const labelsMap: Record<string, Record<string, string>> = {
      pt: {
        radarTitle: 'Radar de Comparação Tática Direta',
        radarSubtitle: 'Compare o perfil de métricas de duas partidas de forma normalizada (0 - 100)',
        matchA: 'Partida A (Amarelo)',
        matchB: 'Partida B (Azul)',
        chooseMatch: 'Escolha uma partida...',
        noGamesForRadar: 'Selecione ou adicione mais partidas deste time no histórico para liberar a comparação por radar.',
        metricPossession: 'Posse de Bola (%)',
        metricPasses: 'Precisão de Passes (%)',
        metricGoals: 'Gols Marcados (Norm.)',
        metricShots: 'Finalizações (Norm.)',
        metricShotsOnTarget: 'No Alvo (Norm.)',
        metricCorners: 'Escanteios (Norm.)',
        metricTackles: 'Desarmes (Norm.)',
        metricFouls: 'Faltas (Norm.)',
        versus: 'vs',
        rawValuesHeader: 'Tabela de Valores Originais',
        partida: 'Partida',
        metrica: 'Métrica'
      },
      en: {
        radarTitle: 'Direct Tactical Radar Comparison',
        radarSubtitle: 'Compare metrics profile of two matches on a normalized scale (0 - 100)',
        matchA: 'Match A (Yellow)',
        matchB: 'Match B (Blue)',
        chooseMatch: 'Choose a match...',
        noGamesForRadar: 'Please select or add more games for this team to enable radar comparison.',
        metricPossession: 'Possession (%)',
        metricPasses: 'Pass Accuracy (%)',
        metricGoals: 'Goals Scored (Norm)',
        metricShots: 'Shots (Norm)',
        metricShotsOnTarget: 'Shots on Target (Norm)',
        metricCorners: 'Corners (Norm)',
        metricTackles: 'Tackles (Norm)',
        metricFouls: 'Fouls (Norm)',
        versus: 'vs',
        rawValuesHeader: 'Original Values Table',
        partida: 'Match',
        metrica: 'Metric'
      },
      es: {
        radarTitle: 'Radar de Comparación Táctica Directa',
        radarSubtitle: 'Compare el perfil de métricas de dos partidos en escala normalizada (0 - 100)',
        matchA: 'Partido A (Amarillo)',
        matchB: 'Partido B (Azul)',
        chooseMatch: 'Elegir un partido...',
        noGamesForRadar: 'Seleccione o agregue más partidos de este equipo para activar la comparación de radar.',
        metricPossession: 'Posesión (%)',
        metricPasses: 'Precisión de Pases (%)',
        metricGoals: 'Goles Marcados (Norm)',
        metricShots: 'Remates (Norm)',
        metricShotsOnTarget: 'Chutes al Arco (Norm)',
        metricCorners: 'Córneres (Norm)',
        metricTackles: 'Desarmes (Norm)',
        metricFouls: 'Faltas (Norm)',
        versus: 'vs',
        rawValuesHeader: 'Tabla de Valores Originales',
        partida: 'Partido',
        metrica: 'Métrica'
      }
    };
    return labelsMap[language] || labelsMap.pt;
  }, [language]);

  // Preparação de dados para o gráfico de Radar
  const { radarData, gameAInfo, gameBInfo } = useMemo(() => {
    const gameA = processedGames.find(g => g.id === radarGameAId);
    const gameB = processedGames.find(g => g.id === radarGameBId);

    if (!gameA) {
      return { radarData: [], gameAInfo: null, gameBInfo: null };
    }

    const metricsList = [
      {
        subject: radarLabels.metricPossession,
        getVal: (g: any) => g.possession,
        normVal: (val: number) => Math.min(100, Math.max(0, val)),
      },
      {
        subject: radarLabels.metricPasses,
        getVal: (g: any) => g.passesCertos,
        normVal: (val: number) => Math.min(100, Math.max(0, val)),
      },
      {
        subject: radarLabels.metricGoals,
        getVal: (g: any) => g.goalsScored,
        normVal: (val: number) => Math.min(100, val * 20),
      },
      {
        subject: radarLabels.metricShots,
        getVal: (g: any) => g.shots,
        normVal: (val: number) => Math.min(100, val * 5),
      },
      {
        subject: radarLabels.metricShotsOnTarget,
        getVal: (g: any) => g.shotsOnTarget,
        normVal: (val: number) => Math.min(100, val * 10),
      },
      {
        subject: radarLabels.metricCorners,
        getVal: (g: any) => g.corners,
        normVal: (val: number) => Math.min(100, val * 8),
      },
      {
        subject: radarLabels.metricTackles,
        getVal: (g: any) => g.desarmes,
        normVal: (val: number) => Math.min(100, val * 6),
      },
      {
        subject: radarLabels.metricFouls,
        getVal: (g: any) => g.faltasCometidas,
        normVal: (val: number) => Math.min(100, val * 6),
      }
    ];

    const data = metricsList.map(m => {
      const valA = m.getVal(gameA);
      const valB = gameB ? m.getVal(gameB) : 0;
      return {
        subject: m.subject,
        gameA: Math.round(m.normVal(valA)),
        gameB: gameB ? Math.round(m.normVal(valB)) : 0,
        rawA: valA,
        rawB: valB,
      };
    });

    return {
      radarData: data,
      gameAInfo: gameA,
      gameBInfo: gameB || null,
    };
  }, [processedGames, radarGameAId, radarGameBId, radarLabels]);

  // Exclusão de análise
  const handleDelete = async (id: string) => {
    if (window.confirm('Tem certeza de que deseja remover esta análise permanentemente?')) {
      try {
        await deleteAnalysis(id);
        setSelectedGames(prev => prev.filter(g => g !== id));
        loadData();
      } catch (err: any) {
        alert(err.message || 'Erro ao excluir');
      }
    }
  };

  // RF01 - Impressão consolidada
  const handlePrint = () => {
    window.print();
  };

  // Formatação de badge de variação para deltas
  const renderDeltaBadge = (value: number, type: 'positive-good' | 'negative-good' | 'neutral') => {
    if (value === 0) return <span className="text-xs bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded ml-1 font-mono">0</span>;
    
    let isGood = false;
    if (type === 'positive-good') isGood = value > 0;
    else if (type === 'negative-good') isGood = value < 0;

    const formatted = value > 0 ? `+${value}` : `${value}`;

    if (isGood) {
      return (
        <span className="inline-flex items-center text-xs bg-emerald-950/60 border border-emerald-500/30 text-emerald-300 px-1.5 py-0.5 rounded ml-1 font-mono">
          <TrendingUp size={10} className="mr-0.5" />
          {formatted}
        </span>
      );
    } else {
      return (
        <span className="inline-flex items-center text-xs bg-rose-950/60 border border-rose-500/30 text-rose-300 px-1.5 py-0.5 rounded ml-1 font-mono">
          <TrendingDown size={10} className="mr-0.5" />
          {formatted}
        </span>
      );
    }
  };

  // Se estiver carregando
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-yellow-100">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-yellow-500 mb-4"></div>
        <p>
          {language === 'pt' ? 'Carregando histórico e relatórios comparativos do banco...' : language === 'en' ? 'Loading history and comparative reports from database...' : 'Cargando historial y reportes comparativos de la base de datos...'}
        </p>
      </div>
    );
  }

  // Se não houver análises salvas no banco
  if (allAnalyses.length === 0) {
    return (
      <div className="bg-[#2a0101]/40 border border-yellow-900/30 rounded-xl p-8 text-center text-yellow-100/80 mb-6">
        <div className="text-xl font-bold text-yellow-200 mb-2">
          {language === 'pt' ? 'Sem dados para comparativos' : language === 'en' ? 'No comparative data available' : 'Sin datos para comparativos'}
        </div>
        <p className="mb-4 text-sm">
          {language === 'pt' ? 'Você ainda não possui análises de partidas salvas no banco SQLite local.' : language === 'en' ? 'You don\'t have any game analyses saved in the local SQLite database yet.' : 'Aún no tiene análisis de partidos guardados en la base de datos SQLite local.'}
        </p>
        <p className="text-xs text-yellow-105/55">
          {language === 'pt' ? 'Faça uma nova análise inserindo uma URL do YouTube de melhores momentos no formulário acima. Elas serão salvas automaticamente e ficarão visíveis aqui.' : language === 'en' ? 'Make a new analysis by entering a YouTube video URL in the form above. They will be saved automatically and appear here.' : 'Realice un nuevo análisis ingresando una URL de YouTube en el formulario superior. Se guardarán automáticamente y aparecerán aquí.'}
        </p>
      </div>
    );
  }

  // Gráfico recharts de posse de bola
  const chartData = activeGames.map((g) => ({
    nome: g.opponent.length > 8 ? `${g.opponent.substring(0, 8)}.` : g.opponent,
    gols: g.goalsScored,
    posse: g.possession,
    finalizacoes: g.shots,
    finalizacoesNoAlvo: g.shotsOnTarget,
    fullData: g
  }));

  return (
    <div className="space-y-6">
      
      {/* SEÇÃO PRINCIPAL DE CONFIGURAÇÃO DO COMPARATIVO */}
      <div id="print-controls" className="bg-[#210101]/90 rounded-xl p-4 md:p-6 border border-yellow-900/40 space-y-4 print:hidden">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-yellow-200 flex items-center gap-2">
              <Sliders size={20} className="text-yellow-500" />
              Painel de Evolução do Time
            </h2>
            <p className="text-xs text-yellow-100/60">
              Escolha o time, controle a amostragem de partidas e visualize relatórios consolidados de desempenho.
            </p>
          </div>
          
          <div className="flex gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 bg-yellow-600 hover:bg-yellow-500 text-yellow-950 font-bold px-4 py-2 rounded-lg transition-colors text-sm"
              title="Gerar PDF ou imprimir relatório consolidado estruturado"
            >
              <Printer size={16} />
              Imprimir Relatório
            </button>
          </div>
        </div>

        <div className="grid md:grid-cols-1 gap-4 border-t border-yellow-950/60 pt-4">
          {/* Seletor de Time */}
          <div className="space-y-1 max-w-md">
            <label className="text-xs font-semibold text-yellow-300">Time Sob Análise</label>
            <select
              value={selectedTeam}
              onChange={(e) => {
                setSelectedTeam(e.target.value);
              }}
              className="w-full bg-black/40 border border-yellow-900/60 text-yellow-100 rounded-lg p-2.5 outline-none focus:border-yellow-500 text-sm"
            >
              <option value="">Selecione um time...</option>
              {allTeams.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
        </div>

        {/* REQUISITO 1.2.2 - SELETOR DE PARTIDAS (CHECKLIST) */}
        {processedGames.length > 0 && (
          <div className="bg-black/20 p-3 rounded-lg border border-yellow-950/40">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <span className="text-xs font-bold text-yellow-400">Filtrar Partidas no Dataset ({activeGames.length} de {processedGames.length}):</span>
              <div className="flex gap-2 text-xs">
                <button onClick={handleSelectAll} className="px-2 py-1 bg-yellow-950/50 hover:bg-yellow-900 text-yellow-250 border border-yellow-900/30 rounded">
                  Selecionar Todos
                </button>
                <button onClick={handleSelectNone} className="px-2 py-1 bg-yellow-950/50 hover:bg-yellow-900 text-yellow-250 border border-yellow-900/30 rounded">
                  Limpar
                </button>
                <button onClick={handleSelectLast5} className="px-2 py-1 bg-yellow-950/50 hover:bg-yellow-900 text-yellow-250 border border-yellow-900/30 rounded">
                  Últimos 5
                </button>
              </div>
            </div>
            
            <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto p-1.5 border border-yellow-950/40 rounded scrollbar-thin scrollbar-thumb-yellow-900">
              {processedGames.map((g) => {
                const checked = selectedGames.includes(g.id);
                return (
                  <button
                    key={g.id}
                    onClick={() => toggleSelectGame(g.id)}
                    className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs border transition-all ${
                      checked 
                        ? 'bg-yellow-900/40 border-yellow-650 text-yellow-100' 
                        : 'bg-black/30 border-yellow-950 text-yellow-100/50 hover:border-yellow-900/50'
                    }`}
                  >
                    <span className={`w-3 h-3 rounded-sm flex items-center justify-center border ${checked ? 'bg-yellow-600 border-yellow-500 text-yellow-950' : 'border-yellow-800'}`}>
                      {checked && <Check size={10} />}
                    </span>
                    <span className="font-semibold">{g.opponent}</span>
                    <span className="text-[10px] text-yellow-300/60">({g.date})</span>
                    <span className={`font-mono px-1 rounded ${g.result === 'W' ? 'bg-emerald-950 text-emerald-300' : g.result === 'D' ? 'bg-orange-950 text-orange-300' : 'bg-rose-950 text-rose-300'}`}>
                      {g.goalsScored}-{g.goalsConceded}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {selectedTeam ? (
        <div className="space-y-6">
          
          {/* PAINEL PRINT CONSOLIDADO COMPLETO */}
          <div className="print:block space-y-6">
            
            {/* CABEÇALHO DA COMPATIBILIDADE PRINT */}
            <div className="hidden print:block border-b border-zinc-300 pb-4 mb-6">
              <h1 className="text-3xl font-black text-black">PROTÁTICA — Inteligência Esportiva</h1>
              <p className="text-xs text-zinc-500 font-mono">Relatório Analítico de Rendimento Comparativo</p>
              <div className="mt-4 grid grid-cols-2 text-sm text-zinc-700">
                <div><strong>Time Principal:</strong> <span className="text-zinc-900">{selectedTeam}</span></div>
                <div><strong>Base de Análises:</strong> <span className="text-zinc-900">{activeGames.length} jogos selecionados</span></div>
              </div>
            </div>

            {/* SEÇÃO 1: MÉDIAS GERAIS E INDICADORES ACUMULADOS (RF02 / RF04) */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              
              {/* Rendimento / Aproveitamento */}
              <div className="bg-[#2a0101]/50 p-4 rounded-xl border border-yellow-900/30 print:border-zinc-300 print:bg-transparent">
                <div className="text-yellow-300/70 text-xs font-semibold uppercase tracking-wider print:text-zinc-500">
                  Aproveitamento
                </div>
                <div className="text-3xl font-extrabold text-yellow-100 print:text-zinc-900 mt-1">
                  {averages.pointsPercentage}%
                </div>
                <div className="text-xs text-yellow-250/60 print:text-zinc-500 mt-1">
                  {averages.points} pts acumulados em {averages.gamesCount} jogos
                </div>
                <div className="flex gap-1.5 mt-2 text-[10px] font-bold">
                  <span className="bg-emerald-950/75 text-emerald-300 px-1.5 py-0.5 rounded print:border print:border-zinc-300">{averages.winCount}V</span>
                  <span className="bg-orange-950/75 text-orange-300 px-1.5 py-0.5 rounded print:border print:border-zinc-300">{averages.drawCount}E</span>
                  <span className="bg-rose-950/75 text-rose-300 px-1.5 py-0.5 rounded print:border print:border-zinc-300">{averages.lossCount}D</span>
                </div>
              </div>

              {/* Posse Média */}
              <div className="bg-[#2a0101]/50 p-4 rounded-xl border border-yellow-900/30 print:border-zinc-300 print:bg-transparent">
                <div className="text-yellow-300/70 text-xs font-semibold uppercase tracking-wider print:text-zinc-500">
                  Posse de Bola Média
                </div>
                <div className="text-3xl font-extrabold text-yellow-100 print:text-zinc-900 mt-1">
                  {averages.possession}%
                </div>
                <div className="text-xs text-yellow-250/60 print:text-zinc-500 mt-1">
                  Controle de jogo nas partidas
                </div>
              </div>

              {/* Finalizações Médias */}
              <div className="bg-[#2a0101]/50 p-4 rounded-xl border border-yellow-900/30 print:border-zinc-300 print:bg-transparent">
                <div className="text-yellow-300/70 text-xs font-semibold uppercase tracking-wider print:text-zinc-500">
                  Volumetria de Ataque
                </div>
                <div className="text-3xl font-extrabold text-yellow-100 print:text-zinc-900 mt-1">
                  {averages.shots} / <span className="text-yellow-400 font-bold">{averages.shotsOnTarget}</span>
                </div>
                <div className="text-xs text-yellow-250/60 print:text-zinc-500 mt-1">
                  Geral de Chutes / No Alvo por jogo
                </div>
              </div>

              {/* Equilíbrio de Gols */}
              <div className="bg-[#2a0101]/50 p-4 rounded-xl border border-yellow-900/30 print:border-zinc-300 print:bg-transparent">
                <div className="text-yellow-300/70 text-xs font-semibold uppercase tracking-wider print:text-zinc-500">
                  Média de Gols (M./S.)
                </div>
                <div className="text-3xl font-extrabold text-yellow-100 print:text-zinc-900 mt-1 text-emerald-400">
                  {averages.goalsScored} <span className="text-yellow-250 font-normal">vs</span> <span className="text-rose-400">{averages.goalsConceded}</span>
                </div>
                <div className="text-xs text-yellow-250/60 print:text-zinc-500 mt-1 font-mono">
                  Saldo Médio: {(averages.goalsScored - averages.goalsConceded).toFixed(1)} gols
                </div>
              </div>

            </div>

            {/* SEÇÃO 2: GRÁFICOS DE EVOLUÇÃO (RF04) */}
            <div className="grid lg:grid-cols-2 gap-6 print:block print:space-y-8">
              
              {/* Gráfico 1: Evolução da Posse e Chutes no Alvo */}
              <div className="bg-[#210101]/60 p-4 rounded-xl border border-yellow-900/30 print:border-none print:bg-transparent print:p-0">
                <h3 className="text-sm font-bold text-yellow-200 mb-4 print:text-zinc-900">Evolução do Controle de Jogo & Finalizações</h3>
                {chartData.length > 0 ? (
                  <div className="h-64 w-full">
                    <ErrorBoundary>
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#3a0404" className="print:stroke-zinc-200" />
                          <XAxis dataKey="nome" stroke="#a16207" className="print:stroke-zinc-500" fontSize={11} />
                          <YAxis stroke="#a16207" className="print:stroke-zinc-500" fontSize={11} />
                          <Tooltip contentStyle={{ backgroundColor: '#1c1917', border: '1px solid #78350f', color: '#fef3c7' }} />
                          <Legend wrapperStyle={{ fontSize: '11px' }} />
                          <Line type="monotone" dataKey="posse" name="Posse de Bola (%)" stroke="#eab308" strokeWidth={3} activeDot={{ r: 8 }} />
                          <Line type="monotone" dataKey="finalizacoesNoAlvo" name="Chutes no Alvo" stroke="#34d399" strokeWidth={2} />
                        </LineChart>
                      </ResponsiveContainer>
                    </ErrorBoundary>
                  </div>
                ) : (
                  <p className="text-center text-xs text-yellow-100/50 py-12">Selecione pelo menos um jogo para gerar gráficos.</p>
                )}
              </div>

              {/* Gráfico 2: Placar e Chutes Gerais */}
              <div className="bg-[#210101]/60 p-4 rounded-xl border border-yellow-900/30 print:border-none print:bg-transparent print:p-0">
                <h3 className="text-sm font-bold text-yellow-200 mb-4 print:text-zinc-900">Gols Marcados vs Volume Geral de Finalizações</h3>
                {chartData.length > 0 ? (
                  <div className="h-64 w-full">
                    <ErrorBoundary>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#3a0404" className="print:stroke-zinc-200" />
                          <XAxis dataKey="nome" stroke="#a16207" className="print:stroke-zinc-500" fontSize={11} />
                          <YAxis stroke="#a16207" className="print:stroke-zinc-500" fontSize={11} />
                          <Tooltip contentStyle={{ backgroundColor: '#1c1917', border: '1px solid #78350f', color: '#fef3c7' }} />
                          <Legend wrapperStyle={{ fontSize: '11px' }} />
                          <Bar dataKey="finalizacoes" name="Chutes Totais" fill="#facc15" />
                          <Bar dataKey="gols" name="Gols Marcados" fill="#f87171" />
                        </BarChart>
                      </ResponsiveContainer>
                    </ErrorBoundary>
                  </div>
                ) : (
                  <p className="text-center text-xs text-yellow-105/50 py-12">Selecione pelo menos um jogo para gerar gráficos.</p>
                )}
              </div>

            </div>

            {/* SEÇÃO RADAR: COMPARATIVO DIRETO DE RADAR DE MÉTICAS (RECHARTS) */}
            <div className="bg-[#210101]/60 border border-yellow-900/30 rounded-xl p-4 md:p-6 space-y-4 print:break-inside-avoid shadow-lg">
              <div className="border-b border-yellow-950/40 pb-3">
                <h3 className="text-base font-bold text-yellow-200 print:text-zinc-900">
                  {radarLabels.radarTitle}
                </h3>
                <p className="text-xs text-yellow-101/60 print:text-zinc-500">
                  {radarLabels.radarSubtitle}
                </p>
              </div>

              {processedGames.length >= 2 ? (
                <div className="space-y-4">
                  {/* Seletores das Partidas */}
                  <div className="grid sm:grid-cols-2 gap-4 print:hidden">
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-yellow-300 uppercase tracking-wide">
                        {radarLabels.matchA}
                      </label>
                      <select
                        value={radarGameAId}
                        onChange={(e) => setRadarGameAId(e.target.value)}
                        className="w-full bg-black/40 border border-yellow-950 text-yellow-100 rounded-lg p-2 outline-none focus:border-yellow-600 text-xs cursor-pointer"
                      >
                        {processedGames.map((g) => (
                          <option key={g.id} value={g.id}>
                            {g.opponent} ({g.date}) — {g.goalsScored}x{g.goalsConceded}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-blue-300 uppercase tracking-wide">
                        {radarLabels.matchB}
                      </label>
                      <select
                        value={radarGameBId}
                        onChange={(e) => setRadarGameBId(e.target.value)}
                        className="w-full bg-black/40 border border-yellow-955 text-yellow-100 rounded-lg p-2 outline-none focus:border-yellow-600 text-xs cursor-pointer"
                      >
                        <option value="">-- {radarLabels.chooseMatch} --</option>
                        {processedGames
                          .filter((g) => g.id !== radarGameAId)
                          .map((g) => (
                            <option key={g.id} value={g.id}>
                              {g.opponent} ({g.date}) — {g.goalsScored}x{g.goalsConceded}
                            </option>
                          ))}
                      </select>
                    </div>
                  </div>

                  {/* Informações Ativas das Partidas no Topo do Gráfico */}
                  <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-black/20 border border-yellow-950/40 rounded-lg">
                    {gameAInfo && (
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-yellow-400"></span>
                        <div className="text-xs">
                          <span className="font-bold text-yellow-200">{gameAInfo.opponent}</span>
                          <span className="text-yellow-101/60 ml-1.5">({gameAInfo.date})</span>
                          <span className="ml-2 font-mono font-bold bg-yellow-950/80 px-1.5 py-0.5 rounded text-yellow-300">
                            {gameAInfo.goalsScored}-{gameAInfo.goalsConceded}
                          </span>
                        </div>
                      </div>
                    )}
                    {gameBInfo ? (
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-blue-400"></span>
                        <div className="text-xs">
                          <span className="font-bold text-blue-200">{gameBInfo.opponent}</span>
                          <span className="text-yellow-101/60 ml-1.5">({gameBInfo.date})</span>
                          <span className="ml-2 font-mono font-bold bg-blue-950/80 px-1.5 py-0.5 rounded text-blue-300">
                            {gameBInfo.goalsScored}-{gameBInfo.goalsConceded}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="text-xs text-yellow-101/40 italic">
                        {language === 'pt' ? 'Nenhuma segunda partida selecionada.' : language === 'en' ? 'No second match selected.' : 'Ningún segundo partido seleccionado.'}
                      </div>
                    )}
                  </div>

                  {/* Visualização de Gráfico e Tabela */}
                  <div className="grid md:grid-cols-5 gap-6 items-center">
                    {/* Gráfico do Radar */}
                    <div className="md:col-span-2 h-72 w-full flex items-center justify-center bg-black/10 rounded-lg p-2">
                      <ErrorBoundary>
                        <ResponsiveContainer width="100%" height="100%">
                          <RadarChart cx="50%" cy="50%" outerRadius="75%" data={radarData}>
                            <PolarGrid stroke="#450a0a" />
                            <PolarAngleAxis dataKey="subject" stroke="#a16207" fontSize={10} />
                            <PolarRadiusAxis angle={30} domain={[0, 100]} stroke="#a16207" fontSize={8} />
                            <Radar
                              name={gameAInfo ? `${gameAInfo.opponent} (${gameAInfo.date})` : 'A'}
                              dataKey="gameA"
                              stroke="#facc15"
                              fill="#facc15"
                              fillOpacity={0.3}
                            />
                            {gameBInfo && (
                              <Radar
                                name={`${gameBInfo.opponent} (${gameBInfo.date})`}
                                dataKey="gameB"
                                stroke="#60a5fa"
                                fill="#60a5fa"
                                fillOpacity={0.3}
                              />
                            )}
                            <Tooltip
                              contentStyle={{
                                backgroundColor: '#1c1917',
                                border: '1px solid #78350f',
                                color: '#fef3c7',
                                fontSize: '11px',
                                borderRadius: '6px'
                              }}
                              formatter={(value: any, name: any, props: any) => {
                                const payload = props.payload;
                                if (name === (gameAInfo ? `${gameAInfo.opponent} (${gameAInfo.date})` : 'A')) {
                                  return [`${payload.rawA}`, name];
                                }
                                return [`${payload.rawB}`, name];
                              }}
                            />
                            {gameBInfo && <Legend wrapperStyle={{ fontSize: '10px' }} />}
                          </RadarChart>
                        </ResponsiveContainer>
                      </ErrorBoundary>
                    </div>

                    {/* Tabela Comparativa de Valores Absolutos */}
                    <div className="md:col-span-3 space-y-2">
                      <div className="text-xs font-bold text-yellow-400 border-b border-yellow-950/30 pb-1">
                        {radarLabels.rawValuesHeader}
                      </div>
                      <div className="overflow-hidden border border-yellow-950/40 rounded-lg">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="bg-yellow-950/40 text-yellow-300 border-b border-yellow-950/50 font-semibold font-sans">
                              <th className="py-2 px-3">{radarLabels.metrica}</th>
                              <th className="py-2 px-3 text-center text-yellow-200">
                                {gameAInfo ? `${gameAInfo.opponent.substring(0,12)}` : 'A'}
                              </th>
                              <th className="py-2 px-3 text-center text-blue-300">
                                {gameBInfo ? `${gameBInfo.opponent.substring(0,12)}` : 'B'}
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-yellow-950/20 bg-black/10">
                            {radarData.map((row: any, idx: number) => {
                              const isFouls = row.subject.toLowerCase().includes('falta') || row.subject.toLowerCase().includes('foul');
                              const isBetterA = isFouls ? row.rawA < row.rawB : row.rawA > row.rawB;
                              const isBetterB = isFouls ? row.rawB < row.rawA : row.rawB > row.rawA;
                              const hasDifference = row.rawA !== row.rawB && gameBInfo;

                              return (
                                <tr key={idx} className="hover:bg-yellow-950/10 transition-colors">
                                  <td className="py-2 px-3 font-medium text-yellow-101/80 font-sans">{row.subject.replace(' (Norm.)', '').replace(' (Norm)', '')}</td>
                                  <td className={`py-2 px-3 text-center font-mono ${
                                    isBetterA && hasDifference ? 'text-emerald-400 font-bold bg-emerald-950/25' : 'text-yellow-100'
                                  }`}>
                                    {row.rawA}{row.subject.includes('%') ? '%' : ''}
                                  </td>
                                  <td className={`py-2 px-3 text-center font-mono ${
                                    isBetterB && hasDifference ? 'text-emerald-400 font-bold bg-emerald-950/25' : 'text-yellow-100/70'
                                  }`}>
                                    {gameBInfo ? `${row.rawB}${row.subject.includes('%') ? '%' : ''}` : '—'}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>

                  </div>
                </div>
              ) : (
                <div className="text-yellow-105/50 text-xs py-6 text-center border border-dashed border-yellow-950/50 rounded-lg font-sans">
                  {radarLabels.noGamesForRadar}
                </div>
              )}
            </div>
            {activeGames.length > 1 && (
              <div className="bg-[#210101]/40 p-4 rounded-xl border border-yellow-950/40 print:border-zinc-350 print:bg-transparent">
                <h3 className="text-sm font-bold text-yellow-200 mb-3 flex items-center gap-1.5 print:text-zinc-900">
                  <Award size={18} className="text-yellow-400" />
                  Evolução Recente Jogo a Jogo (Análise de Desempenho)
                </h3>
                
                <p className="text-xs text-yellow-100/60 mb-4 print:text-zinc-500">
                  Comparação automática de cada partida contra o seu respectivo jogo anterior na sequência histórica do time.
                </p>

                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {/* Ultimo Jogo Delta */}
                  {(() => {
                    const latestGame = activeGames[activeGames.length - 1];
                    const delta = gameDeltas[latestGame.id];

                    if (!delta) return null;

                    return (
                      <div className="col-span-full bg-black/30 p-4 rounded-lg border border-yellow-905/30 print:bg-transparent print:border-zinc-300">
                        <div className="text-xs font-bold text-yellow-400 uppercase tracking-wider mb-2 print:text-zinc-650">
                          Última Partida: Contra {latestGame.opponent} (Placar: {latestGame.goalsScored} - {latestGame.goalsConceded})
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-2">
                          <div className="bg-black/20 p-2.5 rounded print:border print:border-zinc-300">
                            <span className="text-[10px] uppercase text-yellow-100/50 block print:text-zinc-600">Pontos</span>
                            <span className="text-lg font-bold text-yellow-150 print:text-zinc-900">{latestGame.points} pts</span>
                            {renderDeltaBadge(delta.points, 'positive-good')}
                          </div>
                          
                          <div className="bg-black/20 p-2.5 rounded print:border print:border-zinc-300">
                            <span className="text-[10px] uppercase text-yellow-100/50 block print:text-zinc-600">Posse de Bola</span>
                            <span className="text-lg font-bold text-yellow-150 print:text-zinc-900">{latestGame.possession}%</span>
                            {renderDeltaBadge(delta.possession, 'positive-good')}
                          </div>

                          <div className="bg-black/20 p-2.5 rounded print:border print:border-zinc-300">
                            <span className="text-[10px] uppercase text-yellow-100/50 block print:text-zinc-600">Chutes no Alvo</span>
                            <span className="text-lg font-bold text-yellow-150 print:text-zinc-900">{latestGame.shotsOnTarget}</span>
                            {renderDeltaBadge(delta.shotsOnTarget, 'positive-good')}
                          </div>

                          <div className="bg-black/20 p-2.5 rounded print:border print:border-zinc-300">
                            <span className="text-[10px] uppercase text-yellow-100/50 block print:text-zinc-600">Gols Sofridos</span>
                            <span className="text-lg font-bold text-yellow-150 print:text-zinc-900">{latestGame.goalsConceded}</span>
                            {renderDeltaBadge(delta.goalsConceded, 'negative-good')}
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}

            {/* SEÇÃO 5: TABELA CONSOLIDADA DE JOGOS (RF04) */}
            <div className="bg-[#210101]/60 p-4 rounded-xl border border-yellow-905/30 overflow-hidden print:border-zinc-350 print:bg-transparent print:p-0">
              <h3 className="text-sm font-bold text-yellow-200 mb-4 print:text-zinc-900">Histórico Consolidado de Partidas</h3>
              
              <div className="overflow-x-auto custom-scrollbar pb-2">
                <table className="w-full text-left text-xs border-collapse min-w-[600px]">
                  <thead>
                    <tr className="border-b border-yellow-900/40 text-yellow-300 font-bold print:border-zinc-300 print:text-zinc-700">
                      <th className="py-2.5 px-3">Data</th>
                      <th className="py-2.5 px-3">Oponente</th>
                      <th className="py-2.5 px-3">Mando</th>
                      <th className="py-2.5 px-3 text-center">Placar</th>
                      <th className="py-2.5 px-3 text-center">Res</th>
                      <th className="py-2.5 px-3 text-right">Posse</th>
                      <th className="py-2.5 px-3 text-right">Chutes (Alvo)</th>
                      <th className="py-2.5 px-3 text-center">Confiança</th>
                      <th className="py-2.5 px-3 text-center print:hidden">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-yellow-950/40 print:divide-zinc-200">
                    {processedGames.map((game) => {
                      const isActive = selectedGames.includes(game.id);
                      return (
                        <tr 
                          key={game.id} 
                          className={`hover:bg-yellow-950/20 transition-colors print:hover:bg-transparent ${
                            isActive ? 'text-yellow-100' : 'text-yellow-100/30 line-through print:text-zinc-400 print:no-underline'
                          }`}
                        >
                          <td className="py-2.5 px-3 whitespace-nowrap font-mono">{game.date}</td>
                          <td className="py-2.5 px-3 font-semibold">{game.opponent}</td>
                          <td className="py-2.5 px-3 text-yellow-300/60 print:text-zinc-500">{game.homeOrAway === 'Home' ? 'Casa' : 'Fora'}</td>
                          <td className="py-2.5 px-3 text-center font-bold font-mono">
                            {game.goalsScored} - {game.goalsConceded}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span className={`inline-block w-5 py-0.5 text-[10px] font-black rounded text-center ${
                              game.result === 'W' 
                                ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/20 print:text-zinc-700 print:bg-zinc-200' 
                                : game.result === 'D' 
                                ? 'bg-orange-950 text-orange-250 border border-orange-500/20 print:text-zinc-700 print:bg-zinc-200' 
                                : 'bg-rose-950 text-rose-300 border border-rose-500/20 print:text-zinc-700 print:bg-zinc-200'
                            }`}>
                              {game.result}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono">{game.possession}%</td>
                          <td className="py-2.5 px-3 text-right font-mono">{game.shots} ({game.shotsOnTarget})</td>
                          <td className="py-2.5 px-3 text-center">
                            <span className={`capitalize text-[10px] px-2 py-0.5 rounded ${
                              game.confidence === 'alta' 
                                ? 'bg-emerald-950/40 text-emerald-300 border border-emerald-500/10' 
                                : game.confidence === 'media'
                                ? 'bg-amber-950/40 text-amber-300 border border-amber-500/10'
                                : 'bg-rose-950/40 text-rose-300 border border-rose-500/10'
                            }`}>
                              {game.confidence}
                            </span>
                          </td>
                          <td className="py-2 px-3 whitespace-nowrap text-center print:hidden">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => onOpenAnalysis(game.id)}
                                className="flex items-center gap-1 bg-yellow-900/30 hover:bg-yellow-800 text-yellow-200 px-2 py-1 rounded transition-colors"
                                title="Abrir esta análise detalhada na tela principal"
                              >
                                Abrir
                                <ChevronRight size={12} />
                              </button>
                              <button
                                onClick={() => handleDelete(game.id)}
                                className="p-1 bg-rose-950/30 hover:bg-rose-900/50 text-rose-300 rounded transition-colors"
                                title="Excluir do banco local"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        </div>
      ) : (
        <div className="text-center p-8 text-yellow-100/60 bg-[#2a0101]/20 rounded-xl border border-yellow-950/40 print:hidden">
          Nenhum time selecionado ou disponível para o comparativo. Crie análises no formulário acima.
        </div>
      )}
    </div>
  );
};

export default ComparisonDashboard;
