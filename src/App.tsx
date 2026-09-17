import React, { useCallback, useEffect, useState } from 'react';
import Header from './components/Header';
import UrlInputForm, { AnalysisRequest } from './components/UrlInputForm';
import LoadingSpinner from './components/LoadingSpinner';
import AnalysisDisplay from './components/AnalysisDisplay';
import ErrorBoundary from './components/ErrorBoundary';
import Login from './components/Login';
import LandingPage from './components/LandingPage';
import HistoryPanel from './components/HistoryPanel';
import ComparisonDashboard from './components/ComparisonDashboard';
import { useLanguage } from './context/LanguageContext';
import LanguageSelector from './components/LanguageSelector';
import { CreditCard, X, Mail, Send, Key, Settings, Users, Trash2, UserPlus, ShieldAlert, Bot, CalendarCheck, Gift, AlertTriangle, Menu, Sparkles } from 'lucide-react';
import { TelegramConfigPanel } from './components/TelegramConfigPanel';
import { TrialBanner } from './components/TrialBanner';
import { TrialExpiredModal } from './components/TrialExpiredModal';
import { TrialSetPasswordModal } from './components/TrialSetPasswordModal';
import { ResetPasswordModal } from './components/ResetPasswordModal';
import { ResetPasswordPage } from './components/ResetPasswordPage';
import { MySubscriptionModal } from './components/MySubscriptionModal';
import { AdminSubscriptionsPanel } from './components/AdminSubscriptionsPanel';
import { MyTeamModule } from './components/MyTeamModule';
import { OpponentDossierModule } from './components/OpponentDossierModule';
import { PlayersModule } from './components/PlayersModule';
import { TrainingPlansModule } from './components/TrainingPlansModule';
import { TeamGoalsModule } from './components/TeamGoalsModule';
import { EvidenceLibraryModule } from './components/EvidenceLibraryModule';
import { TacticalBoardModule } from './components/TacticalBoardModule';
import { Sidebar } from './components/Sidebar';
import { HomeDashboard } from './components/HomeDashboard';
import { CompetitionsModule } from './components/CompetitionsModule';
import { MatchesModule } from './components/MatchesModule';
import { PlansModule } from './components/PlansModule';
import { ReportsModule } from './components/ReportsModule';
import { SettingsModule } from './components/SettingsModule';
import { getAccountAccessStatus, canAccessPremiumFeatures } from './utils/accessControl';
import {
    analyzeFootballMatch,
    clearToken,
    deleteAnalysis,
    fetchAnalysisHistory,
    fetchSavedAnalysis,
    getAuthHeaders,
    getStoredToken,
} from './services/geminiService';
import type { Analysis, AnalysisHistoryItem, User } from './types';

