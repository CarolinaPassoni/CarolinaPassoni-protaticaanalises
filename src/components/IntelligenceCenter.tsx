import React from 'react';
import { 
  ShieldCheck, 
  TrendingUp, 
  Users, 
  Search, 
  Video, 
  Bookmark, 
  Dumbbell, 
  Target, 
  ArrowRight,
  Sparkles,
  Award,
  Layers,
  Clock,
  CheckCircle2
} from 'lucide-react';
import { AnalysisHistoryItem } from '../types';

interface IntelligenceCenterProps {
  onNavigate: (view: string) => void;
  analyses: AnalysisHistoryItem[];
  teamsCount: number;
  dossiersCount: number;
  playersCount: number;
  evidencesCount: number;
  trainingPlansCount: number;
  activeGoalsCount: number;
  completedGoalsCount: number;
  onOpenAnalysis: (id: string) => void;
}

export const IntelligenceCenter: React.FC<IntelligenceCenterProps> = ({
  onNavigate,
  analyses,
  teamsCount,
  dossiersCount,
  playersCount,
  evidencesCount,
  trainingPlansCount,
  activeGoalsCount,
  completedGoalsCount,
  onOpenAnalysis,
}) => {
  const latestAnalysis = analyses && analyses.length > 0 ? analyses[0] : null;

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Top Banner */}
      <div className="bg-[#2a0101]/80 border border-yellow-500/30 rounded-2xl p-6 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-yellow-400">
            <ShieldCheck className="h-4 w-4" />
            Visão Geral de Desempenho & Inteligência Tática
          </div>
          <h2 className="text-2xl md:text-3xl font-extrabold text-white">
            CENTRO DE INTELIGÊNCIA PROTÁTICA
          </h2>
          <p className="text-xs md:text-sm text-yellow-100/70">
            Central de comando integrada para monitoramento de equipes, adversários, atletas e treinamentos.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => onNavigate('new-analysis')}
            className="px-4 py-2.5 bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-400 hover:to-yellow-500 text-black font-bold text-xs rounded-xl transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
          >
            <Video className="h-3.5 w-3.5" />
            Nova Análise
          </button>
        </div>
      </div>

      {/* Summary Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        
        {/* 1. MINHA EQUIPE */}
        <div className="bg-[#2a0101]/60 border border-yellow-900/40 rounded-2xl p-5 flex flex-col justify-between space-y-4 hover:border-yellow-500/40 transition-colors">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-yellow-500/10 text-yellow-400">
                  <TrendingUp className="h-5 w-5" />
                </div>
                <h3 className="text-base font-bold text-yellow-200">MINHA EQUIPE</h3>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-yellow-950 text-yellow-400 border border-yellow-900/40">
                {teamsCount > 0 ? `${teamsCount} equipe(s)` : 'Sem equipe'}
              </span>
            </div>

            <div className="space-y-1.5 text-xs text-yellow-100/80">
              <div className="flex justify-between py-1 border-b border-yellow-900/20">
                <span className="text-yellow-200/60">Partidas analisadas:</span>
                <strong className="text-white font-mono">{analyses.length}</strong>
              </div>
              <div className="flex justify-between py-1 border-b border-yellow-900/20">
                <span className="text-yellow-200/60">Última análise:</span>
                <span className="text-yellow-300 truncate max-w-[150px]">
                  {latestAnalysis ? latestAnalysis.title : 'Nenhuma'}
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-yellow-200/60">Evolução disponível:</span>
                <span className={analyses.length >= 2 ? 'text-emerald-400 font-bold' : 'text-amber-400'}>
                  {analyses.length >= 2 ? 'Ativa (Dados prontos)' : 'Mínimo 2 jogos'}
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={() => onNavigate('my-team')}
            className="w-full py-2.5 px-3 bg-yellow-950/40 hover:bg-yellow-900/50 border border-yellow-700/30 text-yellow-300 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer"
          >
            Ver Performance
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* 2. ADVERSÁRIOS */}
        <div className="bg-[#2a0101]/60 border border-yellow-900/40 rounded-2xl p-5 flex flex-col justify-between space-y-4 hover:border-yellow-500/40 transition-colors">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-yellow-500/10 text-yellow-400">
                  <Search className="h-5 w-5" />
                </div>
                <h3 className="text-base font-bold text-yellow-200">ADVERSÁRIOS</h3>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-yellow-950 text-yellow-400 border border-yellow-900/40">
                {dossiersCount} dossiê(s)
              </span>
            </div>

            <div className="space-y-1.5 text-xs text-yellow-100/80">
              <div className="flex justify-between py-1 border-b border-yellow-900/20">
                <span className="text-yellow-200/60">Dossiês gerados:</span>
                <strong className="text-white font-mono">{dossiersCount}</strong>
              </div>
              <div className="flex justify-between py-1 border-b border-yellow-900/20">
                <span className="text-yellow-200/60">Mapeamento tático:</span>
                <span className="text-yellow-300">Padrões e Falhas</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-yellow-200/60">Estratégias de confronto:</span>
                <span className="text-emerald-400 font-bold">Diretrizes UEFA Pro</span>
              </div>
            </div>
          </div>

          <button
            onClick={() => onNavigate('opponents')}
            className="w-full py-2.5 px-3 bg-yellow-950/40 hover:bg-yellow-900/50 border border-yellow-700/30 text-yellow-300 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer"
          >
            Ver Adversários
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* 3. JOGADORES */}
        <div className="bg-[#2a0101]/60 border border-yellow-900/40 rounded-2xl p-5 flex flex-col justify-between space-y-4 hover:border-yellow-500/40 transition-colors">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-yellow-500/10 text-yellow-400">
                  <Users className="h-5 w-5" />
                </div>
                <h3 className="text-base font-bold text-yellow-200">JOGADORES</h3>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-yellow-950 text-yellow-400 border border-yellow-900/40">
                {playersCount} catalogados
              </span>
            </div>

            <div className="space-y-1.5 text-xs text-yellow-100/80">
              <div className="flex justify-between py-1 border-b border-yellow-900/20">
                <span className="text-yellow-200/60">Atletas identificados:</span>
                <strong className="text-white font-mono">{playersCount}</strong>
              </div>
              <div className="flex justify-between py-1 border-b border-yellow-900/20">
                <span className="text-yellow-200/60">Scouting individual:</span>
                <span className="text-yellow-300">Pontos Fortes e Atenção</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-yellow-200/60">Validação visual:</span>
                <span className="text-yellow-300">Foto & Posição</span>
              </div>
            </div>
          </div>

          <button
            onClick={() => onNavigate('players')}
            className="w-full py-2.5 px-3 bg-yellow-950/40 hover:bg-yellow-900/50 border border-yellow-700/30 text-yellow-300 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer"
          >
            Ver Jogadores
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* 4. PARTIDAS */}
        <div className="bg-[#2a0101]/60 border border-yellow-900/40 rounded-2xl p-5 flex flex-col justify-between space-y-4 hover:border-yellow-500/40 transition-colors">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-yellow-500/10 text-yellow-400">
                  <Video className="h-5 w-5" />
                </div>
                <h3 className="text-base font-bold text-yellow-200">PARTIDAS</h3>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-yellow-950 text-yellow-400 border border-yellow-900/40">
                {analyses.length} totais
              </span>
            </div>

            <div className="space-y-1.5 text-xs text-yellow-100/80">
              <div className="flex justify-between py-1 border-b border-yellow-900/20">
                <span className="text-yellow-200/60">Última partida:</span>
                <span className="text-white font-semibold truncate max-w-[150px]">
                  {latestAnalysis ? latestAnalysis.title : 'Nenhuma'}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-yellow-900/20">
                <span className="text-yellow-200/60">Status de auditoria:</span>
                <span className="text-emerald-400 font-bold">Grounding Validado</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-yellow-200/60">Confiança geral:</span>
                <span className="text-yellow-300 font-bold">Alta</span>
              </div>
            </div>
          </div>

          <button
            onClick={() => onNavigate('matches')}
            className="w-full py-2.5 px-3 bg-yellow-950/40 hover:bg-yellow-900/50 border border-yellow-700/30 text-yellow-300 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer"
          >
            Abrir Análises
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* 5. EVIDÊNCIAS */}
        <div className="bg-[#2a0101]/60 border border-yellow-900/40 rounded-2xl p-5 flex flex-col justify-between space-y-4 hover:border-yellow-500/40 transition-colors">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-yellow-500/10 text-yellow-400">
                  <Bookmark className="h-5 w-5" />
                </div>
                <h3 className="text-base font-bold text-yellow-200">EVIDÊNCIAS</h3>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-yellow-950 text-yellow-400 border border-yellow-900/40">
                {evidencesCount} salvas
              </span>
            </div>

            <div className="space-y-1.5 text-xs text-yellow-100/80">
              <div className="flex justify-between py-1 border-b border-yellow-900/20">
                <span className="text-yellow-200/60">Clipes catalogados:</span>
                <strong className="text-white font-mono">{evidencesCount}</strong>
              </div>
              <div className="flex justify-between py-1 border-b border-yellow-900/20">
                <span className="text-yellow-200/60">Categorização:</span>
                <span className="text-yellow-300">Ataque, Defesa, Pressão</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-yellow-200/60">Timestamps:</span>
                <span className="text-emerald-400 font-semibold">Minutagem Real</span>
              </div>
            </div>
          </div>

          <button
            onClick={() => onNavigate('evidences')}
            className="w-full py-2.5 px-3 bg-yellow-950/40 hover:bg-yellow-900/50 border border-yellow-700/30 text-yellow-300 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer"
          >
            Abrir Biblioteca
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* 6. TREINAMENTOS */}
        <div className="bg-[#2a0101]/60 border border-yellow-900/40 rounded-2xl p-5 flex flex-col justify-between space-y-4 hover:border-yellow-500/40 transition-colors">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-yellow-500/10 text-yellow-400">
                  <Dumbbell className="h-5 w-5" />
                </div>
                <h3 className="text-base font-bold text-yellow-200">TREINAMENTOS</h3>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-yellow-950 text-yellow-400 border border-yellow-900/40">
                {trainingPlansCount} planos
              </span>
            </div>

            <div className="space-y-1.5 text-xs text-yellow-100/80">
              <div className="flex justify-between py-1 border-b border-yellow-900/20">
                <span className="text-yellow-200/60">Sessões estruturadas:</span>
                <strong className="text-white font-mono">{trainingPlansCount}</strong>
              </div>
              <div className="flex justify-between py-1 border-b border-yellow-900/20">
                <span className="text-yellow-200/60">Origem:</span>
                <span className="text-yellow-300">Insights de Jogos Reais</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-yellow-200/60">Exportação:</span>
                <span className="text-emerald-400 font-semibold">Fichas PDF de Campo</span>
              </div>
            </div>
          </div>

          <button
            onClick={() => onNavigate('training')}
            className="w-full py-2.5 px-3 bg-yellow-950/40 hover:bg-yellow-900/50 border border-yellow-700/30 text-yellow-300 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer"
          >
            Abrir Treinos
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* 7. METAS */}
        <div className="bg-[#2a0101]/60 border border-yellow-900/40 rounded-2xl p-5 flex flex-col justify-between space-y-4 hover:border-yellow-500/40 transition-colors">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-yellow-500/10 text-yellow-400">
                  <Target className="h-5 w-5" />
                </div>
                <h3 className="text-base font-bold text-yellow-200">METAS DA EQUIPE</h3>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-yellow-950 text-yellow-400 border border-yellow-900/40">
                {activeGoalsCount} ativa(s)
              </span>
            </div>

            <div className="space-y-1.5 text-xs text-yellow-100/80">
              <div className="flex justify-between py-1 border-b border-yellow-900/20">
                <span className="text-yellow-200/60">Metas em andamento:</span>
                <strong className="text-amber-400 font-mono">{activeGoalsCount}</strong>
              </div>
              <div className="flex justify-between py-1 border-b border-yellow-900/20">
                <span className="text-yellow-200/60">Metas concluídas:</span>
                <strong className="text-emerald-400 font-mono">{completedGoalsCount}</strong>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-yellow-200/60">Vinculação:</span>
                <span className="text-yellow-300">Análises e Indicadores</span>
              </div>
            </div>
          </div>

          <button
            onClick={() => onNavigate('goals')}
            className="w-full py-2.5 px-3 bg-yellow-950/40 hover:bg-yellow-900/50 border border-yellow-700/30 text-yellow-300 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer"
          >
            Ver Metas
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* 8. QUADRO TÁTICO */}
        <div className="bg-[#2a0101]/60 border border-yellow-900/40 rounded-2xl p-5 flex flex-col justify-between space-y-4 hover:border-yellow-500/40 transition-colors">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-yellow-500/10 text-yellow-400">
                  <Layers className="h-5 w-5" />
                </div>
                <h3 className="text-base font-bold text-yellow-200">QUADRO TÁTICO</h3>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-yellow-950 text-yellow-400 border border-yellow-900/40">
                Interativo
              </span>
            </div>

            <div className="space-y-1.5 text-xs text-yellow-100/80">
              <div className="flex justify-between py-1 border-b border-yellow-900/20">
                <span className="text-yellow-200/60">Formações:</span>
                <span className="text-white font-mono">4-3-3, 4-4-2, 3-5-2...</span>
              </div>
              <div className="flex justify-between py-1 border-b border-yellow-900/20">
                <span className="text-yellow-200/60">Ferramentas:</span>
                <span className="text-yellow-300">Setas, Zonas, Anotações</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-yellow-200/60">Exportação:</span>
                <span className="text-emerald-400 font-semibold">Imagem PNG HD</span>
              </div>
            </div>
          </div>

          <button
            onClick={() => onNavigate('tactical-board')}
            className="w-full py-2.5 px-3 bg-yellow-950/40 hover:bg-yellow-900/50 border border-yellow-700/30 text-yellow-300 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer"
          >
            Abrir Prancheta
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>

      </div>
    </div>
  );
};
