import React, { useState, useEffect } from 'react';
import { Lock, CheckCircle2, AlertCircle, ArrowRight, Eye, EyeOff, KeyRound } from 'lucide-react';
import { validateResetToken, resetPasswordWithToken } from '../services/geminiService';

interface ResetPasswordModalProps {
  token: string;
  onSuccess: () => void;
  onClose?: () => void;
  onGoToLogin?: () => void;
}

export const ResetPasswordModal: React.FC<ResetPasswordModalProps> = ({
  token,
  onSuccess,
  onClose,
  onGoToLogin,
}) => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [isValidating, setIsValidating] = useState(true);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    let isMounted = true;

    async function checkToken() {
      if (!token) {
        setTokenError('Token de redefinição não fornecido.');
        setIsValidating(false);
        return;
      }

      setIsValidating(true);
      setTokenError(null);

      try {
        const result = await validateResetToken(token);
        if (isMounted) {
          if (!result.ok) {
            setTokenError(result.error || 'Link de redefinição inválido ou expirado.');
          }
        }
      } catch (err: any) {
        if (isMounted) {
          setTokenError(err.message || 'Erro ao validar o link de redefinição.');
        }
      } finally {
        if (isMounted) {
          setIsValidating(false);
        }
      }
    }

    checkToken();

    return () => {
      isMounted = false;
    };
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (password.length < 8) {
      setFormError('A nova senha deve ter no mínimo 8 caracteres.');
      return;
    }

    if (password !== confirmPassword) {
      setFormError('As senhas digitadas não coincidem.');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await resetPasswordWithToken(token, password.trim());
      setIsSuccess(true);
      setSuccessMessage(
        response.message || 'Senha redefinida com sucesso! Você já pode fazer login com sua nova senha.'
      );
    } catch (err: any) {
      setFormError(err.message || 'Erro ao redefinir a senha. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFinish = () => {
    if (onGoToLogin) {
      onGoToLogin();
    } else if (onClose) {
      onClose();
    } else {
      onSuccess();
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-fadeIn">
      <div className="bg-[#180202] border border-yellow-500/50 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl relative text-yellow-50">
        <div className="bg-[#2a0101] border-b border-yellow-900/50 p-5 text-center">
          <div className="w-12 h-12 rounded-full bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 flex items-center justify-center mx-auto mb-2 shadow-[0_0_15px_rgba(234,179,8,0.2)]">
            <KeyRound className="h-6 w-6" />
          </div>
          <h3 className="font-black text-lg text-yellow-100 uppercase tracking-wide">
            Redefinir Senha
          </h3>
          <p className="text-xs text-yellow-200/70 mt-0.5">
            Crie sua nova senha para acessar a plataforma
          </p>
        </div>

        <div className="p-6 space-y-4">
          {isValidating ? (
            <div className="text-center py-8 space-y-3">
              <div className="w-8 h-8 border-3 border-yellow-500 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs text-yellow-200/80">Validando link de redefinição...</p>
            </div>
          ) : tokenError ? (
            <div className="text-center space-y-4 py-3">
              <div className="w-12 h-12 bg-red-950/60 border border-red-800 text-red-400 rounded-full flex items-center justify-center mx-auto">
                <AlertCircle className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-bold text-red-300">{tokenError}</p>
                <p className="text-xs text-yellow-200/60 mt-1">
                  O link pode ter expirado (validade de 1 hora) ou já ter sido utilizado.
                </p>
              </div>
              <button
                type="button"
                onClick={handleFinish}
                className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-black text-xs py-3 rounded-lg uppercase tracking-wider transition-all cursor-pointer shadow-lg"
              >
                Voltar para o Login
              </button>
            </div>
          ) : isSuccess ? (
            <div className="text-center space-y-4 py-3">
              <div className="w-12 h-12 bg-green-950/60 border border-green-800 text-green-400 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-bold text-green-300">Senha Alterada!</p>
                <p className="text-xs text-yellow-100/90 mt-1 leading-relaxed">{successMessage}</p>
              </div>
              <button
                type="button"
                onClick={handleFinish}
                className="w-full bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-400 hover:to-yellow-500 text-black font-black text-xs py-3 rounded-lg uppercase tracking-wider transition-all cursor-pointer shadow-lg flex items-center justify-center gap-2"
              >
                <span>Ir para o Login</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-widest text-yellow-300/80 flex items-center gap-1">
                  <Lock className="h-3.5 w-3.5" />
                  <span>Nova Senha (mínimo 8 caracteres)</span>
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (formError) setFormError(null);
                    }}
                    placeholder="Digite sua nova senha"
                    required
                    minLength={8}
                    className="w-full bg-black/60 border border-yellow-900/50 rounded-lg px-3 py-2.5 pr-10 text-sm text-yellow-100 placeholder-yellow-800/40 focus:border-yellow-500 focus:outline-none transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-yellow-500/60 hover:text-yellow-400 transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-widest text-yellow-300/80 flex items-center gap-1">
                  <Lock className="h-3.5 w-3.5" />
                  <span>Confirmar Nova Senha</span>
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      if (formError) setFormError(null);
                    }}
                    placeholder="Confirme a nova senha"
                    required
                    minLength={8}
                    className="w-full bg-black/60 border border-yellow-900/50 rounded-lg px-3 py-2.5 pr-10 text-sm text-yellow-100 placeholder-yellow-800/40 focus:border-yellow-500 focus:outline-none transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-yellow-500/60 hover:text-yellow-400 transition-colors"
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {formError && (
                <div className="flex items-center gap-2 p-2.5 bg-red-950/40 border border-red-900/35 text-red-400 rounded-lg text-xs font-semibold animate-pulse">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-400 hover:to-yellow-500 text-black font-black text-xs py-3 rounded-lg uppercase tracking-wider transition-all cursor-pointer shadow-lg flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                    <span>Salvando Nova Senha...</span>
                  </>
                ) : (
                  <>
                    <span>SALVAR NOVA SENHA</span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
