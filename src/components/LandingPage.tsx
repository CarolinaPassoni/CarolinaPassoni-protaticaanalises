import React, { useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { 
    Tv, 
    ShieldCheck, 
    TrendingUp, 
    FileText, 
    Users, 
    Cpu, 
    Check, 
    ChevronRight, 
    Lock, 
    DollarSign, 
    Volume2, 
    Award,
    CreditCard,
    QrCode,
    Sparkles,
    CheckCircle2,
    Copy,
    LockKeyhole,
    AlertTriangle,
    Gift
} from 'lucide-react';
import TrialRegisterModal from './TrialRegisterModal';

interface LandingPageProps {
    onStartClick: () => void;
    onLoginClick: () => void;
}

type TabType = 'presentation' | 'pricing';

const LandingPage: React.FC<LandingPageProps> = ({ onStartClick, onLoginClick }) => {
    const { t } = useLanguage();
    const [activeTab, setActiveTab] = useState<TabType>('presentation');
    const [isTrialModalOpen, setIsTrialModalOpen] = useState(false);
    const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
    const [yearlyPaymentMode, setYearlyPaymentMode] = useState<'upfront' | 'monthly_sub'>('upfront');
    const [selectedPlan, setSelectedPlan] = useState<{ name: string; price: string } | null>(null);
    const [checkoutComplete, setCheckoutComplete] = useState(false);
    const [pixCopied, setPixCopied] = useState(false);

    // Stripe verification outcomes
    const [isVerifyingSession, setIsVerifyingSession] = useState(false);
    const [verificationError, setVerificationError] = useState('');
    const [buyerEmail, setBuyerEmail] = useState('');
    const [generatedPassword, setGeneratedPassword] = useState('');
    const [passwordCopied, setPasswordCopied] = useState(false);

    const [stripeConfig, setStripeConfig] = useState<{ publishableKey: string; hasSecretKey: boolean }>({
        publishableKey: '',
        hasSecretKey: false,
    });
    const [isCreatingSession, setIsCreatingSession] = useState(false);
    const [checkoutError, setCheckoutError] = useState('');

    const fetchStripeConfig = async () => {
        try {
            const res = await fetch('/api/stripe/config');
            if (res.ok) {
                const data = await res.json();
                setStripeConfig(data);
            }
        } catch (err) {
            console.error('Erro ao buscar configuração do Stripe:', err);
        }
    };

    React.useEffect(() => {
        fetchStripeConfig();
    }, []);

    React.useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        if (params.get('payment_success') === 'true') {
            const plan = params.get('plan') || 'Plano';
            const sessionId = params.get('session_id') || '';
            setSelectedPlan({ name: plan, price: '' });
            setCheckoutComplete(true);
            
            if (sessionId) {
                setIsVerifyingSession(true);
                setVerificationError('');
                fetch('/api/stripe/verify-session', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ sessionId, planName: plan }),
                })
                .then(async (res) => {
                    const data = await res.json();
                    if (res.ok) {
                        setBuyerEmail(data.email || '');
                        setGeneratedPassword(data.passwordPlain || '');
                    } else {
                        setVerificationError(data.error || 'Não foi possível validar o recibo de pagamento no gateway.');
                    }
                })
                .catch((err) => {
                    console.error('Falha de verificação:', err);
                    setVerificationError('Erro de conexão com o painel de verificação.');
                })
                .finally(() => {
                    setIsVerifyingSession(false);
                });
            }

            window.history.replaceState({}, document.title, window.location.pathname);
        } else if (params.get('payment_cancel') === 'true') {
            alert('A transação do Stripe foi cancelada pelo usuário.');
            window.history.replaceState({}, document.title, window.location.pathname);
        }
    }, []);

    const getYearlyMonthlyEquivalentPrice = (name: string): string => {
        if (name.includes('Scout') || name.includes('Bronze')) return 'R$ 41,25';
        if (name.includes('Performance') || name.includes('Profissional')) return 'R$ 97,25';
        if (name.includes('Intelligence') || name.includes('Elite')) return 'R$ 223,25';
        return 'Sob Consulta';
    };

    const handleStripeCheckout = async () => {
        if (!selectedPlan) return;
        setIsCreatingSession(true);
        setCheckoutError('');

        // Determinar nome e preço finais com base na escolha (À vista/Parcelado vs Assinatura Mensal com compromisso)
        const isYearly = selectedPlan.name.includes('Anual');
        if (isYearly && yearlyPaymentMode === 'monthly_sub') {
            setCheckoutError('A modalidade anual parcelada/recorrente mensal ainda não está habilitada no Stripe. Selecione a cobrança anual para continuar.');
            setIsCreatingSession(false);
            return;
        }

        const planId = selectedPlan.name.includes('Scout')
            ? (isYearly ? 'scout_yearly' : 'scout_monthly')
            : selectedPlan.name.includes('Performance')
                ? (isYearly ? 'performance_yearly' : 'performance_monthly')
                : selectedPlan.name.includes('Intelligence')
                    ? (isYearly ? 'intelligence_yearly' : 'intelligence_monthly')
                    : '';

        if (!planId) {
            setCheckoutError('Plano indisponível para checkout automático.');
            setIsCreatingSession(false);
            return;
        }

        const finalPlanName = isYearly
            ? (yearlyPaymentMode === 'upfront' 
                ? `${selectedPlan.name} (Parcelado / À Vista)` 
                : `${selectedPlan.name} (Assinatura Recorrente Mensal com Fidelidade)`)
            : selectedPlan.name;

        const finalPriceValue = isYearly
            ? (yearlyPaymentMode === 'upfront' 
                ? selectedPlan.price 
                : getYearlyMonthlyEquivalentPrice(selectedPlan.name))
            : selectedPlan.price;

        // Abrir uma nova aba em branco imediatamente antes de fazer a chamada assíncrona.
        // Isso preserva o contexto do gesto de clique do usuário e evita bloqueadores de pop-up.
        const checkoutWindow = window.open('', '_blank');
        if (checkoutWindow) {
            checkoutWindow.document.write(`
                <html>
                <head>
                    <title>Processando Pagamento...</title>
                    <style>
                        body {
                            background-color: #1a0000;
                            color: #fef08a;
                            font-family: system-ui, -apple-system, sans-serif;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            height: 100vh;
                            margin: 0;
                            text-align: center;
                        }
                        .loader {
                            border: 4px solid #4a0404;
                            border-top: 4px solid #eab308;
                            border-radius: 50%;
                            width: 40px;
                            height: 40px;
                            animation: spin 1s linear infinite;
                            margin: 0 auto 20px auto;
                        }
                        @keyframes spin {
                            0% { transform: rotate(0deg); }
                            100% { transform: rotate(360deg); }
                        }
                    </style>
                </head>
                <body>
                    <div>
                        <div class="loader"></div>
                        <p style="font-size: 18px; font-weight: bold; margin: 0 0 10px 0;">Redirecionando para o Stripe Seguro...</p>
                        <p style="font-size: 14px; opacity: 0.7; margin: 0;">Por favor, não feche esta janela.</p>
                    </div>
                </body>
                </html>
            `);
        }

        try {
            const res = await fetch('/api/subscription/checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ planId }),
            });
            if (res.ok) {
                const data = await res.json();
                if (data.url) {
                    if (checkoutWindow) {
                        checkoutWindow.location.href = data.url;
                    } else {
                        // Fallback se por algum motivo a janela não pôde ser aberta anteriormente
                        window.open(data.url, '_blank');
                    }
                } else {
                    if (checkoutWindow) checkoutWindow.close();
                    setCheckoutError('Nenhum link de redirecionamento retornado.');
                }
            } else {
                if (checkoutWindow) checkoutWindow.close();
                const errData = await res.json();
                setCheckoutError(errData.error || 'Erro ao iniciar checkout do Stripe. Contate o administrador do site.');
            }
        } catch (err) {
            if (checkoutWindow) checkoutWindow.close();
            setCheckoutError('Erro de conexão ao criar a sessão.');
        } finally {
            setIsCreatingSession(false);
        }
    };

    const handleCopyPix = () => {
        navigator.clipboard.writeText('00020101021126580014br.gov.bcb.pix0136protatica_scout_analise_key_00293029');
        setPixCopied(true);
        setTimeout(() => setPixCopied(false), 3000);
    };

    return (
        <div className="min-h-screen bg-[#4a0404] text-yellow-50 font-sans selection:bg-yellow-500 selection:text-black">
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

            {/* Top Header / Navigation Tab Bar */}
            <header className="sticky top-0 z-50 bg-[#2a0101]/95 backdrop-blur-md border-b border-yellow-900/40 px-4 py-3 md:px-8">
                <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
                    {/* Logo */}
                    <div className="flex items-center gap-3">
                        <img 
                            src="https://files.catbox.moe/o6n9e6.png" 
                            alt="PROTATICA Logo" 
                            className="h-12 w-auto object-contain drop-shadow-[0_0_8px_rgba(250,204,21,0.2)]"
                        />
                        <span className="text-xl font-bold tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-yellow-500 uppercase">
                            {t('title')}
                        </span>
                    </div>

                    {/* Navigation Tabs (Abas) */}
                    <nav className="flex items-center gap-1 md:gap-2 bg-black/40 p-1 rounded-lg border border-yellow-950">
                        <button
                            onClick={() => setActiveTab('presentation')}
                            className={`px-3 py-1.5 rounded-md text-xs md:text-sm font-medium transition-all cursor-pointer ${
                                activeTab === 'presentation'
                                    ? 'bg-yellow-500 text-black shadow-md'
                                    : 'text-yellow-105/70 hover:text-yellow-250 hover:bg-white/5'
                            }`}
                        >
                            {t('presentation')}
                        </button>
                        <button
                            onClick={() => setActiveTab('pricing')}
                            className={`px-3 py-1.5 rounded-md text-xs md:text-sm font-medium transition-all cursor-pointer ${
                                activeTab === 'pricing'
                                    ? 'bg-yellow-500 text-black shadow-md'
                                    : 'text-yellow-105/70 hover:text-yellow-250 hover:bg-white/5'
                            }`}
                        >
                            {t('pricing')}
                        </button>
                        <button
                            onClick={onStartClick}
                            className="px-3 py-1.5 rounded-md text-xs md:text-sm font-medium text-yellow-300 hover:text-yellow-101 bg-yellow-950/40 border border-yellow-700/40 hover:bg-yellow-900/40 cursor-pointer"
                        >
                            {t('start')}
                        </button>
                    </nav>

                    {/* Action Buttons: Trial + Login */}
                    <div className="flex items-center gap-2 sm:gap-3">
                        <button
                            onClick={() => setIsTrialModalOpen(true)}
                            className="bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-300 border border-yellow-500/30 hover:border-yellow-400 font-bold px-3.5 py-2 rounded-lg text-xs sm:text-sm transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
                        >
                            <Gift className="h-4 w-4 text-yellow-400" />
                            <span>Testar 7 Dias Grátis</span>
                        </button>

                        <button
                            onClick={onLoginClick}
                            className="bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-400 hover:to-yellow-500 text-black font-bold px-4 sm:px-5 py-2 rounded-lg text-xs sm:text-sm transition-all shadow-md active:scale-95 cursor-pointer"
                        >
                            {t('login')}
                        </button>
                    </div>
                </div>
            </header>

            {/* Main Content Area */}
            <main className="relative z-10 max-w-7xl mx-auto px-4 py-8 md:py-16">
                {activeTab === 'presentation' && (
                    <div className="space-y-16 animate-fadeIn">
                        {/* HERO SECTION */}
                        <div className="text-center max-w-4xl mx-auto space-y-6">
                            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-yellow-500/10 text-yellow-300 border border-yellow-500/20 uppercase tracking-widest inline-flex items-center gap-1">
                                <Sparkles className="h-3 w-3" /> INTELIGÊNCIA ESPORTIVA SÊNIOR
                            </span>
                            <h1 className="text-4xl md:text-6xl font-black tracking-tight text-white leading-tight">
                                Análise Tática e Scouting de Futebol de Nível <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-yellow-500">UEFA Pro</span>
                            </h1>
                            <p className="text-lg md:text-xl text-yellow-100/80 font-light max-w-3xl mx-auto leading-relaxed">
                                A primeira plataforma profissional que integra análises profundas de vídeos do YouTube com <strong className="text-yellow-300 font-semibold">Validação Computacional de Placar</strong> através do Google Search Grounding em tempo real.
                            </p>
                            
                            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
                                <button
                                    onClick={() => setIsTrialModalOpen(true)}
                                    className="w-full sm:w-auto bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-400 hover:to-yellow-500 text-black font-extrabold text-lg px-8 py-3.5 rounded-xl transition-all shadow-lg shadow-yellow-950/50 flex items-center justify-center gap-2 group transform hover:scale-[1.02] cursor-pointer"
                                >
                                    <Gift className="h-5 w-5 text-black" />
                                    <span>Começar Teste Grátis de 7 Dias</span>
                                    <ChevronRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
                                </button>
                                <button
                                    onClick={() => setActiveTab('pricing')}
                                    className="w-full sm:w-auto bg-[#2a0101]/80 hover:bg-[#2a0101] border border-yellow-700/50 text-yellow-300 font-semibold text-lg px-8 py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
                                >
                                    Ver Planos Pagos
                                </button>
                            </div>
                        </div>

                        {/* PREVIEW CONTAINER (MOCK DA PLATAFORMA EM USO) */}
                        <div className="bg-[#2a0101]/60 border border-yellow-900/30 rounded-2xl p-4 md:p-8 shadow-2xl relative overflow-hidden max-w-5xl mx-auto">
                            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-yellow-600 via-yellow-400 to-yellow-600" />
                            
                            {/* Window mockup header */}
                            <div className="flex items-center justify-between border-b border-yellow-900/20 pb-4 mb-6">
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full bg-red-500" />
                                    <div className="w-3 h-3 rounded-full bg-yellow-500" />
                                    <div className="w-3 h-3 rounded-full bg-green-500" />
                                </div>
                                <span className="text-xs font-mono text-yellow-300/40">DEMONSTRAÇÃO DE INTERFACE // PROTÁTICA V3</span>
                                <div className="w-4" /> {/* Spacer */}
                            </div>

                            {/* Simulated tactical analysis UI */}
                            <div className="grid md:grid-cols-12 gap-6">
                                <div className="md:col-span-4 space-y-4">
                                    <div className="p-4 bg-black/40 rounded-xl border border-yellow-900/30 space-y-3">
                                        <div className="text-xs text-yellow-400 font-bold uppercase tracking-wider">Identificação do Jogo</div>
                                        <div className="font-bold text-lg text-white">Flamengo vs. Palmeiras</div>
                                        <div className="text-xs text-yellow-200/60 bg-yellow-950/40 border border-yellow-900/40 px-2 py-1 rounded inline-block">
                                            Brasileirão Série A
                                        </div>
                                        <div className="text-sm border-t border-yellow-900/10 pt-2 flex items-center justify-between">
                                            <span className="text-yellow-200/50">Placar Audição:</span>
                                            <span className="font-mono text-green-400 font-bold">2 - 0 (Confirmado)</span>
                                        </div>
                                    </div>

                                    <div className="p-4 bg-black/40 rounded-xl border border-yellow-900/30 space-y-2">
                                        <div className="text-xs text-yellow-400 font-bold uppercase tracking-wider">Foco de Auditoria</div>
                                        <p className="text-xs text-yellow-100/70">
                                            "Sistema buscou dados reais no Google e provou que o vídeo corresponde ao jogo de ida, com placar de 2x0 no Maracanã."
                                        </p>
                                    </div>
                                </div>

                                <div className="md:col-span-8 bg-black/50 p-6 rounded-xl border border-yellow-900/20 space-y-4">
                                    <div className="flex items-center justify-between border-b border-yellow-900/10 pb-2">
                                        <span className="text-sm font-bold text-yellow-200">Resultados da IA Avançada</span>
                                        <span className="text-xs text-yellow-400/80 font-mono">Confiabilidade: 98.9%</span>
                                    </div>
                                    
                                    <div className="space-y-3">
                                        <div className="p-3 bg-yellow-900/10 border border-yellow-900/30 rounded-lg">
                                            <h4 className="font-bold text-sm text-yellow-300">Organização Defensiva Estruturada</h4>
                                            <p className="text-xs mt-1 text-yellow-100/80">
                                                Marcação por bloco médio com compactação horizontal ideal de 35m. Geração de sobreposição dupla nas alas.
                                            </p>
                                        </div>

                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="p-3 bg-yellow-900/5 border border-yellow-950 rounded-lg text-center">
                                                <div className="text-xs text-yellow-400/70">Scouting Jogadores</div>
                                                <div className="text-lg font-bold text-yellow-100">8 Analisados</div>
                                            </div>
                                            <div className="p-3 bg-yellow-900/5 border border-yellow-950 rounded-lg text-center">
                                                <div className="text-xs text-yellow-400/70">Validação de Placar</div>
                                                <div className="text-lg font-bold text-yellow-100">Google Search</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* RECURSOS E DIFERENCIAIS */}
                        <div className="space-y-12">
                            <div className="text-center space-y-4">
                                <h2 className="text-3xl md:text-4xl font-extrabold text-white">Por Que Escolher a PROTÁTICA?</h2>
                                <p className="text-yellow-200/70 max-w-2xl mx-auto">
                                    Tecnologia de ponta pensada do zero para scoutings profissionais, treinadores de futebol e jornalistas analíticos.
                                </p>
                            </div>

                            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
                                {/* Feature 1 */}
                                <div className="bg-[#2a0101]/40 border border-yellow-900/20 rounded-xl p-6 hover:border-yellow-700/50 transition-all group">
                                    <div className="p-3 bg-yellow-500/10 rounded-lg text-yellow-400 w-fit mb-4">
                                        <Cpu className="h-6 w-6" />
                                    </div>
                                    <h3 className="font-bold text-lg text-yellow-100 mb-2 group-hover:text-yellow-400 transition-colors">
                                        Gemini 3 Flash
                                    </h3>
                                    <p className="text-sm text-yellow-100/70 leading-relaxed">
                                        Aproveite o modelo de IA mais rápido e completo para processamento de contextos táticos complexos.
                                    </p>
                                </div>

                                {/* Feature 2 */}
                                <div className="bg-[#2a0101]/40 border border-yellow-900/20 rounded-xl p-6 hover:border-yellow-700/50 transition-all group">
                                    <div className="p-3 bg-yellow-500/10 rounded-lg text-yellow-400 w-fit mb-4">
                                        <ShieldCheck className="h-6 w-6" />
                                    </div>
                                    <h3 className="font-bold text-lg text-yellow-100 mb-2 group-hover:text-yellow-400 transition-colors">
                                        Validação de Placar
                                    </h3>
                                    <p className="text-sm text-yellow-100/70 leading-relaxed">
                                        Diferente de IAs normais que erram o placar, nós investigamos a partida real no Google Search para evitar falsos positivos.
                                    </p>
                                </div>

                                {/* Feature 3 */}
                                <div className="bg-[#2a0101]/40 border border-yellow-900/20 rounded-xl p-6 hover:border-yellow-700/50 transition-all group">
                                    <div className="p-3 bg-yellow-500/10 rounded-lg text-yellow-400 w-fit mb-4">
                                        <TrendingUp className="h-6 w-6" />
                                    </div>
                                    <h3 className="font-bold text-lg text-yellow-100 mb-2 group-hover:text-yellow-400 transition-colors">
                                        Scouting UEFA Pro
                                    </h3>
                                    <p className="text-sm text-yellow-100/70 leading-relaxed">
                                        Análises robustas de modelo de jogo de acordo com o padrão tático e diretrizes de grandes ligas europeias.
                                    </p>
                                </div>

                                {/* Feature 4 */}
                                <div className="bg-[#2a0101]/40 border border-yellow-900/20 rounded-xl p-6 hover:border-yellow-700/50 transition-all group">
                                    <div className="p-3 bg-yellow-500/10 rounded-lg text-yellow-400 w-fit mb-4">
                                        <FileText className="h-6 w-6" />
                                    </div>
                                    <h3 className="font-bold text-lg text-yellow-100 mb-2 group-hover:text-yellow-400 transition-colors">
                                        Relatórios em PDF
                                    </h3>
                                    <p className="text-sm text-yellow-100/70 leading-relaxed">
                                        Um clique e seu relatório vira uma ficha técnica de alto padrão visual, perfeitamente limpa para impressão.
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* BANDEIRA DE CREDIBILIDADE DE TESTES */}
                        <div className="bg-gradient-to-r from-yellow-700/10 via-yellow-600/20 to-yellow-700/10 border-y border-yellow-800/40 py-8 px-4 text-center space-y-3">
                            <Award className="h-8 w-8 text-yellow-400 mx-auto" />
                            <h3 className="font-bold text-xl text-yellow-100">Auditoria Completa Transparente</h3>
                            <p className="text-sm text-yellow-200/70 max-w-xl mx-auto">
                                Todas as análises de vídeo armazenadas localmente com ID de auditoria exclusivo, informando o modelo técnico usado e as fontes exatas coletadas na web.
                            </p>
                        </div>
                    </div>
                )}

                {activeTab === 'pricing' && (
                    <div className="space-y-12 animate-fadeIn">
                        {/* HEADER DA TAB DE PLANOS */}
                        <div className="text-center max-w-3xl mx-auto space-y-4">
                            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-yellow-500/20 text-yellow-300 border border-yellow-500/30 uppercase tracking-widest inline-flex items-center gap-1">
                                <DollarSign className="h-3 w-3" /> TABELA DE VALORES TRANSPARENTE
                            </span>
                            <h2 className="text-3xl md:text-5xl font-black text-white">Planos que Cabem no Seu Bolso</h2>
                            <p className="text-yellow-200/70">
                                Escolha a modalidade de faturamento que atende suas necessidades táticas e aproveite descontos exclusivos de faturamento anual.
                            </p>
                        </div>

                        {/* SELECTOR DE CICLO DE FATURAMENTO */}
                        <div className="flex flex-col items-center justify-center gap-2 pt-2">
                            <div className="bg-black/40 border border-yellow-900/40 p-1.5 rounded-xl flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => setBillingCycle('monthly')}
                                    className={`px-4 py-2 rounded-lg text-xs md:text-sm font-bold transition-all cursor-pointer ${
                                        billingCycle === 'monthly'
                                            ? 'bg-gradient-to-r from-yellow-500 to-yellow-600 text-black shadow-lg shadow-yellow-950/40'
                                            : 'text-yellow-200/60 hover:text-yellow-101 hover:bg-yellow-950/10'
                                    }`}
                                >
                                    Assinatura Mensal
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setBillingCycle('yearly')}
                                    className={`px-4 py-2 rounded-lg text-xs md:text-sm font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                                        billingCycle === 'yearly'
                                            ? 'bg-gradient-to-r from-yellow-500 to-yellow-600 text-black shadow-lg shadow-yellow-950/40'
                                            : 'text-yellow-200/60 hover:text-yellow-101 hover:bg-yellow-950/10'
                                    }`}
                                >
                                    <span>Plano Anual</span>
                                    <span className="bg-yellow-500/20 text-yellow-300 text-[10px] uppercase px-1.5 py-0.5 rounded-md border border-yellow-500/20 font-extrabold">
                                        Desconto ~30% 🎁
                                    </span>
                                </button>
                            </div>
                            <p className="text-xs text-yellow-210/50 max-w-lg text-center mt-1">
                                {billingCycle === 'monthly' 
                                    ? 'Assinatura recorrente mensal regular. Sem fidelidade, cancele a qualquer momento.' 
                                    : 'Acesso liberado por 1 ano com desconto máximo aplicado! Pode ser parcelado ou pago mensalmente de forma recorrente.'}
                            </p>
                        </div>

                        {/* Free Trial Banner in Pricing */}
                        <div className="max-w-4xl mx-auto bg-gradient-to-r from-yellow-500/10 via-yellow-500/20 to-yellow-500/10 border border-yellow-500/40 rounded-2xl p-4 sm:p-6 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl">
                            <div className="flex items-center gap-4 text-center sm:text-left">
                                <div className="p-3 bg-yellow-500 text-black rounded-xl shrink-0 hidden sm:block">
                                    <Gift className="h-6 w-6" />
                                </div>
                                <div>
                                    <h4 className="text-base sm:text-lg font-extrabold text-white">
                                        Experimente Grátis por 7 Dias Sem Cartão
                                    </h4>
                                    <p className="text-xs sm:text-sm text-yellow-200/80 mt-0.5">
                                        Libere acesso completo a todas as ferramentas táticas e scouting profissional antes de contratar.
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsTrialModalOpen(true)}
                                className="w-full sm:w-auto px-5 py-2.5 bg-yellow-400 hover:bg-yellow-300 text-black font-extrabold text-xs sm:text-sm rounded-xl transition-all shadow-md active:scale-95 whitespace-nowrap cursor-pointer"
                            >
                                Iniciar Teste Gratuito
                            </button>
                        </div>

                        {/* PLAN CARDS GRID - 4 PILARES COMERCIAIS */}
                        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto pt-4">
                            
                            {/* 1. ProTática Scout - ANALISAR */}
                            <div className="bg-[#2a0101]/40 border border-yellow-900/30 rounded-2xl p-6 flex flex-col justify-between relative overflow-hidden">
                                <div className="space-y-5">
                                    <div>
                                        <div className="flex justify-between items-start">
                                            <span className="text-[10px] font-black tracking-wider uppercase px-2 py-0.5 bg-yellow-950/60 text-yellow-400 border border-yellow-800/40 rounded">
                                                🎥 ANALISAR
                                            </span>
                                            {billingCycle === 'yearly' && (
                                                <span className="bg-yellow-950 text-yellow-400 text-[9px] uppercase px-2 py-0.5 rounded font-black border border-yellow-900/30">Anual</span>
                                            )}
                                        </div>
                                        <h3 className="text-xl font-bold text-yellow-200 mt-2">ProTática Scout</h3>
                                        <p className="text-xs text-yellow-100/60 mt-1">Para analistas autônomos e torcedores qualificados</p>
                                    </div>
                                    
                                    {billingCycle === 'monthly' ? (
                                        <div className="flex items-baseline gap-1">
                                            <span className="text-4xl font-black text-white">R$ 59</span>
                                            <span className="text-yellow-300 text-xs">/mês</span>
                                        </div>
                                    ) : (
                                        <div className="space-y-1">
                                            <div className="flex items-baseline gap-1">
                                                <span className="text-4xl font-black text-white">R$ 41,25</span>
                                                <span className="text-yellow-300 text-xs">/mês*</span>
                                            </div>
                                            <p className="text-[10px] text-yellow-200/50">Cobrança de R$ 495/ano (economia de R$ 213,00)</p>
                                        </div>
                                    )}

                                    <ul className="space-y-2.5 text-xs text-yellow-100/80">
                                        <li className="flex items-center gap-2">
                                            <Check className="h-3.5 w-3.5 text-yellow-400 shrink-0" />
                                            <span>Até 10 análises completas/mês</span>
                                        </li>
                                        <li className="flex items-center gap-2">
                                            <Check className="h-3.5 w-3.5 text-yellow-400 shrink-0" />
                                            <span>Modo Rápida e Detalhada</span>
                                        </li>
                                        <li className="flex items-center gap-2">
                                            <Check className="h-3.5 w-3.5 text-yellow-400 shrink-0" />
                                            <span>Índice de Confiabilidade</span>
                                        </li>
                                        <li className="flex items-center gap-2">
                                            <Check className="h-3.5 w-3.5 text-yellow-400 shrink-0" />
                                            <span>Mapas de Calor e Terços</span>
                                        </li>
                                        <li className="flex items-center gap-2">
                                            <Check className="h-3.5 w-3.5 text-yellow-400 shrink-0" />
                                            <span>Exportação em PDF</span>
                                        </li>
                                    </ul>
                                </div>
                                <button
                                    onClick={() => setSelectedPlan({ 
                                        name: billingCycle === 'monthly' ? 'ProTática Scout' : 'ProTática Scout Anual', 
                                        price: billingCycle === 'monthly' ? 'R$ 59,00' : 'R$ 495,00' 
                                    })}
                                    className="mt-6 w-full py-3 px-3 bg-yellow-950/50 hover:bg-yellow-900/40 text-yellow-300 font-bold text-xs rounded-xl border border-yellow-700/30 transition-all cursor-pointer"
                                >
                                    {billingCycle === 'monthly' ? 'Assinar Scout' : 'Adquirir Scout Anual'}
                                </button>
                            </div>

                            {/* 2. ProTática Performance - DECIDIR (⭐ MAIS ESCOLHIDO) */}
                            <div className="bg-[#2a0101]/90 border-2 border-yellow-500 rounded-2xl p-6 flex flex-col justify-between relative overflow-hidden transform lg:-translate-y-2 shadow-2xl shadow-yellow-950/60">
                                <div className="absolute top-0 right-0 bg-yellow-500 text-black text-[10px] font-black px-3 py-1 rounded-bl-xl uppercase tracking-wider flex items-center gap-1 shadow-md">
                                    ⭐ MAIS ESCOLHIDO
                                </div>
                                
                                <div className="space-y-5">
                                    <div>
                                        <div className="flex justify-between items-start">
                                            <span className="text-[10px] font-black tracking-wider uppercase px-2 py-0.5 bg-yellow-500/20 text-yellow-300 border border-yellow-500/40 rounded">
                                                🧠 DECIDIR
                                            </span>
                                            {billingCycle === 'yearly' && (
                                                <span className="bg-yellow-500 text-black text-[9px] uppercase px-2 py-0.5 rounded font-black">Desconto Máximo</span>
                                            )}
                                        </div>
                                        <h3 className="text-xl font-black text-yellow-300 mt-2">ProTática Performance</h3>
                                        <p className="text-xs text-yellow-100/70 mt-1">Para treinadores, scouts e comissões técnicas</p>
                                    </div>

                                    {billingCycle === 'monthly' ? (
                                        <div className="flex items-baseline gap-1">
                                            <span className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-200 to-yellow-400">R$ 139</span>
                                            <span className="text-yellow-300 text-xs">/mês</span>
                                        </div>
                                    ) : (
                                        <div className="space-y-1">
                                            <div className="flex items-baseline gap-1">
                                                <span className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-200 to-yellow-400">R$ 97,25</span>
                                                <span className="text-yellow-300 text-xs">/mês*</span>
                                            </div>
                                            <p className="text-[10px] text-yellow-100/70">Cobrança de R$ 1.167/ano (economia de R$ 501,00)</p>
                                        </div>
                                    )}

                                    <ul className="space-y-2.5 text-xs text-yellow-100/95 font-medium">
                                        <li className="flex items-center gap-2">
                                            <Check className="h-3.5 w-3.5 text-yellow-400 shrink-0" />
                                            <span className="font-bold text-yellow-200">Análises ILIMITADAS</span>
                                        </li>
                                        <li className="flex items-center gap-2">
                                            <Check className="h-3.5 w-3.5 text-yellow-400 shrink-0" />
                                            <span>Linha do Tempo de Evidências</span>
                                        </li>
                                        <li className="flex items-center gap-2">
                                            <Check className="h-3.5 w-3.5 text-yellow-400 shrink-0" />
                                            <span className="text-yellow-300 font-bold">Pergunte ao seu Jogo (IA)</span>
                                        </li>
                                        <li className="flex items-center gap-2">
                                            <Check className="h-3.5 w-3.5 text-yellow-400 shrink-0" />
                                            <span>3 Principais Insights Táticos</span>
                                        </li>
                                        <li className="flex items-center gap-2">
                                            <Check className="h-3.5 w-3.5 text-yellow-400 shrink-0" />
                                            <span>Gerador de Planos de Treino</span>
                                        </li>
                                        <li className="flex items-center gap-2">
                                            <Check className="h-3.5 w-3.5 text-yellow-400 shrink-0" />
                                            <span>Metas de Evolução da Equipe</span>
                                        </li>
                                    </ul>
                                </div>
                                <button
                                    onClick={() => setSelectedPlan({ 
                                        name: billingCycle === 'monthly' ? 'ProTática Performance' : 'ProTática Performance Anual', 
                                        price: billingCycle === 'monthly' ? 'R$ 139,00' : 'R$ 1.167,00' 
                                    })}
                                    className="mt-6 w-full py-3.5 px-3 bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-400 hover:to-yellow-500 text-black font-extrabold text-xs rounded-xl transition-all shadow-md shadow-yellow-950 cursor-pointer"
                                >
                                    {billingCycle === 'monthly' ? 'Assinar Performance' : 'Adquirir Performance Anual'}
                                </button>
                            </div>

                            {/* 3. ProTática Intelligence - PREPARAR */}
                            <div className="bg-[#2a0101]/40 border border-yellow-900/30 rounded-2xl p-6 flex flex-col justify-between relative overflow-hidden">
                                <div className="space-y-5">
                                    <div>
                                        <div className="flex justify-between items-start">
                                            <span className="text-[10px] font-black tracking-wider uppercase px-2 py-0.5 bg-yellow-950/60 text-yellow-400 border border-yellow-800/40 rounded">
                                                🏆 PREPARAR
                                            </span>
                                            {billingCycle === 'yearly' && (
                                                <span className="bg-yellow-950 text-yellow-400 text-[9px] uppercase px-2 py-0.5 rounded font-black border border-yellow-900/30">Anual</span>
                                            )}
                                        </div>
                                        <h3 className="text-xl font-bold text-yellow-200 mt-2">ProTática Intelligence</h3>
                                        <p className="text-xs text-yellow-100/60 mt-1">Para departamentos de análise e comissões seniores</p>
                                    </div>

                                    {billingCycle === 'monthly' ? (
                                        <div className="flex items-baseline gap-1">
                                            <span className="text-4xl font-black text-white">R$ 319</span>
                                            <span className="text-yellow-300 text-xs">/mês</span>
                                        </div>
                                    ) : (
                                        <div className="space-y-1">
                                            <div className="flex items-baseline gap-1">
                                                <span className="text-4xl font-black text-white">R$ 223,25</span>
                                                <span className="text-yellow-300 text-xs">/mês*</span>
                                            </div>
                                            <p className="text-[10px] text-yellow-200/50">Cobrança de R$ 2.679/ano (economia de R$ 1.149,00)</p>
                                        </div>
                                    )}

                                    <ul className="space-y-2.5 text-xs text-yellow-100/80">
                                        <li className="flex items-center gap-2">
                                            <Check className="h-3.5 w-3.5 text-yellow-400 shrink-0" />
                                            <span className="font-bold text-yellow-200">Dossiê do Adversário</span>
                                        </li>
                                        <li className="flex items-center gap-2">
                                            <Check className="h-3.5 w-3.5 text-yellow-400 shrink-0" />
                                            <span>Biblioteca de Evidências</span>
                                        </li>
                                        <li className="flex items-center gap-2">
                                            <Check className="h-3.5 w-3.5 text-yellow-400 shrink-0" />
                                            <span>Quadro Tático Interativo</span>
                                        </li>
                                        <li className="flex items-center gap-2">
                                            <Check className="h-3.5 w-3.5 text-yellow-400 shrink-0" />
                                            <span>Validação Multi-Fontes</span>
                                        </li>
                                        <li className="flex items-center gap-2">
                                            <Check className="h-3.5 w-3.5 text-yellow-400 shrink-0" />
                                            <span>Até 5 analistas simultâneos</span>
                                        </li>
                                    </ul>
                                </div>
                                <button
                                    onClick={() => setSelectedPlan({ 
                                        name: billingCycle === 'monthly' ? 'ProTática Intelligence' : 'ProTática Intelligence Anual', 
                                        price: billingCycle === 'monthly' ? 'R$ 319,00' : 'R$ 2.679,00' 
                                    })}
                                    className="mt-6 w-full py-3 px-3 bg-yellow-950/50 hover:bg-yellow-900/40 text-yellow-300 font-bold text-xs rounded-xl border border-yellow-700/30 transition-all cursor-pointer"
                                >
                                    {billingCycle === 'monthly' ? 'Assinar Intelligence' : 'Adquirir Intelligence Anual'}
                                </button>
                            </div>

                            {/* 4. ProTática Club - GERENCIAR */}
                            <div className="bg-[#2a0101]/40 border border-yellow-900/30 rounded-2xl p-6 flex flex-col justify-between relative overflow-hidden">
                                <div className="space-y-5">
                                    <div>
                                        <div className="flex justify-between items-start">
                                            <span className="text-[10px] font-black tracking-wider uppercase px-2 py-0.5 bg-yellow-950/60 text-yellow-400 border border-yellow-800/40 rounded">
                                                🏟️ GERENCIAR
                                            </span>
                                            <span className="bg-yellow-900/40 text-yellow-300 text-[9px] uppercase px-2 py-0.5 rounded font-black border border-yellow-800/30">Institucional</span>
                                        </div>
                                        <h3 className="text-xl font-bold text-yellow-200 mt-2">ProTática Club</h3>
                                        <p className="text-xs text-yellow-100/60 mt-1">Para clubes profissionais, federações e academias de base</p>
                                    </div>

                                    <div className="space-y-1">
                                        <div className="flex items-baseline gap-1">
                                            <span className="text-3xl font-black text-white">Sob Consulta</span>
                                        </div>
                                        <p className="text-[10px] text-yellow-200/50">Proposta institucional sob medida</p>
                                    </div>

                                    <ul className="space-y-2.5 text-xs text-yellow-100/80">
                                        <li className="flex items-center gap-2">
                                            <Check className="h-3.5 w-3.5 text-yellow-400 shrink-0" />
                                            <span className="font-bold text-yellow-200">ProTática Base (Sub-10 ao 20)</span>
                                        </li>
                                        <li className="flex items-center gap-2">
                                            <Check className="h-3.5 w-3.5 text-yellow-400 shrink-0" />
                                            <span>Painéis multi-categorias</span>
                                        </li>
                                        <li className="flex items-center gap-2">
                                            <Check className="h-3.5 w-3.5 text-yellow-400 shrink-0" />
                                            <span>Capacitação da comissão</span>
                                        </li>
                                        <li className="flex items-center gap-2">
                                            <Check className="h-3.5 w-3.5 text-yellow-400 shrink-0" />
                                            <span>Usuários ilimitados</span>
                                        </li>
                                        <li className="flex items-center gap-2">
                                            <Check className="h-3.5 w-3.5 text-yellow-400 shrink-0" />
                                            <span>Consultoria e SLA 24/7</span>
                                        </li>
                                    </ul>
                                </div>
                                <a
                                    href="https://wa.me/?text=Ol%C3%A1,%20gostaria%20de%20solicitar%20uma%20apresenta%C3%A7%C3%A3o%20institucional%20do%20ProT%C3%A1tica%20Club."
                                    target="_blank"
                                    rel="noreferrer"
                                    className="mt-6 w-full py-3 px-3 bg-yellow-950/50 hover:bg-yellow-900/40 text-yellow-300 text-center font-bold text-xs rounded-xl border border-yellow-700/30 transition-all cursor-pointer inline-block"
                                >
                                    Falar com Especialista
                                </a>
                            </div>
                            
                        </div>

                        {/* GARANTIA DE RETORNO */}
                        <div className="max-w-3xl mx-auto rounded-xl border border-yellow-900/10 bg-yellow-950/10 p-6 flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
                            <div className="p-3 bg-yellow-500/10 text-yellow-400 rounded-full">
                                <ShieldCheck className="h-8 w-8" />
                            </div>
                            <div>
                                <h4 className="font-bold text-yellow-100 text-lg">Garantia Tática de Incondicionalidade de 7 Dias</h4>
                                <p className="text-sm text-yellow-200/60 mt-1">
                                    Experimente a PROTÁTICA sem riscos. Se nas primeiras 168 horas você achar que a auditoria de jogos não condiz com o nível UEFA Pro, reembolsamos 100% do seu valor.
                                </p>
                            </div>
                        </div>
                    </div>
                )}
            </main>

            {/* CHECKOUT MODAL FLOW (PRIMEIRA LINHA DE CONTATO / SIMULACAO DE COMPRA SUPER REALISTA) */}
            {selectedPlan && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
                    <div className="bg-[#1a0000] border border-yellow-800/45 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl relative">
                        {/* Modal Header */}
                        <div className="bg-[#2a0101] border-b border-yellow-900/30 p-6 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <CreditCard className="h-5 w-5 text-yellow-400" />
                                <span className="font-bold text-lg text-yellow-100 uppercase tracking-wide">Assinatura PROTÁTICA</span>
                            </div>
                            <button 
                                onClick={() => {
                                    setSelectedPlan(null);
                                    setCheckoutComplete(false);
                                    setPixCopied(false);
                                }}
                                className="text-yellow-250/50 hover:text-yellow-100 bg-white/5 hover:bg-white/10 p-1.5 rounded-lg text-sm"
                            >
                                Fechar
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-6 space-y-6">
                            {!checkoutComplete ? (
                                <div className="space-y-4">
                                    <div className="bg-yellow-950/30 border border-yellow-950 rounded-xl p-4 flex justify-between items-center">
                                        <div>
                                            <div className="text-xs text-yellow-400 uppercase font-bold tracking-wider">Item Escolhido</div>
                                            <div className="text-lg font-bold text-white">
                                                {selectedPlan.name.includes('Anual') 
                                                    ? (yearlyPaymentMode === 'upfront' ? `${selectedPlan.name} (À Vista / Parcelado)` : `${selectedPlan.name} (Fidelidade Mensal)`)
                                                    : selectedPlan.name}
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-xs text-yellow-200/50">
                                                {selectedPlan.name.includes('Anual') ? 'Cobrança' : 'Cobrança Mensal'}
                                            </div>
                                            <div className="text-xl font-black text-yellow-300">
                                                {selectedPlan.name.includes('Anual') 
                                                    ? (yearlyPaymentMode === 'upfront' ? selectedPlan.price : `${getYearlyMonthlyEquivalentPrice(selectedPlan.name)}/mês`)
                                                    : selectedPlan.price || 'R$ 59,00'}
                                            </div>
                                        </div>
                                    </div>

                                    {/* SELETOR DE MODALIDADE DE PLANO ANUAL */}
                                    {selectedPlan.name.includes('Anual') && (
                                        <div className="space-y-2 p-4 bg-[#2a0101]/60 border border-yellow-900/30 rounded-xl">
                                            <div className="text-xs font-bold text-yellow-300 uppercase tracking-widest">Modalidade do Plano Anual</div>
                                            <p className="text-[11px] text-yellow-105/75 leading-relaxed mb-2">
                                                Selecione como deseja efetuar o pagamento do valor anual com super desconto:
                                            </p>
                                            <div className="grid grid-cols-2 gap-3">
                                                <button
                                                    type="button"
                                                    onClick={() => setYearlyPaymentMode('upfront')}
                                                    className={`p-3 rounded-lg border text-left transition-all cursor-pointer ${
                                                        yearlyPaymentMode === 'upfront'
                                                            ? 'bg-yellow-500/10 border-yellow-550 text-yellow-101'
                                                            : 'bg-black/30 border-yellow-900/20 text-yellow-200/50 hover:bg-black/40 hover:text-yellow-100'
                                                    }`}
                                                >
                                                    <div className="text-xs font-black uppercase">À Vista / Parcelado</div>
                                                    <div className="text-[11px] font-bold text-yellow-300 mt-1">{selectedPlan.price}</div>
                                                    <div className="text-[9px] opacity-65 mt-1">Dividido em até 12x no cartão via Stripe</div>
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setYearlyPaymentMode('monthly_sub')}
                                                    className={`p-3 rounded-lg border text-left transition-all cursor-pointer ${
                                                        yearlyPaymentMode === 'monthly_sub'
                                                            ? 'bg-yellow-500/10 border-yellow-550 text-yellow-101'
                                                            : 'bg-black/30 border-yellow-900/20 text-yellow-200/50 hover:bg-black/40 hover:text-yellow-100'
                                                    }`}
                                                >
                                                    <div className="text-xs font-black uppercase">Fidelidade Mensal</div>
                                                    <div className="text-[11px] font-bold text-yellow-300 mt-1">
                                                        {getYearlyMonthlyEquivalentPrice(selectedPlan.name)}/mês
                                                    </div>
                                                    <div className="text-[9px] opacity-65 mt-1">Débito mensal recorrente com compromisso anual</div>
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {/* SEÇÃO PRINCIPAL: OPÇÃO DE PAGAMENTO STRIPE REAL */}
                                    <div className="bg-gradient-to-r from-yellow-500/10 to-yellow-600/10 border border-yellow-500/30 p-4 rounded-xl space-y-3">
                                        <div className="flex gap-3 items-start">
                                            <div className="p-2 bg-yellow-500/10 text-yellow-400 rounded-lg">
                                                <CreditCard className="h-5 w-5" />
                                            </div>
                                            <div className="text-xs text-yellow-105/90">
                                                <p className="font-extrabold text-[#ffcc00] text-sm mb-0.5 animate-pulse">Pagamento via Stripe</p>
                                                <p className="text-[11px] text-yellow-100/75">Transações processadas de forma 100% segura diretamente pelo gateway Stripe configurado.</p>
                                            </div>
                                        </div>
                                        
                                        {checkoutError && (
                                            <div className="text-red-400 text-xs text-center border border-red-900/30 bg-red-950/20 p-2 rounded">
                                                {checkoutError}
                                            </div>
                                        )}

                                        <button
                                            type="button"
                                            disabled={isCreatingSession}
                                            onClick={handleStripeCheckout}
                                            className="w-full bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-400 hover:to-yellow-500 disabled:opacity-50 text-black font-black py-3 rounded-lg text-xs tracking-wider uppercase transition-all shadow-md shadow-yellow-950 flex items-center justify-center gap-2 cursor-pointer"
                                        >
                                            {isCreatingSession ? 'Processando Checkout Stripe...' : 'Pagar com Stripe / Cartão'}
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center py-4 space-y-4">
                                    {isVerifyingSession ? (
                                        <div className="space-y-4 py-8">
                                            <div className="mx-auto border-4 border-yellow-950 border-t-yellow-500 w-12 h-12 rounded-full animate-spin" />
                                            <h4 className="text-md font-bold text-yellow-300 uppercase tracking-wide">Vinculando seu faturamento...</h4>
                                            <p className="text-xs text-yellow-101/60 max-w-xs mx-auto">
                                                Estamos consultando o Stripe para liberar seu acesso táctico, criar sua contra-senha de administrador e disparar seu e-mail de credenciais. Por favor, aguarde.
                                            </p>
                                        </div>
                                    ) : verificationError ? (
                                        <div className="space-y-4 py-4">
                                            <div className="mx-auto bg-red-950/40 text-red-400 border border-red-900/40 w-12 h-12 rounded-full flex items-center justify-center">
                                                <AlertTriangle className="h-6 w-6" />
                                            </div>
                                            <h4 className="text-md font-bold text-red-400 uppercase tracking-wide">Atenção na Validação</h4>
                                            <p className="text-xs text-yellow-101/70 max-w-sm mx-auto px-4 leading-relaxed">
                                                {verificationError}
                                            </p>
                                            <p className="text-[11px] text-yellow-202/50 max-w-xs mx-auto">
                                                Se o seu pagamento já foi debitado, consulte a caixa de spam do seu e-mail de faturamento do Stripe com suas credenciais de entrada.
                                            </p>
                                            <button
                                                onClick={() => {
                                                    setSelectedPlan(null);
                                                    setCheckoutComplete(false);
                                                    onLoginClick();
                                                }}
                                                className="inline-block bg-yellow-950/60 hover:bg-yellow-905 border border-yellow-500/30 text-yellow-300 font-bold px-5 py-2 rounded-lg text-xs transition-all cursor-pointer"
                                            >
                                                Ir para o Login
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="space-y-4">
                                            <div className="mx-auto bg-green-950/40 text-green-400 border border-green-800/50 w-14 h-14 rounded-full flex items-center justify-center animate-bounce">
                                                <CheckCircle2 className="h-8 w-8" />
                                            </div>
                                            <h4 className="text-lg font-extrabold text-white uppercase tracking-wider">⚽ Pagamento Verificado!</h4>
                                            
                                            <div className="bg-[#2a0101] border border-yellow-500/20 rounded-xl p-4 space-y-3 text-left max-w-sm mx-auto">
                                                <p className="text-xs text-yellow-101/85 leading-relaxed">
                                                    Excelente! Seu pagamento foi validado no Stripe. Nós enviamos os links e as credenciais abaixo para seu e-mail de pagamento:
                                                </p>
                                                
                                                <div className="space-y-1">
                                                    <span className="block text-[10px] uppercase font-bold text-yellow-500 tracking-wider">Seu E-mail Cadastrado</span>
                                                    <span className="block text-xs font-mono font-bold text-yellow-50 bg-black/40 px-2 py-1 rounded truncate">{buyerEmail || 'Verifique seu Inbox'}</span>
                                                </div>

                                                <div className="space-y-1 pt-1.5">
                                                    <span className="block text-[10px] uppercase font-bold text-yellow-500 tracking-wider">Sua Senha de Acesso</span>
                                                    <div className="flex gap-1.5 items-center">
                                                        <span className="flex-grow text-sm font-mono font-black text-yellow-200 bg-black/75 px-2.5 py-1.5 rounded border border-yellow-900/40 tracking-wider">
                                                            {generatedPassword || 'SENHA_LIBERADA'}
                                                        </span>
                                                        {generatedPassword && (
                                                            <button
                                                                onClick={() => {
                                                                    navigator.clipboard.writeText(generatedPassword);
                                                                    setPasswordCopied(true);
                                                                    setTimeout(() => setPasswordCopied(false), 3000);
                                                                }}
                                                                title="Copiar Senha"
                                                                className="p-2 bg-yellow-950/40 hover:bg-yellow-905 border border-yellow-500/20 rounded text-yellow-300 transition-all cursor-pointer"
                                                            >
                                                                <Copy className="h-4 w-4" />
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>

                                                {passwordCopied && (
                                                    <p className="text-green-400 text-[10px] font-bold text-center animate-pulse">
                                                        Senha provisória copiada com sucesso!
                                                    </p>
                                                )}
                                            </div>

                                            <p className="text-[11px] text-yellow-101/60 max-w-xs mx-auto leading-relaxed">
                                                Obs: use esta senha única no painel de Login para liberar todas as inteligências de Scouting.
                                            </p>

                                            <button
                                                onClick={() => {
                                                    setSelectedPlan(null);
                                                    setCheckoutComplete(false);
                                                    onLoginClick();
                                                }}
                                                className="inline-block bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-400 hover:to-yellow-555 text-black font-extrabold px-6 py-2.5 rounded-lg text-xs uppercase tracking-wider transition-all shadow-md shadow-yellow-950/60 cursor-pointer"
                                            >
                                                Ir para a Tela de Login
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Simple footer style */}
            <footer className="border-t border-yellow-900/20 py-8 text-center text-xs text-yellow-300/40 mt-16 pb-12">
                <p>© 2026 PROTÁTICA Analises Esportivas. Todos os direitos reservados.</p>
                <p className="mt-1">Homologado para scoutings da elite do futebol brasileiro.</p>
            </footer>

            {/* Trial Registration Modal */}
            <TrialRegisterModal
                isOpen={isTrialModalOpen}
                onClose={() => setIsTrialModalOpen(false)}
                onOpenLogin={() => {
                    setIsTrialModalOpen(false);
                    onLoginClick();
                }}
            />
        </div>
    );
};

export default LandingPage;
