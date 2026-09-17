import React, { useState, useEffect } from 'react';
import { Lock, CheckCircle2, AlertCircle, ArrowRight, Eye, EyeOff, KeyRound } from 'lucide-react';
import { validateResetToken, resetPasswordWithToken } from '../services/geminiService';

interface ResetPasswordPageProps {
  initialToken?: string | null;
  onGoToLogin: () => void;
}

export const ResetPasswordPage: React.FC<ResetPasswordPageProps> = ({
  initialToken,
  onGoToLogin,
}) => {
  // Extrai o token da URL se não fornecido via prop
  const getTokenFromUrl = (): string => {
    if (initialToken) return initialToken.trim();
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const queryToken = params.get('token') || params.get('reset_token') || params.get('reset_password');
      if (queryToken) return queryToken.trim();

      const pathname = window.location.pathname;
      if (pathname.startsWith('/reset-password/')) {
        return pathname.replace('/reset-password/', '').trim();
      }
    }
    return '';
  };

  const token = getTokenFromUrl();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [isValidating, setIsValidating] = useState(true);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  // Validação inicial do Token no backend sem consumir o token
  useEffect(() => {
    let isMounted = true;

    async function checkToken() {
      if (!token) {
        setTokenError('Link de redefinição inválido.');
        setIsValidating(false);
        return;
      }

      setIsValidating(true);
      setTokenError(null);

      try {
        const result = await validateResetToken(token);
        if (isMounted) {
          if (!result.ok) {
            setTokenError(result.error || 'Link de redefinição inválido.');
          }
        }
      } catch (err: any) {
        if (isMounted) {
          setTokenError(err.message || 'Link de redefinição inválido.');
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

    if (!token) {
      setFormError('Link de redefinição inválido.');
      return;
    }

    setIsSubmitting(true);

    try {
      await resetPasswordWithToken(token, password.trim());
      setIsSuccess(true);
    } catch (err: any) {
      setFormError(err.message || 'Erro ao salvar a nova senha. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen font-sans flex items-center justify-center p-4 bg-[#4a0404] relative overflow-hidden text-yellow-50">
      {/* Background Decorativo */}
      <div 
        className="absolute inset-0 z-0 opacity-[0.08] pointer-events-none"
        style={{
          backgroundImage: "url('https://files.catbox.moe/lfylnw.png')",
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        }}
      />

      <div className="w-full max-w-md relative z-10 animate-fadeIn">
        <div className="bg-[#2a0101] backdrop-blur-md rounded-2xl shadow-2xl border border-yellow-900/40 overflow-hidden shadow-black/60">
          
          {/* Header */}
          <div className="bg-[#1f0101] border-b border-yellow-900/50 p-6 text-center">
            <img 
              src="https://files.catbox.moe/o6n9e6.png" 
              alt="PROTÁTICA Logo" 
              className="h-20 w-auto mb-3 mx-auto object-contain drop-shadow-[0_0_15px_rgba(250,204,21,0.25)]"
            />
            <div className="inline-flex items-center justify-center gap-1.5 px-3 py-1 rounded-full bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-[11px] font-bold uppercase tracking-wider mb-2">
              <KeyRound className="h-3.5 w-3.5" />
              <span>PROTÁTICA</span>
            </div>
            <h1 className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-200 to-yellow-400 uppercase tracking-wide">
              REDEFINIR SENHA
            </h1>
            <p className="text-xs text-yellow-200/70 mt-1">
              Crie uma nova senha para sua conta.
            </p>
          </div>

          {/* Body */}
          <div className="p-6 sm:p-8 space-y-5">
            {isValidating ? (
              <div className="text-center py-10 space-y-3">
                <div className="w-9 h-9 border-3 border-yellow-500 border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-xs text-yellow-200/80 font-medium">Validando link de redefinição...</p>
              </div>
            ) : tokenError ? (
              <div className="text-center space-y-5 py-2">
                <div className="w-14 h-14 bg-red-950/60 border border-red-800/80 text-red-400 rounded-full flex items-center justify-center mx-auto shadow-lg shadow-red-950/50">
                  <AlertCircle className="h-7 w-7" />
                </div>
                <div>
                  <p className="text-sm font-bold text-red-300">{tokenError}</p>
                  <p className="text-xs text-yellow-200/60 mt-1.5">
                    Caso precise, solicite uma nova recuperação na tela de login.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onGoToLogin}
                  className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-black text-xs py-3.5 rounded-xl uppercase tracking-wider transition-all cursor-pointer shadow-lg hover:shadow-yellow-500/20"
                >
                  IR PARA O LOGIN
                </button>
              </div>
            ) : isSuccess ? (
              <div className="text-center space-y-5 py-2">
                <div className="w-14 h-14 bg-green-950/60 border border-green-800/80 text-green-400 rounded-full flex items-center justify-center mx-auto shadow-lg shadow-green-950/50">
                  <CheckCircle2 className="h-7 w-7" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-green-300">Senha alterada com sucesso.</h3>
                  <p className="text-xs text-yellow-100/80 mt-1.5 leading-relaxed">
                    Você já pode acessar sua conta normalmente com a nova senha criada.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onGoToLogin}
                  className="w-full bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-400 hover:to-yellow-500 text-black font-black text-xs py-3.5 rounded-xl uppercase tracking-wider transition-all cursor-pointer shadow-lg shadow-yellow-950/40 flex items-center justify-center gap-2"
                >
                  <span>ENTRAR NO PROTÁTICA</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-widest text-yellow-300/80 flex items-center gap-1">
                    <Lock className="h-3.5 w-3.5" />
                    <span>Nova senha</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        if (formError) setFormError(null);
                      }}
                      placeholder="Mínimo de 8 caracteres"
                      required
                      minLength={8}
                      className="w-full bg-black/60 border border-yellow-900/50 rounded-xl px-3.5 py-3 pr-10 text-sm text-yellow-100 placeholder-yellow-800/40 focus:border-yellow-500 focus:outline-none transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-yellow-500/60 hover:text-yellow-400 transition-colors p-1"
                      aria-label="Alternar visibilidade da senha"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-widest text-yellow-300/80 flex items-center gap-1">
                    <Lock className="h-3.5 w-3.5" />
                    <span>Confirmar nova senha</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => {
                        setConfirmPassword(e.target.value);
                        if (formError) setFormError(null);
                      }}
                      placeholder="Repita a nova senha"
                      required
                      minLength={8}
                      className="w-full bg-black/60 border border-yellow-900/50 rounded-xl px-3.5 py-3 pr-10 text-sm text-yellow-100 placeholder-yellow-800/40 focus:border-yellow-500 focus:outline-none transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-yellow-500/60 hover:text-yellow-400 transition-colors p-1"
                      aria-label="Alternar visibilidade da confirmação"
                    >
                      {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {formError && (
                  <div className="flex items-center gap-2 p-3 bg-red-950/50 border border-red-900/50 text-red-400 rounded-xl text-xs font-semibold animate-pulse">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{formError}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-400 hover:to-yellow-500 text-black font-black text-xs py-3.5 rounded-xl uppercase tracking-wider transition-all cursor-pointer shadow-lg shadow-yellow-950/40 flex items-center justify-center gap-2 disabled:opacity-60 mt-2"
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

          {/* Footer */}
          <div className="bg-[#180101] border-t border-yellow-900/30 px-6 py-4 text-center">
            <button
              type="button"
              onClick={onGoToLogin}
              className="text-xs text-yellow-400/80 hover:text-yellow-200 font-medium transition-colors cursor-pointer"
            >
              ← Voltar para a tela de Login
            </button>
          </div>

        </div>
      </div>
    </div>
  );
};
