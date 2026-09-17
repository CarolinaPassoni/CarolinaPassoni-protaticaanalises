import React, { useState, useEffect } from 'react';
import {
  Users,
  Clock,
  CheckCircle2,
  AlertCircle,
  ShieldAlert,
  Search,
  RefreshCw,
  Mail,
  Calendar,
  Sparkles,
  Lock,
  Unlock,
  Send,
  PlusCircle,
  FileText,
  Activity,
  UserCheck
} from 'lucide-react';
import { User, SubscriptionEvent, EmailLog } from '../types.js';
import { OFFICIAL_PLANS_LIST } from '../utils/plans.js';

export const AdminSubscriptionsPanel: React.FC = () => {
  const [subView, setSubView] = useState<'list' | 'events' | 'emails' | 'test'>('list');
  const [users, setUsers] = useState<User[]>([]);
  const [events, setEvents] = useState<SubscriptionEvent[]>([]);
  const [emailLogs, setEmailLogs] = useState<EmailLog[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Extend Modal State
  const [extendUserId, setExtendUserId] = useState<string | null>(null);
  const [extendDays, setExtendDays] = useState<number>(3);
  const [extendReason, setExtendReason] = useState<string>('Extensão solicitada pelo usuário');

  // Activate Modal State
  const [activateUserId, setActivateUserId] = useState<string | null>(null);
  const [activatePlanId, setActivatePlanId] = useState<string>('pro_annual');
  const [activateDays, setActivateDays] = useState<number>(365);
  const [activateReason, setActivateReason] = useState<string>('Ativação manual admin');

  // Test Email State
  const [testEmailAddress, setTestEmailAddress] = useState<string>('');
  const [isSendingTest, setIsSendingTest] = useState(false);

  const getAuthToken = () => localStorage.getItem('auth_token') || '';

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/admin/subscriptions', {
        headers: { Authorization: `Bearer ${getAuthToken()}` },
      });
      const data = await res.json();
      if (res.ok) {
        setUsers(data.users || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchEvents = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/admin/subscription-events', {
        headers: { Authorization: `Bearer ${getAuthToken()}` },
      });
      const data = await res.json();
      if (res.ok) setEvents(data.events || []);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchEmailLogs = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/admin/email-logs', {
        headers: { Authorization: `Bearer ${getAuthToken()}` },
      });
      const data = await res.json();
      if (res.ok) setEmailLogs(data.logs || []);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (subView === 'list') fetchUsers();
    else if (subView === 'events') fetchEvents();
    else if (subView === 'emails') fetchEmailLogs();
  }, [subView]);

  const handleExtendTrial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!extendUserId) return;
    setActionMessage(null);

    try {
      const res = await fetch('/api/admin/subscriptions/extend', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getAuthToken()}`,
        },
        body: JSON.stringify({
          userId: extendUserId,
          additionalDays: extendDays,
          reason: extendReason,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setActionMessage({ type: 'success', text: `Trial estendido em +${extendDays} dias com sucesso!` });
        setExtendUserId(null);
        fetchUsers();
      } else {
        setActionMessage({ type: 'error', text: data.error || 'Erro ao estender trial.' });
      }
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'Falha de comunicação.' });
    }
  };

  const handleActivatePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activateUserId) return;
    setActionMessage(null);

    try {
      const res = await fetch('/api/admin/subscriptions/activate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getAuthToken()}`,
        },
        body: JSON.stringify({
          userId: activateUserId,
          planId: activatePlanId,
          durationDays: activateDays,
          reason: activateReason,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setActionMessage({ type: 'success', text: 'Plano pago ativado com sucesso para o usuário!' });
        setActivateUserId(null);
        fetchUsers();
      } else {
        setActionMessage({ type: 'error', text: data.error || 'Erro ao ativar plano.' });
      }
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'Falha de comunicação.' });
    }
  };

  const handleToggleBlock = async (userId: string, currentBlocked?: boolean | number) => {
    setActionMessage(null);
    try {
      const isCurrentlyBlocked = Boolean(currentBlocked);
      const res = await fetch('/api/admin/subscriptions/toggle-block', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getAuthToken()}`,
        },
        body: JSON.stringify({
          userId,
          block: !isCurrentlyBlocked,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setActionMessage({
          type: 'success',
          text: !isCurrentlyBlocked ? 'Usuário bloqueado com sucesso.' : 'Usuário desbloqueado com sucesso.',
        });
        fetchUsers();
      } else {
        setActionMessage({ type: 'error', text: data.error || 'Erro ao alterar bloqueio.' });
      }
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'Erro de comunicação.' });
    }
  };

  const handleResendAccess = async (userId: string, email: string) => {
    setActionMessage(null);
    try {
      const res = await fetch('/api/admin/subscriptions/resend-access', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getAuthToken()}`,
        },
        body: JSON.stringify({ userId }),
      });
      const data = await res.json();
      if (res.ok) {
        setActionMessage({ type: 'success', text: `Instruções de acesso disparadas para ${email}!` });
      } else {
        setActionMessage({ type: 'error', text: data.error || 'Erro ao reenviar acesso.' });
      }
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'Erro de conexão.' });
    }
  };

  const handleSendTestEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testEmailAddress) return;
    setIsSendingTest(true);
    setActionMessage(null);

    try {
      const res = await fetch('/api/admin/test-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getAuthToken()}`,
        },
        body: JSON.stringify({ testEmail: testEmailAddress.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        setActionMessage({ type: 'success', text: data.message || 'E-mail de teste disparado com êxito!' });
      } else {
        setActionMessage({ type: 'error', text: data.error || 'Falha no disparo do e-mail.' });
      }
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'Falha de comunicação.' });
    } finally {
      setIsSendingTest(false);
    }
  };

  const filteredUsers = users.filter((u) => {
    const matchSearch =
      u.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.displayName && u.displayName.toLowerCase().includes(searchTerm.toLowerCase()));

    if (!matchSearch) return false;

    if (filterStatus === 'all') return true;
    if (filterStatus === 'trial_active') return u.accountType === 'trial' && u.trialStatus === 'active';
    if (filterStatus === 'trial_expired') return u.accountType === 'trial' && u.trialStatus === 'expired';
    if (filterStatus === 'paid_active') return u.accountType === 'paid' && u.subscriptionStatus === 'active';
    if (filterStatus === 'paid_expired') return u.accountType === 'paid' && u.subscriptionStatus === 'expired';
    if (filterStatus === 'blocked') return !!u.isBlocked;
    return true;
  });

  return (
    <div className="space-y-5">
      {/* Sub Navigation */}
      <div className="flex border-b border-yellow-900/30 gap-2 pb-2">
        <button
          type="button"
          onClick={() => setSubView('list')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
            subView === 'list'
              ? 'bg-yellow-500 text-black'
              : 'bg-black/40 text-yellow-200/70 hover:text-white'
          }`}
        >
          <Users className="h-3.5 w-3.5" />
          <span>Assinantes & Testes</span>
        </button>

        <button
          type="button"
          onClick={() => setSubView('events')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
            subView === 'events'
              ? 'bg-yellow-500 text-black'
              : 'bg-black/40 text-yellow-200/70 hover:text-white'
          }`}
        >
          <Activity className="h-3.5 w-3.5" />
          <span>Eventos de Assinatura</span>
        </button>

        <button
          type="button"
          onClick={() => setSubView('emails')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
            subView === 'emails'
              ? 'bg-yellow-500 text-black'
              : 'bg-black/40 text-yellow-200/70 hover:text-white'
          }`}
        >
          <Mail className="h-3.5 w-3.5" />
          <span>Logs de E-mail</span>
        </button>

        <button
          type="button"
          onClick={() => setSubView('test')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
            subView === 'test'
              ? 'bg-yellow-500 text-black'
              : 'bg-black/40 text-yellow-200/70 hover:text-white'
          }`}
        >
          <Send className="h-3.5 w-3.5" />
          <span>Testar SMTP</span>
        </button>
      </div>

      {actionMessage && (
        <div
          className={`p-3 rounded-xl text-xs font-semibold flex items-center justify-between ${
            actionMessage.type === 'success'
              ? 'bg-emerald-950/60 border border-emerald-800 text-emerald-300'
              : 'bg-red-950/60 border border-red-800 text-red-300'
          }`}
        >
          <span>{actionMessage.text}</span>
          <button
            onClick={() => setActionMessage(null)}
            className="text-white/60 hover:text-white ml-2 text-xs"
          >
            ✕
          </button>
        </div>
      )}

      {/* Subview: LIST OF USERS */}
      {subView === 'list' && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-black/40 p-3 rounded-xl border border-yellow-900/30">
            <div className="flex items-center gap-2 flex-grow max-w-sm">
              <Search className="h-4 w-4 text-yellow-500/70 shrink-0" />
              <input
                type="text"
                placeholder="Buscar por e-mail ou nome..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-black/60 border border-yellow-900/40 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:border-yellow-500"
              />
            </div>

            <div className="flex items-center gap-2">
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="bg-black/60 border border-yellow-900/40 rounded-lg px-2.5 py-1 text-xs text-yellow-200 focus:outline-none"
              >
                <option value="all">Todos os Status</option>
                <option value="trial_active">Trial Ativo</option>
                <option value="trial_expired">Trial Expirado</option>
                <option value="paid_active">Plano Pago Ativo</option>
                <option value="paid_expired">Plano Pago Expirado</option>
                <option value="blocked">Bloqueados</option>
              </select>

              <button
                type="button"
                onClick={fetchUsers}
                disabled={isLoading}
                className="p-1.5 bg-yellow-950/60 hover:bg-yellow-900/80 border border-yellow-500/30 text-yellow-300 rounded-lg text-xs cursor-pointer"
                title="Atualizar"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto border border-yellow-900/30 rounded-xl bg-black/30">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-yellow-900/40 bg-[#2a0101]/60 text-[10px] uppercase tracking-wider text-yellow-300 font-bold">
                  <th className="p-3">Usuário</th>
                  <th className="p-3">Tipo / Plano</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Validade / Expiração</th>
                  <th className="p-3">Conversão</th>
                  <th className="p-3 text-right">Ações Rápidas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-yellow-900/20">
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-yellow-200/50">
                      Nenhum registro encontrado com os filtros atuais.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((u) => {
                    const isTrial = u.accountType === 'trial';
                    const isPaid = u.accountType === 'paid';
                    const isAdmin = u.role === 'admin';

                    return (
                      <tr key={u.id} className="hover:bg-yellow-950/20 transition-colors">
                        <td className="p-3">
                          <div className="font-bold text-white">{u.displayName || u.username}</div>
                          <div className="text-[10px] text-yellow-200/60 font-mono truncate max-w-[180px]">
                            {u.username}
                          </div>
                        </td>

                        <td className="p-3">
                          {isAdmin ? (
                            <span className="text-[10px] font-bold text-purple-400 bg-purple-950/60 px-2 py-0.5 rounded border border-purple-800">
                              Admin Central
                            </span>
                          ) : isPaid ? (
                            <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800">
                              {u.subscriptionPlan || 'Plano Pago'}
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold text-yellow-400 bg-yellow-950/60 px-2 py-0.5 rounded border border-yellow-800">
                              Demo 7 Dias
                            </span>
                          )}
                        </td>

                        <td className="p-3">
                          {u.isBlocked ? (
                            <span className="text-[10px] font-bold text-red-400 bg-red-950/60 px-2 py-0.5 rounded border border-red-800">
                              Bloqueado
                            </span>
                          ) : isTrial && u.trialStatus === 'active' ? (
                            <span className="text-[10px] font-bold text-yellow-300 bg-yellow-950/80 px-2 py-0.5 rounded border border-yellow-700">
                              Trial Ativo
                            </span>
                          ) : isTrial && u.trialStatus === 'expired' ? (
                            <span className="text-[10px] font-bold text-amber-400 bg-amber-950/80 px-2 py-0.5 rounded border border-amber-700">
                              Trial Expirado
                            </span>
                          ) : isPaid && u.subscriptionStatus === 'active' ? (
                            <span className="text-[10px] font-bold text-emerald-300 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-700">
                              Assinatura Ativa
                            </span>
                          ) : isPaid && u.subscriptionStatus === 'expired' ? (
                            <span className="text-[10px] font-bold text-red-400 bg-red-950/80 px-2 py-0.5 rounded border border-red-700">
                              Assinatura Expirada
                            </span>
                          ) : (
                            <span className="text-[10px] text-yellow-200/60">
                              {u.subscriptionStatus || u.trialStatus || 'Pendente'}
                            </span>
                          )}
                        </td>

                        <td className="p-3 text-[11px] text-yellow-100">
                          {isTrial && u.trialExpiresAt ? (
                            new Date(u.trialExpiresAt).toLocaleDateString('pt-BR')
                          ) : isPaid && u.subscriptionExpiresAt ? (
                            new Date(u.subscriptionExpiresAt).toLocaleDateString('pt-BR')
                          ) : (
                            '—'
                          )}
                        </td>

                        <td className="p-3">
                          {u.convertedFromTrial ? (
                            <span className="text-[10px] font-bold text-emerald-400">Sim</span>
                          ) : (
                            <span className="text-[10px] text-yellow-200/40">Não</span>
                          )}
                        </td>

                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Extend Trial */}
                            {isTrial && (
                              <button
                                type="button"
                                onClick={() => {
                                  setExtendUserId(u.id);
                                  setExtendDays(3);
                                }}
                                title="Estender Teste Grátis"
                                className="px-2 py-1 bg-yellow-950/60 hover:bg-yellow-900 border border-yellow-600/40 text-yellow-300 text-[10px] font-bold rounded cursor-pointer"
                              >
                                + Dias
                              </button>
                            )}

                            {/* Activate Paid Plan */}
                            <button
                              type="button"
                              onClick={() => {
                                setActivateUserId(u.id);
                                setActivateDays(365);
                              }}
                              title="Ativar Plano Pago Manualmente"
                              className="px-2 py-1 bg-emerald-950/60 hover:bg-emerald-900 border border-emerald-600/40 text-emerald-300 text-[10px] font-bold rounded cursor-pointer"
                            >
                              Ativar Plano
                            </button>

                            {/* Resend Access Email */}
                            <button
                              type="button"
                              onClick={() => handleResendAccess(u.id, u.username)}
                              title="Reenviar E-mail de Acesso"
                              className="p-1 bg-black/40 hover:bg-white/10 border border-yellow-900/40 text-yellow-200 rounded cursor-pointer"
                            >
                              <Mail className="h-3.5 w-3.5" />
                            </button>

                            {/* Block/Unblock (Never admin) */}
                            {!isAdmin && (
                              <button
                                type="button"
                                onClick={() => handleToggleBlock(u.id, u.isBlocked)}
                                title={u.isBlocked ? 'Desbloquear Acesso' : 'Bloquear Acesso'}
                                className={`p-1 border rounded cursor-pointer ${
                                  u.isBlocked
                                    ? 'bg-red-900/80 border-red-500 text-white'
                                    : 'bg-black/40 hover:bg-red-950/60 border-yellow-900/40 text-red-400'
                                }`}
                              >
                                {u.isBlocked ? (
                                  <Unlock className="h-3.5 w-3.5" />
                                ) : (
                                  <Lock className="h-3.5 w-3.5" />
                                )}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Subview: SUBSCRIPTION EVENTS */}
      {subView === 'events' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-yellow-300 uppercase tracking-wider">
              Histórico de Eventos de Assinatura
            </span>
            <button
              type="button"
              onClick={fetchEvents}
              className="text-[11px] text-yellow-400 underline hover:text-yellow-300 cursor-pointer"
            >
              Atualizar
            </button>
          </div>

          <div className="overflow-x-auto border border-yellow-900/30 rounded-xl bg-black/30 max-h-[50vh]">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-yellow-900/40 bg-[#2a0101]/60 text-[10px] uppercase text-yellow-300 font-bold">
                  <th className="p-3">Data / Hora</th>
                  <th className="p-3">Usuário ID</th>
                  <th className="p-3">Tipo de Evento</th>
                  <th className="p-3">Detalhes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-yellow-900/20">
                {events.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-6 text-center text-yellow-200/50">
                      Nenhum evento de assinatura registrado ainda.
                    </td>
                  </tr>
                ) : (
                  events.map((ev) => (
                    <tr key={ev.id} className="hover:bg-yellow-950/20">
                      <td className="p-3 text-yellow-200/70 whitespace-nowrap">
                        {new Date(ev.createdAt).toLocaleString('pt-BR')}
                      </td>
                      <td className="p-3 font-mono text-[11px] text-white">{ev.userId}</td>
                      <td className="p-3">
                        <span className="font-bold text-yellow-300">{ev.eventType}</span>
                      </td>
                      <td className="p-3 text-yellow-100 font-mono text-[10px]">
                        {ev.metadata ? JSON.stringify(ev.metadata) : '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Subview: EMAIL LOGS */}
      {subView === 'emails' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-yellow-300 uppercase tracking-wider">
              Disparos e Logs de E-mail
            </span>
            <button
              type="button"
              onClick={fetchEmailLogs}
              className="text-[11px] text-yellow-400 underline hover:text-yellow-300 cursor-pointer"
            >
              Atualizar
            </button>
          </div>

          <div className="overflow-x-auto border border-yellow-900/30 rounded-xl bg-black/30 max-h-[50vh]">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-yellow-900/40 bg-[#2a0101]/60 text-[10px] uppercase text-yellow-300 font-bold">
                  <th className="p-3">Data</th>
                  <th className="p-3">Destinatário</th>
                  <th className="p-3">Tipo de Template</th>
                  <th className="p-3">Assunto</th>
                  <th className="p-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-yellow-900/20">
                {emailLogs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-yellow-200/50">
                      Nenhum registro de e-mail enviado ainda.
                    </td>
                  </tr>
                ) : (
                  emailLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-yellow-950/20">
                      <td className="p-3 text-yellow-200/70 whitespace-nowrap">
                        {new Date(log.sentAt).toLocaleString('pt-BR')}
                      </td>
                      <td className="p-3 font-mono text-white">{log.recipientEmail}</td>
                      <td className="p-3 text-yellow-300 font-bold">{log.templateType}</td>
                      <td className="p-3 text-yellow-100">{log.subject}</td>
                      <td className="p-3">
                        {log.status === 'sent' ? (
                          <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800">
                            Enviado
                          </span>
                        ) : (
                          <span
                            className="text-[10px] font-bold text-red-400 bg-red-950/60 px-2 py-0.5 rounded border border-red-800"
                            title={log.errorMessage || ''}
                          >
                            Falha
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Subview: TEST SMTP */}
      {subView === 'test' && (
        <form onSubmit={handleSendTestEmail} className="bg-black/40 border border-yellow-900/40 p-5 rounded-xl space-y-4">
          <div className="space-y-1">
            <h4 className="text-xs font-bold text-yellow-300 uppercase tracking-wider">
              Testar Envio Real de E-mail
            </h4>
            <p className="text-[11px] text-yellow-200/70">
              Dispara uma mensagem de teste usando as credenciais SMTP configuradas no painel.
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="block text-[11px] font-bold text-yellow-100 uppercase tracking-wider">
              E-mail de Destino para Teste
            </label>
            <input
              type="email"
              required
              placeholder="seu.email@dominio.com"
              value={testEmailAddress}
              onChange={(e) => setTestEmailAddress(e.target.value)}
              className="w-full bg-black/60 border border-yellow-900/40 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-yellow-500"
            />
          </div>

          <button
            type="submit"
            disabled={isSendingTest}
            className="w-full py-2.5 bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-400 hover:to-yellow-500 text-black font-extrabold rounded-lg text-xs uppercase tracking-wider transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Send className="h-4 w-4" />
            <span>{isSendingTest ? 'Disparando...' : 'Enviar E-mail de Teste'}</span>
          </button>
        </form>
      )}

      {/* MODAL: EXTEND TRIAL */}
      {extendUserId && (
        <div className="fixed inset-0 z-[115] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-[#180202] border border-yellow-500/50 rounded-2xl w-full max-w-sm p-5 space-y-4">
            <h4 className="font-extrabold text-sm text-yellow-100 uppercase tracking-wider">
              Estender Teste Gratuito
            </h4>
            <form onSubmit={handleExtendTrial} className="space-y-3">
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-yellow-200 uppercase">
                  Adicionar Dias
                </label>
                <div className="flex gap-2">
                  {[3, 7, 14].map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setExtendDays(d)}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                        extendDays === d
                          ? 'bg-yellow-500 text-black border-yellow-400'
                          : 'bg-black/40 text-yellow-200 border-yellow-900/40'
                      }`}
                    >
                      +{d} Dias
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-yellow-200 uppercase">
                  Motivo / Justificativa
                </label>
                <input
                  type="text"
                  required
                  value={extendReason}
                  onChange={(e) => setExtendReason(e.target.value)}
                  className="w-full bg-black/60 border border-yellow-900/40 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-yellow-500"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  className="flex-1 py-2 bg-yellow-500 hover:bg-yellow-400 text-black font-extrabold text-xs rounded-lg uppercase tracking-wider cursor-pointer"
                >
                  Confirmar
                </button>
                <button
                  type="button"
                  onClick={() => setExtendUserId(null)}
                  className="px-3 py-2 bg-white/10 hover:bg-white/20 text-white text-xs rounded-lg cursor-pointer"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ACTIVATE PLAN */}
      {activateUserId && (
        <div className="fixed inset-0 z-[115] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-[#180202] border border-emerald-500/50 rounded-2xl w-full max-w-sm p-5 space-y-4">
            <h4 className="font-extrabold text-sm text-yellow-100 uppercase tracking-wider">
              Ativar Plano Pago Manualmente
            </h4>
            <form onSubmit={handleActivatePlan} className="space-y-3">
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-yellow-200 uppercase">
                  Selecione o Plano
                </label>
                <select
                  value={activatePlanId}
                  onChange={(e) => {
                    setActivatePlanId(e.target.value);
                    const p = OFFICIAL_PLANS_LIST.find((x) => x.id === e.target.value);
                    if (p) setActivateDays(p.durationDays);
                  }}
                  className="w-full bg-black/60 border border-yellow-900/40 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none"
                >
                  {OFFICIAL_PLANS_LIST.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.priceFormatted})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-yellow-200 uppercase">
                  Duração em Dias
                </label>
                <input
                  type="number"
                  min={1}
                  value={activateDays}
                  onChange={(e) => setActivateDays(parseInt(e.target.value, 10) || 30)}
                  className="w-full bg-black/60 border border-yellow-900/40 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-yellow-200 uppercase">
                  Motivo
                </label>
                <input
                  type="text"
                  required
                  value={activateReason}
                  onChange={(e) => setActivateReason(e.target.value)}
                  className="w-full bg-black/60 border border-yellow-900/40 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  className="flex-1 py-2 bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-xs rounded-lg uppercase tracking-wider cursor-pointer"
                >
                  Ativar Assinatura
                </button>
                <button
                  type="button"
                  onClick={() => setActivateUserId(null)}
                  className="px-3 py-2 bg-white/10 hover:bg-white/20 text-white text-xs rounded-lg cursor-pointer"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