const App: React.FC = () => {
    const { t } = useLanguage();
    const [analysis, setAnalysis] = useState<Analysis | null>(null);
    const [history, setHistory] = useState<AnalysisHistoryItem[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [isHistoryLoading, setIsHistoryLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [activeView, setActiveView] = useState<string>('dashboard');
    const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState<boolean>(false);
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
        try {
            return localStorage.getItem('protatica_sidebar_collapsed') === 'true';
        } catch {
            return false;
        }
    });
    const [selectedMatchUrl, setSelectedMatchUrl] = useState<string>('');
    const [trainingProblem, setTrainingProblem] = useState<string | null>(null);
    const [currentView, setCurrentView] = useState<'landing' | 'login' | 'reset-password'>(() => {
        if (typeof window !== 'undefined') {
            const pathname = window.location.pathname;
            const params = new URLSearchParams(window.location.search);
            if (
                pathname === '/reset-password' ||
                pathname.startsWith('/reset-password') ||
                pathname.startsWith('/recuperar-senha') ||
                params.has('reset_token') ||
                params.has('reset_password') ||
                (params.has('token') && (pathname.startsWith('/reset-password') || pathname.startsWith('/recuperar-senha')))
            ) {
                return 'reset-password';
            }
            if (pathname === '/login') {
                return 'login';
            }
        }
        return 'landing';
    });

    // Estado de Configuração do Stripe e SMTP (Zona Administrativa)
    const [isStripeModalOpen, setIsStripeModalOpen] = useState(false);
    const [stripeModalTab, setStripeModalTab] = useState<'stripe' | 'smtp' | 'users' | 'telegram' | 'subscriptions'>('subscriptions');
    const [stripeSecretInput, setStripeSecretInput] = useState('');
    const [stripePublishableInput, setStripePublishableInput] = useState('');
    const [isSavingStripe, setIsSavingStripe] = useState(false);
    const [stripeSaveMessage, setStripeSaveMessage] = useState('');
    const [stripeConfig, setStripeConfig] = useState({ hasSecretKey: false, publishableKey: '' });

    // Modais e Status de Teste Gratuito e Assinatura
    const [isMySubscriptionModalOpen, setIsMySubscriptionModalOpen] = useState(false);
    const [isTrialExpiredModalOpen, setIsTrialExpiredModalOpen] = useState(false);
    const [subscriptionInfo, setSubscriptionInfo] = useState<any>(null);
    const [resetPasswordToken, setResetPasswordToken] = useState<string | null>(() => {
        if (typeof window !== 'undefined') {
            const params = new URLSearchParams(window.location.search);
            const pathname = window.location.pathname;
            const isResetPath = pathname.startsWith('/reset-password') || pathname.startsWith('/recuperar-senha');
            const token = params.get('token') || params.get('reset_token') || params.get('reset_password') || (pathname.startsWith('/reset-password/') ? pathname.replace('/reset-password/', '').trim() : null);
            return token || null;
        }
        return null;
    });
    const [trialSetPasswordData, setTrialSetPasswordData] = useState<{
        isOpen: boolean;
        token: string;
        email: string;
        name: string;
    }>({
        isOpen: false,
        token: '',
        email: '',
        name: '',
    });

    // SMTP settings state
    const [smtpHost, setSmtpHost] = useState('');
    const [smtpPort, setSmtpPort] = useState('587');
    const [smtpUser, setSmtpUser] = useState('');
    const [smtpPass, setSmtpPass] = useState('');
    const [smtpSecure, setSmtpSecure] = useState(false);
    const [smtpFromName, setSmtpFromName] = useState('PROTÁTICA Scout & Analise');

    // SMTP test email sender state
    const [isTestingSmtp, setIsTestingSmtp] = useState(false);
    const [smtpTestEmail, setSmtpTestEmail] = useState('');
    const [smtpTestStatus, setSmtpTestStatus] = useState('');

    // Estado administrativo de gerenciamento de usuários / acessos
    const [usersList, setUsersList] = useState<{ id: string; username: string; displayName: string; createdAt: string }[]>([]);
    const [isUsersLoading, setIsUsersLoading] = useState(false);
    const [newUsername, setNewUsername] = useState('');
    const [newDisplayName, setNewDisplayName] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [userError, setUserError] = useState('');
    const [userSuccess, setUserSuccess] = useState('');
    const [editingUserId, setEditingUserId] = useState<string | null>(null);
    const [editPasswordInput, setEditPasswordInput] = useState('');

    const fetchUsers = async () => {
        setIsUsersLoading(true);
        setUserError('');
        try {
            const res = await fetch('/api/admin/users', { headers: getAuthHeaders() });
            if (res.ok) {
                const data = await res.json();
                setUsersList(data.users || []);
            } else {
                setUserError('Erro ao carregar lista de acessos.');
            }
        } catch (err) {
            setUserError('Conexão falhou ao carregar usuários.');
        } finally {
            setIsUsersLoading(false);
        }
    };

    useEffect(() => {
        if (isStripeModalOpen && stripeModalTab === 'users') {
            fetchUsers();
        }
    }, [isStripeModalOpen, stripeModalTab]);

    const handleCreateUser = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newUsername || !newPassword) {
            setUserError('Usuário e senha são obrigatórios.');
            return;
        }
        setUserError('');
        setUserSuccess('');
        try {
            const res = await fetch('/api/admin/users/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
                body: JSON.stringify({
                    username: newUsername,
                    displayName: newDisplayName || newUsername,
                    password: newPassword
                })
            });
            if (res.ok) {
                setUserSuccess('Acesso criado com sucesso!');
                setNewUsername('');
                setNewDisplayName('');
                setNewPassword('');
                fetchUsers();
            } else {
                const data = await res.json();
                setUserError(data.error || 'Erro ao criar acesso.');
            }
        } catch (err) {
            setUserError('Erro de conexão ao criar.');
        }
    };

    const handleDeleteUser = async (userId: string) => {
        if (!window.confirm('Tem certeza de que deseja revogar este acesso?')) return;
        setUserError('');
        setUserSuccess('');
        try {
            const res = await fetch('/api/admin/users/delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
                body: JSON.stringify({ id: userId })
            });
            if (res.ok) {
                setUserSuccess('Acesso revogado com sucesso!');
                fetchUsers();
            } else {
                const data = await res.json();
                setUserError(data.error || 'Erro ao remover acesso.');
            }
        } catch (err) {
            setUserError('Erro de conexão ao remover.');
        }
    };

    const handleResetPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingUserId || !editPasswordInput) {
            setUserError('Senha não pode ser vazia.');
            return;
        }
        setUserError('');
        setUserSuccess('');
        try {
            const res = await fetch('/api/admin/users/reset-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
                body: JSON.stringify({ id: editingUserId, newPassword: editPasswordInput })
            });
            if (res.ok) {
                setUserSuccess('Senha redefinida com sucesso!');
                setEditingUserId(null);
                setEditPasswordInput('');
                fetchUsers();
            } else {
                const data = await res.json();
                setUserError(data.error || 'Erro ao redefinir senha.');
            }
        } catch (err) {
            setUserError('Erro de rede ao redefinir.');
        }
    };

    const fetchStripeAdminConfig = async () => {
        try {
            const res = await fetch('/api/stripe/config');
            if (res.ok) {
                const data = await res.json();
                setStripeConfig(data);
                if (data.publishableKey) {
                    setStripePublishableInput(data.publishableKey);
                }
                if (data.hasSecretKey) {
                    setStripeSecretInput('sk_••••••••••••••••••••');
                } else {
                    setStripeSecretInput('');
                }

                // Load SMTP
                if (data.smtpHost) setSmtpHost(data.smtpHost);
                if (data.smtpPort) setSmtpPort(data.smtpPort);
                if (data.smtpUser) setSmtpUser(data.smtpUser);
                if (data.smtpFromName) setSmtpFromName(data.smtpFromName);
                setSmtpSecure(!!data.smtpSecure);
                if (data.hasSmtpPass) {
                    setSmtpPass('••••••••••••••••••••');
                } else {
                    setSmtpPass('');
                }
            }
        } catch (err) {
            console.error('Erro ao ler chaves do Stripe e SMTP:', err);
        }
    };

    useEffect(() => {
        if (isStripeModalOpen) {
            fetchStripeAdminConfig();
        }
    }, [isStripeModalOpen]);

    const handleSaveStripeAdminConfig = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSavingStripe(true);
        setStripeSaveMessage('');
        try {
            const res = await fetch('/api/stripe/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
                body: JSON.stringify({
                    secretKey: stripeSecretInput,
                    publishableKey: stripePublishableInput,
                    smtpHost,
                    smtpPort,
                    smtpUser,
                    smtpPass,
                    smtpSecure,
                    smtpFromName,
                }),
            });
            if (res.ok) {
                setStripeSaveMessage('Configurações armazenadas com sucesso!');
                setTimeout(() => setStripeSaveMessage(''), 3000);
                fetchStripeAdminConfig();
            } else {
                setStripeSaveMessage('Erro ao salvar as configurações.');
            }
        } catch (err) {
            setStripeSaveMessage('Erro de rede ao salvar.');
        } finally {
            setIsSavingStripe(false);
        }
    };

    const handleTestSmtp = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!smtpTestEmail) {
            setSmtpTestStatus('Insira um email para receber o teste.');
            return;
        }
        setIsTestingSmtp(true);
        setSmtpTestStatus('Enviando email de teste...');
        try {
            const res = await fetch('/api/smtp/test-send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
                body: JSON.stringify({ testEmail: smtpTestEmail }),
            });
            const data = await res.json();
            if (res.ok) {
                setSmtpTestStatus('Sucesso: email de teste enviado! Verifique o spam se necessário.');
            } else {
                setSmtpTestStatus('Erro: ' + (data.error || 'Falha ao despachar.'));
            }
        } catch (err) {
            setSmtpTestStatus('Erro ao conectar com o SMTP do servidor.');
        } finally {
            setIsTestingSmtp(false);
        }
    };

    // Progresso real do job
    const [progressStep, setProgressStep] = useState<string>('');
    const [progressPct, setProgressPct] = useState<number | null>(null);

    // ── Sessão persistente ──────────────────────────────────────────────────
    const [currentUser, setCurrentUser] = useState<User | null>(() => {
        const userStr = localStorage.getItem('protatica_user');
        try {
            return userStr ? JSON.parse(userStr) : null;
        } catch {
            return null;
        }
    });

    const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
        return getStoredToken() !== null;
    });

    // Estado da modal de alteração de senha (Redefinição)
    const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
    const [oldPasswordInput, setOldPasswordInput] = useState('');
    const [newPasswordInput, setNewPasswordInput] = useState('');
    const [confirmPasswordInput, setConfirmPasswordInput] = useState('');
    const [changePasswordError, setChangePasswordError] = useState('');
    const [changePasswordSuccess, setChangePasswordSuccess] = useState('');
    const [isSavingPassword, setIsSavingPassword] = useState(false);

    const handleChangePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!oldPasswordInput || !newPasswordInput || !confirmPasswordInput) {
            setChangePasswordError('Todos os campos são obrigatórios.');
            return;
        }
        if (newPasswordInput !== confirmPasswordInput) {
            setChangePasswordError('A nova senha e a confirmação não conferem.');
            return;
        }
        if (newPasswordInput.length < 4) {
            setChangePasswordError('A nova senha deve ter no mínimo 4 caracteres.');
            return;
        }

        setChangePasswordError('');
        setChangePasswordSuccess('');
        setIsSavingPassword(true);

        try {
            const res = await fetch('/api/user/change-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: currentUser?.id,
                    oldPassword: oldPasswordInput,
                    newPassword: newPasswordInput,
                }),
            });
            const data = await res.json();
            if (res.ok) {
                setChangePasswordSuccess('Sua senha foi atualizada com sucesso!');
                setOldPasswordInput('');
                setNewPasswordInput('');
                setConfirmPasswordInput('');
                setTimeout(() => {
                    setIsChangePasswordOpen(false);
                    setChangePasswordSuccess('');
                }, 2000);
            } else {
                setChangePasswordError(data.error || 'Erro ao alterar a senha.');
            }
        } catch (err) {
            setChangePasswordError('Erro de rede ao se comunicar com o servidor.');
        } finally {
            setIsSavingPassword(false);
        }
    };

    const fetchMySubscription = useCallback(async () => {
        const token = getStoredToken();
        if (!token) return;
        try {
            const res = await fetch('/api/subscription/me', {
                headers: getAuthHeaders(),
            });
            if (res.ok) {
                const data = await res.json();
                setSubscriptionInfo(data);
                if (data.user) {
                    setCurrentUser((prev: any) => ({ ...(prev || {}), ...data.user }));
                }
                if (data.status === 'trial_expired' || data.status === 'paid_expired') {
                    setIsTrialExpiredModalOpen(true);
                }
            }
        } catch (e) {
            console.warn('Erro ao checar status da assinatura:', e);
        }
    }, []);

    // Escuta mudanças de navegação no histórico (Voltar / Avançar do navegador)
    useEffect(() => {
        const handleLocationChange = () => {
            const pathname = window.location.pathname;
            const params = new URLSearchParams(window.location.search);
            if (
                pathname === '/reset-password' ||
                pathname.startsWith('/reset-password') ||
                pathname.startsWith('/recuperar-senha') ||
                params.has('reset_token') ||
                params.has('reset_password') ||
                (params.has('token') && (pathname.startsWith('/reset-password') || pathname.startsWith('/recuperar-senha')))
            ) {
                setCurrentView('reset-password');
                const token = params.get('token') || params.get('reset_token') || params.get('reset_password') || (pathname.startsWith('/reset-password/') ? pathname.replace('/reset-password/', '').trim() : null);
                setResetPasswordToken(token || null);
            } else if (pathname === '/login') {
                setCurrentView('login');
            } else if (pathname === '/' || pathname === '') {
                setCurrentView('landing');
            }
        };

        window.addEventListener('popstate', handleLocationChange);
        return () => window.removeEventListener('popstate', handleLocationChange);
    }, []);

    // Leitura e verificação de Token de Confirmação de E-mail de Teste Grátis e Redefinição de Senha
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const pathname = window.location.pathname;

        // 1. Redefinição de Senha (/reset-password ou ?token= ou ?reset_token= ou ?reset_password=)
        const isResetPath = pathname === '/reset-password' || pathname.startsWith('/reset-password') || pathname.startsWith('/recuperar-senha');
        const resetToken = params.get('token') || params.get('reset_token') || params.get('reset_password') || (pathname.startsWith('/reset-password/') ? pathname.replace('/reset-password/', '').trim() : null);
        if (isResetPath || resetToken) {
            setCurrentView('reset-password');
            if (resetToken) {
                console.log('[PASSWORD RESET FRONTEND]', {
                    tokenPresent: Boolean(resetToken),
                    endpoint: '/api/auth/validate-reset-token',
                    method: 'GET',
                });
                setResetPasswordToken(resetToken);
            }
            return;
        }

        // 2. Confirmação do e-mail do teste de 7 dias
        const isVerifyPath = pathname.startsWith('/verify') || pathname.startsWith('/activate') || pathname === '/' || pathname === '';
        const verifyTrialToken = params.get('verify_trial') || params.get('verify_trial_token') || (isVerifyPath && !isResetPath ? params.get('token') : null);
        if (verifyTrialToken) {
            console.log('[ACTIVATION FRONTEND]', {
                tokenPresent: Boolean(verifyTrialToken),
                endpoint: '/api/trial/verify-email',
                method: 'POST',
            });

            fetch('/api/trial/verify-email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: verifyTrialToken }),
            })
            .then(async (res) => {
                const data = await res.json().catch(() => null);
                if (res.ok && data) {
                    setTrialSetPasswordData({
                        isOpen: true,
                        token: data.token || data.setPasswordToken || verifyTrialToken,
                        email: data.email || '',
                        name: data.name || '',
                    });
                } else {
                    const errorMsg = data?.error || data?.message || 'Link de confirmação inválido ou expirado.';
                    alert('Aviso de Verificação: ' + errorMsg);
                }
            })
            .catch((err) => {
                console.error('[ACTIVATION FRONTEND] Network/Fetch Error:', err);
                alert('Erro de conexão ao verificar o link do e-mail.');
            })
            .finally(() => {
                window.history.replaceState({}, document.title, window.location.pathname);
            });
            return;
        }

        // 3. Link direto para criar senha do trial vindo do e-mail de boas-vindas
        const setPassToken = params.get('set_password');
        if (setPassToken) {
            setTrialSetPasswordData({
                isOpen: true,
                token: setPassToken,
                email: '',
                name: '',
            });
            window.history.replaceState({}, document.title, window.location.pathname);
        }
    }, []);

    const loadHistory = useCallback(async (autoSelectLatest = false) => {
        const token = getStoredToken();
        if (!token) {
            setHistory([]);
            return;
        }
        setIsHistoryLoading(true);
        try {
            const items = await fetchAnalysisHistory();
            setHistory(items);
            if (autoSelectLatest && items.length > 0) {
                try {
                    const result = await fetchSavedAnalysis(items[0].id);
                    if (result) {
                        setAnalysis(result);
                    }
                } catch (loadErr) {
                    console.warn('Erro ao carregar automaticamente a última análise:', loadErr);
                }
            }
        } catch (e) {
            console.warn('Histórico indisponível:', e);
        } finally {
            setIsHistoryLoading(false);
        }
    }, []);

    useEffect(() => {
        const checkSession = async () => {
            const token = getStoredToken();
            if (!token) {
                setIsAuthenticated(false);
                setCurrentUser(null);
                return;
            }
            try {
                const res = await fetch('/api/me', {
                    headers: getAuthHeaders(),
                });
                if (res.ok) {
                    const data = await res.json();
                    if (data.user) {
                        setCurrentUser(data.user);
                        setIsAuthenticated(true);
                        loadHistory(true);
                        fetchMySubscription();
                        return;
                    }
                } else if (res.status === 401) {
                    clearToken();
                    setIsAuthenticated(false);
                    setCurrentUser(null);
                }
            } catch {
                loadHistory(true);
            }
        };

        if (isAuthenticated) {
            checkSession();
        }
    }, [isAuthenticated, loadHistory, fetchMySubscription]);

    const handleAnalysisRequest = async (request: AnalysisRequest) => {
        // Bloqueio no Frontend para usuários com teste ou plano expirado
        if (currentUser?.role !== 'admin' && !canAccessPremiumFeatures(currentUser as any)) {
            setIsTrialExpiredModalOpen(true);
            return;
        }

        setIsLoading(true);
        setError(null);
        setAnalysis(null);
        setProgressStep('Iniciando análise…');
        setProgressPct(null);

        // Solicita permissão para notificação se ainda não foi dada
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
        }

        try {
            const result = await analyzeFootballMatch(request, (step, pct) => {
                setProgressStep(step);
                setProgressPct(pct);
            });
            setAnalysis(result);
            setActiveView('analysis');
            await loadHistory();

            // Notificação ao concluir (útil quando o usuário está em outra aba)
            if ('Notification' in window && Notification.permission === 'granted') {
                const placar = result.placar && result.placar !== 'não identificado'
                    ? ` · ${result.placar}` : '';
                const title = result.timeA && result.timeB
                    ? `${result.timeA} x ${result.timeB}${placar}`
                    : 'Análise concluída';
                new Notification('PROTÁTICA — Análise pronta!', {
                    body: title,
                    icon: '/logo.png',
                    tag: 'protatica-analysis',
                });
            }
        } catch (e: unknown) {
            if (e instanceof Error) {
                // Mensagem amigável para erros de rede
                if (e.message.includes('fetch') || e.message.includes('NetworkError') || e.message.includes('Failed to fetch')) {
                    setError('O servidor de análise não está respondendo. Verifique se o servidor backend está online.');
                } else {
                    setError(e.message);
                }
            } else {
                setError('Ocorreu um erro inesperado.');
            }
        } finally {
            setIsLoading(false);
            setProgressStep('');
            setProgressPct(null);
        }
    };

    const handleOpenHistoryItem = async (id: string) => {
        setIsLoading(true);
        setError(null);
        try {
            const result = await fetchSavedAnalysis(id);
            setAnalysis(result);
            setActiveView('analysis');
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Não foi possível abrir a análise salva.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleDeleteAnalysis = async (id: string) => {
        try {
            await deleteAnalysis(id);
            if (analysis?.analysisId === id) setAnalysis(null);
            await loadHistory();
        } catch (e) {
            console.error('Erro ao remover análise:', e);
        }
    };

    const handleSelectMatchToAnalyze = (match: any) => {
        const videoUrl = String(match?.videoUrl || '').trim();
        if (!videoUrl) {
            setSelectedMatchUrl('');
            setError(
                currentUser?.role === 'admin'
                    ? 'Esta partida ainda não possui vídeo-fonte. Vá em Partidas e use “Vincular URL” para associar o vídeo do YouTube antes de analisar.'
                    : 'Esta partida ainda não possui um vídeo-fonte vinculado pelo administrador.'
            );
            setActiveView('matches');
            window.scrollTo({ top: 0, behavior: 'smooth' });
            return;
        }
        setError(null);
        setSelectedMatchUrl(videoUrl);
        setActiveView('new-analysis');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleSidebarNavigate = (view: string, params?: any) => {
        setIsMobileSidebarOpen(false);
        if (view === 'admin') {
            setIsStripeModalOpen(true);
            return;
        }
        if (view === 'new-analysis' && params?.videoUrl) {
            setSelectedMatchUrl(params.videoUrl);
        }
        setActiveView(view);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleLogout = () => {
        clearToken();                   
        setIsAuthenticated(false);
        setCurrentUser(null);
        setAnalysis(null);
        setHistory([]);
        setError(null);
        setIsLoading(false);
        setProgressStep('');
        setProgressPct(null);
        setCurrentView('landing');
    };

    if (currentView === 'reset-password') {
        return (
            <div className="flex flex-col min-h-screen">
                <LanguageSelector />
                <ResetPasswordPage
                    initialToken={resetPasswordToken}
                    onGoToLogin={() => {
                        setResetPasswordToken(null);
                        setCurrentView('login');
                        window.history.pushState({}, document.title, '/login');
                    }}
                />
            </div>
        );
    }

    if (!isAuthenticated) {
        if (currentView === 'landing') {
            return (
                <div className="flex flex-col min-h-screen">
                    <LanguageSelector />
                    <LandingPage 
                        onStartClick={() => {
                            setCurrentView('login');
                            window.history.pushState({}, document.title, '/login');
                        }}
                        onLoginClick={() => {
                            setCurrentView('login');
                            window.history.pushState({}, document.title, '/login');
                        }}
                    />
                </div>
            );
        }
        return (
            <div className="flex flex-col min-h-screen">
                <LanguageSelector />
                <Login 
                    onLoginSuccess={(user) => {
                        setCurrentUser(user);
                        setIsAuthenticated(true);
                    }} 
                    onBackToLanding={() => {
                        setCurrentView('landing');
                        window.history.pushState({}, document.title, '/');
                    }}
                />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#240303] text-stone-100 font-sans print:bg-white print:text-black flex flex-col md:flex-row overflow-x-hidden">
            <Sidebar
                activeView={activeView}
                onNavigate={handleSidebarNavigate}
                user={currentUser}
                onLogout={handleLogout}
                isOpenMobile={isMobileSidebarOpen}
                onCloseMobile={() => setIsMobileSidebarOpen(false)}
                analysisHistoryCount={history.length}
                isCollapsed={isSidebarCollapsed}
                onToggleCollapse={() => setIsSidebarCollapsed((prev) => !prev)}
            />

            <div className={`flex-1 ${isSidebarCollapsed ? 'md:pl-16' : 'md:pl-64'} flex flex-col min-h-screen transition-all duration-300 w-full min-w-0`}>
                {/* Mobile Top Header */}
                <div className="md:hidden flex items-center justify-between p-3.5 bg-[#140101] border-b border-yellow-900/40 sticky top-0 z-30 shadow-lg">
                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={() => setIsMobileSidebarOpen(true)}
                            className="p-2 rounded-lg bg-yellow-950/60 text-yellow-400 border border-yellow-500/20 hover:bg-yellow-900/60 transition-colors"
                            aria-label="Abrir Menu"
                        >
                            <Menu className="w-5 h-5" />
                        </button>
                        <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center font-black text-black text-xs shadow-md">
                                P
                            </div>
                            <span className="font-extrabold text-sm tracking-wider text-yellow-300">PROTÁTICA</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setActiveView('new-analysis')}
                            className="px-3 py-1 bg-yellow-500 hover:bg-yellow-400 text-black font-black text-xs rounded-lg flex items-center gap-1 shadow-sm transition-transform active:scale-95"
                        >
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>Analisar</span>
                        </button>
                    </div>
                </div>

                {/* Desktop Top Status & Quick Bar */}
                <div className="hidden md:flex items-center justify-between px-8 py-3.5 bg-[#180202] border-b border-yellow-900/30">
                    <div className="flex items-center gap-2.5 text-xs text-yellow-200/60">
                        <span className="font-bold text-yellow-400 uppercase tracking-wider text-[11px]">PROTÁTICA INTELLIGENCE</span>
                        <span className="text-yellow-700">/</span>
                        <span className="capitalize text-yellow-100 font-bold tracking-wide">
                            {activeView === 'dashboard' && 'Visão Geral & Central de Inteligência'}
                            {activeView === 'new-analysis' && 'Nova Análise de Partida'}
                            {activeView === 'analysis' && 'Relatório Detalhado da Partida'}
                            {activeView === 'competitions' && 'Grandes Ligas & Campeonatos'}
                            {activeView === 'matches' && 'Jogos do Momento & Análises'}
                            {activeView === 'players' && 'Catálogo & Fotos de Jogadores'}
                            {activeView === 'my-team' && 'Minha Equipe / Evolução'}
                            {activeView === 'opponents' && 'Dossiê do Adversário'}
                            {activeView === 'training-plan' && 'Planos de Treino'}
                            {activeView === 'team-goals' && 'Metas & KPIs'}
                            {activeView === 'evidence-library' && 'Biblioteca de Evidências & Vídeos'}
                            {activeView === 'tactical-board' && 'Prancheta Tática Interativa'}
                            {activeView === 'comparison' && 'Comparativo Estatístico'}
                            {activeView === 'reports' && 'Relatórios e Insights'}
                            {activeView === 'pricing' && 'Planos e Assinaturas'}
                            {activeView === 'settings' && 'Configurações da Conta'}
                        </span>
                    </div>

                    <div className="flex items-center gap-3">
                        <LanguageSelector />
                        {currentUser?.role === 'admin' && (
                            <button
                                type="button"
                                onClick={() => setIsStripeModalOpen(true)}
                                className="px-3 py-1.5 bg-yellow-950/60 border border-yellow-500/40 hover:border-yellow-400 text-yellow-300 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-all shadow-sm"
                            >
                                <Settings className="w-3.5 h-3.5 text-yellow-400" />
                                <span>Painel Master</span>
                            </button>
                        )}
                    </div>
                </div>

                {/* Trial Status Banner for active trial users */}
                {currentUser?.role !== 'admin' && (currentUser as any)?.account_type === 'trial' && (
                    <div className="p-4 pb-0 max-w-7xl w-full mx-auto">
                        <TrialBanner
                            daysRemaining={subscriptionInfo?.daysRemaining ?? (currentUser as any)?.daysRemaining}
                            trialEndDate={subscriptionInfo?.trialEndDate || (currentUser as any)?.trial_ends_at}
                            onUpgradeClick={() => setIsMySubscriptionModalOpen(true)}
                        />
                    </div>
                )}

                {/* Main Dynamic View Outlet */}
                <main className="flex-1 p-4 md:p-8 max-w-7xl w-full mx-auto">
                    {/* Loading com progresso real */}
                    {isLoading && (
                        <LoadingSpinner step={progressStep || undefined} pct={progressPct} />
                    )}

                    {error && (
                        <div className="bg-red-950/70 border border-red-700/60 text-red-200 px-4 py-3 rounded-xl text-center print:hidden mb-6 shadow-md">
                            <strong className="font-bold">Aviso: </strong>
                            <span className="block sm:inline">{error}</span>
                        </div>
                    )}

                    {!isLoading && (
                        <>
                            {activeView === 'dashboard' && (
                                <HomeDashboard
                                    onNavigate={handleSidebarNavigate}
                                    recentAnalyses={history}
                                    onOpenAnalysis={handleOpenHistoryItem}
                                    onSelectMatchToAnalyze={handleSelectMatchToAnalyze}
                                />
                            )}

                            {(activeView === 'new-analysis' || activeView === 'analysis') && (
                                <div className="space-y-6">
                                    <UrlInputForm
                                        onSubmit={handleAnalysisRequest}
                                        isLoading={isLoading}
                                        initialUrl={selectedMatchUrl}
                                    />

                                    <div className="grid xl:grid-cols-[320px_minmax(0,1fr)] gap-6">
                                        <div className="print:hidden">
                                            <HistoryPanel
                                                items={history}
                                                activeId={analysis?.analysisId}
                                                onOpen={handleOpenHistoryItem}
                                                onDelete={handleDeleteAnalysis}
                                                isLoading={isLoading || isHistoryLoading}
                                            />
                                        </div>

                                        <div>
                                            {analysis ? (
                                                <ErrorBoundary>
                                                    <AnalysisDisplay
                                                        analysis={analysis}
                                                        onGenerateTrainingPlan={(problemText) => {
                                                            setTrainingProblem(problemText);
                                                            setActiveView('training-plan');
                                                        }}
                                                    />
                                                </ErrorBoundary>
                                            ) : (
                                                <div className="print:hidden bg-[#180202] border border-yellow-900/30 rounded-2xl p-8 text-center text-yellow-101/80 shadow-lg">
                                                    <div className="text-2xl font-bold text-yellow-202 mb-2">{t('welcomeTitle')}</div>
                                                    <p className="text-sm text-yellow-100/70">
                                                        {t('welcomeText')}
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeView === 'competitions' && (
                                <CompetitionsModule
                                    onSelectMatchToAnalyze={handleSelectMatchToAnalyze}
                                    onOpenAnalysis={handleOpenHistoryItem}
                                    isAdmin={currentUser?.role === 'admin'}
                                />
                            )}

                            {activeView === 'matches' && (
                                <MatchesModule
                                    onSelectMatchToAnalyze={handleSelectMatchToAnalyze}
                                    onOpenAnalysis={handleOpenHistoryItem}
                                    onNavigateToCompetition={() => setActiveView('competitions')}
                                    isAdmin={currentUser?.role === 'admin'}
                                />
                            )}

                            {activeView === 'players' && (
                                <PlayersModule isAdmin={currentUser?.role === 'admin'} />
                            )}

                            {activeView === 'my-team' && (
                                <MyTeamModule
                                    analyses={history}
                                    onOpenAnalysis={handleOpenHistoryItem}
                                    onNavigate={(v: any) => setActiveView(v)}
                                />
                            )}

                            {(activeView === 'opponents' || activeView === 'opponent') && (
                                <OpponentDossierModule
                                    analyses={history}
                                    onOpenAnalysis={handleOpenHistoryItem}
                                    onNavigate={(v: any) => setActiveView(v)}
                                />
                            )}

                            {(activeView === 'training-plan' || activeView === 'training') && (
                                <TrainingPlansModule
                                    analyses={history}
                                    initialProblem={trainingProblem}
                                    onNavigate={(v: any) => setActiveView(v)}
                                />
                            )}

                            {(activeView === 'team-goals' || activeView === 'goals') && (
                                <TeamGoalsModule
                                    analyses={history}
                                    onNavigate={(v: any) => setActiveView(v)}
                                />
                            )}

                            {(activeView === 'evidence-library' || activeView === 'evidence') && (
                                <EvidenceLibraryModule
                                    onOpenAnalysis={handleOpenHistoryItem}
                                    onNavigate={(v: any) => setActiveView(v)}
                                />
                            )}

                            {activeView === 'tactical-board' && (
                                <TacticalBoardModule />
                            )}

                            {activeView === 'comparison' && (
                                <ComparisonDashboard onOpenAnalysis={handleOpenHistoryItem} />
                            )}

                            {activeView === 'pricing' && (
                                <PlansModule
                                    isAdmin={currentUser?.role === 'admin'}
                                    currentPlanId={(currentUser as any)?.subscription_plan || (currentUser as any)?.subscriptionPlan || null}
                                />
                            )}

                            {activeView === 'settings' && (
                                <SettingsModule
                                    user={currentUser}
                                    onChangePassword={() => setIsChangePasswordOpen(true)}
                                    onOpenAdmin={() => setIsStripeModalOpen(true)}
                                />
                            )}

                            {activeView === 'reports' && (
                                <ReportsModule
                                    history={history}
                                    onOpenAnalysis={handleOpenHistoryItem}
                                    onNavigate={handleSidebarNavigate}
                                />
                            )}
                        </>
                    )}
                </main>
            </div>

            {/* MODAL DE CONFIGURAÇÃO DE ADMIN (ACESSO EXCLUSIVO DO ADMIN) */}
            {isStripeModalOpen && (
                <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fadeIn">
                    <div className="bg-[#1a0000] border border-yellow-500/40 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl relative flex flex-col max-h-[90vh]">
                        {/* Modal Header */}
                        <div className="bg-[#2a0101] border-b border-yellow-900/50 p-5 flex items-center justify-between shrink-0">
                            <div className="flex items-center gap-2">
                                <Settings className="h-5 w-5 text-yellow-500" />
                                <span className="font-bold text-sm text-yellow-101 uppercase tracking-wider">Painel de Configurações do Sistema</span>
                            </div>
                            <button 
                                onClick={() => setIsStripeModalOpen(false)}
                                className="text-yellow-202/60 hover:text-yellow-100 bg-white/5 hover:bg-white/10 p-1.5 rounded-lg text-sm transition-colors cursor-pointer"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        {/* Tabs Navigation */}
                        <div className="flex border-b border-yellow-900/30 bg-black/30 shrink-0 overflow-x-auto">
                            <button
                                type="button"
                                onClick={() => setStripeModalTab('subscriptions')}
                                className={`flex-grow py-3 px-3 text-center text-[11px] font-bold uppercase tracking-wider transition-all border-b-2 flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap ${stripeModalTab === 'subscriptions' ? 'border-yellow-500 text-yellow-300 bg-[#2a0101]/40' : 'border-transparent text-yellow-200/55 hover:text-yellow-101 hover:bg-white/5'}`}
                            >
                                <CalendarCheck className="h-3.5 w-3.5 text-yellow-500" />
                                Assinaturas & Testes
                            </button>
                            <button
                                type="button"
                                onClick={() => setStripeModalTab('telegram')}
                                className={`flex-grow py-3 px-3 text-center text-[11px] font-bold uppercase tracking-wider transition-all border-b-2 flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap ${stripeModalTab === 'telegram' ? 'border-yellow-500 text-yellow-300 bg-[#2a0101]/40' : 'border-transparent text-yellow-200/55 hover:text-yellow-101 hover:bg-white/5'}`}
                            >
                                <Bot className="h-3.5 w-3.5 text-yellow-500" />
                                Telegram
                            </button>
                            <button
                                type="button"
                                onClick={() => setStripeModalTab('stripe')}
                                className={`flex-grow py-3 px-3 text-center text-[11px] font-bold uppercase tracking-wider transition-all border-b-2 flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap ${stripeModalTab === 'stripe' ? 'border-yellow-500 text-yellow-300 bg-[#2a0101]/40' : 'border-transparent text-yellow-200/55 hover:text-yellow-101 hover:bg-white/5'}`}
                            >
                                <CreditCard className="h-3.5 w-3.5" />
                                Gateway Stripe
                            </button>
                            <button
                                type="button"
                                onClick={() => setStripeModalTab('smtp')}
                                className={`flex-grow py-3 px-3 text-center text-[11px] font-bold uppercase tracking-wider transition-all border-b-2 flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap ${stripeModalTab === 'smtp' ? 'border-yellow-500 text-yellow-300 bg-[#2a0101]/40' : 'border-transparent text-yellow-200/55 hover:text-yellow-101 hover:bg-white/5'}`}
                            >
                                <Mail className="h-3.5 w-3.5" />
                                Envio de Email (SMTP)
                            </button>
                            <button
                                type="button"
                                onClick={() => setStripeModalTab('users')}
                                className={`flex-grow py-3 px-3 text-center text-[11px] font-bold uppercase tracking-wider transition-all border-b-2 flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap ${stripeModalTab === 'users' ? 'border-yellow-500 text-yellow-300 bg-[#2a0101]/40' : 'border-transparent text-yellow-200/55 hover:text-yellow-101 hover:bg-white/5'}`}
                            >
                                <Users className="h-3.5 w-3.5" />
                                Controle de Acessos
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-6 overflow-y-auto space-y-4 flex-grow">
                            {stripeModalTab === 'subscriptions' ? (
                                <AdminSubscriptionsPanel />
                            ) : stripeModalTab === 'telegram' ? (
                                <TelegramConfigPanel />
                            ) : stripeModalTab === 'users' ? (
                                <div className="space-y-6">
                                    {/* Create user block */}
                                    <div className="bg-[#2a0101]/40 border border-yellow-905/30 rounded-xl p-4 space-y-3">
                                        <div className="flex items-center gap-2 text-yellow-300 font-bold text-xs uppercase tracking-wider">
                                            <UserPlus className="h-4 w-4 text-yellow-500" />
                                            <span>Criar Novo Acesso Manual</span>
                                        </div>
                                        <form onSubmit={handleCreateUser} className="space-y-3">
                                            <div className="grid sm:grid-cols-2 gap-3">
                                                <div className="space-y-1">
                                                    <label className="block text-[10px] font-bold text-yellow-101 uppercase tracking-widest">E-mail / Usuário</label>
                                                    <input 
                                                        type="text"
                                                        required
                                                        placeholder="ex: cliente@email.com"
                                                        value={newUsername}
                                                        onChange={(e) => setNewUsername(e.target.value)}
                                                        className="w-full bg-black/60 border border-yellow-900/40 rounded-lg px-2.5 py-1.5 text-xs text-yellow-50 focus:border-yellow-500 focus:outline-none"
                                                    />
                                                </div>
                                                <div className="space-y-1">
                                                    <label className="block text-[10px] font-bold text-yellow-101 uppercase tracking-widest">Nome (Exibição)</label>
                                                    <input 
                                                        type="text"
                                                        placeholder="ex: Comprador Premium"
                                                        value={newDisplayName}
                                                        onChange={(e) => setNewDisplayName(e.target.value)}
                                                        className="w-full bg-black/60 border border-yellow-900/40 rounded-lg px-2.5 py-1.5 text-xs text-yellow-50 focus:border-yellow-500 focus:outline-none"
                                                    />
                                                </div>
                                            </div>
                                            <div className="space-y-1">
                                                <label className="block text-[10px] font-bold text-yellow-101 uppercase tracking-widest">Senha de Acesso Única</label>
                                                <input 
                                                    type="text"
                                                    required
                                                    placeholder="Defina a senha que o usuário usará no login"
                                                    value={newPassword}
                                                    onChange={(e) => setNewPassword(e.target.value)}
                                                    className="w-full bg-black/60 border border-yellow-905/40 rounded-lg px-2.5 py-1.5 text-xs text-yellow-50 focus:border-yellow-500 focus:outline-none"
                                                />
                                            </div>
                                            <button
                                                type="submit"
                                                className="w-full bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-400 hover:to-yellow-555 text-black font-black text-[11px] py-2 rounded-lg uppercase tracking-wider transition-all cursor-pointer"
                                            >
                                                Adicionar Credencial de Entrada
                                            </button>
                                        </form>
                                    </div>

                                    {/* Feedback messages */}
                                    {(userError || userSuccess) && (
                                        <div className={`p-3 rounded-lg text-xs font-semibold ${userError ? 'bg-red-950/40 border border-red-900/40 text-red-300' : 'bg-green-950/40 border border-green-900/40 text-green-300'}`}>
                                            {userError || userSuccess}
                                        </div>
                                    )}

                                    {/* Users list block */}
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between text-yellow-300 font-bold text-xs uppercase tracking-wider border-b border-yellow-900/20 pb-2">
                                            <div className="flex items-center gap-2">
                                                <Users className="h-4 w-4 text-yellow-500" />
                                                <span>Acessos Livres Ativos ({usersList.length})</span>
                                            </div>
                                            <button 
                                                type="button"
                                                onClick={fetchUsers} 
                                                className="text-[10px] text-yellow-500 underline hover:text-yellow-400 cursor-pointer"
                                            >
                                                Atualizar Lista
                                            </button>
                                        </div>

                                        {isUsersLoading ? (
                                            <p className="text-xs text-yellow-202/60 text-center py-4">Requisitando credenciais...</p>
                                        ) : usersList.length === 0 ? (
                                            <p className="text-xs text-yellow-202/60 text-center py-4">Nenhum login cadastrado na base SQLite.</p>
                                        ) : (
                                            <div className="space-y-2 overflow-y-auto max-h-[30vh] pr-1">
                                                {usersList.map((usr) => (
                                                    <div 
                                                        key={usr.id} 
                                                        className="bg-black/40 border border-yellow-950/60 rounded-lg p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                                                    >
                                                        <div className="space-y-0.5">
                                                            <div className="flex items-center gap-2">
                                                                <span className="font-bold text-xs text-white">{usr.displayName}</span>
                                                                {usr.role === 'admin' && (
                                                                    <span className="bg-yellow-950 text-yellow-400 text-[9px] uppercase px-1.5 py-0.2 rounded font-mono font-bold">Admin Central</span>
                                                                )}
                                                            </div>
                                                            <div className="text-[10px] text-yellow-101/60 font-mono tracking-tight">{usr.username}</div>
                                                        </div>

                                                        <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                                                            {editingUserId === usr.id ? (
                                                                <form 
                                                                    onSubmit={handleResetPassword} 
                                                                    className="flex items-center gap-1 bg-black/60 p-1 border border-yellow-500/20 rounded"
                                                                >
                                                                    <input 
                                                                        type="text" 
                                                                        required
                                                                        placeholder="Nova Senha" 
                                                                        value={editPasswordInput}
                                                                        onChange={(e) => setEditPasswordInput(e.target.value)}
                                                                        className="bg-transparent border-none text-[11px] text-yellow-50 placeholder-yellow-803/40 focus:outline-none w-24 px-1"
                                                                    />
                                                                    <button 
                                                                        type="submit" 
                                                                        className="bg-green-600 hover:bg-green-500 text-white text-[10px] font-bold px-2 py-1 rounded cursor-pointer"
                                                                    >
                                                                        Gravar
                                                                    </button>
                                                                    <button 
                                                                        type="button" 
                                                                        onClick={() => { setEditingUserId(null); setEditPasswordInput(''); }}
                                                                        className="text-yellow-600 hover:text-white text-[10px] px-1.5 cursor-pointer"
                                                                    >
                                                                        Cancelar
                                                                    </button>
                                                                </form>
                                                            ) : (
                                                                <>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => { setEditingUserId(usr.id); setEditPasswordInput(''); }}
                                                                        className="bg-yellow-950/40 hover:bg-yellow-900/60 border border-yellow-500/20 text-yellow-300 font-bold text-[10px] px-2.5 py-1 rounded transition-colors cursor-pointer"
                                                                    >
                                                                        Definir Senha
                                                                    </button>
                                                                    {usr.role !== 'admin' && (
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => handleDeleteUser(usr.id)}
                                                                            title="Revogar Acesso"
                                                                            className="bg-red-950/30 hover:bg-red-900/30 border border-red-500/10 hover:border-red-500/30 text-red-400 p-1 rounded transition-colors cursor-pointer animate-pulse"
                                                                        >
                                                                            <Trash2 className="h-3.5 w-3.5" />
                                                                        </button>
                                                                    )}
                                                                </>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    
                                    <div className="bg-yellow-950/20 border border-yellow-500/10 rounded-lg p-3 text-[10px] text-yellow-101/60 leading-relaxed flex gap-2">
                                        <ShieldAlert className="h-4 w-4 text-yellow-500 shrink-0 mt-0.5" />
                                        <span>
                                            Sempre que um usuário completa um pagamento pelo gateway do Stripe, seu e-mail de faturamento e uma nova senha provisória são vinculados automaticamente. Utilize este painel administrativo para criar novas contas manualmente ou ajustar senhas de compradores sob demanda.
                                        </span>
                                    </div>
                                </div>
                            ) : (
                                <form onSubmit={handleSaveStripeAdminConfig} className="space-y-4">
                                    {stripeModalTab === 'stripe' ? (
                                        <div className="space-y-4">
                                            <p className="text-[11px] text-yellow-101/75 leading-relaxed bg-[#2a0101]/20 p-3 rounded-lg border border-yellow-900/20">
                                                Insira as credenciais do seu Stripe comercial para direcionar os pagamentos diretamente à sua conta. Quando os clientes pagarem, o sistema emitirá suas credenciais de uso automaticamente por email.
                                            </p>

                                            <div className="space-y-1.5">
                                                <label className="block text-xs font-bold text-yellow-300 uppercase tracking-widest">Stripe Publishable Key (Chave Pública)</label>
                                                <input 
                                                    type="text"
                                                    placeholder="pk_test_... ou pk_live_..."
                                                    value={stripePublishableInput}
                                                    onChange={(e) => setStripePublishableInput(e.target.value)}
                                                    className="w-full bg-black/60 border border-yellow-900/40 rounded-lg px-3 py-2 text-xs text-yellow-50 focus:border-yellow-500 focus:outline-none"
                                                />
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="block text-xs font-bold text-yellow-300 uppercase tracking-widest">Stripe Secret Key (Chave Secreta)</label>
                                                <input 
                                                    type="password"
                                                    placeholder="sk_test_... ou sk_live_..."
                                                    value={stripeSecretInput}
                                                    onChange={(e) => setStripeSecretInput(e.target.value)}
                                                    className="w-full bg-black/60 border border-yellow-900/40 rounded-lg px-3 py-2 text-xs text-yellow-50 focus:border-yellow-500 focus:outline-none"
                                                />
                                            </div>

                                            <div className="text-xs flex items-center gap-2 pt-1 border-t border-yellow-900/20 text-yellow-101/70">
                                                <span className={`inline-block w-2.5 h-2.5 rounded-full ${stripeConfig.hasSecretKey ? 'bg-green-500' : 'bg-red-500 animate-pulse'}`} />
                                                <span>
                                                    Status Gateway: {stripeConfig.hasSecretKey ? 'Chaves Stripe Ativas e Operacionais' : 'Aguardando Credenciais'}
                                                </span>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="space-y-4">
                                            <p className="text-[11px] text-yellow-101/75 leading-relaxed bg-[#2a0101]/20 p-3 rounded-lg border border-yellow-900/20">
                                                Configure as credenciais de SMTP para que o sistema consiga disparar mensagens de email contendo o link de acesso e a chave secreta de faturamento aprovada aos compradores do Stripe.
                                            </p>

                                            <div className="grid sm:grid-cols-2 gap-4">
                                                <div className="space-y-1.5">
                                                    <label className="block text-xs font-bold text-yellow-300 uppercase tracking-widest">Servidor SMTP (Host)</label>
                                                    <input 
                                                        type="text"
                                                        placeholder="ex: smtp.hostinger.com ou smtp.gmail.com"
                                                        value={smtpHost}
                                                        onChange={(e) => setSmtpHost(e.target.value)}
                                                        className="w-full bg-black/60 border border-yellow-900/40 rounded-lg px-3 py-2 text-xs text-yellow-50 focus:border-yellow-500 focus:outline-none"
                                                    />
                                                </div>
                                                <div className="space-y-1.5">
                                                    <label className="block text-xs font-bold text-yellow-300 uppercase tracking-widest">Porta SMTP</label>
                                                    <input 
                                                        type="text"
                                                        placeholder="ex: 465 (SSL) ou 587 (TLS)"
                                                        value={smtpPort}
                                                        onChange={(e) => setSmtpPort(e.target.value)}
                                                        className="w-full bg-black/60 border border-yellow-900/40 rounded-lg px-3 py-2 text-xs text-yellow-50 focus:border-yellow-500 focus:outline-none"
                                                    />
                                                </div>
                                                <div className="space-y-1.5 sm:col-span-2">
                                                    <label className="block text-xs font-bold text-yellow-300 uppercase tracking-widest">Conta de Envio (Email / Usuário)</label>
                                                    <input 
                                                        type="email"
                                                        placeholder="ex: contato@protatica.com"
                                                        value={smtpUser}
                                                        onChange={(e) => setSmtpUser(e.target.value)}
                                                        className="w-full bg-black/60 border border-yellow-905/40 rounded-lg px-3 py-2 text-xs text-yellow-50 focus:border-yellow-500 focus:outline-none"
                                                    />
                                                </div>
                                                <div className="space-y-1.5 sm:col-span-2">
                                                    <label className="block text-xs font-bold text-yellow-300 uppercase tracking-widest">Senha de Email SMTP</label>
                                                    <input 
                                                        type="password"
                                                        placeholder="Senha da caixa postal ou senha de app"
                                                        value={smtpPass}
                                                        onChange={(e) => setSmtpPass(e.target.value)}
                                                        className="w-full bg-black/60 border border-yellow-905/40 rounded-lg px-3 py-2 text-xs text-yellow-50 focus:border-yellow-500 focus:outline-none"
                                                    />
                                                </div>
                                                <div className="space-y-1.5 sm:col-span-2">
                                                    <label className="block text-xs font-bold text-yellow-300 uppercase tracking-widest">Nome do Remetente</label>
                                                    <input 
                                                        type="text"
                                                        placeholder="ex: PROTÁTICA Scout & Analise"
                                                        value={smtpFromName}
                                                        onChange={(e) => setSmtpFromName(e.target.value)}
                                                        className="w-full bg-black/60 border border-yellow-905/40 rounded-lg px-3 py-2 text-xs text-yellow-50 focus:border-yellow-500 focus:outline-none"
                                                    />
                                                </div>
                                                <div className="flex items-center gap-2 sm:col-span-2 pt-1 font-semibold text-xs text-yellow-202">
                                                    <input 
                                                        type="checkbox"
                                                        id="smtpSecure"
                                                        checked={smtpSecure}
                                                        onChange={(e) => setSmtpSecure(e.target.checked)}
                                                        className="rounded border-yellow-900 text-yellow-500 focus:ring-yellow-500 bg-black cursor-pointer"
                                                    />
                                                    <label htmlFor="smtpSecure" className="cursor-pointer selection:bg-transparent">
                                                        Usar SSL Seguro Conexão Estrita (Recomendado para porta 465)
                                                    </label>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    <div className="border-t border-yellow-900/20 pt-4 flex justify-between items-center gap-2">
                                        <div className="text-center font-semibold text-xs text-yellow-400">
                                            {stripeSaveMessage && <span className="animate-pulse">{stripeSaveMessage}</span>}
                                        </div>
                                        <div className="flex gap-2 shrink-0">
                                            <button
                                                type="button"
                                                onClick={() => setIsStripeModalOpen(false)}
                                                className="px-4 py-2 bg-transparent text-yellow-300 border border-yellow-700/30 font-bold text-xs rounded-lg hover:bg-yellow-900/10 cursor-pointer"
                                            >
                                                Cancelar
                                            </button>
                                            <button
                                                type="submit"
                                                disabled={isSavingStripe}
                                                className="bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-400 hover:to-yellow-500 disabled:opacity-50 text-black font-black text-xs px-5 py-2 rounded-lg transition-all cursor-pointer"
                                            >
                                                {isSavingStripe ? 'Salvando...' : 'Gravar Configurações'}
                                            </button>
                                        </div>
                                    </div>
                                </form>
                            )}

                            {/* SMTP TEST TRIGGER BLOCK */}
                            {stripeModalTab === 'smtp' && (
                                <div className="mt-4 pt-4 border-t border-yellow-900/35 space-y-3">
                                    <div className="flex items-center gap-2 text-yellow-300 font-bold text-xs uppercase tracking-wider">
                                        <Send className="h-4 w-4 text-yellow-500" />
                                        <span>Testar Envio de Email</span>
                                    </div>
                                    <p className="text-[10px] text-yellow-101/60">
                                        Clique abaixo para enviar um email de teste após salvar suas configurações smtp acima para provar a comunicação do servidor de emails.
                                    </p>
                                    <form onSubmit={handleTestSmtp} className="flex gap-2">
                                        <input 
                                            type="email"
                                            placeholder="seuemail@comprador.com"
                                            value={smtpTestEmail}
                                            onChange={(e) => setSmtpTestEmail(e.target.value)}
                                            className="flex-grow bg-black/60 border border-yellow-900/40 rounded-lg px-3 py-1.5 text-xs text-yellow-50 focus:border-yellow-500 focus:outline-none"
                                        />
                                        <button
                                            type="submit"
                                            disabled={isTestingSmtp}
                                            className="bg-yellow-950/50 hover:bg-yellow-900/60 border border-yellow-500/40 disabled:opacity-50 text-yellow-300 font-bold text-xs px-4 py-1.5 rounded-lg transition-all cursor-pointer shrink-0"
                                        >
                                            {isTestingSmtp ? 'Disparando...' : 'Testar Conexão'}
                                        </button>
                                    </form>
                                    {smtpTestStatus && (
                                        <div className={`p-2 rounded text-[11px] font-semibold ${smtpTestStatus.startsWith('Erro') ? 'bg-red-950/40 border border-red-900/40 text-red-300' : 'bg-green-950/40 border border-green-900/40 text-green-300'}`}>
                                            {smtpTestStatus}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL DE ALTERAÇÃO DE SENHA (TODOS OS USUÁRIOS) */}
            {isChangePasswordOpen && (
                <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fadeIn">
                    <div className="bg-[#1a0000] border border-yellow-500/40 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl relative flex flex-col">
                        {/* Modal Header */}
                        <div className="bg-[#2a0101] border-b border-yellow-900/50 p-5 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Key className="h-5 w-5 text-yellow-500" />
                                <span className="font-bold text-sm text-yellow-101 uppercase tracking-wider">Alterar Senha de Acesso</span>
                            </div>
                            <button 
                                onClick={() => {
                                    setIsChangePasswordOpen(false);
                                    setChangePasswordError('');
                                    setChangePasswordSuccess('');
                                }}
                                className="text-yellow-202/60 hover:text-yellow-100 bg-white/5 hover:bg-white/10 p-1.5 rounded-lg text-sm transition-colors cursor-pointer"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <form onSubmit={handleChangePassword} className="p-6 space-y-4">
                            <p className="text-[11px] text-yellow-101/70 leading-relaxed bg-[#2a0101]/20 p-2.5 rounded-lg border border-yellow-900/10">
                                Digite sua senha provisória ou atual juntamente com a nova senha desejada para atualizar suas credenciais táticas.
                            </p>

                            <div className="space-y-1">
                                <label className="block text-[11px] font-bold text-yellow-300 uppercase tracking-widest">Senha Atual</label>
                                <input 
                                    type="password"
                                    required
                                    value={oldPasswordInput}
                                    onChange={(e) => setOldPasswordInput(e.target.value)}
                                    className="w-full bg-black/60 border border-yellow-900/40 rounded-lg px-3 py-2 text-xs text-yellow-50 focus:border-yellow-500 focus:outline-none"
                                    placeholder="Sua senha atual"
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="block text-[11px] font-bold text-yellow-300 uppercase tracking-widest">Nova Senha</label>
                                <input 
                                    type="password"
                                    required
                                    value={newPasswordInput}
                                    onChange={(e) => setNewPasswordInput(e.target.value)}
                                    className="w-full bg-black/60 border border-yellow-900/40 rounded-lg px-3 py-2 text-xs text-yellow-50 focus:border-yellow-500 focus:outline-none"
                                    placeholder="Pelo menos 4 caracteres"
                                />
                            </div>

                            <div className="space-y-1 border-b border-yellow-900/10 pb-3">
                                <label className="block text-[11px] font-bold text-yellow-300 uppercase tracking-widest">Confirmar Nova Senha</label>
                                <input 
                                    type="password"
                                    required
                                    value={confirmPasswordInput}
                                    onChange={(e) => setConfirmPasswordInput(e.target.value)}
                                    className="w-full bg-black/60 border border-yellow-900/40 rounded-lg px-3 py-2 text-xs text-yellow-50 focus:border-yellow-500 focus:outline-none"
                                    placeholder="Repita a nova senha"
                                />
                            </div>

                            {changePasswordError && (
                                <div className="p-2.5 rounded text-[11px] font-semibold bg-red-950/40 border border-red-900/40 text-red-400">
                                    {changePasswordError}
                                </div>
                            )}

                            {changePasswordSuccess && (
                                <div className="p-2.5 rounded text-[11px] font-semibold bg-green-950/40 border border-green-900/40 text-green-300">
                                    {changePasswordSuccess}
                                </div>
                            )}

                            <div className="pt-2 flex justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsChangePasswordOpen(false);
                                        setChangePasswordError('');
                                        setChangePasswordSuccess('');
                                    }}
                                    className="px-4 py-2 bg-transparent text-yellow-300 border border-yellow-700/30 font-bold text-xs rounded-lg hover:bg-yellow-900/10 cursor-pointer"
                                    disabled={isSavingPassword}
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSavingPassword}
                                    className="bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-400 hover:to-yellow-500 disabled:opacity-50 text-black font-black text-xs px-5 py-2 rounded-lg transition-all cursor-pointer"
                                >
                                    {isSavingPassword ? 'Salvando...' : 'Atualizar Senha'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            {/* MODAL DE TESTE OU PLANO EXPIRADO */}
            <TrialExpiredModal
                isOpen={isTrialExpiredModalOpen}
                onClose={() => setIsTrialExpiredModalOpen(false)}
                onOpenUpgrade={() => {
                    setIsTrialExpiredModalOpen(false);
                    setIsMySubscriptionModalOpen(true);
                }}
            />

            {/* MODAL DE MINHA ASSINATURA / UPGRADE PARA PLANO PAGO */}
            <MySubscriptionModal
                user={currentUser}
                isOpen={isMySubscriptionModalOpen}
                onClose={() => {
                    setIsMySubscriptionModalOpen(false);
                    fetchMySubscription();
                }}
            />

            {/* MODAL DE DEFINIR SENHA APÓS CONFIRMAÇÃO DO TESTE GRÁTIS */}
            {trialSetPasswordData.isOpen && (
                <TrialSetPasswordModal
                    isOpen={trialSetPasswordData.isOpen}
                    token={trialSetPasswordData.token}
                    email={trialSetPasswordData.email}
                    name={trialSetPasswordData.name}
                    onSuccess={(user, token) => {
                        setTrialSetPasswordData({ isOpen: false, token: '', email: '', name: '' });
                        if (user && typeof user === 'object') {
                            setCurrentUser(user);
                        }
                        setIsAuthenticated(true);
                        fetchMySubscription();
                    }}
                />
            )}

            {/* MODAL DE REDEFINIÇÃO DE SENHA */}
            {resetPasswordToken && (
                <ResetPasswordModal
                    token={resetPasswordToken}
                    onSuccess={() => {
                        setResetPasswordToken(null);
                        setCurrentView('login');
                        window.history.replaceState({}, document.title, '/');
                    }}
                    onClose={() => {
                        setResetPasswordToken(null);
                        window.history.replaceState({}, document.title, '/');
                    }}
                    onGoToLogin={() => {
                        setResetPasswordToken(null);
                        setCurrentView('login');
                        window.history.replaceState({}, document.title, '/');
                    }}
                />
            )}
        </div>
    );
};

export default App;
