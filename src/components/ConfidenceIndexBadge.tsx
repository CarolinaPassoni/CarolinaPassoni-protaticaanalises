import React from 'react';
import { ShieldCheck, CheckCircle2, AlertCircle, HelpCircle, Eye, FileText, Database, Cpu } from 'lucide-react';
import { Analysis } from '../types';

interface ConfidenceIndexBadgeProps {
  analysis?: Analysis;
  level?: 'alta' | 'media' | 'baixa' | string;
  sources?: {
    visual?: string;
    transcription?: string;
    confirmedData?: string;
    inference?: string;
  };
  compact?: boolean;
}

export const ConfidenceIndexBadge: React.FC<ConfidenceIndexBadgeProps> = ({
  analysis,
  level: initialLevel,
  sources: initialSources,
  compact = false,
}) => {
  const derivedLevel = initialLevel || analysis?.placarAuditoria?.confianca || (analysis as any)?.indiceConfianca?.nivel || 'alta';
  const derivedSources = initialSources || (analysis as any)?.indiceConfianca?.fontes || {
    visual: 'Alta',
    transcription: 'Média',
    confirmedData: 'Alta',
    inference: 'Média',
  };

  const normLevel = (derivedLevel || 'alta').toLowerCase();
  const sources = derivedSources;
  
  const getBadgeColor = () => {
    if (normLevel.includes('alt') || normLevel.includes('high')) {
      return {
        bg: 'bg-emerald-950/60',
        border: 'border-emerald-500/50',
        text: 'text-emerald-300',
        icon: CheckCircle2,
        label: 'ALTA CONFIABILIDADE',
      };
    }
    if (normLevel.includes('med') || normLevel.includes('méd')) {
      return {
        bg: 'bg-amber-950/60',
        border: 'border-amber-500/50',
        text: 'text-amber-300',
        icon: AlertCircle,
        label: 'MÉDIA CONFIABILIDADE',
      };
    }
    return {
      bg: 'bg-red-950/60',
      border: 'border-red-500/50',
      text: 'text-red-300',
      icon: HelpCircle,
      label: 'BAIXA CONFIABILIDADE',
    };
  };

  const badge = getBadgeColor();
  const Icon = badge.icon;

  if (compact) {
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold ${badge.bg} ${badge.border} ${badge.text} border`}>
        <Icon className="h-3 w-3 shrink-0" />
        <span>{badge.label}</span>
      </span>
    );
  }

  return (
    <div className={`p-3.5 rounded-xl ${badge.bg} ${badge.border} border space-y-2.5`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <ShieldCheck className={`h-4 w-4 ${badge.text}`} />
          <span className="text-xs font-black uppercase tracking-wider text-white">
            Índice de Confiabilidade da Análise
          </span>
        </div>
        <span className={`text-[10px] font-black px-2 py-0.5 rounded ${badge.bg} ${badge.text} border ${badge.border}`}>
          {badge.label}
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
        <div className="bg-black/30 rounded-lg p-2 border border-yellow-900/20 flex items-center gap-2">
          <Eye className="h-3.5 w-3.5 text-yellow-400 shrink-0" />
          <div className="text-[10px]">
            <span className="block text-yellow-100/60 font-medium">Evidência Visual</span>
            <strong className="text-yellow-200">{sources.visual || 'Alta'}</strong>
          </div>
        </div>

        <div className="bg-black/30 rounded-lg p-2 border border-yellow-900/20 flex items-center gap-2">
          <FileText className="h-3.5 w-3.5 text-yellow-400 shrink-0" />
          <div className="text-[10px]">
            <span className="block text-yellow-100/60 font-medium">Transcrição</span>
            <strong className="text-yellow-200">{sources.transcription || 'Média'}</strong>
          </div>
        </div>

        <div className="bg-black/30 rounded-lg p-2 border border-yellow-900/20 flex items-center gap-2">
          <Database className="h-3.5 w-3.5 text-yellow-400 shrink-0" />
          <div className="text-[10px]">
            <span className="block text-yellow-100/60 font-medium">Dados Confirmados</span>
            <strong className="text-emerald-400">{sources.confirmedData || 'Alta'}</strong>
          </div>
        </div>

        <div className="bg-black/30 rounded-lg p-2 border border-yellow-900/20 flex items-center gap-2">
          <Cpu className="h-3.5 w-3.5 text-yellow-400 shrink-0" />
          <div className="text-[10px]">
            <span className="block text-yellow-100/60 font-medium">Inferência Tática</span>
            <strong className="text-yellow-300">{sources.inference || 'Média'}</strong>
          </div>
        </div>
      </div>
    </div>
  );
};
