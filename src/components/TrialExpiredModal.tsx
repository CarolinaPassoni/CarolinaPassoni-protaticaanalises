import React from 'react';
import { Clock, ShieldAlert, Sparkles, LogOut, Check } from 'lucide-react';
import { User } from '../types.js';

interface TrialExpiredModalProps {
  user?: User | null;
  isOpen: boolean;
  onOpenPlans?: () => void;
  onOpenUpgrade?: () => void;
  onLogout?: () => void;
  onClose?: () => void;
}

export const TrialExpiredModal: React.FC<TrialExpiredModalProps> = ({
  user,
  isOpen,
  onOpenPlans,
  onOpenUpgrade,
  onLogout,
  onClose,
}) => {
  if (!isOpen) return null;

  const handleUpgrade = onOpenPlans || onOpenUpgrade || (() => {});
  const handleExit = onLogout || onClose || (() => {});

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/90 backdrop-blur-lg animate-fadeIn">
      <div className="bg-[#180202] border border-amber-500/50 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl relative">
        {/* Header */}
        <div className="bg-[#2a0101] border-b border-yellow-900/50 p-6 text-center">
          <div className="w-14 h-14 rounded-full bg-amber-500/10 border-2 border-amber-500/40 text-amber-400 flex items-center justify-center mx-auto mb-3 shadow-lg shadow-amber-950/60">
            <Clock className="h-7 w-7" />
          </div>
          <h3 className="font-black text-xl text-yellow-100 uppercase tracking-wide">
            Seu período gratuito terminou
          </h3>
          <p className="text-xs text-yellow-200/70 mt-1">
            Esperamos que tenha aproveitado o poder da análise tática com inteligência artificial.
          </p>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          <div className="bg-[#2a0101]/40 border border-yellow-900/30 rounded-xl p-4 space-y-2.5 text-xs text-yellow-200/80">
            <div className="flex items-center gap-2 text-emerald-400 font-bold">
              <Check className="h-4 w-4" />
              <span>Seu histórico de análises e relatórios continuam preservados</span>
            </div>
            <div className="flex items-center gap-2 text-emerald-400 font-bold">
              <Check className="h-4 w-4" />
              <span>Ativação instantânea assim que escolher seu plano</span>
            </div>
            <div className="flex items-center gap-2 text-emerald-400 font-bold">
              <Check className="h-4 w-4" />
              <span>Acesso contínuo aos novos recursos e atualizações táticas</span>
            </div>
          </div>

          <div className="space-y-3 pt-2">
            <button
              type="button"
              onClick={handleUpgrade}
              className="w-full py-4 bg-gradient-to-r from-yellow-500 via-yellow-400 to-yellow-600 hover:from-yellow-400 hover:to-yellow-500 text-black font-black rounded-xl text-xs uppercase tracking-wider transition-all shadow-xl shadow-yellow-950/60 flex items-center justify-center gap-2 cursor-pointer"
            >
              <Sparkles className="h-4 w-4" />
              <span>ESCOLHER UM PLANO E CONTINUAR</span>
            </button>

            <button
              type="button"
              onClick={handleExit}
              className="w-full py-2.5 bg-white/5 hover:bg-white/10 text-yellow-200/70 hover:text-white rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Sair da Conta</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
