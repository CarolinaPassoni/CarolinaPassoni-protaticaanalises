import React from 'react';
import { BarChart3, FileText, PlusCircle, Scale, Video } from 'lucide-react';
import type { AnalysisHistoryItem } from '../types';

interface ReportsModuleProps {
  history: AnalysisHistoryItem[];
  onOpenAnalysis: (id: string) => void;
  onNavigate: (view: string) => void;
}

export const ReportsModule: React.FC<ReportsModuleProps> = ({ history, onOpenAnalysis, onNavigate }) => {
  const recent = history.slice(0, 8);
  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      <div className="rounded-3xl border border-amber-900/40 bg-gradient-to-r from-[#200308] via-[#160205] to-[#0d0103] p-6 md:p-8">
        <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-amber-300"><FileText className="h-3.5 w-3.5" /> Central de Relatórios</div>
        <h1 className="mt-3 text-3xl font-black text-white">RELATÓRIOS & INSIGHTS</h1>
        <p className="mt-2 text-sm text-zinc-300">Acesse análises salvas, compare partidas e gere novos relatórios sem voltar à tela inicial.</p>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-amber-950/50 bg-[#170306] p-5"><BarChart3 className="h-5 w-5 text-amber-400" /><div className="mt-3 text-3xl font-black text-white">{history.length}</div><div className="text-xs text-zinc-400">análises disponíveis</div></div>
        <button onClick={() => onNavigate('comparison')} className="text-left rounded-2xl border border-amber-950/50 bg-[#170306] p-5 hover:border-amber-500/40"><Scale className="h-5 w-5 text-amber-400" /><div className="mt-3 font-bold text-white">Comparar análises</div><div className="text-xs text-zinc-400 mt-1">Abra o painel comparativo estatístico.</div></button>
        <button onClick={() => onNavigate('new-analysis')} className="text-left rounded-2xl border border-amber-950/50 bg-[#170306] p-5 hover:border-amber-500/40"><PlusCircle className="h-5 w-5 text-amber-400" /><div className="mt-3 font-bold text-white">Nova análise</div><div className="text-xs text-zinc-400 mt-1">Gere um novo relatório tático.</div></button>
      </div>

      <div className="rounded-2xl border border-amber-950/50 bg-[#120204] overflow-hidden">
        <div className="px-5 py-4 border-b border-amber-950/40"><h2 className="font-bold text-white">Relatórios recentes</h2></div>
        {recent.length === 0 ? (
          <div className="p-10 text-center text-sm text-zinc-500">Nenhuma análise salva ainda.</div>
        ) : (
          <div className="divide-y divide-amber-950/30">
            {recent.map((item) => (
              <button key={item.id} onClick={() => onOpenAnalysis(item.id)} className="w-full px-5 py-4 flex items-center gap-3 text-left hover:bg-white/[0.03]">
                <div className="rounded-lg bg-amber-500/10 p-2 text-amber-400"><Video className="h-4 w-4" /></div>
                <div className="min-w-0 flex-1"><div className="truncate text-sm font-bold text-white">{item.videoTitle || item.title || `${item.timeA} x ${item.timeB}`}</div><div className="mt-0.5 text-[11px] text-zinc-500">{item.createdAt || item.created_at || ''} · {item.placar || item.score || 'placar não informado'}</div></div>
                <span className="text-xs font-bold text-amber-400">Abrir</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ReportsModule;
