import React, { useState } from 'react';
import { X, CreditCard, ShieldCheck, Clock, Sparkles, CheckCircle2, AlertCircle } from 'lucide-react';
import { User } from '../types.js';
import { getAccountAccessStatus, formatRemainingTrialTime } from '../utils/accessControl.js';
import { getPlanById } from '../utils/plans.js';
import { getStoredToken, getAuthHeaders } from '../services/geminiService';

interface MySubscriptionModalProps {
  user?: User | null;
  isOpen: boolean;
  onClose: () => void;
  onOpenPlans?: () => void;
}

export const MySubscriptionModal: React.FC<MySubscriptionModalProps> = ({
  user: initialUser,
  isOpen,
  onClose,
  onOpenPlans,
}) => {
  const [currentUser, setCurrentUser] = useState<User | null>(initialUser || null);

  React.useEffect(() => {
    if (initialUser) {
      setCurrentUser(initialUser);
    } else if (isOpen) {
      const token = getStoredToken();
      if (token) {
        fetch('/api/user/subscription', {
          headers: getAuthHeaders(),
        })
          .then((res) => res.json())
          .then((data) => {
            if (data && data.user) {
              setCurrentUser(data.user);
            }
          })
          .catch(() => {});
      }
    }
  }, [initialUser, isOpen]);

  if (!isOpen) return null;

  const user = currentUser;
  if (!user) return null;

  const accessStatus = getAccountAccessStatus(user);
  const currentPlan = user.subscriptionPlan ? getPlanById(user.subscriptionPlan) : null;

  const formatDate = (isoString?: string | null) => {
    if (!isoString) return '—';
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoString;
    }
  };

  return (
    <div className="fixed inset-0 z-[105] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fadeIn">
      <div className="bg-[#180202] border border-yellow-500/40 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl relative flex flex-col">
        {/* Header */}
        <div className="bg-[#2a0101] border-b border-yellow-900/50 p-5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-yellow-500/10 border border-yellow-500/30 text-yellow-400">
              <CreditCard className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-yellow-100 uppercase tracking-wide">
                Minha Assinatura e Plano
              </h3>
              <p className="text-[11px] text-yellow-200/70">
                Detalhes de acesso e vigência da conta
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-yellow-200/60 hover:text-yellow-100 bg-white/5 hover:bg-white/10 p-1.5 rounded-lg text-sm transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {/* Status Badge Block */}
          <div className="bg-[#2a0101]/60 border border-yellow-900/40 rounded-xl p-4 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold text-yellow-200/60 uppercase tracking-wider block">
                Status da Conta
              </span>
              <div className="flex items-center gap-2 mt-1">
                {accessStatus === 'admin' && (
                  <span className="px-2.5 py-1 rounded-md text-xs font-black bg-purple-950/80 text-purple-300 border border-purple-800">
                    Administrador Central
                  </span>
                )}
                {accessStatus === 'trial_active' && (
                  <span className="px-2.5 py-1 rounded-md text-xs font-black bg-yellow-950/80 text-yellow-300 border border-yellow-800 flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    Teste Gratuito Ativo
                  </span>
                )}
                {accessStatus === 'trial_expired' && (
                  <span className="px-2.5 py-1 rounded-md text-xs font-black bg-amber-950/80 text-amber-300 border border-amber-800 flex items-center gap-1">
                    <AlertCircle className="h-3.5 w-3.5" />
                    Teste Gratuito Expirado
                  </span>
                )}
                {accessStatus === 'paid_active' && (
                  <span className="px-2.5 py-1 rounded-md text-xs font-black bg-emerald-950/80 text-emerald-300 border border-emerald-800 flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Plano Ativo
                  </span>
                )}
                {accessStatus === 'paid_expired' && (
                  <span className="px-2.5 py-1 rounded-md text-xs font-black bg-red-950/80 text-red-300 border border-red-800 flex items-center gap-1">
                    <AlertCircle className="h-3.5 w-3.5" />
                    Assinatura Expirada
                  </span>
                )}
                {accessStatus === 'blocked' && (
                  <span className="px-2.5 py-1 rounded-md text-xs font-black bg-red-950/80 text-red-300 border border-red-800">
                    Conta Suspensa
                  </span>
                )}
              </div>
            </div>

            {user.convertedFromTrial && (
              <span className="text-[10px] text-emerald-400 font-bold bg-emerald-950/40 border border-emerald-800/40 px-2 py-1 rounded">
                Convertido do Demo
              </span>
            )}
          </div>

          {/* Details Grid */}
          <div className="grid sm:grid-cols-2 gap-3 text-xs">
            <div className="bg-black/40 border border-yellow-900/30 rounded-xl p-3">
              <span className="text-[10px] text-yellow-200/60 block uppercase font-bold">Usuário / E-mail</span>
              <span className="text-white font-mono mt-0.5 block truncate">{user.username}</span>
            </div>

            <div className="bg-black/40 border border-yellow-900/30 rounded-xl p-3">
              <span className="text-[10px] text-yellow-200/60 block uppercase font-bold">Plano Contratado</span>
              <span className="text-yellow-300 font-bold mt-0.5 block">
                {currentPlan?.name || (user.accountType === 'trial' ? 'Período de Demonstração (7 Dias)' : 'Plano Padrão')}
              </span>
            </div>

            {user.accountType === 'trial' && (
              <>
                <div className="bg-black/40 border border-yellow-900/30 rounded-xl p-3">
                  <span className="text-[10px] text-yellow-200/60 block uppercase font-bold">Tempo Restante</span>
                  <span className="text-yellow-400 font-extrabold mt-0.5 block">
                    {formatRemainingTrialTime(user.trialExpiresAt)}
                  </span>
                </div>

                <div className="bg-black/40 border border-yellow-900/30 rounded-xl p-3">
                  <span className="text-[10px] text-yellow-200/60 block uppercase font-bold">Expiração do Teste</span>
                  <span className="text-yellow-100 mt-0.5 block">
                    {formatDate(user.trialExpiresAt)}
                  </span>
                </div>
              </>
            )}

            {user.accountType === 'paid' && (
              <>
                <div className="bg-black/40 border border-yellow-900/30 rounded-xl p-3">
                  <span className="text-[10px] text-yellow-200/60 block uppercase font-bold">Início da Assinatura</span>
                  <span className="text-yellow-100 mt-0.5 block">
                    {formatDate(user.subscriptionStartedAt)}
                  </span>
                </div>

                <div className="bg-black/40 border border-yellow-900/30 rounded-xl p-3">
                  <span className="text-[10px] text-yellow-200/60 block uppercase font-bold">Vigência / Renovação</span>
                  <span className="text-yellow-100 mt-0.5 block">
                    {formatDate(user.subscriptionExpiresAt)}
                  </span>
                </div>
              </>
            )}
          </div>

          {/* Action button */}
          <div className="pt-2">
            <button
              type="button"
              onClick={() => {
                onClose();
                if (onOpenPlans) onOpenPlans();
              }}
              className="w-full py-3.5 bg-gradient-to-r from-yellow-500 via-yellow-400 to-yellow-600 hover:from-yellow-400 hover:to-yellow-500 text-black font-extrabold rounded-xl text-xs uppercase tracking-wider transition-all shadow-lg shadow-yellow-950/60 flex items-center justify-center gap-2 cursor-pointer"
            >
              <Sparkles className="h-4 w-4" />
              <span>{user.accountType === 'paid' ? 'Alterar ou Renovar Plano' : 'Assinar Plano Profissional'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
