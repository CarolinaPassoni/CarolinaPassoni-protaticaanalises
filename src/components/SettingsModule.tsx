import React, { useEffect, useState } from 'react';
import {
  Bot,
  CheckCircle2,
  KeyRound,
  Loader2,
  RefreshCw,
  Settings,
  Shield,
  UserCircle,
  XCircle,
} from 'lucide-react';
import type { User } from '../types';
import { getAuthHeaders } from '../services/geminiService';

interface SettingsModuleProps {
  user: User | null;
  onChangePassword: () => void;
  onOpenAdmin?: () => void;
}

type GeminiStatus = {
  configured: boolean;
  model: string;
  ok?: boolean;
  latencyMs?: number;
  message?: string;
  error?: string;
};

export const SettingsModule: React.FC<SettingsModuleProps> = ({ user, onChangePassword, onOpenAdmin }) => {
  const [geminiStatus, setGeminiStatus] = useState<GeminiStatus | null>(null);
  const [geminiLoading, setGeminiLoading] = useState(false);
  const [geminiTesting, setGeminiTesting] = useState(false);

  const loadGeminiStatus = async () => {
    if (user?.role !== 'admin') return;
    setGeminiLoading(true);
    try {
      const response = await fetch('/api/admin/gemini/status', {
        headers: getAuthHeaders(),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Não foi possível consultar a Gemini.');
      setGeminiStatus(data);
    } catch (err: any) {
      setGeminiStatus({
        configured: false,
        model: '—',
        error: err?.message || 'Falha ao consultar configuração.',
      });
    } finally {
      setGeminiLoading(false);
    }
  };

  const testGemini = async () => {
    setGeminiTesting(true);
    try {
      const response = await fetch('/api/admin/gemini/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
      });
      const data = await response.json().catch(() => ({}));
      setGeminiStatus(data);
    } catch (err: any) {
      setGeminiStatus((prev) => ({
        configured: prev?.configured ?? true,
        model: prev?.model || '—',
        ok: false,
        error: err?.message || 'Falha de conexão com o servidor.',
      }));
    } finally {
      setGeminiTesting(false);
    }
  };

  useEffect(() => {
    loadGeminiStatus();
  }, [user?.role]);

  const testSucceeded = geminiStatus?.ok === true;
  const testFailed = geminiStatus?.ok === false;

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      <div className="rounded-3xl border border-amber-900/40 bg-gradient-to-r from-[#200308] via-[#160205] to-[#0d0103] p-6 md:p-8">
        <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-amber-300"><Settings className="h-3.5 w-3.5" /> Configurações</div>
        <h1 className="mt-3 text-3xl font-black text-white">CONTA & SEGURANÇA</h1>
        <p className="mt-2 text-sm text-zinc-300">Gerencie seu acesso e as configurações disponíveis para sua conta.</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        <div className="rounded-2xl border border-amber-950/50 bg-[#170306] p-5">
          <div className="flex items-center gap-3"><UserCircle className="h-5 w-5 text-amber-400" /><h2 className="font-bold text-white">Dados da conta</h2></div>
          <dl className="mt-5 space-y-3 text-sm">
            <div className="flex justify-between gap-4 border-b border-amber-950/30 pb-2"><dt className="text-zinc-500">Usuário</dt><dd className="text-white font-medium truncate">{user?.username || '—'}</dd></div>
            <div className="flex justify-between gap-4 border-b border-amber-950/30 pb-2"><dt className="text-zinc-500">Nome</dt><dd className="text-white font-medium truncate">{user?.displayName || user?.name || '—'}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-zinc-500">Perfil</dt><dd className="text-amber-300 font-bold">{user?.role === 'admin' ? 'Administrador' : 'Usuário'}</dd></div>
          </dl>
        </div>

        <div className="rounded-2xl border border-amber-950/50 bg-[#170306] p-5">
          <div className="flex items-center gap-3"><Shield className="h-5 w-5 text-amber-400" /><h2 className="font-bold text-white">Segurança</h2></div>
          <p className="mt-2 text-xs text-zinc-400">Use uma senha exclusiva e atualize-a periodicamente.</p>
          <button onClick={onChangePassword} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-xs font-black text-black hover:bg-amber-400"><KeyRound className="h-4 w-4" /> Alterar senha</button>
          {user?.role === 'admin' && onOpenAdmin && <button onClick={onOpenAdmin} className="ml-2 mt-5 inline-flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-xs font-black text-amber-300 hover:bg-amber-500/20"><Settings className="h-4 w-4" /> Painel administrativo</button>}
        </div>
      </div>

      {user?.role === 'admin' && (
        <div className="rounded-2xl border border-amber-900/40 bg-[#170306] p-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <Bot className="h-5 w-5 text-amber-400" />
                <h2 className="font-bold text-white">Inteligência Artificial — Gemini</h2>
              </div>
              <p className="mt-2 text-xs text-zinc-400">Verifica a configuração da API sem revelar a chave.</p>
            </div>

            <div className="flex gap-2">
              <button type="button" onClick={loadGeminiStatus} disabled={geminiLoading || geminiTesting} className="inline-flex items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs font-bold text-zinc-300 hover:bg-zinc-800 disabled:opacity-50">
                {geminiLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Atualizar
              </button>
              <button type="button" onClick={testGemini} disabled={!geminiStatus?.configured || geminiTesting || geminiLoading} className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2 text-xs font-black text-black hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50">
                {geminiTesting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bot className="h-4 w-4" />}
                {geminiTesting ? 'Testando...' : 'Testar Gemini'}
              </button>
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <div className="rounded-xl border border-amber-950/40 bg-black/20 p-4">
              <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Chave</div>
              <div className={`mt-1 text-sm font-bold ${geminiStatus?.configured ? 'text-emerald-400' : 'text-red-400'}`}>{geminiLoading ? 'Consultando...' : geminiStatus?.configured ? 'Configurada' : 'Não configurada'}</div>
            </div>
            <div className="rounded-xl border border-amber-950/40 bg-black/20 p-4">
              <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Modelo</div>
              <div className="mt-1 text-sm font-bold text-white">{geminiStatus?.model || '—'}</div>
            </div>
            <div className="rounded-xl border border-amber-950/40 bg-black/20 p-4">
              <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Teste</div>
              <div className="mt-1 flex items-center gap-2 text-sm font-bold">
                {testSucceeded ? <><CheckCircle2 className="h-4 w-4 text-emerald-400" /><span className="text-emerald-400">Conectada</span></> :
                 testFailed ? <><XCircle className="h-4 w-4 text-red-400" /><span className="text-red-400">Falhou</span></> :
                 <span className="text-zinc-400">Não executado</span>}
              </div>
            </div>
          </div>

          {geminiStatus?.latencyMs !== undefined && <p className="mt-3 text-xs text-zinc-500">Latência do teste: {geminiStatus.latencyMs} ms.</p>}
          {(geminiStatus?.message || geminiStatus?.error) && (
            <div className={`mt-3 rounded-xl border px-4 py-3 text-xs ${testFailed || geminiStatus?.error ? 'border-red-900/50 bg-red-950/20 text-red-300' : 'border-emerald-900/50 bg-emerald-950/20 text-emerald-300'}`}>
              {geminiStatus?.message || geminiStatus?.error}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SettingsModule;
