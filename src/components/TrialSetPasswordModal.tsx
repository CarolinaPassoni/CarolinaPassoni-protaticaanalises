import React, { useState, useEffect } from 'react';
import { Lock, CheckCircle, AlertCircle, ArrowRight, ShieldCheck, Sparkles } from 'lucide-react';
import { User } from '../types.js';

interface TrialSetPasswordModalProps {
  isOpen?: boolean;
  verifyToken?: string | null;
  setPasswordToken?: string | null;
  token?: string | null;
  email?: string;
  name?: string;
  onSuccess: (userOrToken: any, tokenOrUser?: any) => void;
  onClose?: () => void;
}

export const TrialSetPasswordModal: React.FC<TrialSetPasswordModalProps> = ({
  isOpen = true,
  verifyToken,
  setPasswordToken: initialSetPasswordToken,
  token,
  email,
  name,
  onSuccess,
  onClose,
}) => {
  const [activeSetPasswordToken, setActiveSetPasswordToken] = useState<string | null>(
    initialSetPasswordToken || token || null
  );
  const [isVerifying, setIsVerifying] = useState(!!verifyToken);
  const [verificationError, setVerificationError] = useState<string | null>(null);
  const [verificationSuccess, setVerificationSuccess] = useState(false);
  const [expiresAtText, setExpiresAtText] = useState<string>('');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (token) {
      setActiveSetPasswordToken(token);
    }
  }, [token]);

  useEffect(() => {
    if (verifyToken) {
      const verifyEmail = async () => {
        setIsVerifying(true);
        setVerificationError(null);
        try {
          const res = await fetch('/api/trial/verify-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: verifyToken }),
          });
          const data = await res.json().catch(() => null);
          if (!res.ok) {
            setVerificationError(data?.message || data?.error || 'Token inválido ou expirado.');
          } else {
            setVerificationSuccess(true);
            setActiveSetPasswordToken(data?.setPasswordToken || data?.token || verifyToken);
            if (data?.expiresAtFormatted) {
              setExpiresAtText(data.expiresAtFormatted);
            }
          }
        } catch (err: any) {
          setVerificationError(err.message || 'Erro de conexão.');
        } finally {
          setIsVerifying(false);
        }
      };

      verifyEmail();
    }
  }, [verifyToken]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (password.length < 6) {
      setFormError('A senha deve conter no mínimo 6 caracteres.');
      return;
    }

    if (password !== confirmPassword) {
      setFormError('As senhas digitadas não conferem.');
      return;
    }

    if (!activeSetPasswordToken) {
      setFormError('Token de definição de senha ausente.');
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch('/api/trial/set-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: activeSetPasswordToken,
          setPasswordToken: activeSetPasswordToken,
          password: password.trim(),
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        setFormError(data?.message || data?.error || 'Erro ao definir senha.');
        return;
      }

      // Save token in localStorage
      if (data?.token) {
        localStorage.setItem('auth_token', data.token);
      }

      onSuccess(data.user, data.token);
    } catch (err: any) {
      setFormError(err.message || 'Erro de comunicação com o servidor.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-fadeIn">
      <div className="bg-[#180202] border border-yellow-500/50 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl relative">
        <div className="bg-[#2a0101] border-b border-yellow-900/50 p-5 text-center">
          <div className="w-12 h-12 rounded-full bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 flex items-center justify-center mx-auto mb-2">
            <Lock className="h-6 w-6" />
          </div>
          <h3 className="font-black text-lg text-yellow-100 uppercase tracking-wide">
            Definir Senha de Acesso
          </h3>
          <p className="text-xs text-yellow-200/70">
            Crie sua senha segura para acessar o ProTática
          </p>
        </div>

        <div className="p-6 space-y-4">
          {isVerifying ? (
            <div className="text-center py-6 space-y-3">
              <div className="w-8 h-8 border-3 border-yellow-500 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs text-yellow-200/80">Validando seu link de ativação e liberando seus 7 dias...</p>
            </div>
          ) : verificationError ? (
            <div className="text-center space-y-4 py-2">
              <div className="w-12 h-12 bg-red-950/60 border border-red-800 text-red-400 rounded-full flex items-center justify-center mx-auto">
                <AlertCircle className="h-6 w-6" />
              </div>
              <p className="text-sm font-bold text-red-300">{verificationError}</p>
              <p className="text-xs text-yellow-200/60">
                O link pode ter expirado ou já ter sido utilizado.
              </p>
              <button
                type="button"
                onClick={onClose}
                className="w-full py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Voltar à Página Inicial
              </button>
            </div>
          ) : (
            <>
              {verificationSuccess && (
                <div className="bg-emerald-950/40 border border-emerald-800/40 rounded-xl p-3.5 flex items-start gap-2.5 text-xs text-emerald-300">
                  <Sparkles className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <strong className="block text-emerald-200 font-bold">Teste Grátis Ativado com Sucesso!</strong>
                    <span>Seus 7 dias completos já estão liberados {expiresAtText ? `até ${expiresAtText}` : ''}.</span>
                  </div>
                </div>
              )}

              {formError && (
                <div className="bg-red-950/60 border border-red-800/60 text-red-300 p-3 rounded-xl text-xs flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
                  <span>{formError}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-yellow-200 uppercase tracking-wider">
                    Nova Senha
                  </label>
                  <input
                    type="password"
                    required
                    placeholder="Mínimo 6 caracteres"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-black/60 border border-yellow-900/40 focus:border-yellow-500 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-yellow-200 uppercase tracking-wider">
                    Confirme a Senha
                  </label>
                  <input
                    type="password"
                    required
                    placeholder="Repita sua nova senha"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full bg-black/60 border border-yellow-900/40 focus:border-yellow-500 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3.5 bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-400 hover:to-yellow-500 text-black font-extrabold rounded-xl text-xs uppercase tracking-wider transition-all shadow-lg shadow-yellow-950/60 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <span>Gravando Senha...</span>
                  ) : (
                    <>
                      <span>CRIAR SENHA E ACESSAR</span>
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
