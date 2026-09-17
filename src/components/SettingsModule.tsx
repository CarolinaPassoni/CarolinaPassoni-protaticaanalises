import React from 'react';
import { KeyRound, Settings, Shield, UserCircle } from 'lucide-react';
import type { User } from '../types';

interface SettingsModuleProps {
  user: User | null;
  onChangePassword: () => void;
  onOpenAdmin?: () => void;
}

export const SettingsModule: React.FC<SettingsModuleProps> = ({ user, onChangePassword, onOpenAdmin }) => (
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
  </div>
);

export default SettingsModule;
