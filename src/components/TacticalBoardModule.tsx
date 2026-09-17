import React, { useState, useRef, useEffect } from 'react';
import { 
  Trophy, 
  RotateCcw, 
  Save, 
  FolderOpen, 
  Trash2, 
  Download, 
  Plus, 
  Move, 
  ArrowRight, 
  Sparkles,
  Layers,
  Circle,
  Eye
} from 'lucide-react';
import { getAuthHeaders } from '../services/geminiService';

interface PlayerToken {
  id: string;
  number: number;
  team: 'blue' | 'red';
  x: number; // percentage 0 - 100
  y: number; // percentage 0 - 100
  label?: string;
}

interface TacticalBoard {
  id: string;
  title: string;
  formationA: string;
  formationB: string;
  data: {
    players: PlayerToken[];
    ball: { x: number; y: number };
    notes?: string;
  };
  createdAt: string;
}

const FORMATIONS: Record<string, { x: number; y: number }[]> = {
  '4-3-3': [
    { x: 8, y: 50 },  // GK
    { x: 22, y: 15 }, // LB
    { x: 20, y: 38 }, // CB
    { x: 20, y: 62 }, // CB
    { x: 22, y: 85 }, // RB
    { x: 38, y: 50 }, // DM
    { x: 48, y: 32 }, // CM
    { x: 48, y: 68 }, // CM
    { x: 75, y: 18 }, // LW
    { x: 78, y: 50 }, // ST
    { x: 75, y: 82 }, // RW
  ],
  '4-4-2': [
    { x: 8, y: 50 },
    { x: 22, y: 15 },
    { x: 20, y: 38 },
    { x: 20, y: 62 },
    { x: 22, y: 85 },
    { x: 45, y: 15 },
    { x: 42, y: 38 },
    { x: 42, y: 62 },
    { x: 45, y: 85 },
    { x: 75, y: 40 },
    { x: 75, y: 60 },
  ],
  '4-2-3-1': [
    { x: 8, y: 50 },
    { x: 22, y: 15 },
    { x: 20, y: 38 },
    { x: 20, y: 62 },
    { x: 22, y: 85 },
    { x: 38, y: 38 },
    { x: 38, y: 62 },
    { x: 60, y: 18 },
    { x: 60, y: 50 },
    { x: 60, y: 82 },
    { x: 80, y: 50 },
  ],
  '3-5-2': [
    { x: 8, y: 50 },
    { x: 20, y: 25 },
    { x: 18, y: 50 },
    { x: 20, y: 75 },
    { x: 45, y: 12 },
    { x: 42, y: 35 },
    { x: 38, y: 50 },
    { x: 42, y: 65 },
    { x: 45, y: 88 },
    { x: 75, y: 40 },
    { x: 75, y: 60 },
  ],
};

const getOpponentFormation = (formationKey: string) => {
  const base = FORMATIONS[formationKey] || FORMATIONS['4-3-3'];
  return base.map((p) => ({
    x: 100 - p.x,
    y: 100 - p.y,
  }));
};

