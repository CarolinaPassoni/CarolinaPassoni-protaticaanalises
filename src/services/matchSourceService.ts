import type { Match } from '../types';
import { getAuthHeaders } from './geminiService';

export interface MatchSourceResolution {
  match: Match;
  sourceTitle?: string;
  confidence?: number;
  cached?: boolean;
}

export const resolveMatchVideoSource = async (match: Match): Promise<MatchSourceResolution> => {
  if (match.videoUrl?.trim()) {
    return { match, cached: true, confidence: 100 };
  }

  const response = await fetch(`/api/matches/${encodeURIComponent(match.id)}/resolve-video`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || 'Não foi possível localizar automaticamente um vídeo confiável desta partida.');
  }

  if (!data?.match?.videoUrl) {
    throw new Error('A busca automática não encontrou um vídeo confiável desta partida.');
  }

  return data as MatchSourceResolution;
};
