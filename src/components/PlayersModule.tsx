import React, { useState, useEffect } from 'react';
import {
  UserCheck,
  Search,
  Filter,
  ShieldCheck,
  ShieldAlert,
  Plus,
  Edit2,
  Trash2,
  Check,
  User,
  Sparkles,
  Award,
  ArrowRight,
  TrendingUp
} from 'lucide-react';
import { PlayerCatalogItem } from '../types';
import PlayerPhoto from './PlayerPhoto';
import { getAuthHeaders } from '../services/geminiService';

interface PlayersModuleProps {
  isAdmin?: boolean;
}

export const PlayersModule: React.FC<PlayersModuleProps> = ({ isAdmin = false }) => {
  const [players, setPlayers] = useState<PlayerCatalogItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [clubFilter, setClubFilter] = useState<string>('all');

  // Modal for Add / Edit player
  const [showModal, setShowModal] = useState<boolean>(false);
  const [editingPlayer, setEditingPlayer] = useState<PlayerCatalogItem | null>(null);
  const [formData, setFormData] = useState({
    displayName: '',
    club: '',
    position: '',
    shirtNumber: '',
    season: '2026',
    photoUrl: '',
    photoSource: 'Clube Oficial / Federação',
    photoVerified: true,
    adminVerified: true,
  });

  const fetchPlayers = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/players/catalog');
      if (res.ok) {
        const data = await res.json();
        setPlayers(data.players || []);
      }
    } catch (err) {
      console.error('Error fetching players:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlayers();
  }, []);

  const openAddModal = () => {
    setEditingPlayer(null);
    setFormData({
      displayName: '',
      club: '',
      position: '',
      shirtNumber: '',
      season: '2026',
      photoUrl: '',
      photoSource: 'Clube Oficial / Federação',
      photoVerified: true,
      adminVerified: true,
    });
    setShowModal(true);
  };

  const openEditModal = (player: PlayerCatalogItem) => {
    setEditingPlayer(player);
    setFormData({
      displayName: player.displayName,
      club: player.club,
      position: player.position || '',
      shirtNumber: player.shirtNumber || '',
      season: player.season || '2026',
      photoUrl: player.photoUrl || '',
      photoSource: player.photoSource || 'Clube Oficial / Federação',
      photoVerified: player.photoVerified,
      adminVerified: player.adminVerified,
    });
    setShowModal(true);
  };

  const handleSavePlayer = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/players/catalog', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({
          id: editingPlayer?.id,
          ...formData
        })
      });
      if (res.ok) {
        setShowModal(false);
        fetchPlayers();
      }
    } catch (err) {
      console.error('Error saving player:', err);
    }
  };

  const handleDeletePlayer = async (id: string) => {
    if (!window.confirm('Tem certeza que deseja remover este atleta do catálogo?')) return;
    try {
      const res = await fetch(`/api/players/catalog/${id}`, {
        method: 'DELETE',
        headers: { ...getAuthHeaders() }
      });
      if (res.ok) {
        fetchPlayers();
      }
    } catch (err) {
      console.error('Error deleting player:', err);
    }
  };

  const filteredPlayers = players.filter((p) => {
    const matchesSearch = p.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.club.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.position && p.position.toLowerCase().includes(searchTerm.toLowerCase()));
    if (!matchesSearch) return false;

    if (statusFilter === 'confirmed') {
      return p.status === 'confirmed' || p.photoVerified || p.adminVerified;
    }
    if (statusFilter === 'unconfirmed') {
      return p.status === 'unconfirmed' && !p.photoVerified && !p.adminVerified;
    }
    return true;
  });

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Header Banner */}
      <div className="relative rounded-2xl bg-gradient-to-r from-[#200308] via-[#160205] to-[#0d0103] border border-amber-900/30 p-6 md:p-8 overflow-hidden shadow-xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-semibold uppercase tracking-wider mb-3">
              <UserCheck className="w-3.5 h-3.5" /> Scouting & Identificação Auditada
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
              CATÁLOGO DE JOGADORES
            </h1>
            <p className="text-sm text-zinc-300 mt-1 max-w-2xl">
              Perfis de atletas com confirmação de identidade estrita, fotos auditadas por fontes oficiais e histórico tático.
            </p>
          </div>

          {isAdmin && (
            <button
              onClick={openAddModal}
              className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-bold text-xs rounded-xl shadow-lg shadow-amber-500/20 transition-all shrink-0"
            >
              <Plus className="w-4 h-4" /> Adicionar / Confirmar Atleta
            </button>
          )}
        </div>

        {/* Search & Filters */}
        <div className="mt-6 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar atleta por nome, clube ou posição..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-zinc-900/80 border border-zinc-800 focus:border-amber-500/50 rounded-xl text-sm text-white placeholder-zinc-500 outline-none transition-all"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto">
            {[
              { id: 'all', label: 'Todos os Atletas' },
              { id: 'confirmed', label: '✓ Fotos Confirmadas' },
              { id: 'unconfirmed', label: '⚠️ Não Confirmadas' },
            ].map((sf) => (
              <button
                key={sf.id}
                onClick={() => setStatusFilter(sf.id)}
                className={`px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                  statusFilter === sf.id
                    ? 'bg-amber-500 text-black font-bold shadow-md shadow-amber-500/20'
                    : 'bg-zinc-900/80 text-zinc-400 border border-zinc-800 hover:text-white'
                }`}
              >
                {sf.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Grid of Players */}
      {loading ? (
        <div className="text-center py-16 text-zinc-400 text-sm">Carregando catálogo de atletas...</div>
      ) : filteredPlayers.length === 0 ? (
        <div className="bg-zinc-900/40 border border-zinc-800 rounded-2xl p-12 text-center text-zinc-400">
          Nenhum atleta encontrado com os filtros selecionados.
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {filteredPlayers.map((player) => {
            const isConfirmed = player.photoVerified || player.adminVerified || player.status === 'confirmed';
            return (
              <div
                key={player.id}
                className="bg-gradient-to-b from-[#1c0307] to-[#120204] border border-amber-950/40 hover:border-amber-500/40 rounded-2xl p-3 flex flex-col justify-between transition-all duration-300 group shadow-md"
              >
                <div>
                  {/* Photo Component */}
                  <div className="w-full rounded-xl overflow-hidden mb-3 aspect-[4/5] relative">
                    <PlayerPhoto
                      playerName={player.displayName}
                      teamName={player.club}
                      season={player.season}
                      position={player.position}
                      shirtNumber={player.shirtNumber}
                      fallbackUrl={player.photoUrl}
                      className="w-full h-full"
                    />

                    {isConfirmed && (
                      <div
                        className="absolute top-1.5 right-1.5 bg-emerald-600/90 text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow flex items-center gap-1"
                        title="Identidade e foto auditadas"
                      >
                        <ShieldCheck className="w-3 h-3" />
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-1 mb-0.5">
                    <span className="text-[10px] text-amber-400 font-bold uppercase truncate">
                      {player.club}
                    </span>
                    {player.shirtNumber && (
                      <span className="text-[9px] bg-zinc-800 text-zinc-300 font-mono px-1 rounded">
                        #{player.shirtNumber}
                      </span>
                    )}
                  </div>

                  <h3 className="text-sm font-bold text-white group-hover:text-amber-300 transition-colors line-clamp-1">
                    {player.displayName}
                  </h3>

                  <p className="text-[11px] text-zinc-400 line-clamp-1 mt-0.5">
                    {player.position || 'Atleta Profissional'}
                  </p>
                </div>

                {/* Admin controls or view details */}
                <div className="mt-3 pt-2 border-t border-amber-950/30 flex items-center justify-between text-xs">
                  <span className="text-[9px] text-zinc-500 font-mono">{player.season || '2026'}</span>

                  {isAdmin ? (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEditModal(player)}
                        className="p-1 text-zinc-400 hover:text-amber-400 transition-colors"
                        title="Editar atleta"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => handleDeletePlayer(player.id)}
                        className="p-1 text-zinc-400 hover:text-red-400 transition-colors"
                        title="Remover atleta"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <span className="text-[10px] text-amber-400/80 font-medium">Scouting</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#170306] border border-amber-500/30 rounded-2xl max-w-md w-full p-6 shadow-2xl animate-scaleUp">
            <h3 className="text-base font-bold text-white mb-4">
              {editingPlayer ? 'Editar Atleta Auditado' : 'Cadastrar Atleta no Catálogo'}
            </h3>
            <form onSubmit={handleSavePlayer} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-zinc-300 mb-1 font-medium">Nome Completo do Jogador</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Vinícius Júnior"
                  value={formData.displayName}
                  onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-300 mb-1 font-medium">Clube Atual</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Real Madrid"
                    value={formData.club}
                    onChange={(e) => setFormData({ ...formData, club: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-white"
                  />
                </div>
                <div>
                  <label className="block text-zinc-300 mb-1 font-medium">Temporada</label>
                  <input
                    type="text"
                    placeholder="Ex: 2026/27"
                    value={formData.season}
                    onChange={(e) => setFormData({ ...formData, season: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-300 mb-1 font-medium">Posição Tática</label>
                  <input
                    type="text"
                    placeholder="Ex: Ponta esquerda"
                    value={formData.position}
                    onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-white"
                  />
                </div>
                <div>
                  <label className="block text-zinc-300 mb-1 font-medium">Número da Camisa</label>
                  <input
                    type="text"
                    placeholder="Ex: 7"
                    value={formData.shirtNumber}
                    onChange={(e) => setFormData({ ...formData, shirtNumber: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-zinc-300 mb-1 font-medium">URL da Foto Oficial</label>
                <input
                  type="url"
                  placeholder="https://..."
                  value={formData.photoUrl}
                  onChange={(e) => setFormData({ ...formData, photoUrl: e.target.value })}
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-white"
                />
              </div>

              <div>
                <label className="block text-zinc-300 mb-1 font-medium">Fonte Auditada</label>
                <input
                  type="text"
                  placeholder="Ex: Site Oficial do Clube / Federação"
                  value={formData.photoSource}
                  onChange={(e) => setFormData({ ...formData, photoSource: e.target.value })}
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-white"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="verifiedCheck"
                  checked={formData.adminVerified}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      adminVerified: e.target.checked,
                      photoVerified: e.target.checked,
                    })
                  }
                  className="rounded text-amber-500"
                />
                <label htmlFor="verifiedCheck" className="text-zinc-300">
                  Marcar como Identidade e Foto Confirmadas
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-lg shadow-md"
                >
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PlayersModule;
