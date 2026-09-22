import type { Analysis, AnalysisHistoryItem, VerifiedVideoContext } from '../types';
import type { AnalysisRequest } from '../components/UrlInputForm';

export function getStoredToken(): string | null {
  const token = localStorage.getItem('protatica_auth');
  if (!token || token === 'true' || token === 'false') {
    if (token === 'true' || token === 'false') {
      localStorage.removeItem('protatica_auth');
      localStorage.removeItem('protatica_user');
    }
    return null;
  }
  return token;
}

export function clearToken(): void {
  localStorage.removeItem('protatica_auth');
  localStorage.removeItem('protatica_user');
}

export function getAuthHeaders(): Record<string, string> {
  const token = getStoredToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function verifyAuthSession(): Promise<any | null> {
  const token = getStoredToken();
  if (!token) return null;
  try {
    const res = await fetch('/api/me', {
      headers: getAuthHeaders(),
    });
    if (res.ok) {
      const data = await res.json();
      return data.user || null;
    }
    if (res.status === 401) {
      clearToken();
    }
    return null;
  } catch {
    return null;
  }
}

export async function verifyVideo(url: string): Promise<VerifiedVideoContext> {
  const response = await fetch('/api/verify-video', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Não foi possível confirmar a identidade do vídeo.');
  }

  const data = await response.json();
  return data.verifiedContext;
}

export async function loginWithPassword(username: string, password: string): Promise<any> {
  const response = await fetch('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Senha ou acesso inválido.');
  }
  const data = await response.json();
  if (data.token) {
    localStorage.setItem('protatica_auth', data.token);
  }
  if (data.user) {
    localStorage.setItem('protatica_user', JSON.stringify(data.user));
  }
  return data.user;
}

export async function changePassword(userId: string, oldPassword: string, newPassword: string): Promise<void> {
  const response = await fetch('/api/user/change-password', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify({ userId, oldPassword, newPassword }),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Erro ao redefinir sua senha.');
  }
}

export async function requestPasswordReset(email: string): Promise<any> {
  const response = await fetch('/api/auth/forgot-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(data?.error || data?.message || 'Erro ao processar sua solicitação.');
  }
  return data;
}

export async function validateResetToken(token: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const response = await fetch(`/api/auth/validate-reset-token?token=${encodeURIComponent(token)}`);
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      return { ok: false, error: data?.error || data?.message || 'Link de redefinição inválido ou expirado.' };
    }
    return data || { ok: true };
  } catch (err: any) {
    return { ok: false, error: err.message || 'Erro de conexão.' };
  }
}

export async function resetPasswordWithToken(token: string, password: string): Promise<any> {
  const response = await fetch('/api/auth/reset-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, password }),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(data?.error || data?.message || 'Erro ao redefinir a senha.');
  }
  return data;
}

export async function deleteAnalysis(id: string): Promise<void> {
  const response = await fetch(`/api/analyses?id=${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  if (!response.ok) throw new Error('Não foi possível remover a análise.');
}

export async function fetchAllFullAnalyses(): Promise<Analysis[]> {
  const token = getStoredToken();
  if (!token) return [];
  const response = await fetch('/api/analyses?full=true', {
    headers: getAuthHeaders(),
  });
  if (response.status === 401) {
    clearToken();
    return [];
  }
  if (!response.ok) throw new Error('Não foi possível carregar os comparativos.');
  const data = await response.json();
  return data.analyses || [];
}

export async function fetchAnalysisHistory(): Promise<AnalysisHistoryItem[]> {
  const token = getStoredToken();
  if (!token) return [];
  const response = await fetch('/api/analyses', {
    headers: getAuthHeaders(),
  });
  if (response.status === 401) {
    clearToken();
    return [];
  }
  if (!response.ok) throw new Error('Não foi possível carregar o histórico.');
  const data = await response.json();
  return data.analyses || [];
}

export async function fetchSavedAnalysis(id: string): Promise<Analysis> {
  const response = await fetch(`/api/analyses?id=${encodeURIComponent(id)}`, {
    headers: getAuthHeaders(),
  });
  if (response.status === 401) {
    clearToken();
    throw new Error('Sessão expirada. Faça login novamente.');
  }
  if (!response.ok) throw new Error('Análise não encontrada.');
  const data = await response.json();
  return data.analysis;
}

export async function analyzeFootballMatch(
  request: AnalysisRequest,
  onProgress?: (step: string, pct: number | null) => void
): Promise<Analysis> {
  const progressTimers: any[] = [];
  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  if (onProgress) {
    onProgress('Enviando o trecho do vídeo para a inteligência artificial...', null);

    progressTimers.push(setTimeout(() => {
      onProgress('Processando o conteúdo visual do vídeo...', null);
    }, 15000));

    progressTimers.push(setTimeout(() => {
      onProgress('Analisando organização tática, eventos e transições...', null);
    }, 60000));

    progressTimers.push(setTimeout(() => {
      onProgress('A análise continua em processamento. Não feche esta tela...', null);
    }, 180000));
  }

  const sendRequest = async (): Promise<Response> => {
    if (request.type === 'file') {
      const formData = new FormData();
      formData.append('videoFile', request.file);
      formData.append('mode', request.mode || 'quick');
      formData.append('clipStartSeconds', String(request.clipStartSeconds || 0));
      formData.append('clipEndSeconds', String(request.clipEndSeconds || 900));

      return fetch('/api/analyze', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: formData,
      });
    }

    const body = {
      type: 'url',
      url: request.url,
      mode: request.mode || 'quick',
      clipStartSeconds: request.clipStartSeconds || 0,
      clipEndSeconds: request.clipEndSeconds || 900,
    };

    return fetch('/api/analyze', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify(body),
    });
  };

  try {
    const maxCycles = 3;
    let lastMessage = 'A inteligência artificial está temporariamente indisponível.';

    for (let cycle = 1; cycle <= maxCycles; cycle++) {
      if (onProgress && cycle > 1) {
        onProgress(
          `Nova tentativa automática ${cycle}/${maxCycles} iniciada...`,
          null
        );
      }

      const response = await sendRequest();

      if (response.ok) {
        const data = await response.json();
        if (onProgress) onProgress('Concluído!', 100);
        return data.analysis;
      }

      const error = await response.json().catch(() => ({}));
      lastMessage = error?.error || 'Erro ao processar análise.';

      const retryable =
        Boolean(error?.retryable) &&
        (response.status === 429 || response.status === 503);

      if (!retryable || cycle >= maxCycles) {
        throw new Error(lastMessage);
      }

      const fallbackDelays = [8, 20, 45];
      const requestedDelay = Number(error?.retryAfterSeconds || 0);
      const waitSeconds = Math.min(
        60,
        Math.max(
          fallbackDelays[Math.min(cycle - 1, fallbackDelays.length - 1)],
          Number.isFinite(requestedDelay) ? requestedDelay : 0
        )
      );

      for (let remaining = waitSeconds; remaining > 0; remaining--) {
        if (onProgress) {
          onProgress(
            `IA do Google temporariamente ocupada. Nova tentativa automática em ${remaining}s.`,
            null
          );
        }
        await sleep(1000);
      }
    }

    throw new Error(lastMessage);
  } finally {
    for (const timer of progressTimers) {
      clearTimeout(timer);
    }
  }
}
