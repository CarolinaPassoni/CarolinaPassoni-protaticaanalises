import React, { useState } from 'react';
import { loginWithPassword, requestPasswordReset } from '../services/geminiService';
import { useLanguage } from '../context/LanguageContext';
import { Sparkles, Mail, Key, User, ArrowLeft, RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react';

interface LoginProps {
    onLoginSuccess: (user: any) => void;
    onBackToLanding?: () => void;
}

const Login: React.FC<LoginProps> = ({ onLoginSuccess, onBackToLanding }) => {
    const { t, language } = useLanguage();
    const [username, setUsername] = useState(''); // Empty default so user must enter their credentials
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    // Forget password / redefinition flow state
    const [isRecoveryMode, setIsRecoveryMode] = useState(false);
    const [recoveryEmail, setRecoveryEmail] = useState('');
    const [recoverySuccessMsg, setRecoverySuccessMsg] = useState('');

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isLoading) return;
        if (!username || !password) {
            setError(language === 'pt' ? 'Usuário e senha são necessários.' : 'Username and password are required.');
            return;
        }

        setIsLoading(true);
        setError('');
        setSuccess('');

        try {
            const user = await loginWithPassword(username.trim(), password.trim());
            setSuccess(language === 'pt' ? 'Acesso autorizado!' : 'Access authorized!');
            setTimeout(() => {
                onLoginSuccess(user);
            }, 800);
        } catch (err) {
            setError(err instanceof Error ? err.message : (language === 'pt' ? 'Credenciais inválidas.' : 'Invalid credentials.'));
        } finally {
            setIsLoading(false);
        }
    };

    const handlePasswordReset = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isLoading) return;
        if (!recoveryEmail || !recoveryEmail.includes('@')) {
            setError(language === 'pt' ? 'Informe um e-mail válido.' : 'Please enter a valid email.');
            return;
        }

        setIsLoading(true);
        setError('');
        setRecoverySuccessMsg('');

        try {
            const data = await requestPasswordReset(recoveryEmail.trim());
            setRecoverySuccessMsg(data.message || (language === 'pt'
                ? 'Se houver uma conta associada a este e-mail, enviaremos um link para redefinir sua senha.'
                : 'If there is an account associated with this email, we will send a password reset link.'));
        } catch (err) {
            setError(err instanceof Error ? err.message : (language === 'pt' ? 'Erro ao solicitar redefinição.' : 'Error requesting reset.'));
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen font-sans flex items-center justify-center p-4 bg-[#4a0404] relative overflow-hidden text-yellow-50">
            <div 
                className="absolute inset-0 z-0 opacity-[0.08] pointer-events-none"
                style={{
                    backgroundImage: "url('https://files.catbox.moe/lfylnw.png')",
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    backgroundRepeat: 'no-repeat',
                }}
            />

            <div className="w-full max-w-md relative z-10">
                <div className="bg-[#2a0101] backdrop-blur-md rounded-xl shadow-2xl border border-yellow-900/20 overflow-hidden p-8 space-y-6">
                    <div className="text-center flex flex-col items-center">
                        <img 
                            src="https://files.catbox.moe/o6n9e6.png" 
                            alt="PROTATICA Logo" 
                            className="h-32 w-auto mb-2 object-contain drop-shadow-[0_0_15px_rgba(250,204,21,0.3)] animate-pulse"
                        />
                        <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-yellow-500 uppercase tracking-wider">
                           {isRecoveryMode ? (language === 'pt' ? 'Recuperar Senha' : 'Reset Password') : t('restrictedAccess')}
                        </h1>
                        <p className="text-yellow-200/70 mt-1 text-xs">
                            {isRecoveryMode 
                                ? (language === 'pt' ? 'Insira seu email cadastrado na compra para redefinir' : 'Enter your registered email to reset')
                                : (language === 'pt' ? 'Acesse a plataforma de inteligência tática.' : 'Access the tactical intelligence platform.')
                            }
                        </p>
                    </div>

                    {!isRecoveryMode ? (
                        /* LOGIN FORM */
                        <form onSubmit={handleLogin} className="space-y-4">
                            <div className="space-y-1.5">
                                <label htmlFor="username" className="text-xs font-bold uppercase tracking-widest text-yellow-300/80 flex items-center gap-1">
                                    <User className="h-3.5 w-3.5" />
                                    <span>{language === 'pt' ? 'E-mail / Usuário' : 'E-mail / Username'}</span>
                                </label>
                                <input
                                    type="text"
                                    id="username"
                                    value={username}
                                    onChange={(e) => {
                                        setUsername(e.target.value);
                                        if (error) setError('');
                                    }}
                                    className="w-full bg-black/50 border border-yellow-850/40 rounded-lg px-3 py-2 text-sm placeholder-yellow-800/30 text-white focus:border-yellow-500 focus:outline-none transition-all"
                                    placeholder="ex: cliente@email.com ou admin"
                                    required
                                />
                            </div>

                            <div className="space-y-1.5">
                                <div className="flex justify-between items-center">
                                    <label htmlFor="password" className="text-xs font-bold uppercase tracking-widest text-yellow-300/80 flex items-center gap-1">
                                        <Key className="h-3.5 w-3.5" />
                                        <span>{language === 'pt' ? 'Senha' : 'Password'}</span>
                                    </label>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setIsRecoveryMode(true);
                                            setError('');
                                            setSuccess('');
                                        }}
                                        className="text-[11px] text-yellow-500 hover:text-yellow-300 hover:underline transition-colors cursor-pointer"
                                    >
                                        {language === 'pt' ? 'Esqueceu a senha?' : 'Forgot password?'}
                                    </button>
                                </div>
                                <input
                                    type="password"
                                    id="password"
                                    value={password}
                                    onChange={(e) => {
                                        setPassword(e.target.value);
                                        if (error) setError('');
                                    }}
                                    className="w-full bg-black/50 border border-yellow-850/40 rounded-lg px-3 py-2 text-sm placeholder-yellow-850/20 text-white focus:border-yellow-500 focus:outline-none transition-all"
                                    placeholder="••••••••"
                                    required
                                />
                            </div>

                            {error && (
                                <div className="flex items-center gap-2 p-2.5 bg-red-950/40 border border-red-900/35 text-red-400 rounded-lg text-xs font-semibold">
                                    <AlertCircle className="h-4 w-4 shrink-0" />
                                    <span>{error}</span>
                                </div>
                            )}

                            {success && (
                                <div className="flex items-center gap-2 p-2.5 bg-green-950/40 border border-green-900/35 text-green-300 rounded-lg text-xs font-semibold">
                                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                                    <span>{success}</span>
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={isLoading}
                                className="w-full bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-400 hover:to-yellow-555 text-black font-black text-xs py-3 rounded-lg uppercase tracking-wider transition-all duration-300 cursor-pointer shadow-lg hover:shadow-yellow-500/20 disabled:opacity-60 disabled:cursor-wait"
                            >
                                {isLoading ? (language === 'pt' ? 'Aguarde...' : 'Verifying...') : t('enterBtn')}
                            </button>
                        </form>
                    ) : (
                        /* RECOVERY FORM */
                        <form onSubmit={handlePasswordReset} className="space-y-4">
                            <div className="space-y-1.5">
                                <label htmlFor="recoveryEmail" className="text-xs font-bold uppercase tracking-widest text-yellow-300/80 flex items-center gap-1">
                                    <Mail className="h-3.5 w-3.5" />
                                    <span>{language === 'pt' ? 'E-mail Cadastrado' : 'Registered Email'}</span>
                                </label>
                                <input
                                    type="email"
                                    id="recoveryEmail"
                                    value={recoveryEmail}
                                    onChange={(e) => {
                                        setRecoveryEmail(e.target.value);
                                        if (error) setError('');
                                    }}
                                    className="w-full bg-black/50 border border-yellow-850/40 rounded-lg px-3 py-2 text-sm placeholder-yellow-800/30 text-white focus:border-yellow-500 focus:outline-none transition-all"
                                    placeholder="ex: comprador@email.com"
                                    required
                                />
                            </div>

                            {error && (
                                <div className="flex items-center gap-2 p-2.5 bg-red-950/40 border border-red-900/35 text-red-400 rounded-lg text-xs font-semibold animate-pulse">
                                    <AlertCircle className="h-4 w-4 shrink-0" />
                                    <span>{error}</span>
                                </div>
                            )}

                            {recoverySuccessMsg && (
                                <div className="space-y-2 p-3.5 bg-green-950/30 border border-green-800/40 text-green-200 rounded-lg text-xs">
                                    <div className="flex items-center gap-2 font-bold text-green-300">
                                        <CheckCircle2 className="h-4 w-4 text-green-400 shrink-0" />
                                        <span>{language === 'pt' ? 'Solicitação Enviada' : 'Request Sent'}</span>
                                    </div>
                                    <p className="leading-relaxed text-yellow-100/90 text-xs">{recoverySuccessMsg}</p>
                                    <p className="text-[11px] text-yellow-300/70 border-t border-green-900/40 pt-2 mt-1">
                                        {language === 'pt'
                                            ? '⏱ Verifique sua caixa de entrada e também a pasta de spam. O link é válido por 1 hora.'
                                            : '⏱ Check your inbox and spam folder. The link is valid for 1 hour.'}
                                    </p>
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsRecoveryMode(false);
                                        setError('');
                                        setSuccess('');
                                        setRecoverySuccessMsg('');
                                    }}
                                    className="flex items-center justify-center gap-1 bg-transparent hover:bg-white/5 border border-yellow-900/30 text-yellow-300 py-3 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
                                >
                                    <ArrowLeft className="h-3.5 w-3.5" />
                                    <span>{language === 'pt' ? 'Voltar' : 'Back'}</span>
                                </button>
                                
                                <button
                                    type="submit"
                                    disabled={isLoading}
                                    className="bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-400 hover:to-yellow-555 text-black font-black text-xs py-3 rounded-lg uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1 disabled:opacity-50"
                                >
                                    <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                                    <span>{isLoading ? (language === 'pt' ? 'Aguarde' : 'Wait') : (language === 'pt' ? 'Enviar Link' : 'Send Link')}</span>
                                </button>
                            </div>
                        </form>
                    )}

                    {onBackToLanding && (
                        <div className="text-center pt-2 border-t border-yellow-900/10">
                            <button
                                type="button"
                                onClick={onBackToLanding}
                                className="text-xs text-yellow-500 hover:text-yellow-300 underline font-semibold transition-all cursor-pointer"
                            >
                                {language === 'pt' ? '← Voltar para Apresentação' : language === 'en' ? '← Back to Presentation' : '← Volver a la Presentación'}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Login;
