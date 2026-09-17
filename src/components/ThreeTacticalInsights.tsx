import React from 'react';
import { AlertTriangle, TrendingUp, Compass, Clock, ArrowRight, ShieldAlert, CheckCircle } from 'lucide-react';
import { Analysis } from '../types';

interface ThreeTacticalInsightsProps {
  analysis: Analysis;
  onGenerateTrainingPlan?: (problemText: string) => void;
}

export const ThreeTacticalInsights: React.FC<ThreeTacticalInsightsProps> = ({
  analysis,
  onGenerateTrainingPlan,
}) => {
  // Extract real insights or derive from defensive/offensive phases and moments
  const vulnerabilityText = 
    analysis.pontosFracos?.timeA?.[0] ||
    analysis.pontosFracos?.timeB?.[0] ||
    analysis.faseDefensiva?.timeA?.compactacao_pressao ||
    analysis.faseDefensiva?.timeA?.posicionamento ||
    (analysis as any).vulnerabilidade ||
    'Espaço excessivo entre as linhas de marcação e lentidão na recomposição pós-perda.';

  const opportunityText = 
    analysis.pontosFortes?.timeA?.[0] ||
    analysis.pontosFortes?.timeB?.[0] ||
    analysis.faseOfensiva?.timeA?.criacao ||
    analysis.faseOfensiva?.timeA?.saidaDeBola ||
    (analysis as any).oportunidade ||
    'Exploração de amplitude pelas laterais com superioridade numérica no terço final.';

  const recommendationText = 
    analysis.recomendacoesTaticas?.timeA?.[0] ||
    analysis.recomendacoesTaticas?.timeB?.[0] ||
    analysis.conclusaoRecomendacoes?.split('\n')[0] ||
    (analysis as any).ajustesSugeridos ||
    'Compactação do bloco médio e redução do espaço nas costas dos laterais durante transição defensiva.';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Compass className="h-5 w-5 text-yellow-400" />
          <h3 className="text-base md:text-lg font-black text-yellow-200 uppercase tracking-wide">
            3 Principais Insights Táticos
          </h3>
        </div>
        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-yellow-950 text-yellow-300 border border-yellow-800/40 uppercase">
          Diagnóstico UEFA Pro
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* CARD 1: VULNERABILIDADE */}
        <div className="bg-[#2a0101]/80 border-l-4 border-l-red-500 border-y border-r border-red-900/30 rounded-xl p-4 flex flex-col justify-between space-y-3 shadow-lg">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-black text-red-400 uppercase tracking-wider">
                <AlertTriangle className="h-4 w-4" />
                Vulnerabilidade
              </div>
              <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-red-950/80 text-red-300 border border-red-800/40">
                Confiança Alta
              </span>
            </div>

            <p className="text-xs text-yellow-50/90 leading-relaxed font-medium">
              {vulnerabilityText}
            </p>
          </div>

          <div className="pt-2 border-t border-red-950/40 flex items-center justify-between text-[10px]">
            <span className="text-yellow-200/50 flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Evidência observada
            </span>
            {onGenerateTrainingPlan && (
              <button
                type="button"
                onClick={() => onGenerateTrainingPlan(vulnerabilityText)}
                className="text-red-400 hover:text-red-300 font-bold flex items-center gap-1 cursor-pointer"
              >
                Gerar Treino →
              </button>
            )}
          </div>
        </div>

        {/* CARD 2: OPORTUNIDADE */}
        <div className="bg-[#2a0101]/80 border-l-4 border-l-emerald-500 border-y border-r border-emerald-900/30 rounded-xl p-4 flex flex-col justify-between space-y-3 shadow-lg">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-black text-emerald-400 uppercase tracking-wider">
                <TrendingUp className="h-4 w-4" />
                Oportunidade
              </div>
              <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-800/40">
                Confiança Alta
              </span>
            </div>

            <p className="text-xs text-yellow-50/90 leading-relaxed font-medium">
              {opportunityText}
            </p>
          </div>

          <div className="pt-2 border-t border-emerald-950/40 flex items-center justify-between text-[10px]">
            <span className="text-yellow-200/50 flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Potencial de gol
            </span>
            {onGenerateTrainingPlan && (
              <button
                type="button"
                onClick={() => onGenerateTrainingPlan(opportunityText)}
                className="text-emerald-400 hover:text-emerald-300 font-bold flex items-center gap-1 cursor-pointer"
              >
                Trabalhar Ação →
              </button>
            )}
          </div>
        </div>

        {/* CARD 3: RECOMENDAÇÃO */}
        <div className="bg-[#2a0101]/80 border-l-4 border-l-yellow-500 border-y border-r border-yellow-900/30 rounded-xl p-4 flex flex-col justify-between space-y-3 shadow-lg">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-black text-yellow-400 uppercase tracking-wider">
                <Compass className="h-4 w-4" />
                Recomendação
              </div>
              <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-yellow-950/80 text-yellow-300 border border-yellow-800/40">
                Próximo Jogo
              </span>
            </div>

            <p className="text-xs text-yellow-50/90 leading-relaxed font-medium">
              {recommendationText}
            </p>
          </div>

          <div className="pt-2 border-t border-yellow-950/40 flex items-center justify-between text-[10px]">
            <span className="text-yellow-200/50 flex items-center gap-1">
              <CheckCircle className="h-3 w-3" />
              Diretriz tática
            </span>
            {onGenerateTrainingPlan && (
              <button
                type="button"
                onClick={() => onGenerateTrainingPlan(recommendationText)}
                className="text-yellow-400 hover:text-yellow-300 font-bold flex items-center gap-1 cursor-pointer"
              >
                Planejar Treino →
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
