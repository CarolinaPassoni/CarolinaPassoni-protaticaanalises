import React, { useState, useEffect } from 'react';
import {
  Home,
  PlusCircle,
  Globe,
  Users,
  ShieldAlert,
  UserCheck,
  Film,
  Dumbbell,
  Target,
  Trello,
  FileText,
  CreditCard,
  Settings,
  Shield,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  Sparkles,
  Trophy,
  User
} from 'lucide-react';

export interface SidebarProps {
  activeView: string;
  onNavigate: (view: string, params?: any) => void;
  user: any;
  onLogout: () => void;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
  analysisHistoryCount?: number;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

interface NavItem {
  id: string;
  label: string;
  icon: React.ElementType;
  badge?: string | number;
  highlight?: boolean;
  adminOnly?: boolean;
  category: 'main' | 'intelligence' | 'account' | 'admin';
}

const NAV_ITEMS: NavItem[] = [
  // Main
  { id: 'dashboard', label: 'Início', icon: Home, category: 'main' },
  { id: 'new-analysis', label: 'Nova Análise', icon: PlusCircle, highlight: true, category: 'main' },
  { id: 'competitions', label: 'Competições', icon: Globe, badge: '14', category: 'main' },
  { id: 'matches', label: 'Partidas', icon: Trophy, category: 'main' },

  // Intelligence & Tactical
  { id: 'my-team', label: 'Minha Equipe', icon: Users, category: 'intelligence' },
  { id: 'opponents', label: 'Adversários', icon: ShieldAlert, category: 'intelligence' },
  { id: 'players', label: 'Jogadores', icon: UserCheck, category: 'intelligence' },
  { id: 'evidence-library', label: 'Evidências', icon: Film, category: 'intelligence' },
  { id: 'training-plan', label: 'Treinamentos', icon: Dumbbell, category: 'intelligence' },
  { id: 'team-goals', label: 'Metas', icon: Target, category: 'intelligence' },
  { id: 'tactical-board', label: 'Quadro Tático', icon: Trello, category: 'intelligence' },
  { id: 'reports', label: 'Relatórios', icon: FileText, category: 'intelligence' },

  // Account
  { id: 'pricing', label: 'Planos', icon: CreditCard, category: 'account' },
  { id: 'settings', label: 'Configurações', icon: Settings, category: 'account' },

  // Admin
  { id: 'admin', label: 'Painel Admin', icon: Shield, adminOnly: true, category: 'admin' },
];

export const Sidebar: React.FC<SidebarProps> = ({
  activeView,
  onNavigate,
  user,
  onLogout,
  isOpenMobile,
  onCloseMobile,
  analysisHistoryCount,
  isCollapsed: controlledCollapsed,
  onToggleCollapse,
}) => {
  const [internalCollapsed, setInternalCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('protatica_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  const isCollapsed = controlledCollapsed !== undefined ? controlledCollapsed : internalCollapsed;

  const handleToggleCollapse = () => {
    if (onToggleCollapse) {
      onToggleCollapse();
    } else {
      setInternalCollapsed((prev) => {
        const next = !prev;
        try {
          localStorage.setItem('protatica_sidebar_collapsed', String(next));
        } catch {}
        return next;
      });
    }
  };

  useEffect(() => {
    if (controlledCollapsed !== undefined) {
      try {
        localStorage.setItem('protatica_sidebar_collapsed', String(controlledCollapsed));
      } catch {}
    }
  }, [controlledCollapsed]);

  const isAdmin = user?.role === 'admin';

  const userPlanName = (() => {
    if (isAdmin) return 'Administrador';
    if (user?.subscription_plan) {
      return user.subscription_plan.toUpperCase();
    }
    if (user?.account_type === 'trial' || user?.accountType === 'trial') {
      return 'Trial 7 Dias';
    }
    return 'Performance';
  })();

  const handleNavClick = (viewId: string) => {
    onNavigate(viewId);
    onCloseMobile();
  };

  const renderNavGroup = (title: string, items: NavItem[]) => {
    const visibleItems = items.filter((item) => !item.adminOnly || isAdmin);
    if (visibleItems.length === 0) return null;

    return (
      <div className="mb-4">
        {!isCollapsed && (
          <div className="px-3 mb-1.5 text-[10px] font-bold uppercase tracking-wider text-amber-500/60 select-none">
            {title}
          </div>
        )}
        <div className="space-y-1">
          {visibleItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeView === item.id;
            return (
              <button
                key={item.id}
                id={`sidebar-nav-${item.id}`}
                onClick={() => handleNavClick(item.id)}
                title={isCollapsed ? item.label : undefined}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all group relative ${
                  isActive
                    ? 'bg-gradient-to-r from-amber-500/20 via-amber-500/10 to-transparent text-amber-300 border-l-2 border-amber-400 font-semibold'
                    : item.highlight
                    ? 'text-amber-400 hover:bg-amber-500/10 hover:text-amber-300'
                    : 'text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200'
                } ${isCollapsed ? 'justify-center px-2' : ''}`}
              >
                <Icon
                  className={`w-4 h-4 shrink-0 transition-transform duration-200 group-hover:scale-110 ${
                    isActive ? 'text-amber-400' : item.highlight ? 'text-amber-400' : 'text-zinc-400 group-hover:text-zinc-200'
                  }`}
                />
                {!isCollapsed && (
                  <span className="truncate flex-1 text-left">{item.label}</span>
                )}
                {!isCollapsed && item.badge && (
                  <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-1.5 py-0.5 rounded-full font-mono">
                    {item.badge}
                  </span>
                )}
                {/* Tooltip on collapsed desktop */}
                {isCollapsed && (
                  <div className="absolute left-full ml-2 px-2.5 py-1 bg-zinc-900 border border-amber-500/30 text-amber-200 text-xs rounded shadow-xl whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity z-50">
                    {item.label}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  const sidebarContent = (
    <div className="flex flex-col h-full bg-[#120205] border-r border-amber-950/40 text-zinc-200 select-none">
      {/* Brand Header */}
      <div className="p-4 border-b border-amber-950/40 flex items-center justify-between shrink-0">
        <button
          onClick={() => handleNavClick('dashboard')}
          className="flex items-center gap-2.5 text-left group overflow-hidden focus:outline-none"
        >
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 p-0.5 shadow-md shadow-amber-500/20 shrink-0 group-hover:scale-105 transition-transform">
            <div className="w-full h-full bg-[#1b0307] rounded-[6px] flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-amber-400" />
            </div>
          </div>
          {!isCollapsed && (
            <div className="truncate">
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-base tracking-tight text-white">PROTÁTICA</span>
                <span className="text-[9px] bg-amber-500/20 text-amber-400 border border-amber-500/30 px-1 py-0.2 rounded font-mono font-bold">
                  PRO
                </span>
              </div>
              <p className="text-[10px] text-zinc-400 truncate">Inteligência Tática</p>
            </div>
          )}
        </button>

        {/* Desktop Collapse Toggle */}
        <button
          onClick={handleToggleCollapse}
          className="hidden md:flex p-1.5 text-zinc-400 hover:text-amber-300 hover:bg-zinc-800/60 rounded-md transition-colors"
          title={isCollapsed ? 'Expandir menu lateral' : 'Recolher menu lateral'}
        >
          {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>

        {/* Mobile Close Button */}
        <button
          onClick={onCloseMobile}
          className="md:hidden p-1.5 text-zinc-400 hover:text-white rounded-md"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Navigation Links Scrollable Area */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1 custom-scrollbar">
        {renderNavGroup(
          'Navegação',
          NAV_ITEMS.filter((i) => i.category === 'main')
        )}
        {renderNavGroup(
          'Inteligência & Tática',
          NAV_ITEMS.filter((i) => i.category === 'intelligence')
        )}
        {renderNavGroup(
          'Configurações',
          NAV_ITEMS.filter((i) => i.category === 'account')
        )}
        {isAdmin && renderNavGroup('Administração', NAV_ITEMS.filter((i) => i.category === 'admin'))}
      </div>

      {/* User Profile Card */}
      <div className="p-3 border-t border-amber-950/40 bg-[#170307] shrink-0">
        {!isCollapsed ? (
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-amber-500 to-amber-300 p-0.5 shrink-0">
              <div className="w-full h-full bg-[#1b0307] rounded-full flex items-center justify-center text-amber-400 font-bold text-xs uppercase">
                {user?.username ? user.username.slice(0, 2) : <User className="w-4 h-4" />}
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-white truncate">{user?.username || 'Usuário'}</p>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-amber-400 font-medium truncate">{userPlanName}</span>
              </div>
            </div>
            <button
              onClick={onLogout}
              className="p-1.5 text-zinc-400 hover:text-red-400 hover:bg-zinc-800/60 rounded-md transition-colors shrink-0"
              title="Sair do sistema"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <div
              className="w-8 h-8 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-300 text-xs font-bold uppercase"
              title={`${user?.username || 'Usuário'} (${userPlanName})`}
            >
              {user?.username ? user.username.slice(0, 2) : <User className="w-4 h-4" />}
            </div>
            <button
              onClick={onLogout}
              className="p-1.5 text-zinc-400 hover:text-red-400 rounded-md transition-colors"
              title="Sair"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Fixed Sidebar */}
      <aside
        className={`hidden md:block fixed top-0 left-0 bottom-0 z-[1100] transition-all duration-300 shadow-2xl ${
          isCollapsed ? 'w-16' : 'w-64'
        }`}
      >
        {sidebarContent}
      </aside>

      {/* Mobile Drawer Backdrop */}
      {isOpenMobile && (
        <div
          className="md:hidden fixed inset-0 bg-black/80 backdrop-blur-sm z-40 animate-fadeIn"
          onClick={onCloseMobile}
        />
      )}

      {/* Mobile Drawer Sidebar */}
      <aside
        className={`md:hidden fixed top-0 left-0 bottom-0 w-72 z-50 transform transition-transform duration-300 shadow-2xl ${
          isOpenMobile ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {sidebarContent}
      </aside>
    </>
  );
};

export default Sidebar;
