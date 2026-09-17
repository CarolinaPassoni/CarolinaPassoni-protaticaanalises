import React from 'react';
import { useLanguage } from '../context/LanguageContext';
import { Settings, LogOut, Key, Printer, CreditCard, Gift } from 'lucide-react';

interface HeaderProps {
    currentUser: { 
        id: string; 
        username: string; 
        displayName: string;
        role?: 'admin' | 'user';
        account_type?: string;
        trial_status?: string;
        subscription_status?: string;
        daysRemaining?: number;
    } | null;
    onLogout: () => void;
    onOpenStripeSettings: () => void;
    onOpenChangePassword: () => void;
    onOpenSubscription?: () => void;
}

const Header: React.FC<HeaderProps> = ({ 
    currentUser, 
    onLogout, 
    onOpenStripeSettings, 
    onOpenChangePassword,
    onOpenSubscription 
}) => {
    const { t, language } = useLanguage();
    const isAdmin = currentUser?.role === 'admin';
    const isTrial = currentUser?.account_type === 'trial' || currentUser?.trial_status === 'active';

    return (
        <header className="relative text-center p-4 md:p-6 border-b border-yellow-900/50">
            <div className="flex justify-center items-center gap-3 mb-2">
                <img 
                    src="https://files.catbox.moe/o6n9e6.png" 
                    alt="PROTATICA Logo" 
                    className="h-12 w-auto object-contain drop-shadow-[0_0_8px_rgba(250,204,21,0.2)]"
                />
                <h1 className="text-4xl md:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-yellow-500">
                    {t('title')}
                </h1>
            </div>
            
            <p className="text-md md:text-lg text-yellow-200/70">
                {t('subtitle')}
            </p>

            {currentUser && (
                <div className="mt-2 text-xs text-yellow-500 font-medium flex items-center justify-center gap-2 flex-wrap">
                    <span>
                        {language === 'pt' ? 'Conectado como: ' : 'Logged in as: '}
                        <strong className="text-yellow-105 font-bold">{currentUser.displayName}</strong>
                        <span className="text-yellow-101/50 font-mono ml-1">({currentUser.username})</span>
                    </span>

                    {isTrial && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            <Gift className="h-3 w-3" />
                            <span>Período de Teste</span>
                        </span>
                    )}

                    {!isAdmin && !isTrial && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            <CreditCard className="h-3 w-3" />
                            <span>Plano Ativo</span>
                        </span>
                    )}
                </div>
            )}

            <div className="absolute top-4 right-4 flex wrap gap-2 print:hidden items-center">
                {/* Admin-only Panel Gear Trigger */}
                {isAdmin && (
                    <button
                        onClick={onOpenStripeSettings}
                        className="bg-yellow-950/40 border border-yellow-500/35 text-yellow-300 px-3 py-2 rounded-lg hover:bg-yellow-900/50 hover:text-yellow-101 transition-all text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                        title="Painel de Controle e Configurações"
                    >
                        <Settings className="h-4 w-4 stroke-[2.5]" />
                        <span className="hidden md:inline">{language === 'pt' ? 'Configurações' : 'Settings'}</span>
                    </button>
                )}

                {/* Non-admin My Subscription Button */}
                {!isAdmin && onOpenSubscription && (
                    <button
                        onClick={onOpenSubscription}
                        className="bg-yellow-500/10 border border-yellow-500/30 text-yellow-300 px-3 py-2 rounded-lg hover:bg-yellow-500/20 transition-all text-xs font-semibold flex items-center gap-1 cursor-pointer"
                        title="Detalhes da Assinatura / Teste"
                    >
                        <CreditCard className="h-3.5 w-3.5" />
                        <span className="hidden md:inline">{isTrial ? 'Meu Teste' : 'Minha Assinatura'}</span>
                    </button>
                )}

                {/* Change Password option for all users */}
                <button
                    onClick={onOpenChangePassword}
                    className="bg-black/30 border border-yellow-900/30 text-yellow-300/80 px-3 py-2 rounded-lg hover:bg-yellow-900/40 hover:text-yellow-102 transition-colors text-xs font-semibold flex items-center gap-1 cursor-pointer"
                    title="Mudar Senha de Acesso"
                >
                    <Key className="h-3.5 w-3.5" />
                    <span className="hidden md:inline">{language === 'pt' ? 'Alterar Senha' : 'Change Password'}</span>
                </button>

                <button
                    onClick={() => window.print()}
                    className="bg-transparent border border-yellow-700/50 text-yellow-300/80 px-3 py-2 rounded-lg hover:bg-yellow-900/40 hover:text-yellow-200 transition-colors text-xs font-semibold flex items-center gap-1"
                >
                    <Printer className="h-3.5 w-3.5" />
                    <span className="hidden md:inline">{t('pdfReport')}</span>
                </button>
                
                <button
                    onClick={onLogout}
                    className="bg-red-950/15 border border-red-900/40 text-red-300/80 px-3 py-2 rounded-lg hover:bg-red-900/40 hover:text-red-101 transition-colors text-xs font-semibold flex items-center gap-1"
                    aria-label={t('logout')}
                >
                    <LogOut className="h-3.5 w-3.5" />
                    <span>{t('logout')}</span>
                </button>
            </div>
        </header>
    );
};

export default Header;