export const TacticalBoardModule: React.FC = () => {
  const [boardTitle, setBoardTitle] = useState('Prancheta Tática');
  const [formationA, setFormationA] = useState('4-3-3');
  const [formationB, setFormationB] = useState('4-4-2');
  const [notes, setNotes] = useState('');

  const [players, setPlayers] = useState<PlayerToken[]>([]);
  const [ball, setBall] = useState<{ x: number; y: number }>({ x: 50, y: 50 });
  const [draggingItem, setDraggingItem] = useState<{ type: 'player' | 'ball'; id?: string } | null>(null);

  const [savedBoards, setSavedBoards] = useState<TacticalBoard[]>([]);
  const [isSavedListOpen, setIsSavedListOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const pitchRef = useRef<HTMLDivElement>(null);

  // Initialize formation
  const setupFormations = (formA: string, formB: string) => {
    const aPositions = FORMATIONS[formA] || FORMATIONS['4-3-3'];
    const bPositions = getOpponentFormation(formB);

    const initialTokens: PlayerToken[] = [
      ...aPositions.map((p, idx) => ({
        id: `blue-${idx + 1}`,
        number: idx + 1,
        team: 'blue' as const,
        x: p.x,
        y: p.y,
      })),
      ...bPositions.map((p, idx) => ({
        id: `red-${idx + 1}`,
        number: idx + 1,
        team: 'red' as const,
        x: p.x,
        y: p.y,
      })),
    ];

    setPlayers(initialTokens);
    setBall({ x: 50, y: 50 });
  };

  useEffect(() => {
    setupFormations(formationA, formationB);
    fetchSavedBoards();
  }, []);

  const fetchSavedBoards = async () => {
    try {
      const res = await fetch('/api/tactical/boards', {
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        setSavedBoards(data.boards || []);
      }
    } catch (err) {
      console.error('Erro ao listar pranchetas:', err);
    }
  };

  // Drag and Drop calculations on pitch
  const handlePointerDown = (type: 'player' | 'ball', id?: string) => {
    setDraggingItem({ type, id });
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingItem || !pitchRef.current) return;

    const rect = pitchRef.current.getBoundingClientRect();
    const clientX = e.clientX;
    const clientY = e.clientY;

    let x = ((clientX - rect.left) / rect.width) * 100;
    let y = ((clientY - rect.top) / rect.height) * 100;

    // Bounds limit 2% to 98%
    x = Math.max(2, Math.min(98, x));
    y = Math.max(2, Math.min(98, y));

    if (draggingItem.type === 'ball') {
      setBall({ x, y });
    } else if (draggingItem.type === 'player' && draggingItem.id) {
      setPlayers((prev) =>
        prev.map((p) => (p.id === draggingItem.id ? { ...p, x, y } : p))
      );
    }
  };

  const handlePointerUp = () => {
    setDraggingItem(null);
  };

  const handleSaveBoard = async () => {
    setIsSaving(true);
    try {
      const payload = {
        title: boardTitle.trim() || 'Prancheta Tática',
        formationA,
        formationB,
        data: {
          players,
          ball,
          notes,
        },
      };

      const res = await fetch('/api/tactical/boards', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const saved = await res.json();
        setSavedBoards((prev) => [saved.board, ...prev.filter((b) => b.id !== saved.board.id)]);
        alert('Prancheta tática salva com sucesso!');
      }
    } catch (err) {
      console.error('Erro ao salvar prancheta:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleLoadBoard = (board: TacticalBoard) => {
    setBoardTitle(board.title);
    setFormationA(board.formationA || '4-3-3');
    setFormationB(board.formationB || '4-4-2');
    if (board.data) {
      if (board.data.players) setPlayers(board.data.players);
      if (board.data.ball) setBall(board.data.ball);
      if (board.data.notes) setNotes(board.data.notes);
    }
    setIsSavedListOpen(false);
  };

  const handleDeleteBoard = async (id: string) => {
    if (!confirm('Deseja excluir esta prancheta?')) return;
    try {
      const res = await fetch(`/api/tactical/boards/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        setSavedBoards((prev) => prev.filter((b) => b.id !== id));
      }
    } catch (err) {
      console.error('Erro ao deletar prancheta:', err);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="bg-[#2a0101]/80 border border-yellow-500/30 rounded-2xl p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-yellow-400">
            <Trophy className="h-4 w-4" />
            Simulador de Prancheta Interativa
          </div>
          <h2 className="text-2xl md:text-3xl font-extrabold text-white">
            QUADRO TÁTICO INTERATIVO
          </h2>
          <p className="text-xs md:text-sm text-yellow-100/70">
            Posicione atletas, simule dinâmicas de jogo, movimentações e comportamentos táticos em tempo real.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setIsSavedListOpen(true)}
            className="px-3.5 py-2 bg-yellow-950/50 hover:bg-yellow-900/60 border border-yellow-700/40 text-yellow-300 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <FolderOpen className="h-4 w-4" />
            Carregar ({savedBoards.length})
          </button>

          <button
            disabled={isSaving}
            onClick={handleSaveBoard}
            className="px-4 py-2 bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-400 hover:to-yellow-500 text-black font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all shadow-md cursor-pointer"
          >
            <Save className="h-4 w-4" />
            {isSaving ? 'Salvando...' : 'Salvar Prancheta'}
          </button>
        </div>
      </div>

      {/* Control Bar: Title & Formations */}
      <div className="bg-[#2a0101]/60 border border-yellow-900/40 rounded-2xl p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-[10px] font-bold text-yellow-200/80 mb-1 uppercase tracking-wider">
            Título da Prancheta
          </label>
          <input
            type="text"
            value={boardTitle}
            onChange={(e) => setBoardTitle(e.target.value)}
            className="w-full bg-black/40 border border-yellow-900/50 rounded-xl px-3 py-1.5 text-xs text-yellow-50 focus:border-yellow-500 focus:outline-none font-bold"
          />
        </div>

        <div>
          <label className="block text-[10px] font-bold text-blue-400 mb-1 uppercase tracking-wider">
            Formação Equipe Azul
          </label>
          <select
            value={formationA}
            onChange={(e) => {
              setFormationA(e.target.value);
              setupFormations(e.target.value, formationB);
            }}
            className="w-full bg-black/40 border border-yellow-900/50 rounded-xl px-3 py-1.5 text-xs text-yellow-50 focus:border-yellow-500 focus:outline-none"
          >
            <option value="4-3-3">4-3-3</option>
            <option value="4-4-2">4-4-2</option>
            <option value="4-2-3-1">4-2-3-1</option>
            <option value="3-5-2">3-5-2</option>
          </select>
        </div>

        <div>
          <label className="block text-[10px] font-bold text-red-400 mb-1 uppercase tracking-wider">
            Formação Equipe Vermelha
          </label>
          <select
            value={formationB}
            onChange={(e) => {
              setFormationB(e.target.value);
              setupFormations(formationA, e.target.value);
            }}
            className="w-full bg-black/40 border border-yellow-900/50 rounded-xl px-3 py-1.5 text-xs text-yellow-50 focus:border-yellow-500 focus:outline-none"
          >
            <option value="4-4-2">4-4-2</option>
            <option value="4-3-3">4-3-3</option>
            <option value="4-2-3-1">4-2-3-1</option>
            <option value="3-5-2">3-5-2</option>
          </select>
        </div>
      </div>

      {/* PITCH CONTAINER */}
      <div className="relative w-full max-w-4xl mx-auto select-none">
        <div
          ref={pitchRef}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          className="relative w-full aspect-[16/10] bg-gradient-to-b from-[#14532d] via-[#15803d] to-[#14532d] rounded-2xl border-4 border-white/80 shadow-2xl overflow-hidden cursor-crosshair touch-none"
        >
          {/* Football Field Lines (SVG Layer) */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none stroke-white/70 stroke-[2] fill-none">
            {/* Outer border padding */}
            <rect x="3%" y="3%" width="94%" height="94%" />
            {/* Center Line */}
            <line x1="50%" y1="3%" x2="50%" y2="97%" />
            {/* Center Circle */}
            <circle cx="50%" cy="50%" r="12%" />
            <circle cx="50%" cy="50%" r="1%" className="fill-white" />
            {/* Penalty Area Left */}
            <rect x="3%" y="22%" width="15%" height="56%" />
            <rect x="3%" y="36%" width="6%" height="28%" />
            <circle cx="14%" cy="50%" r="0.8%" className="fill-white" />
            <path d="M 18% 40% A 10% 10% 0 0 1 18% 60%" />
            {/* Penalty Area Right */}
            <rect x="82%" y="22%" width="15%" height="56%" />
            <rect x="91%" y="36%" width="6%" height="28%" />
            <circle cx="86%" cy="50%" r="0.8%" className="fill-white" />
            <path d="M 82% 40% A 10% 10% 0 0 0 82% 60%" />
          </svg>

          {/* PLAYERS (Tokens) */}
          {players.map((p) => {
            const isBlue = p.team === 'blue';
            return (
              <div
                key={p.id}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  handlePointerDown('player', p.id);
                }}
                style={{
                  left: `${p.x}%`,
                  top: `${p.y}%`,
                  transform: 'translate(-50%, -50%)',
                }}
                className={`absolute w-7 h-7 md:w-8 md:h-8 rounded-full flex items-center justify-center font-extrabold text-xs shadow-lg cursor-grab active:cursor-grabbing select-none border-2 transition-transform hover:scale-110 ${
                  isBlue
                    ? 'bg-blue-600 border-white text-white shadow-blue-900/60'
                    : 'bg-red-600 border-white text-white shadow-red-900/60'
                }`}
              >
                {p.number}
              </div>
            );
          })}

          {/* BALL */}
          <div
            onPointerDown={(e) => {
              e.stopPropagation();
              handlePointerDown('ball');
            }}
            style={{
              left: `${ball.x}%`,
              top: `${ball.y}%`,
              transform: 'translate(-50%, -50%)',
            }}
            className="absolute w-5 h-5 md:w-6 md:h-6 rounded-full bg-white border-2 border-black flex items-center justify-center shadow-2xl cursor-grab active:cursor-grabbing select-none hover:scale-125 transition-transform"
          >
            <div className="w-2 h-2 rounded-full bg-black/80" />
          </div>
        </div>

        {/* Pitch Footer Toolbar */}
        <div className="mt-3 flex items-center justify-between text-xs text-yellow-100/60">
          <span>* Arraste os jogadores e a bola livremente pelo campo para simular movimentações.</span>
          <button
            onClick={() => setupFormations(formationA, formationB)}
            className="text-yellow-400 hover:text-yellow-300 font-bold flex items-center gap-1 cursor-pointer"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Resetar Posições
          </button>
        </div>
      </div>

      {/* Tactical Notes */}
      <div className="bg-[#2a0101]/60 border border-yellow-900/40 rounded-2xl p-4 space-y-2">
        <label className="block text-xs font-bold text-yellow-400 uppercase tracking-wider">
          Observações & Orientações da Prancheta
        </label>
        <textarea
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Descreva as instruções táticas, movimentos de pressão ou diretrizes para esta prancheta..."
          className="w-full bg-black/40 border border-yellow-900/50 rounded-xl p-3 text-xs text-yellow-50 focus:border-yellow-500 focus:outline-none"
        />
      </div>

      {/* Saved Boards Modal */}
      {isSavedListOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-[#1a0000] border border-yellow-500/40 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-yellow-900/40 pb-3">
              <h3 className="text-base font-bold text-yellow-200">Pranchetas Salvas</h3>
              <button
                onClick={() => setIsSavedListOpen(false)}
                className="text-yellow-200/50 hover:text-yellow-100 text-sm"
              >
                ✕
              </button>
            </div>

            {savedBoards.length === 0 ? (
              <div className="text-center py-6 text-xs text-yellow-100/60">
                Nenhuma prancheta salva até o momento.
              </div>
            ) : (
              <div className="space-y-2">
                {savedBoards.map((b) => (
                  <div
                    key={b.id}
                    className="p-3 bg-black/40 border border-yellow-900/30 rounded-xl flex items-center justify-between hover:border-yellow-500/40 transition-colors"
                  >
                    <div>
                      <h4 className="text-xs font-bold text-white">{b.title}</h4>
                      <span className="text-[10px] text-yellow-200/50 font-mono">
                        {b.formationA} vs {b.formationB} · {new Date(b.createdAt).toLocaleDateString('pt-BR')}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleLoadBoard(b)}
                        className="px-2.5 py-1 bg-yellow-500 text-black text-xs font-bold rounded-lg cursor-pointer"
                      >
                        Carregar
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteBoard(b.id)}
                        className="text-yellow-100/30 hover:text-red-400 p-1"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
