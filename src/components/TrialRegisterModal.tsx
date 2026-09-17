import React, { useState } from 'react';
import { X, Sparkles, CheckCircle2, AlertCircle, Mail, Phone, Building, UserCheck, ShieldCheck, ArrowRight } from 'lucide-react';

interface TrialRegisterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGoToLogin?: () => void;
  onOpenLogin?: () => void;
  onGoToResetPassword?: () => void;
}

export const TrialRegisterModal: React.FC<TrialRegisterModalProps> = ({
  isOpen,
  onClose,
  onGoToLogin,
  onOpenLogin,
  onGoToResetPassword,
}) => {
  const handleLoginClick = onGoToLogin || onOpenLogin || onClose;
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [organization, setOrganization] = useState('');
  const [usageProfile, setUsageProfile] = useState('Treinador');
  const [termsAccepted, setTermsAccepted] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [existingAccountWarning, setExistingAccountWarning] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [initialEmailSent, setInitialEmailSent] = useState(true);

  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendMessage, setResendMessage] = useState<string | null>(null);
  const [resendIsError, setResendIsError] = useState(false);
  const [isResending, setIsResending] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setExistingAccountWarning(false);

    if (!termsAccepted) {
      setErrorMessage('Você deve aceitar os Termos de Uso e a Política de Privacidade para prosseguir.');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('/api/trial/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          phone: phone.trim(),
          organization: organization.trim(),
          usageProfile,
          termsAccepted: true,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (response.status === 409 || data.error === 'ALREADY_EXISTS') {
          setExistingAccountWarning(true);
          setErrorMessage(data.message || data.error || 'Já existe uma conta associada a este e-mail.');
        } else {
          setErrorMessage(data.message || data.error || 'Erro ao processar o cadastro.');
        }
        return;
      }

      setInitialEmailSent(data.emailSent !== false);
      setIsSuccess(true);
      setResendCooldown(60);
      const timer = setInterval(() => {
        setResendCooldown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro de conexão com o servidor.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0 || !email || isResending) return;
    setResendMessage(null);
    setResendIsError(false);
    setIsResending(true);

    try {
      const res = await fetch('/api/trial/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.ok) {
        setResendMessage(data.message || 'Novo e-mail de ativação enviado com sucesso! Verifique sua caixa de entrada.');
        setResendIsError(false);
        setResendCooldown(60);
      } else {
        const errorMsg = data?.error || data?.message || `Não foi possível reenviar (HTTP ${res.status}). Tente novamente mais tarde.`;
        setResendMessage(errorMsg);
        setResendIsError(true);
      }
    } catch (err: any) {
      setResendMessage(err.message || 'Erro de conexão ao solicitar reenvio. Verifique sua rede.');
      setResendIsError(true);
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fadeIn">
      <div className="bg-[#180202] border border-yellow-500/40 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl relative flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="bg-[#2a0101] border-b border-yellow-900/50 p-5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-yellow-500/10 border border-yellow-500/30 text-yellow-400">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-yellow-100 uppercase tracking-wide">
                Teste Grátis por 7 Dias
              </h3>
              <p className="text-[11px] text-yellow-200/70">
                Acesso completo às ferramentas profissionais de scout & IA
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

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-grow">
          {isSuccess ? (
            <div className="text-center space-y-5 py-4 animate-fadeIn">
              <div className="w-16 h-16 bg-emerald-950/80 border-2 border-emerald-500/80 text-emerald-400 rounded-full flex items-center justify-center mx-auto shadow-lg shadow-emerald-950/50">
                <CheckCircle2 className="h-8 w-8" />
              </div>

              <div className="space-y-2">
                <h4 className="text-xl font-black text-white">Cadastro realizado!</h4>
                {initialEmailSent ? (
                  <p className="text-sm text-yellow-100/80 max-w-md mx-auto leading-relaxed">
                    Enviamos um e-mail para <strong className="text-yellow-400">{email}</strong> com o link exclusivo para você ativar seus <span className="text-emerald-400 font-bold">7 dias gratuitos</span> e definir sua senha.
                  </p>
                ) : (
                  <p className="text-sm text-yellow-200/90 max-w-md mx-auto leading-relaxed">
                    Sua conta de teste foi criada com sucesso! Caso não receba o e-mail de ativação em instantes, clique no botão de <strong>Reenviar e-mail</strong> abaixo.
                  </p>
                )}
              </div>

              <div className="bg-[#2a0101]/60 border border-yellow-900/40 rounded-xl p-4 text-xs text-yellow-200/70 text-left space-y-2">
                <div className="flex items-start gap-2">
                  <Mail className="h-4 w-4 text-yellow-400 shrink-0 mt-0.5" />
                  <span>Verifique sua caixa de entrada e também a pasta de spam/lixo eletrônico.</span>
                </div>
                <div className="flex items-start gap-2">
                  <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>Seus 7 dias começam a contar somente a partir do momento em que você ativar o link.</span>
                </div>
              </div>

              {resendMessage && (
                <div
                  className={`text-xs p-3 rounded-lg border flex items-start gap-2 text-left ${
                    resendIsError
                      ? 'bg-red-950/60 border-red-800/60 text-red-300'
                      : 'bg-emerald-950/60 border-emerald-800/60 text-emerald-300'
                  }`}
                >
                  {resendIsError ? (
                    <AlertCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                  )}
                  <span>{resendMessage}</span>
                </div>
              )}

              <div className="pt-2 flex flex-col sm:flex-row gap-3 justify-center items-center">
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={resendCooldown > 0 || isResending}
                  className="text-xs text-yellow-300 hover:text-yellow-200 underline disabled:opacity-50 disabled:no-underline cursor-pointer flex items-center gap-1.5"
                >
                  {isResending ? (
                    'Reenviando...'
                  ) : resendCooldown > 0 ? (
                    `Reenviar e-mail em ${resendCooldown}s`
                  ) : (
                    'Não recebeu? Reenviar e-mail de ativação'
                  )}
                </button>
              </div>

              <div className="pt-4 border-t border-yellow-900/30">
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    handleLoginClick();
                  }}
                  className="w-full py-3 bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-400 hover:to-yellow-500 text-black font-bold rounded-xl text-xs uppercase tracking-wider transition-all cursor-pointer"
                >
                  Ir para a Tela de Login
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="bg-yellow-950/30 border border-yellow-900/40 rounded-xl p-3.5 flex items-center gap-3 text-xs text-yellow-200/80">
                <ShieldCheck className="h-5 w-5 text-yellow-400 shrink-0" />
                <span>
                  <strong>Sem compromisso:</strong> não é necessário cartão de crédito para começar o período gratuito.
                </span>
              </div>

              {errorMessage && (
                <div className="bg-red-950/60 border border-red-900/60 rounded-xl p-3 text-xs text-red-300 space-y-2">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
                    <span>{errorMessage}</span>
                  </div>
                  {existingAccountWarning && (
                    <div className="flex gap-2 pt-1 border-t border-red-900/30 text-xs">
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          handleLoginClick();
                        }}
                        className="text-yellow-300 hover:underline font-bold"
                      >
                        Entrar agora →
                      </button>
                      <span className="text-red-400/50">|</span>
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          if (onGoToResetPassword) onGoToResetPassword();
                          else handleLoginClick();
                        }}
                        className="text-yellow-300 hover:underline font-bold"
                      >
                        Recuperar senha →
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Nome */}
              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-yellow-200 uppercase tracking-wider">
                  Nome Completo *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Carlos Eduardo Silva"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-black/60 border border-yellow-900/40 focus:border-yellow-500 rounded-xl px-3 py-2 text-xs text-white placeholder-yellow-900/50 focus:outline-none"
                />
              </div>

              {/* Email */}
              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-yellow-200 uppercase tracking-wider">
                  E-mail Profissional *
                </label>
                <div className="relative">
                  <input
                    type="email"
                    required
                    placeholder="seu.email@dominio.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-black/60 border border-yellow-900/40 focus:border-yellow-500 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-yellow-900/50 focus:outline-none"
                  />
                  <Mail className="h-4 w-4 text-yellow-600/70 absolute left-3 top-2.5" />
                </div>
              </div>

              {/* Telefone & Perfil */}
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-yellow-200 uppercase tracking-wider">
                    WhatsApp / Telefone *
                  </label>
                  <div className="relative">
                    <input
                      type="tel"
                      required
                      placeholder="(11) 99999-9999"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full bg-black/60 border border-yellow-900/40 focus:border-yellow-500 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-yellow-900/50 focus:outline-none"
                    />
                    <Phone className="h-4 w-4 text-yellow-600/70 absolute left-3 top-2.5" />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-yellow-200 uppercase tracking-wider">
                    Perfil de Uso *
                  </label>
                  <select
                    value={usageProfile}
                    onChange={(e) => setUsageProfile(e.target.value)}
                    className="w-full bg-black/60 border border-yellow-900/40 focus:border-yellow-500 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                  >
                    <option value="Treinador">Treinador</option>
                    <option value="Analista de desempenho">Analista de desempenho</option>
                    <option value="Clube">Clube</option>
                    <option value="Escola/Faculdade">Escola / Faculdade</option>
                    <option value="Atleta">Atleta</option>
                    <option value="Jornalista">Jornalista</option>
                    <option value="Torcedor">Torcedor</option>
                    <option value="Outro">Outro</option>
                  </select>
                </div>
              </div>

              {/* Organização (Opcional) */}
              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-yellow-200 uppercase tracking-wider">
                  Organização / Clube / Empresa <span className="text-yellow-600 font-normal">(opcional)</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Ex: Grêmio FBPA, Rádio X, Freelancer"
                    value={organization}
                    onChange={(e) => setOrganization(e.target.value)}
                    className="w-full bg-black/60 border border-yellow-900/40 focus:border-yellow-500 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-yellow-900/50 focus:outline-none"
                  />
                  <Building className="h-4 w-4 text-yellow-600/70 absolute left-3 top-2.5" />
                </div>
              </div>

              {/* Terms Checkbox */}
              <div className="pt-2">
                <label className="flex items-start gap-2.5 cursor-pointer text-xs text-yellow-200/80 select-none">
                  <input
                    type="checkbox"
                    checked={termsAccepted}
                    onChange={(e) => setTermsAccepted(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-yellow-900/60 bg-black/60 text-yellow-500 focus:ring-yellow-500"
                  />
                  <span>
                    Li e aceito os <strong className="text-yellow-300 underline">Termos de Uso</strong> e a{' '}
                    <strong className="text-yellow-300 underline">Política de Privacidade</strong>.
                  </span>
                </label>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3.5 px-4 bg-gradient-to-r from-yellow-500 via-yellow-400 to-yellow-600 hover:from-yellow-400 hover:to-yellow-500 text-black font-black rounded-xl text-xs uppercase tracking-wider transition-all shadow-lg shadow-yellow-950/60 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isLoading ? (
                  <span>Processando...</span>
                ) : (
                  <>
                    <span>CRIAR MEU ACESSO GRÁTIS</span>
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

export default TrialRegisterModal;
