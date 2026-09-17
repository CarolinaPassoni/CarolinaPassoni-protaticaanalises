import React, { useState, useEffect } from 'react';
import { Send, Bot, RefreshCw, CheckCircle, AlertTriangle, Shield, Radio, FileText, Image as ImageIcon, Bell, MessageSquare, Trash2 } from 'lucide-react';
import type { TelegramConfig, TelegramMessageLog } from '../types';

interface TelegramConfigPanelProps {
  onStatusChange?: (msg: string) => void;
}

export const TelegramConfigPanel: React.FC<TelegramConfigPanelProps> = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  // Configuration form states
  const [active, setActive] = useState(false);
  const [botToken, setBotToken] = useState('');
  const [channelId, setChannelId] = useState('');
  const [vipGroupId, setVipGroupId] = useState('');
  const [autoPublish, setAutoPublish] = useState(false);
  const [autoSendReport, setAutoSendReport] = useState(false);
  const [autoSendHeatmaps, setAutoSendHeatmaps] = useState(false);
  const [sendAlerts, setSendAlerts] = useState(false);
  const [webhookSecret, setWebhookSecret] = useState('');

  // Info from server
  const [hasServerToken, setHasServerToken] = useState(false);
  const [maskedToken, setMaskedToken] = useState('');
  const [botInfo, setBotInfo] = useState<{ username?: string; firstName?: string; id?: number } | null>(null);

  // Message Logs
  const [messages, setMessages] = useState<TelegramMessageLog[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);

  const fetchConfig = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/telegram/config');
      if (res.ok) {
        const data: TelegramConfig & { maskedToken?: string } = await res.json();
        setActive(data.active);
        setHasServerToken(data.hasToken);
        setMaskedToken(data.maskedToken || '');
        setChannelId(data.channelId || '');
        setVipGroupId(data.vipGroupId || '');
        setAutoPublish(data.autoPublish);
        setAutoSendReport(data.autoSendReport);
        setAutoSendHeatmaps(data.autoSendHeatmaps);
        setSendAlerts(data.sendAlerts);
        setWebhookSecret(data.webhookSecret || '');
        setBotInfo(data.botInfo || null);
      }
    } catch (err) {
      console.error('Erro ao carregar configurações do Telegram:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async () => {
    setLoadingMessages(true);
    try {
      const res = await fetch('/api/telegram/messages?limit=25');
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
      }
    } catch (err) {
      console.error('Erro ao carregar logs do Telegram:', err);
    } finally {
      setLoadingMessages(false);
    }
  };

  useEffect(() => {
    fetchConfig();
    fetchMessages();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveStatus(null);

    try {
      const payload: Record<string, any> = {
        active,
        channelId,
        vipGroupId,
        autoPublish,
        autoSendReport,
        autoSendHeatmaps,
        sendAlerts,
        webhookSecret,
      };

      if (botToken.trim()) {
        payload.botToken = botToken.trim();
      }

      const res = await fetch('/api/telegram/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setSaveStatus('Configurações do Telegram salvas com sucesso!');
        setBotToken('');
        await fetchConfig();
        setTimeout(() => setSaveStatus(null), 4000);
      } else {
        const err = await res.json();
        setSaveStatus(`Erro: ${err.error || 'Falha ao salvar.'}`);
      }
    } catch (err: any) {
      setSaveStatus(`Erro de conexão: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);

    try {
      const res = await fetch('/api/telegram/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ botToken: botToken.trim() || undefined }),
      });

      const data = await res.json();
      if (res.ok && data.ok) {
        setTestResult({
          ok: true,
          message: `Conexão bem-sucedida! Bot: @${data.bot?.username || 'bot'} (${data.bot?.firstName || 'ProTática'}) [ID: ${data.bot?.id}]`,
        });
        setBotInfo(data.bot);
      } else {
        setTestResult({
          ok: false,
          message: data.error || 'Não foi possível autenticar o bot com o Telegram.',
        });
      }
    } catch (err: any) {
      setTestResult({
        ok: false,
        message: `Falha na requisição de teste: ${err.message}`,
      });
    } finally {
      setTesting(false);
    }
  };

  const handleClearLogs = async () => {
    if (!confirm('Deseja limpar todo o histórico de logs do Telegram?')) return;
    try {
      await fetch('/api/telegram/clear-messages', { method: 'POST' });
      setMessages([]);
    } catch (err) {
      console.error('Erro ao limpar logs:', err);
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center text-yellow-300 flex items-center justify-center gap-2">
        <RefreshCw className="h-5 w-5 animate-spin text-yellow-500" />
        <span className="text-xs">Carregando módulo Telegram...</span>
      </div>
    );
  }

  const webhookUrl = typeof window !== 'undefined' ? `${window.location.origin}/api/telegram/webhook` : '/api/telegram/webhook';

  return (
    <div className="space-y-6">
      {/* Bot Status & Header Overview */}
      <div className="bg-[#2a0101]/60 border border-yellow-900/50 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-yellow-950/60 border border-yellow-500/30 text-yellow-400">
            <Bot className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-yellow-100">Telegram Bot API</span>
              <span
                className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${
                  active && (hasServerToken || botToken)
                    ? 'bg-green-950 border border-green-700 text-green-300'
                    : 'bg-red-950 border border-red-800 text-red-300'
                }`}
              >
                {active && (hasServerToken || botToken) ? 'Ativo & Operacional' : 'Inativo'}
              </span>
            </div>
            <p className="text-[11px] text-yellow-200/60">
              {botInfo?.username ? (
                <>Conectado como <span className="text-yellow-400 font-mono font-bold">@{botInfo.username}</span></>
              ) : (
                'Transmissão automática de relatórios, dados táticos e comandos para canais e grupos VIP.'
              )}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleTestConnection}
          disabled={testing}
          className="bg-yellow-950/60 hover:bg-yellow-900/70 border border-yellow-500/40 text-yellow-300 hover:text-yellow-100 font-bold text-xs px-3.5 py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 shrink-0"
        >
          <Radio className={`h-3.5 w-3.5 ${testing ? 'animate-ping' : 'text-yellow-500'}`} />
          <span>{testing ? 'Testando...' : 'Testar Conexão'}</span>
        </button>
      </div>

      {testResult && (
        <div
          className={`p-3 rounded-lg text-xs font-semibold flex items-center gap-2 ${
            testResult.ok
              ? 'bg-green-950/50 border border-green-800 text-green-300'
              : 'bg-red-950/50 border border-red-800 text-red-300'
          }`}
        >
          {testResult.ok ? <CheckCircle className="h-4 w-4 shrink-0" /> : <AlertTriangle className="h-4 w-4 shrink-0" />}
          <span>{testResult.message}</span>
        </div>
      )}

      {/* Main Settings Form */}
      <form onSubmit={handleSave} className="space-y-4">
        {/* Toggle Ativo/Inativo */}
        <div className="bg-[#1a0000]/60 border border-yellow-900/30 rounded-xl p-3.5 flex items-center justify-between">
          <div className="space-y-0.5">
            <label className="text-xs font-bold text-yellow-100 flex items-center gap-2 cursor-pointer" htmlFor="tg-active-toggle">
              <span>Habilitar Integração Telegram</span>
            </label>
            <p className="text-[10px] text-yellow-200/60">
              Permite o envio de mensagens, comandos de webhook e disparos automáticos.
            </p>
          </div>
          <input
            id="tg-active-toggle"
            type="checkbox"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
            className="w-4 h-4 rounded border-yellow-800 text-yellow-500 focus:ring-yellow-500 bg-black cursor-pointer"
          />
        </div>

        {/* Bot Token */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="block text-[11px] font-bold text-yellow-300 uppercase tracking-wider">
              Token do Bot Telegram (BotFather)
            </label>
            {hasServerToken && (
              <span className="text-[10px] text-green-400 font-mono flex items-center gap-1">
                <Shield className="h-3 w-3" /> Token gravado no servidor ({maskedToken || '••••'})
              </span>
            )}
          </div>
          <input
            type="password"
            placeholder={hasServerToken ? 'Digite um novo token se desejar substituir' : 'ex: 123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ'}
            value={botToken}
            onChange={(e) => setBotToken(e.target.value)}
            className="w-full bg-black/60 border border-yellow-900/40 rounded-lg px-3 py-2 text-xs text-yellow-50 focus:border-yellow-500 focus:outline-none"
          />
          <p className="text-[10px] text-yellow-101/60">
            Obtenha seu token criando um bot com o <b>@BotFather</b> no aplicativo do Telegram. O token é mantido seguro no backend.
          </p>
        </div>

        {/* Channel & VIP Group IDs */}
        <div className="grid sm:grid-cols-2 gap-3.5">
          <div className="space-y-1.5">
            <label className="block text-[11px] font-bold text-yellow-300 uppercase tracking-wider">
              Canal Público (ID ou @Username)
            </label>
            <input
              type="text"
              placeholder="ex: @canal_protatica ou -100123456789"
              value={channelId}
              onChange={(e) => setChannelId(e.target.value)}
              className="w-full bg-black/60 border border-yellow-900/40 rounded-lg px-3 py-2 text-xs text-yellow-50 focus:border-yellow-500 focus:outline-none"
            />
            <p className="text-[10px] text-yellow-101/50">
              Certifique-se de adicionar o bot como Administrador do canal com permissão de postar mensagens.
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="block text-[11px] font-bold text-yellow-300 uppercase tracking-wider">
              Grupo VIP (Chat ID)
            </label>
            <input
              type="text"
              placeholder="ex: -1009876543210"
              value={vipGroupId}
              onChange={(e) => setVipGroupId(e.target.value)}
              className="w-full bg-black/60 border border-yellow-900/40 rounded-lg px-3 py-2 text-xs text-yellow-50 focus:border-yellow-500 focus:outline-none"
            />
            <p className="text-[10px] text-yellow-101/50">
              ID do grupo de assinantes VIP onde relatórios exclusivos serão publicados.
            </p>
          </div>
        </div>

        {/* Automated Publishing Switches */}
        <div className="bg-[#2a0101]/40 border border-yellow-900/30 rounded-xl p-4 space-y-3">
          <span className="text-[11px] font-bold text-yellow-300 uppercase tracking-wider block border-b border-yellow-900/20 pb-1.5">
            Regras de Publicação e Automação
          </span>

          <div className="grid sm:grid-cols-2 gap-3">
            <label className="flex items-start gap-2.5 p-2.5 rounded-lg bg-black/30 border border-yellow-950 hover:border-yellow-900/40 cursor-pointer transition-colors">
              <input
                type="checkbox"
                checked={autoPublish}
                onChange={(e) => setAutoPublish(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-yellow-800 text-yellow-500 focus:ring-yellow-500 bg-black cursor-pointer"
              />
              <div className="text-[11px]">
                <span className="font-bold text-yellow-100 flex items-center gap-1">
                  <Send className="h-3 w-3 text-yellow-500" /> Publicação Automática
                </span>
                <span className="text-yellow-200/55 block text-[10px] mt-0.5">
                  Publica o resumo tático formatado no canal/grupo logo que o vídeo for analisado.
                </span>
              </div>
            </label>

            <label className="flex items-start gap-2.5 p-2.5 rounded-lg bg-black/30 border border-yellow-950 hover:border-yellow-900/40 cursor-pointer transition-colors">
              <input
                type="checkbox"
                checked={autoSendReport}
                onChange={(e) => setAutoSendReport(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-yellow-800 text-yellow-500 focus:ring-yellow-500 bg-black cursor-pointer"
              />
              <div className="text-[11px]">
                <span className="font-bold text-yellow-100 flex items-center gap-1">
                  <FileText className="h-3 w-3 text-yellow-500" /> Envio de Relatório PDF
                </span>
                <span className="text-yellow-200/55 block text-[10px] mt-0.5">
                  Anexa o documento PDF gerado da análise diretamente ao Telegram quando disponível.
                </span>
              </div>
            </label>

            <label className="flex items-start gap-2.5 p-2.5 rounded-lg bg-black/30 border border-yellow-950 hover:border-yellow-900/40 cursor-pointer transition-colors">
              <input
                type="checkbox"
                checked={autoSendHeatmaps}
                onChange={(e) => setAutoSendHeatmaps(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-yellow-800 text-yellow-500 focus:ring-yellow-500 bg-black cursor-pointer"
              />
              <div className="text-[11px]">
                <span className="font-bold text-yellow-100 flex items-center gap-1">
                  <ImageIcon className="h-3 w-3 text-yellow-500" /> Mapas de Calor Táticos
                </span>
                <span className="text-yellow-200/55 block text-[10px] mt-0.5">
                  Anexa a imagem de mapa de calor tático à mensagem publicada.
                </span>
              </div>
            </label>

            <label className="flex items-start gap-2.5 p-2.5 rounded-lg bg-black/30 border border-yellow-950 hover:border-yellow-900/40 cursor-pointer transition-colors">
              <input
                type="checkbox"
                checked={sendAlerts}
                onChange={(e) => setSendAlerts(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-yellow-800 text-yellow-500 focus:ring-yellow-500 bg-black cursor-pointer"
              />
              <div className="text-[11px]">
                <span className="font-bold text-yellow-100 flex items-center gap-1">
                  <Bell className="h-3 w-3 text-yellow-500" /> Alertas do Sistema
                </span>
                <span className="text-yellow-200/55 block text-[10px] mt-0.5">
                  Envia notificações operacionais e status de processamento da plataforma.
                </span>
              </div>
            </label>
          </div>
        </div>

        {/* Webhook Settings */}
        <div className="bg-[#1a0000]/60 border border-yellow-900/30 rounded-xl p-3.5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-yellow-300 uppercase tracking-wider">
              Webhook para Comandos (/jogos, /analise, /estatisticas)
            </span>
          </div>
          <div className="space-y-1">
            <div className="text-[10px] text-yellow-101/70 font-mono bg-black/70 p-2 rounded border border-yellow-900/30 select-all overflow-x-auto">
              URL do Webhook: <span className="text-yellow-400 font-bold">{webhookUrl}</span>
            </div>
            <p className="text-[10px] text-yellow-101/50">
              Para ativar o webhook com o Telegram, utilize: <code className="text-yellow-300">https://api.telegram.org/bot&lt;TOKEN&gt;/setWebhook?url={webhookUrl}</code>
            </p>
          </div>
          <div className="pt-1">
            <label className="block text-[10px] font-bold text-yellow-200 uppercase tracking-wider">
              Secret Token de Webhook (Opcional)
            </label>
            <input
              type="text"
              placeholder="ex: meu_token_secreto_123"
              value={webhookSecret}
              onChange={(e) => setWebhookSecret(e.target.value)}
              className="w-full bg-black/60 border border-yellow-900/40 rounded-lg px-2.5 py-1.5 text-xs text-yellow-50 focus:border-yellow-500 focus:outline-none mt-1"
            />
          </div>
        </div>

        {/* Feedback message */}
        {saveStatus && (
          <div
            className={`p-2.5 rounded text-xs font-semibold ${
              saveStatus.startsWith('Erro')
                ? 'bg-red-950/50 border border-red-800 text-red-300'
                : 'bg-green-950/50 border border-green-800 text-green-300'
            }`}
          >
            {saveStatus}
          </div>
        )}

        {/* Submit Actions */}
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-400 hover:to-yellow-500 disabled:opacity-50 text-black font-black text-xs px-5 py-2.5 rounded-lg transition-all cursor-pointer shadow-md"
          >
            {saving ? 'Salvando...' : 'Gravar Configurações do Telegram'}
          </button>
        </div>
      </form>

      {/* Message Logs Section */}
      <div className="mt-6 pt-4 border-t border-yellow-900/40 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-yellow-300 font-bold text-xs uppercase tracking-wider">
            <MessageSquare className="h-4 w-4 text-yellow-500" />
            <span>Histórico de Mensagens e Disparos ({messages.length})</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={fetchMessages}
              disabled={loadingMessages}
              className="text-[10px] text-yellow-500 underline hover:text-yellow-400 cursor-pointer flex items-center gap-1"
            >
              <RefreshCw className={`h-3 w-3 ${loadingMessages ? 'animate-spin' : ''}`} />
              <span>Atualizar Logs</span>
            </button>
            {messages.length > 0 && (
              <button
                type="button"
                onClick={handleClearLogs}
                className="text-[10px] text-red-400 hover:text-red-300 cursor-pointer flex items-center gap-0.5 ml-2"
                title="Limpar Histórico"
              >
                <Trash2 className="h-3 w-3" />
                <span>Limpar</span>
              </button>
            )}
          </div>
        </div>

        {loadingMessages ? (
          <p className="text-xs text-yellow-200/50 text-center py-4">Carregando logs...</p>
        ) : messages.length === 0 ? (
          <div className="bg-black/30 border border-yellow-900/20 rounded-lg p-4 text-center text-xs text-yellow-200/50">
            Nenhuma mensagem registrada no log do Telegram ainda.
          </div>
        ) : (
          <div className="space-y-2 overflow-y-auto max-h-[220px] pr-1">
            {messages.map((m) => (
              <div
                key={m.id}
                className="bg-black/40 border border-yellow-900/20 rounded-lg p-2.5 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2"
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[9px] uppercase font-bold px-1.5 py-0.2 rounded ${
                        m.status === 'sucesso'
                          ? 'bg-green-950 text-green-400 border border-green-800/40'
                          : 'bg-red-950 text-red-400 border border-red-800/40'
                      }`}
                    >
                      {m.status}
                    </span>
                    <span className="text-yellow-300 font-mono text-[11px] font-bold">{m.tipo}</span>
                    <span className="text-yellow-101/50 text-[10px] font-mono">Chat: {m.chat_id}</span>
                  </div>
                  <p className="text-yellow-100/80 text-[11px] truncate max-w-md">
                    {m.conteudo_resumido || '(sem conteúdo de texto)'}
                  </p>
                  {m.erro && (
                    <p className="text-red-400 text-[10px] font-mono">
                      Erro: {m.erro}
                    </p>
                  )}
                </div>
                <div className="text-[10px] text-yellow-200/40 font-mono shrink-0 self-end sm:self-center">
                  {m.created_at ? new Date(m.created_at).toLocaleString('pt-BR') : ''}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
