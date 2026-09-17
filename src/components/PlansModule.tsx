import React, { useMemo, useState } from 'react';
import { Check, CreditCard, Loader2, ShieldCheck, Sparkles } from 'lucide-react';
import { OFFICIAL_PLANS } from '../utils/plans';
import { getAuthHeaders } from '../services/geminiService';

interface PlansModuleProps {
  isAdmin?: boolean;
  currentPlanId?: string | null;
}

export const PlansModule: React.FC<PlansModuleProps> = ({ isAdmin = false, currentPlanId }) => {
  const [cycle, setCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [message, setMessage] = useState<string>('');

  const plans = useMemo(() => {
    const ids = cycle === 'monthly'
      ? ['scout_monthly', 'performance_monthly', 'intelligence_monthly']
      : ['scout_yearly', 'performance_yearly', 'intelligence_yearly'];
    return ids.map((id) => OFFICIAL_PLANS[id]).filter(Boolean);
  }, [cycle]);

  const startCheckout = async (planId: string) => {
    if (isAdmin) {
      setMessage('A conta administradora possui acesso total. O checkout é destinado às contas de clientes.');
      return;
    }
    setLoadingPlan(planId);
    setMessage('');
    try {
      const res = await fetch('/api/subscription/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ planId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.url) {
        throw new Error(data.error || 'Checkout ainda não está disponível. Verifique a configuração do Stripe no Painel Admin.');
      }
      window.location.href = data.url;
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Não foi possível iniciar o checkout.');
    } finally {
      setLoadingPlan(null);
    }
  };

  return (
    <div className="space-y-7 animate-fadeIn pb-12">
      <div className="rounded-3xl border border-amber-900/40 bg-gradient-to-r from-[#200308] via-[#160205] to-[#0d0103] p-6 md:p-8 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-5">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-amber-300">
              <CreditCard className="h-3.5 w-3.5" /> Planos ProTática
            </div>
            <h1 className="mt-3 text-3xl md:text-4xl font-black text-white">Escolha o nível de inteligência tática</h1>
            <p className="mt-2 max-w-3xl text-sm text-zinc-300">Planos oficiais, recursos e cobrança em uma página própria dentro do sistema.</p>
          </div>
          <div className="inline-flex rounded-xl border border-amber-900/40 bg-black/40 p-1">
            <button onClick={() => setCycle('monthly')} className={`px-4 py-2 rounded-lg text-xs font-bold ${cycle === 'monthly' ? 'bg-amber-500 text-black' : 'text-zinc-400 hover:text-white'}`}>Mensal</button>
            <button onClick={() => setCycle('yearly')} className={`px-4 py-2 rounded-lg text-xs font-bold ${cycle === 'yearly' ? 'bg-amber-500 text-black' : 'text-zinc-400 hover:text-white'}`}>Anual</button>
          </div>
        </div>
      </div>

      {message && <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">{message}</div>}

      <div className="grid lg:grid-cols-3 gap-5">
        {plans.map((plan) => {
          const active = currentPlanId === plan.id || currentPlanId === plan.category;
          return (
            <div key={plan.id} className={`relative flex flex-col rounded-2xl border p-5 bg-[#170306] ${plan.popular ? 'border-amber-400/60 shadow-lg shadow-amber-950/30' : 'border-amber-950/50'}`}>
              {plan.popular && <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-amber-500 px-3 py-1 text-[10px] font-black uppercase text-black">Mais escolhido</div>}
              <div className="flex-1">
                <div className="text-[10px] font-black uppercase tracking-widest text-amber-400">{plan.pillarBadge}</div>
                <h2 className="mt-2 text-xl font-black text-white">{plan.name}</h2>
                <p className="mt-1 text-xs text-zinc-400 min-h-10">{plan.description}</p>
                <div className="mt-5 flex items-end gap-1">
                  <span className="text-3xl font-black text-amber-300">{plan.priceFormatted}</span>
                  <span className="pb-1 text-xs text-zinc-500">/{cycle === 'monthly' ? 'mês' : 'ano'}</span>
                </div>
                <ul className="mt-5 space-y-2.5">
                  {plan.features.map((feature) => <li key={feature} className="flex gap-2 text-xs text-zinc-300"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" /><span>{feature}</span></li>)}
                </ul>
              </div>
              <button
                type="button"
                disabled={loadingPlan !== null || active}
                onClick={() => startCheckout(plan.id)}
                className="mt-6 w-full rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 px-4 py-3 text-xs font-black uppercase text-black transition hover:from-amber-400 hover:to-amber-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loadingPlan === plan.id ? <span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Abrindo checkout...</span> : active ? 'Plano atual' : isAdmin ? 'Visualizar como administrador' : 'Escolher plano'}
              </button>
            </div>
          );
        })}
      </div>

      <div className="rounded-2xl border border-amber-900/30 bg-black/30 p-5 flex items-start gap-3">
        <ShieldCheck className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
        <div>
          <h3 className="font-bold text-white">ProTática Club</h3>
          <p className="mt-1 text-xs text-zinc-400">Clubes, federações e academias podem contratar uma estrutura personalizada com múltiplos usuários e integrações dedicadas.</p>
        </div>
      </div>
    </div>
  );
};

export default PlansModule;
