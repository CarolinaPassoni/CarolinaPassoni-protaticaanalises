import React from 'react';
import { Clock, Sparkles, ArrowUpRight } from 'lucide-react';
import { User } from '../types.js';
import { getAccountAccessStatus, formatRemainingTrialTime } from '../utils/accessControl.js';

interface TrialBannerProps {
  user?: User | null;
  onOpenPlans?: () => void;
  daysRemaining?: number | string | null;
  trialEndDate?: string | null;
  onUpgradeClick?: () => void;
}

export const TrialBanner: React.FC<TrialBannerProps> = ({
  user,
  onOpenPlans,
  daysRemaining,
  trialEndDate,
  onUpgradeClick,
}) => {
  const handleUpgrade = onOpenPlans || onUpgradeClick || (() => {});
  let remainingText = '';

  if (daysRemaining !== undefined && daysRemaining !== null) {
    remainingText = `${daysRemaining} dias restantes`;
  } else if (user) {
    const status = getAccountAccessStatus(user);
    if (status !== 'trial_active') return null;
    remainingText = formatRemainingTrialTime(user.trialExpiresAt || user.trial_expires_at);
  } else if (trialEndDate) {
    remainingText = formatRemainingTrialTime(trialEndDate);
  } else {
    remainingText = '7 dias restantes';
  }

  return (
    <div className="bg-gradient-to-r from-amber-500/15 via-yellow-500/20 to-amber-500/15 border-b border-yellow-500/40 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs shadow-inner">
      <div className="flex items-center gap-2.5 text-yellow-200">
        <div className="p-1 rounded-md bg-yellow-500/20 border border-yellow-500/40 text-yellow-300">
          <Clock className="h-3.5 w-3.5" />
        </div>
        <div>
          <span className="font-bold text-yellow-100">Teste gratuito</span> —{' '}
          <span className="font-extrabold text-yellow-300">{remainingText}</span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <span className="text-[11px] text-yellow-200/70 hidden sm:inline">
          Garanta acesso ilimitado sem interrupções
        </span>
        <button
          type="button"
          onClick={handleUpgrade}
          className="px-3 py-1.5 bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-400 hover:to-yellow-500 text-black font-extrabold rounded-lg text-[11px] uppercase tracking-wider transition-all shadow-md shadow-yellow-950/40 flex items-center gap-1 cursor-pointer"
        >
          <Sparkles className="h-3 w-3" />
          <span>Fazer Upgrade</span>
          <ArrowUpRight className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
};
