import express from 'express';
import http from 'http';
import path, { join } from 'path';
import { randomUUID, randomBytes, createHash } from 'crypto';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'fs';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import multer from 'multer';
import { normalizeAnalysisResponse } from './src/utils/normalizeAnalysis.js';
import { generateAnalysisPdf, sanitizeFilename, getAnalysisPdfFilename } from './src/services/pdfService.js';
import {
  saveAnalysis,
  listAnalyses,
  getAnalysisById,
  getPublicAnalysisById,
  enrichAnalysisFromDb,
  verifyUserCredentials,
  findUserByUsername,
  findUserByEmail,
  findUserById,
  deleteAnalysisFromDb,
  listAllFullAnalyses,
  countAnalysesForUserSince,
  getSetting,
  setSetting,
  createUserWithPassword,
  listAllUsers,
  deleteUserFromDb,
  updateUserPasswordInDb,
  createAuthSession,
  verifyAuthSessionToken,
  deleteAuthSession,
  getPlayerPhotoCache,
  setPlayerPhotoCache,
  deletePlayerPhotoCache,
  createTrialUser,
  createVerificationToken,
  inspectVerificationToken,
  validateVerificationToken,
  verifyAndConsumeToken,
  activateTrialAfterVerification,
  activateTrialWithPassword,
  updateUserPassword,
  logSubscriptionEvent,
  logAdminAudit,
  activatePaidSubscription,
  adminExtendTrial,
  adminToggleBlockUser,
  listAllSubscriptionsAdmin,
  listSubscriptionEvents,
  listEmailLogs,
  saveTrainingPlan,
  listTrainingPlans,
  deleteTrainingPlan,
  saveTacticalBoard,
  listTacticalBoards,
  deleteTacticalBoard,
  saveEvidenceItem,
  listSavedEvidences,
  deleteSavedEvidence,
  saveTeamGoal,
  listTeamGoals,
  deleteTeamGoal,
  saveTeam,
  listTeams,
  deleteTeam,
  saveOpponentDossier,
  listOpponentDossiers,
  deleteOpponentDossier,
  listCompetitions,
  getCompetitionById,
  saveCompetition,
  deleteCompetition,
  listMatches,
  getMatchById,
  saveMatch,
  linkMatchAnalysis,
  deleteMatch,
  listPlayerCatalog,
  getPlayerCatalogEntry,
  savePlayerCatalogEntry,
  deletePlayerCatalogEntry,
  updateAnalysisVisibility,
  listPublicAnalyses,
} from './src/db-sqlite.js';
import {
  getTelegramConfig,
  saveTelegramConfig,
  testTelegramConnection,
  publishAnalysis,
  handleTelegramWebhook,
  listTelegramMessages,
  clearTelegramMessages,
} from './src/services/telegramService.js';
import {
  sendTrialVerificationEmail,
  sendTrialActivatedEmail,
  sendPaidAccessCredentialsEmail,
  sendTrialExpiringAlertEmail,
  sendTrialExpiredEmail,
  sendPasswordResetEmail,
  verifySmtpConnection,
  sendEmail,
} from './src/services/emailService.js';
import {
  notifyTrialRequested,
  notifyTrialActivated,
  notifySubscriptionPaid,
  notifyTrialExpiringSoon,
} from './src/services/notificationService.js';
import { getOfficialPlanById, OFFICIAL_PLANS } from './src/utils/plans.js';
import { checkRateLimit } from './src/utils/rateLimiter.js';
import {
  processMultimodalVideoEvidence,
  normalizeTeamName,
  formatSecondsToTimestamp,
} from './src/services/videoExtractor.js';
import Stripe from 'stripe';
import nodemailer from 'nodemailer';

const app = express();
const PORT = Number(process.env.PORT || 3000);

// Setup upload parser for local video files
const upload = multer({
  dest: '/tmp/protatica_uploads/',
  limits: { fileSize: 750 * 1024 * 1024 } // 750 MB
});

const VALID_MODELS = new Set([
  'gemini-3.7-flash',
  'gemini-3.7-pro',
  'gemini-2.0-flash',
  'gemini-3.1-flash-lite',
  'gemini-flash-latest',
]);

const sanitizeModelName = (modelName?: string): string => {
  if (!modelName) return 'gemini-3.7-flash';
  let m = modelName.trim();
  if (m.startsWith('models/')) {
    m = m.replace(/^models\//, '');
  }
  if (m.startsWith('AQ.') || m.startsWith('AIza') || !m.startsWith('gemini-')) {
    return 'gemini-3.7-flash';
  }
  if (m === 'gemini-2.5-flash' || m === 'gemini-3.6-flash' || m === 'gemini-1.5-flash' || m === 'gemini-1.5-pro' || m === 'gemini-3.5-flash') {
    return 'gemini-3.7-flash';
  }
  if (VALID_MODELS.has(m) || m.startsWith('gemini-3.7-') || m.startsWith('gemini-2.0-')) {
    return m;
  }
  return 'gemini-3.7-flash';
};

export const GEMINI_MODEL = sanitizeModelName(process.env.GEMINI_MODEL);

export const getGeminiApiKey = (): string => {
  const key = String(process.env.GEMINI_API_KEY || '').trim();
  if (key && !key.startsWith('MY_GEMINI')) return key;
  return '';
};

app.use(express.json({
  limit: '50mb',
  verify: (req: any, _res, buf) => {
    // Stripe requires the exact raw request body to validate webhook signatures.
    if (req.originalUrl === '/api/stripe/webhook') req.rawBody = Buffer.from(buf);
  },
}));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Render/hosting health check. Keep this route independent from AI, SMTP and billing.
app.get('/healthz', (_req, res) => {
  res.status(200).json({ status: 'ok', service: 'protatica' });
});

const getPublicAppUrl = (): string => {
  const candidate = String(process.env.APP_PUBLIC_URL || process.env.APP_URL || '').trim();
  if (candidate) {
    try {
      const parsed = new URL(candidate);
      if (parsed.protocol === 'https:' || (process.env.NODE_ENV !== 'production' && parsed.protocol === 'http:')) {
        return parsed.origin;
      }
    } catch {}
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error('APP_PUBLIC_URL é obrigatório em produção.');
  }
  return `http://localhost:${PORT}`;
};

const getClientIp = (req: express.Request): string => {
  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return forwarded || req.ip || req.socket.remoteAddress || 'unknown';
};

const enforceRateLimit = (req: express.Request, res: express.Response, keyPrefix: string, max: number, windowSeconds: number) => {
  const result = checkRateLimit(`${keyPrefix}:${getClientIp(req)}`, max, windowSeconds);
  if (!result.allowed) {
    res.setHeader('Retry-After', String(result.retryAfterSeconds));
    res.status(429).json({ error: 'Muitas tentativas. Aguarde antes de tentar novamente.' });
    return false;
  }
  return true;
};

const getAnalysisOwnerScope = (user: any): string | undefined =>
  user && user.role !== 'admin' ? user.id : undefined;

const getPlanTier = (user: any): 'scout' | 'performance' | 'intelligence' | 'club' | 'unknown' => {
  const value = String(user?.subscription_plan || '').toLowerCase();
  if (value.includes('club')) return 'club';
  if (value.includes('intelligence') || value.includes('elite')) return 'intelligence';
  if (value.includes('performance') || value.includes('pro')) return 'performance';
  if (value.includes('scout') || value.includes('bronze')) return 'scout';
  return 'unknown';
};

// --- AUTHENTICATION & SUBSCRIPTION MIDDLEWARE ---
export const getAuthUser = (req: express.Request): any => {
  const authHeader = req.headers.authorization || req.headers['x-auth-token'];
  if (!authHeader) return null;
  const token = typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
    ? authHeader.slice(7).trim()
    : String(authHeader).trim();
  if (!token) return null;
  return verifyAuthSessionToken(token);
};

export const requireAuth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const user = getAuthUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Acesso não autorizado. Faça login para continuar.' });
  }
  (req as any).user = user;
  next();
};

export const requireAdmin = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const user = getAuthUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Acesso restrito ao administrador.' });
  }
  if (user.role !== 'admin') {
    return res.status(403).json({ error: 'Permissão de administrador necessária.' });
  }
  (req as any).user = user;
  next();
};

export const requireActiveSubscription = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const user = (req as any).user || getAuthUser(req);
  if (!user) {
    console.log('[ANALYZE BLOCKED] reason=unauthenticated');
    return res.status(401).json({ error: 'Acesso não autorizado. Faça login para continuar.' });
  }

  // Admin always has full bypass access
  if (user.role === 'admin') {
    (req as any).user = user;
    return next();
  }

  // If blocked by admin
  if (user.is_blocked || user.isBlocked) {
    console.log(`[ANALYZE BLOCKED] reason=account_blocked userId=${user.id}`);
    return res.status(403).json({
      error: 'Seu acesso foi suspenso pela administração do ProTática.',
      code: 'ACCOUNT_BLOCKED',
    });
  }

  const now = new Date().getTime();

  // If user is paid
  if (user.account_type === 'paid' || user.accountType === 'paid') {
    const expStr = user.subscription_expires_at || user.subscriptionExpiresAt;
    if (expStr && now > new Date(expStr).getTime()) {
      console.log(`[ANALYZE BLOCKED] reason=subscription_expired userId=${user.id}`);
      return res.status(403).json({
        error: 'Sua assinatura expirou. Renove seu plano para continuar executando análises.',
        code: 'SUBSCRIPTION_EXPIRED',
        requiresRenewal: true,
      });
    }
    (req as any).user = user;
    return next();
  }

  // If user is trial
  const trialStatus = user.trial_status || user.trialStatus;
  if (trialStatus === 'pending_verification') {
    console.log(`[ANALYZE BLOCKED] reason=trial_pending_verification userId=${user.id}`);
    return res.status(403).json({
      error: 'Confirme seu e-mail para ativar seus 7 dias de teste grátis.',
      code: 'TRIAL_PENDING_VERIFICATION',
    });
  }

  const trialExpStr = user.trial_expires_at || user.trialExpiresAt;
  if (trialExpStr && now > new Date(trialExpStr).getTime()) {
    console.log(`[ANALYZE BLOCKED] reason=trial_expired userId=${user.id}`);
    return res.status(403).json({
      error: 'Seu período de teste grátis de 7 dias expirou. Escolha um plano para continuar aproveitando a plataforma.',
      code: 'TRIAL_EXPIRED',
      trialExpired: true,
    });
  }

  if (trialStatus === 'expired') {
    console.log(`[ANALYZE BLOCKED] reason=trial_expired userId=${user.id}`);
    return res.status(403).json({
      error: 'Seu período de teste grátis de 7 dias expirou. Escolha um plano para continuar aproveitando a plataforma.',
      code: 'TRIAL_EXPIRED',
      trialExpired: true,
    });
  }

  (req as any).user = user;
  next();
};

const requirePlanAtLeast = (minimum: 'scout' | 'performance' | 'intelligence') => {
  const rank: Record<string, number> = { unknown: 0, scout: 1, performance: 2, intelligence: 3, club: 4 };
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const user = (req as any).user || getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Faça login para continuar.' });
    if (user.role === 'admin' || user.account_type === 'trial') {
      (req as any).user = user;
      return next();
    }
    const tier = getPlanTier(user);
    if ((rank[tier] || 0) < rank[minimum]) {
      return res.status(403).json({
        error: `Este recurso requer o plano ${minimum === 'performance' ? 'Performance' : minimum === 'intelligence' ? 'Intelligence' : 'Scout'} ou superior.`,
        code: 'PLAN_FEATURE_RESTRICTED',
        currentTier: tier,
        requiredTier: minimum,
      });
    }
    (req as any).user = user;
    next();
  };
};

// --- UTILS ---
export const extractVideoId = (rawUrl: string): string | null => {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  const str = rawUrl.trim();
  if (!str) return null;

  try {
    const safeUrl = /^https?:\/\//i.test(str) ? str : `https://${str}`;
    const u = new URL(safeUrl);

    // 1. Check search parameter 'v' (e.g. youtube.com/watch?v=ID)
    const vParam = u.searchParams.get('v');
    if (vParam) {
      const cleanV = vParam.split(/[?&#]/)[0].trim();
      if (/^[a-zA-Z0-9_-]{11}$/.test(cleanV)) return cleanV;
    }

    // 2. Check youtu.be shortlinks (e.g. youtu.be/ID)
    if (u.hostname.toLowerCase().includes('youtu.be')) {
      const pathSeg = u.pathname.split('/').filter(Boolean)[0];
      if (pathSeg) {
        const cleanSeg = pathSeg.split(/[?&#]/)[0].trim();
        if (/^[a-zA-Z0-9_-]{11}$/.test(cleanSeg)) return cleanSeg;
      }
    }

    // 3. Check segments like /shorts/ID, /embed/ID, /live/ID, /v/ID
    const parts = u.pathname.split('/').filter(Boolean);
    const pickAfter = (segment: string) => {
      const idx = parts.findIndex((p) => p.toLowerCase() === segment.toLowerCase());
      if (idx >= 0 && parts[idx + 1]) {
        return parts[idx + 1].split(/[?&#]/)[0].trim();
      }
      return null;
    };

    const pathId = pickAfter('shorts') || pickAfter('embed') || pickAfter('live') || pickAfter('v');
    if (pathId && /^[a-zA-Z0-9_-]{11}$/.test(pathId)) {
      return pathId;
    }

    // 4. If direct 11-char ID
    if (/^[a-zA-Z0-9_-]{11}$/.test(str)) {
      return str;
    }
  } catch {
    const directMatch = str.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?|shorts|live)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i);
    if (directMatch && directMatch[1]) {
      return directMatch[1];
    }
  }

  return null;
};

export interface VerifiedVideoContext {
  sourceUrl: string;
  videoId: string;
  title: string;
  channelTitle?: string;
  duration?: number;
  verifiedAt: string;
  thumbnailUrl?: string;
}

export const fetchYouTubeVideoMetadata = async (rawUrl: string, videoId: string) => {
  let title = '';
  let channelTitle = '';
  const canonicalUrl = `https://www.youtube.com/watch?v=${videoId}`;

  try {
    const endpoint = `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(canonicalUrl)}`;
    const r = await fetch(endpoint);
    if (r.ok) {
      const data = await r.json();
      if (data?.title) title = String(data.title).trim();
      if (data?.author_name) channelTitle = String(data.author_name).trim();
    }
  } catch (err) {
    console.warn('[METADATA] oEmbed warning:', err);
  }

  if (!title || !channelTitle) {
    try {
      const pageRes = await fetch(canonicalUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' }
      });
      if (pageRes.ok) {
        const html = await pageRes.text();
        if (!title) {
          const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
          if (titleMatch && titleMatch[1]) {
            title = titleMatch[1].replace(/\s*-\s*YouTube$/i, '').trim();
          }
        }
        if (!channelTitle) {
          const channelMatch = html.match(/"author":\s*"([^"]+)"/i) || html.match(/"ownerChannelName":\s*"([^"]+)"/i);
          if (channelMatch && channelMatch[1]) {
            channelTitle = channelMatch[1].trim();
          }
        }
      }
    } catch (pageErr) {
      console.warn('[METADATA] HTML title fallback warning:', pageErr);
    }
  }

  return {
    videoId,
    title: title || 'Partida de Futebol',
    channelTitle: channelTitle || 'YouTube',
    canonicalUrl,
    thumbnailUrl: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`
  };
};

export const verifyVideoIdentity = async (rawUrl: string): Promise<VerifiedVideoContext> => {
  const cleanUrl = String(rawUrl || '').trim();
  const videoId = extractVideoId(cleanUrl);
  if (!videoId) {
    throw new Error('URL de vídeo inválida ou não suportada. É necessário um link válido do YouTube.');
  }

  const meta = await fetchYouTubeVideoMetadata(cleanUrl, videoId);
  return {
    sourceUrl: cleanUrl,
    videoId: meta.videoId,
    title: meta.title,
    channelTitle: meta.channelTitle,
    verifiedAt: new Date().toISOString(),
    thumbnailUrl: meta.thumbnailUrl
  };
};

const tryRepairTruncatedJson = (jsonString: string): string => {
  let s = jsonString.trim();
  let inString = false;
  let isEscaped = false;
  const stack: ('{' | '[')[] = [];
  
  for (let i = 0; i < s.length; i++) {
    const char = s[i];
    if (isEscaped) {
      isEscaped = false;
      continue;
    }
    if (char === '\\') {
      isEscaped = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (!inString) {
      if (char === '{') stack.push('{');
      else if (char === '[') stack.push('[');
      else if (char === '}') {
        if (stack[stack.length - 1] === '{') stack.pop();
      } else if (char === ']') {
        if (stack[stack.length - 1] === '[') stack.pop();
      }
    }
  }

  if (inString) s += '"';

  let lastLength = 0;
  while (s.length !== lastLength) {
    lastLength = s.length;
    s = s.trim();
    if (s.endsWith(',')) {
      s = s.slice(0, -1);
      continue;
    }
    const trailingKeyColon = /,\s*"[^"]*"\s*:\s*$/;
    if (trailingKeyColon.test(s)) {
      s = s.replace(trailingKeyColon, '');
      continue;
    }
    const trailingKeyColonNoComma = /{\s*"[^"]*"\s*:\s*$/;
    if (trailingKeyColonNoComma.test(s)) {
      s = s.replace(/"[^"]*"\s*:\s*$/, '');
      continue;
    }
  }

  const finalStack: ('{' | '[')[] = [];
  inString = false;
  isEscaped = false;
  for (let i = 0; i < s.length; i++) {
    const char = s[i];
    if (isEscaped) {
      isEscaped = false;
      continue;
    }
    if (char === '\\') {
      isEscaped = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (!inString) {
      if (char === '{') finalStack.push('{');
      else if (char === '[') finalStack.push('[');
      else if (char === '}') {
        if (finalStack[finalStack.length - 1] === '{') finalStack.pop();
      } else if (char === ']') {
        if (finalStack[finalStack.length - 1] === '[') finalStack.pop();
      }
    }
  }

  while (finalStack.length > 0) {
    const last = finalStack.pop();
    if (last === '{') {
      s = s.trim();
      if (s.endsWith(',')) s = s.slice(0, -1);
      s += '}';
    } else if (last === '[') {
      s = s.trim();
      if (s.endsWith(',')) s = s.slice(0, -1);
      s += ']';
    }
  }

  return s;
};

const parseJsonResponse = (text: string) => {
  if (!text) return null;
  try {
    let cleaned = text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim();
    const startObj = cleaned.indexOf('{');
    const endObj = cleaned.lastIndexOf('}');
    if (startObj >= 0 && endObj > startObj) {
      cleaned = cleaned.substring(startObj, endObj + 1);
    }
    return JSON.parse(cleaned);
  } catch {
    // Normal JSON parse failed, moving to repair
  }

  try {
    let cleaned = text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim();
    const startObj = cleaned.indexOf('{');
    if (startObj < 0) return null;
    const endObj = cleaned.lastIndexOf('}');
    if (endObj > startObj) {
      cleaned = cleaned.substring(startObj, endObj + 1);
    } else {
      cleaned = cleaned.substring(startObj);
    }

    let corrected = '';
    let inString = false;
    let escapeActive = false;
    
    for (let i = 0; i < cleaned.length; i++) {
      const char = cleaned[i];
      if (char === '"' && !escapeActive) {
        inString = !inString;
        corrected += char;
      } else if (char === '\\' && inString && !escapeActive) {
        escapeActive = true;
        corrected += char;
      } else if (inString && (char === '\n' || char === '\r')) {
        corrected += '\\n';
        if (char === '\r' && cleaned[i + 1] === '\n') i++;
      } else {
        corrected += char;
        escapeActive = false;
      }
    }

    try {
      return JSON.parse(corrected);
    } catch {}

    const extraCleaned = corrected
      .replace(/,\s*([}\]])/g, '$1')
      .replace(/\/\*[\s\S]*?\*\/|([^\\:]|^)\/\/.*$/gm, '$1');

    try {
      return JSON.parse(extraCleaned);
    } catch {}

    const repaired = tryRepairTruncatedJson(extraCleaned);
    return JSON.parse(repaired);
  } catch (err) {
    console.error('Falha crítica de parse JSON da IA:', err);
    return null;
  }
};

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    timeA: { type: Type.STRING },
    timeB: { type: Type.STRING },
    placar: { type: Type.STRING },
    placarAuditoria: {
      type: Type.OBJECT,
      properties: {
        placarVisivel: { type: Type.STRING },
        placarFinal: { type: Type.STRING },
        fontePlacar: { type: Type.STRING },
        confianca: { type: Type.STRING, description: 'Valores permitidos: alta, media, baixa' },
        observacoes: { type: Type.STRING },
        evidencias: { type: Type.ARRAY, items: { type: Type.STRING } }
      }
    },
    resumoPartida: { type: Type.STRING },
    momentosChave: { type: Type.STRING },
    contextoPartida: {
      type: Type.OBJECT,
      properties: {
        competicao: { type: Type.STRING },
        temporada: { type: Type.STRING },
        fase: { type: Type.STRING },
        dataJogo: { type: Type.STRING },
        estadio: { type: Type.STRING },
        cidade: { type: Type.STRING },
        arbitro: { type: Type.STRING },
        publico: { type: Type.STRING },
        condicoesClimaticas: { type: Type.STRING }
      }
    },
    formacoes: {
      type: Type.OBJECT,
      properties: {
        timeA: {
          type: Type.OBJECT,
          properties: {
            esquema: { type: Type.STRING },
            titulares: { type: Type.ARRAY, items: { type: Type.STRING } },
            destaquesFuncionais: { type: Type.STRING }
          }
        },
        timeB: {
          type: Type.OBJECT,
          properties: {
            esquema: { type: Type.STRING },
            titulares: { type: Type.ARRAY, items: { type: Type.STRING } },
            destaquesFuncionais: { type: Type.STRING }
          }
        }
      }
    },
    faseDefensiva: {
      type: Type.OBJECT,
      properties: {
        timeA: {
          type: Type.OBJECT,
          properties: {
            posicionamento: { type: Type.STRING },
            compactacao_pressao: { type: Type.STRING },
            transicao: { type: Type.STRING }
          }
        },
        timeB: {
          type: Type.OBJECT,
          properties: {
            posicionamento: { type: Type.STRING },
            compactacao_pressao: { type: Type.STRING },
            transicao: { type: Type.STRING }
          }
        }
      }
    },
    faseOfensiva: {
      type: Type.OBJECT,
      properties: {
        timeA: {
          type: Type.OBJECT,
          properties: {
            saidaDeBola: { type: Type.STRING },
            criacao: { type: Type.STRING },
            finalizacao_movimentacao: { type: Type.STRING }
          }
        },
        timeB: {
          type: Type.OBJECT,
          properties: {
            saidaDeBola: { type: Type.STRING },
            criacao: { type: Type.STRING },
            finalizacao_movimentacao: { type: Type.STRING }
          }
        }
      }
    },
    estatisticas: {
      type: Type.OBJECT,
      properties: {
        posseDeBola: {
          type: Type.OBJECT,
          properties: {
            timeA: { type: Type.STRING },
            timeB: { type: Type.STRING }
          }
        },
        finalizacoes: {
          type: Type.OBJECT,
          properties: {
            timeA: { type: Type.STRING },
            timeB: { type: Type.STRING }
          }
        },
        finalizacoesNoAlvo: {
          type: Type.OBJECT,
          properties: {
            timeA: { type: Type.STRING },
            timeB: { type: Type.STRING }
          }
        },
        passesCertos: {
          type: Type.OBJECT,
          properties: {
            timeA: { type: Type.STRING },
            timeB: { type: Type.STRING }
          }
        },
        faltasCometidas: {
          type: Type.OBJECT,
          properties: {
            timeA: { type: Type.STRING },
            timeB: { type: Type.STRING }
          }
        },
        desarmes: {
          type: Type.OBJECT,
          properties: {
            timeA: { type: Type.STRING },
            timeB: { type: Type.STRING }
          }
        },
        escanteios: {
          type: Type.OBJECT,
          properties: {
            timeA: { type: Type.STRING },
            timeB: { type: Type.STRING }
          }
        },
        impedimentos: {
          type: Type.OBJECT,
          properties: {
            timeA: { type: Type.STRING },
            timeB: { type: Type.STRING }
          }
        },
        mapaDeCalor: {
          type: Type.OBJECT,
          properties: {
            timeA: {
              type: Type.OBJECT,
              properties: {
                tercoDefensivo: { type: Type.STRING },
                tercoMedio: { type: Type.STRING },
                tercoOfensivo: { type: Type.STRING }
              }
            },
            timeB: {
              type: Type.OBJECT,
              properties: {
                tercoDefensivo: { type: Type.STRING },
                tercoMedio: { type: Type.STRING },
                tercoOfensivo: { type: Type.STRING }
              }
            }
          }
        }
      }
    },
    indicadoresAvancados: {
      type: Type.OBJECT,
      properties: {
        xG: {
          type: Type.OBJECT,
          properties: {
            timeA: { type: Type.STRING },
            timeB: { type: Type.STRING }
          }
        },
        grandesChances: {
          type: Type.OBJECT,
          properties: {
            timeA: { type: Type.STRING },
            timeB: { type: Type.STRING }
          }
        },
        passesTercoFinal: {
          type: Type.OBJECT,
          properties: {
            timeA: { type: Type.STRING },
            timeB: { type: Type.STRING }
          }
        }
      }
    },
    analiseJogadores: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          visualId: { type: Type.STRING },
          shirtNumber: { type: Type.STRING },
          probableName: { type: Type.STRING },
          confirmedName: { type: Type.STRING },
          identificationConfidence: { type: Type.STRING, description: 'alta, media, baixa' },
          identificationSource: { type: Type.STRING },
          identificacao: { type: Type.STRING },
          nome: { type: Type.STRING },
          time: { type: Type.STRING },
          posicao: { type: Type.STRING },
          camisa: { type: Type.STRING },
          nivelConfianca: { type: Type.STRING, description: 'Valores permitidos: alta, media, baixa' },
          analise: { type: Type.STRING },
          acoesPercebidas: { type: Type.ARRAY, items: { type: Type.STRING } },
          pontosFortes: { type: Type.ARRAY, items: { type: Type.STRING } },
          pontosAtencao: { type: Type.ARRAY, items: { type: Type.STRING } }
        }
      }
    },
    linhaDoTempo: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          minuto: { type: Type.STRING },
          time: { type: Type.STRING },
          tipo: { type: Type.STRING },
          descricao: { type: Type.STRING },
          impactoTatico: { type: Type.STRING },
          evidenceSource: { type: Type.STRING },
          confidence: { type: Type.STRING }
        }
      }
    },
    conclusaoRecomendacoes: { type: Type.STRING },
    verificacaoAuditoria: {
      type: Type.OBJECT,
      properties: {
        partidaIdentificada: { type: Type.STRING },
        fontesPrincipais: { type: Type.ARRAY, items: { type: Type.STRING } },
        observacoes: { type: Type.STRING },
        nivelConfianca: { type: Type.STRING, description: 'Valores permitidos: alta, media, baixa' },
        segmentosAnalisados: { type: Type.STRING },
        estrategiaAnalise: { type: Type.STRING }
      }
    }
  },
  required: [
    'timeA',
    'timeB',
    'placar',
    'placarAuditoria',
    'resumoPartida',
    'momentosChave',
    'contextoPartida',
    'formacoes',
    'faseDefensiva',
    'faseOfensiva',
    'estatisticas',
    'analiseJogadores',
    'linhaDoTempo',
    'conclusaoRecomendacoes',
    'verificacaoAuditoria'
  ]
};

// --- STRIPE SDK INTEGRATION ---
function getStripeClient(): Stripe {
  const envKey = String(process.env.STRIPE_SECRET_KEY || '').trim();
  const storedKey = String(getSetting('stripe_secret_key') || '').trim();
  const secretKey = envKey || (process.env.NODE_ENV !== 'production' ? storedKey : '');
  if (!secretKey) {
    throw new Error('STRIPE_SECRET_KEY não configurada no servidor. Em produção, segredos não são lidos do SQLite.');
  }
  return new Stripe(secretKey);
}

async function createOfficialStripeCheckout(plan: any, authUser?: any) {
  if (!plan || plan.price <= 0 || plan.id === 'club_custom') {
    throw new Error('Este plano não está disponível para checkout automático.');
  }
  const stripe = getStripeClient();
  const origin = getPublicAppUrl();
  const metadata = {
    userId: authUser?.id || '',
    userEmail: authUser?.email || '',
    planId: plan.id,
    planName: plan.name,
    durationDays: String(plan.durationDays),
    billingCycle: plan.billingCycle,
    isTrialConversion: authUser?.account_type === 'trial' ? 'true' : 'false',
  };

  return stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    customer_email: authUser?.email || undefined,
    client_reference_id: authUser?.id || undefined,
    metadata,
    subscription_data: { metadata },
    line_items: [{
      price_data: {
        currency: 'brl',
        product_data: { name: `ProTática — ${plan.name}`, description: plan.description },
        unit_amount: Math.round(plan.price * 100),
        recurring: { interval: plan.billingCycle === 'yearly' ? 'year' : 'month' },
      },
      quantity: 1,
    }],
    mode: 'subscription',
    success_url: `${origin}/?payment_success=true&session_id={CHECKOUT_SESSION_ID}&plan=${encodeURIComponent(plan.name)}`,
    cancel_url: `${origin}/?payment_cancel=true`,
  });
}

function resolveLegacyPlanId(planName: string): string | null {
  const value = String(planName || '').toLowerCase();
  const yearly = value.includes('anual');
  if (value.includes('scout') || value.includes('bronze')) return yearly ? 'scout_yearly' : 'scout_monthly';
  if (value.includes('performance') || value.includes('profissional') || value.includes('pro')) return yearly ? 'performance_yearly' : 'performance_monthly';
  if (value.includes('intelligence') || value.includes('elite')) return yearly ? 'intelligence_yearly' : 'intelligence_monthly';
  return null;
}

// --- AUTH / USER ROUTES ---
app.post('/api/login', (req, res) => {
  if (!enforceRateLimit(req, res, 'login', 10, 15 * 60)) return;
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Usuário/e-mail e senha são obrigatórios.' });
  }

  const user = verifyUserCredentials(username, password);
  if (!user) return res.status(401).json({ error: 'E-mail / Usuário ou senha incorretos.' });

  if (user.is_blocked) {
    return res.status(403).json({ error: 'Conta bloqueada. Entre em contato com o suporte.' });
  }

  if (user.role !== 'admin' && (user.email_verified === 0 || user.trial_status === 'pending_verification')) {
    return res.status(403).json({
      error: 'Confirme seu e-mail e crie sua senha para ativar o acesso.',
      needsVerification: true,
      email: user.email || user.username,
    });
  }

  const token = createAuthSession(user.id);
  res.json({ ok: true, user, token });
});

app.post('/api/logout', (req, res) => {
  const authHeader = req.headers.authorization || req.headers['x-auth-token'];
  if (authHeader) {
    const token = typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
      ? authHeader.slice(7).trim()
      : String(authHeader).trim();
    if (token) deleteAuthSession(token);
  }
  res.json({ ok: true });
});

app.get('/api/me', (req, res) => {
  const user = getAuthUser(req);
  if (!user) return res.status(401).json({ error: 'Não autenticado.' });
  res.json({ user });
});

app.post('/api/user/change-password', requireAuth, (req, res) => {
  const { userId, oldPassword, newPassword } = req.body;
  const authUser = (req as any).user;
  if (!userId || !oldPassword || !newPassword) {
    return res.status(400).json({ error: 'Todos os campos são obrigatórios para a alteração.' });
  }
  if (authUser.id !== userId) {
    return res.status(403).json({ error: 'Você só pode alterar sua própria senha.' });
  }

  try {
    const user = findUserByUsername(authUser.username);
    if (!user) return res.status(404).json({ error: 'Usuário não encontrado.' });

    const verified = verifyUserCredentials(user.username, oldPassword);
    if (!verified) return res.status(401).json({ error: 'Sua senha atual está incorreta.' });

    const updated = updateUserPasswordInDb(userId, newPassword.trim());
    if (updated) res.json({ ok: true });
    else res.status(500).json({ error: 'Falha interna ao atualizar no banco de dados.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Erro ao redefinir sua senha.' });
  }
});

// --- PASSWORD RESET SECURE FLOW ---
const handlePasswordResetRequest = async (req: express.Request, res: express.Response) => {
  if (!enforceRateLimit(req, res, 'password_reset_request', 5, 60 * 60)) return;
  const email = String(req.body.email || '').trim().toLowerCase();
  const maskedEmail = email ? email.replace(/(?<=.{2}).(?=.*@)/g, '*') : 'empty';
  console.log(`[PASSWORD RESET] request received for ${maskedEmail}`);

  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'E-mail válido é obrigatório.' });
  }

  try {
    const user = findUserByEmail(email) || findUserByUsername(email);
    if (user) {
      console.log(`[PASSWORD RESET] user resolved: ${user.id}`);
      // Generates 1-hour expiration token (invalidates any older password_reset tokens)
      const token = createVerificationToken(user.id, 'password_reset', 1);
      console.log(`[PASSWORD RESET] token created`);

      const origin = getPublicAppUrl();
      console.log(`[PASSWORD RESET] email send started`);

      const emailResult = await sendPasswordResetEmail(
        { id: user.id, name: user.display_name, email: user.email || user.username },
        token.rawToken,
        origin
      );

      if (emailResult.success) {
        console.log(`[PASSWORD RESET] email send success`);
      } else {
        console.error(`[PASSWORD RESET][EMAIL ERROR]:`, emailResult.error);
      }
    } else {
      console.log(`[PASSWORD RESET] user not found (returning neutral response to avoid enumeration)`);
    }

    // Always return neutral response to prevent user enumeration
    return res.json({
      ok: true,
      message: 'Se houver uma conta associada a este e-mail, enviaremos um link para redefinir sua senha.',
    });
  } catch (err: any) {
    console.error('[PASSWORD RESET][ERROR]:', err);
    return res.status(500).json({ error: 'Erro ao processar solicitação de redefinição de senha.' });
  }
};

app.post('/api/auth/forgot-password', handlePasswordResetRequest);
app.post('/api/user/reset-request', handlePasswordResetRequest);

// Validate reset token before rendering form
const handleValidateResetToken = (req: express.Request, res: express.Response) => {
  console.log('[PASSWORD RESET VERIFY] request received');
  const rawToken = String(req.body?.token || req.query?.token || req.query?.reset_token || '').trim();
  const tokenPresent = Boolean(rawToken);
  console.log(`[PASSWORD RESET VERIFY] token present=${tokenPresent}`);

  if (!tokenPresent) {
    return res.status(400).json({ ok: false, error: 'Token de redefinição obrigatório.' });
  }

  const inspection = inspectVerificationToken(rawToken, 'password_reset');
  console.log(`[PASSWORD RESET VERIFY] token found=${inspection.found}`);
  console.log(`[PASSWORD RESET VERIFY] expired=${inspection.expired}`);
  console.log(`[PASSWORD RESET VERIFY] alreadyUsed=${inspection.alreadyUsed}`);

  if (!inspection.found) {
    return res.status(400).json({ ok: false, error: 'Link de redefinição inválido.' });
  }
  if (inspection.alreadyUsed) {
    return res.status(400).json({ ok: false, error: 'Este link já foi utilizado.' });
  }
  if (inspection.expired) {
    return res.status(400).json({ ok: false, error: 'Este link expirou. Solicite uma nova redefinição de senha.' });
  }

  console.log('[PASSWORD RESET VERIFY] success');
  return res.json({ ok: true, valid: true });
};

app.get(['/api/auth/validate-reset-token', '/api/user/validate-reset-token', '/api/auth/reset-password/verify'], handleValidateResetToken);
app.post(['/api/auth/validate-reset-token', '/api/user/validate-reset-token', '/api/auth/reset-password/verify'], handleValidateResetToken);

// Confirm new password
const handleResetPassword = async (req: express.Request, res: express.Response) => {
  if (!enforceRateLimit(req, res, 'password_reset_confirm', 8, 60 * 60)) return;
  const rawToken = String(req.body.token || '').trim();
  const password = String(req.body.password || '').trim();

  if (!rawToken) {
    return res.status(400).json({ error: 'Token de redefinição é obrigatório.' });
  }

  if (!password || password.length < 8) {
    return res.status(400).json({ error: 'A nova senha deve conter no mínimo 8 caracteres.' });
  }

  try {
    const tokenRecord = verifyAndConsumeToken(rawToken, 'password_reset');
    if (!tokenRecord) {
      return res.status(400).json({
        error: 'Link de redefinição inválido ou expirado. Solicite uma nova redefinição de senha.',
        code: 'INVALID_OR_EXPIRED_TOKEN',
      });
    }

    console.log(`[PASSWORD RESET] token valid`);
    const userId = tokenRecord.user_id;
    const user = findUserById(userId);
    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }

    updateUserPassword(userId, password);
    console.log(`[PASSWORD RESET] password updated`);
    logSubscriptionEvent(userId, 'password_reset_success');

    return res.json({
      ok: true,
      message: 'Senha redefinida com sucesso! Você já pode fazer login com sua nova senha.',
    });
  } catch (err: any) {
    console.error('[PASSWORD RESET][RESET ERROR]:', err);
    return res.status(500).json({ error: err.message || 'Erro ao redefinir a senha.' });
  }
};

app.post('/api/auth/reset-password', handleResetPassword);
app.post('/api/user/reset-password', handleResetPassword);

// --- ADMIN USERS ENDPOINTS ---
app.get('/api/admin/users', requireAdmin, (req, res) => {
  try {
    const list = listAllUsers();
    res.json({ users: list });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Erro ao listar usuários.' });
  }
});

app.post('/api/admin/users/create', requireAdmin, (req, res) => {
  const { username, displayName, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Usuário e senha são obrigatórios.' });
  }
  try {
    const id = createUserWithPassword(username.trim(), (displayName || username).trim(), password.trim());
    res.json({ ok: true, id });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Erro ao criar usuário.' });
  }
});

app.post('/api/admin/users/reset-password', requireAdmin, (req, res) => {
  const { id, newPassword } = req.body;
  if (!id || !newPassword) {
    return res.status(400).json({ error: 'ID do usuário e nova senha são obrigatórios.' });
  }
  try {
    const ok = updateUserPasswordInDb(id, newPassword.trim());
    if (ok) res.json({ ok: true });
    else res.status(400).json({ error: 'Usuário não encontrado.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Erro ao redefinir senha.' });
  }
});

app.post('/api/admin/users/delete', requireAdmin, (req, res) => {
  const { id } = req.body;
  if (!id) return res.status(400).json({ error: 'ID do usuário é obrigatório.' });
  try {
    const ok = deleteUserFromDb(id);
    if (ok) res.json({ ok: true });
    else res.status(400).json({ error: 'Não foi possível deletar o usuário.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Erro ao deletar usuário.' });
  }
});

// --- STRIPE & SMTP CONFIG ENDPOINTS ---
app.get('/api/stripe/config', (req, res) => {
  const user = getAuthUser(req);
  const isAdmin = Boolean(user && user.role === 'admin');

  const production = process.env.NODE_ENV === 'production';
  const publishableKey = process.env.STRIPE_PUBLISHABLE_KEY || getSetting('stripe_publishable_key') || '';
  const hasSecretKey = production
    ? Boolean(process.env.STRIPE_SECRET_KEY)
    : Boolean(process.env.STRIPE_SECRET_KEY || getSetting('stripe_secret_key'));

  if (!isAdmin) {
    return res.json({
      publishableKey,
      hasSecretKey,
    });
  }

  const smtpHost = process.env.SMTP_HOST || getSetting('smtp_host') || '';
  const smtpPort = process.env.SMTP_PORT || getSetting('smtp_port') || '587';
  const smtpUser = process.env.SMTP_USER || getSetting('smtp_user') || '';
  const hasSmtpPass = production
    ? Boolean(process.env.SMTP_PASSWORD || process.env.SMTP_PASS)
    : Boolean(process.env.SMTP_PASSWORD || process.env.SMTP_PASS || getSetting('smtp_pass'));
  const smtpSecure = process.env.SMTP_SECURE === 'true' || (!production && (getSetting('smtp_secure') || 'false') === 'true');
  const smtpFromName = process.env.SMTP_FROM_NAME || getSetting('smtp_from_name') || 'PROTÁTICA Scout & Analise';

  res.json({
    publishableKey,
    hasSecretKey,
    smtpHost,
    smtpPort,
    smtpUser,
    hasSmtpPass,
    smtpSecure,
    smtpFromName,
  });
});

app.post('/api/stripe/config', requireAdmin, (req, res) => {
  const { 
    secretKey, 
    publishableKey,
    smtpHost,
    smtpPort,
    smtpUser,
    smtpPass,
    smtpSecure,
    smtpFromName,
  } = req.body;

  const production = process.env.NODE_ENV === 'production';
  const submittedStripeSecret = typeof secretKey === 'string' && secretKey.trim() && !secretKey.includes('••••');
  const submittedSmtpSecret = typeof smtpPass === 'string' && smtpPass.trim() && !smtpPass.includes('••••');
  if (production && (submittedStripeSecret || submittedSmtpSecret)) {
    return res.status(400).json({
      error: 'Em produção, STRIPE_SECRET_KEY e SMTP_PASSWORD/SMTP_PASS devem ser configurados como variáveis de ambiente/secret manager, não salvos no SQLite.',
      code: 'PRODUCTION_SECRET_ENV_REQUIRED',
    });
  }
  
  if (!production && secretKey !== undefined) {
    const trimmedSecretKey = secretKey.trim();
    if (trimmedSecretKey && !trimmedSecretKey.includes('••••')) {
      setSetting('stripe_secret_key', trimmedSecretKey);
    } else if (!trimmedSecretKey) {
      setSetting('stripe_secret_key', '');
    }
  }
  
  if (publishableKey !== undefined) setSetting('stripe_publishable_key', publishableKey.trim());
  if (smtpHost !== undefined) setSetting('smtp_host', smtpHost.trim());
  if (smtpPort !== undefined) setSetting('smtp_port', smtpPort.trim());
  if (smtpUser !== undefined) setSetting('smtp_user', smtpUser.trim());
  if (!production && smtpPass !== undefined) {
    const trimmedPass = smtpPass.trim();
    if (trimmedPass && !trimmedPass.includes('••••')) {
      setSetting('smtp_pass', trimmedPass);
    } else if (!trimmedPass) {
      setSetting('smtp_pass', '');
    }
  }
  if (smtpSecure !== undefined) setSetting('smtp_secure', smtpSecure ? 'true' : 'false');
  if (smtpFromName !== undefined) setSetting('smtp_from_name', smtpFromName.trim());
  
  res.json({ ok: true });
});

// --- TELEGRAM BOT CONFIG & PUBLISH ENDPOINTS ---
app.get('/api/telegram/config', requireAdmin, (req, res) => {
  try {
    const config = getTelegramConfig();
    res.json(config);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Erro ao carregar configurações do Telegram.' });
  }
});

app.post('/api/telegram/config', requireAdmin, (req, res) => {
  try {
    const {
      active,
      botToken,
      channelId,
      vipGroupId,
      autoPublish,
      autoSendReport,
      autoSendHeatmaps,
      sendAlerts,
      webhookSecret,
    } = req.body;

    if (process.env.NODE_ENV === 'production') {
      const submittedBotToken = typeof botToken === 'string' && botToken.trim() && !botToken.includes('••••');
      const submittedWebhookSecret = typeof webhookSecret === 'string' && webhookSecret.trim() && !webhookSecret.includes('••••');
      if (submittedBotToken || submittedWebhookSecret) {
        return res.status(400).json({
          error: 'Em produção, TELEGRAM_BOT_TOKEN e TELEGRAM_WEBHOOK_SECRET devem ser configurados como variáveis de ambiente/secret manager.',
          code: 'PRODUCTION_SECRET_ENV_REQUIRED',
        });
      }
    }

    saveTelegramConfig({
      active,
      botToken,
      channelId,
      vipGroupId,
      autoPublish,
      autoSendReport,
      autoSendHeatmaps,
      sendAlerts,
      webhookSecret,
    });

    res.json({ ok: true, config: getTelegramConfig() });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Erro ao salvar configurações do Telegram.' });
  }
});

app.post('/api/telegram/test', requireAdmin, async (req, res) => {
  try {
    const { botToken } = req.body;
    const result = await testTelegramConnection(botToken);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message || 'Erro ao testar conexão com Telegram.' });
  }
});

app.post('/api/telegram/publish', requireAuth, requireActiveSubscription, requirePlanAtLeast('intelligence'), async (req, res) => {
  try {
    const {
      analysisId,
      target,
      selectedContents,
      sendReportPdf,
      sendHeatmap,
      customNote,
      appUrl,
    } = req.body;

    // Carrega obrigatoriamente a análise oficial gravada no banco de dados SQLite
    if (!analysisId) {
      return res.status(400).json({ error: 'analysisId é obrigatório para publicação no Telegram.' });
    }

    const currentUser = (req as any).user;
    const officialAnalysis = getAnalysisById(analysisId, getAnalysisOwnerScope(currentUser));
    if (!officialAnalysis) {
      return res.status(404).json({ error: 'Análise oficial não encontrada no banco de dados para publicação no Telegram.' });
    }

    // Impede publicação de análises com conflito severo
    if (officialAnalysis.validationStatus === 'conflict') {
      return res.status(400).json({ error: 'Esta análise possui divergências/conflitos críticos de contexto e não pode ser publicada.' });
    }

    // Gera o PDF centralizado e validado pelo backend
    let reportPdfBase64 = '';
    let pdfFilename = '';
    if (sendReportPdf) {
      const pdfRes = await generateAnalysisPdf(officialAnalysis);
      if (pdfRes.buffer && pdfRes.buffer.length > 0) {
        reportPdfBase64 = pdfRes.buffer.toString('base64');
        pdfFilename = pdfRes.filename;
      }
    }

    const result = await publishAnalysis(officialAnalysis, {
      target: target || 'all',
      selectedContents,
      sendReportPdf: !!sendReportPdf,
      reportPdfBase64,
      pdfFilename,
      sendHeatmap: !!sendHeatmap,
      customNote,
      appUrl: getPublicAppUrl(),
      isAuto: false,
    });

    res.json(result);
  } catch (err: any) {
    console.error('Erro na publicação Telegram:', err);
    res.status(500).json({ success: false, deliveredCount: 0, itemsSent: [], itemsFailed: [], errors: [err.message || 'Erro interno ao publicar no Telegram.'] });
  }
});

app.get('/api/telegram/messages', requireAdmin, (req, res) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
    const messages = listTelegramMessages(limit);
    res.json({ messages });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Erro ao listar mensagens do Telegram.' });
  }
});

app.post('/api/telegram/clear-messages', requireAdmin, (req, res) => {
  try {
    clearTelegramMessages();
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Erro ao limpar logs do Telegram.' });
  }
});

app.post('/api/telegram/webhook', async (req, res) => {
  try {
    const webhookSecret = getTelegramConfig().webhookSecret;
    if (!webhookSecret && process.env.NODE_ENV === 'production') {
      return res.status(503).json({ error: 'TELEGRAM_WEBHOOK_SECRET não configurado.' });
    }
    if (webhookSecret) {
      const headerSecret = req.headers['x-telegram-bot-api-secret-token'];
      if (headerSecret !== webhookSecret) {
        return res.status(403).json({ error: 'Secret token inválido.' });
      }
    }
    const update = req.body;
    const result = await handleTelegramWebhook(update);
    res.json({ ok: true, result });
  } catch (err: any) {
    console.error('[Telegram Webhook Error]:', err);
    res.status(200).json({ ok: false, error: err.message });
  }
});

// --- SCOUTING & PLAYER PHOTO CACHE ENDPOINTS ---
app.get('/api/players/photo', (req, res) => {
  const nome = String(req.query.nome || '').trim();
  const time = String(req.query.time || '').trim();
  const temporada = String(req.query.temporada || '').trim();
  if (!nome) {
    return res.status(400).json({ error: 'Nome do jogador é obrigatório.' });
  }
  const cached = getPlayerPhotoCache(nome, time, temporada);
  res.json({ photo: cached });
});

app.post('/api/players/photo', requireAuth, (req, res) => {
  const { nome, time, temporada, url, fonte, confidence, confidenceScore, manualVerified } = req.body;
  if (!nome || !time || !url) {
    return res.status(400).json({ error: 'Nome, time e URL são obrigatórios.' });
  }
  const authUser = (req as any).user || getAuthUser(req);
  const isAdmin = authUser?.role === 'admin';
  const isManual = Boolean(manualVerified && isAdmin);
  const score = typeof confidenceScore === 'number' ? confidenceScore : (isManual ? 100 : 8);

  // If score < 6 and not admin manual verification, reject storage
  if (score < 6 && !isManual) {
    return res.status(400).json({ error: 'Score de confiança insuficiente para armazenamento.' });
  }

  setPlayerPhotoCache(
    nome,
    time,
    temporada || '',
    url,
    fonte || (isManual ? 'admin_manual' : 'web'),
    confidence || (score >= 8 ? 'alta' : 'media'),
    score,
    isManual
  );
  res.json({ ok: true, score, manualVerified: isManual });
});

app.delete('/api/players/photo', requireAdmin, (req, res) => {
  const { nome, time } = req.body;
  if (!nome) return res.status(400).json({ error: 'Nome é obrigatório.' });
  deletePlayerPhotoCache(nome, time);
  res.json({ ok: true });
});

// --- SMTP EMAILING HELPERS ---
async function sendCredentialsEmail(toEmail: string, passwordPlain: string, planName: string, appUrl: string) {
  const production = process.env.NODE_ENV === 'production';
  const host = process.env.SMTP_HOST || (!production ? getSetting('smtp_host') || '' : '');
  const portStr = process.env.SMTP_PORT || (!production ? getSetting('smtp_port') || '587' : '587');
  const user = process.env.SMTP_USER || (!production ? getSetting('smtp_user') || '' : '');
  const pass = process.env.SMTP_PASSWORD || process.env.SMTP_PASS || (!production ? getSetting('smtp_pass') || '' : '');
  const secure = process.env.SMTP_SECURE === 'true' || (!production && (getSetting('smtp_secure') || 'false') === 'true');
  const fromName = process.env.SMTP_FROM_NAME || (!production ? getSetting('smtp_from_name') || 'PROTÁTICA Scout & Analise' : 'PROTÁTICA Scout & Analise');

  if (!host || !user || !pass) {
    console.warn('[SMTP] Configurações incompletas na base de dados. O email não pôde ser disparado.');
    return false;
  }

  const transporter = nodemailer.createTransport({
    host,
    port: parseInt(portStr, 10),
    secure,
    auth: { user, pass },
  });

  const mailOptions = {
    from: `"${fromName}" <${user}>`,
    to: toEmail,
    subject: `⚽ Seu acesso à PROTÁTICA está liberado! - ${planName}`,
    html: `
      <div style="background-color: #1a0000; color: #ffffff; font-family: sans-serif; padding: 40px; border-radius: 12px; max-width: 600px; margin: 0 auto; border: 1px solid #eab308; box-shadow: 0 4px 12px rgba(0,0,0,0.5);">
        <div style="text-align: center; margin-bottom: 20px;">
          <h1 style="color: #eab308; font-size: 26px; font-weight: 800; margin: 0; text-transform: uppercase; letter-spacing: 1px;">PROTÁTICA</h1>
          <p style="color: #fef08a; font-size: 14px; margin: 5px 0 0 0;">Análise de Desempenho e Scouting com Inteligência Artificial</p>
        </div>
        <h2 style="color: #eab308; text-align: center; font-size: 20px; font-weight: bold; margin-bottom: 24px; border-bottom: 1px solid #4a0404; padding-bottom: 12px;">⚽ Suas Credenciais de Acesso</h2>
        <p style="font-size: 15px; line-height: 1.6; color: #fef08a;">Olá,</p>
        <p style="font-size: 15px; line-height: 1.6; color: #e4e4e7;">Aqui estão suas informações de acesso para <strong>${planName}</strong>:</p>
        <div style="background-color: #2a0101; border-left: 4px solid #eab308; padding: 20px; margin: 24px 0; border-radius: 8px;">
          <p style="margin: 8px 0; font-size: 14px; color: #e4e4e7;"><strong>Link da Plataforma:</strong> <a href="${appUrl}" style="color: #eab308; text-decoration: underline; font-weight: bold;">${appUrl}</a></p>
          <p style="margin: 8px 0; font-size: 14px; color: #e4e4e7;"><strong>Sua Senha de Acesso:</strong> <span style="background-color: #000000; color: #fef08a; padding: 6px 12px; border-radius: 6px; font-family: monospace; font-size: 16px; font-weight: bold; border: 1px solid #581c0c; display: inline-block; margin-left: 5px; letter-spacing: 1px;">${passwordPlain}</span></p>
        </div>
      </div>
    `,
  };

  await transporter.sendMail(mailOptions);
  return true;
}

app.post('/api/smtp/test-send', requireAdmin, async (req, res) => {
  const { testEmail } = req.body;
  if (!testEmail) return res.status(400).json({ error: 'Email de teste é obrigatório.' });

  try {
    const origin = getPublicAppUrl();
    const sent = await sendCredentialsEmail(testEmail, 'SENHATEST123', 'Plano Teste Admin', origin);
    if (sent) res.json({ ok: true, message: `Email de teste enviado com êxito para ${testEmail}!` });
    else res.status(400).json({ error: 'Configuração SMTP ausente. Preencha os campos Host, Usuário e Senha antes de testar.' });
  } catch (err: any) {
    console.error('SMTP Test Error:', err);
    res.status(500).json({ error: err.message || 'Erro crítico ao enviar email de teste.' });
  }
});

// --- TRIAL & SUBSCRIPTION FLOW ENDPOINTS ---

// 1. Register for 7-day free trial
app.post('/api/trial/register', async (req, res) => {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  
  // Rate limit: max 5 trial requests per hour per IP
  const rateLimit = checkRateLimit(`trial_reg_${ip}`, 5, 3600);
  if (!rateLimit.allowed) {
    return res.status(429).json({
      error: 'Muitas solicitações de teste a partir deste dispositivo. Por favor, aguarde alguns minutos antes de tentar novamente.',
    });
  }

  const { name, email, phone, organization, usageProfile, termsAccepted } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Nome completo é obrigatório.' });
  }

  if (!email || !email.trim()) {
    return res.status(400).json({ error: 'E-mail profissional é obrigatório.' });
  }

  const cleanEmail = email.trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(cleanEmail)) {
    return res.status(400).json({ error: 'Formato de e-mail inválido.' });
  }

  if (!termsAccepted) {
    return res.status(400).json({ error: 'Você precisa aceitar os termos de uso para solicitar o teste.' });
  }

  try {
    // Case-insensitive duplicate check
    const existingUser = findUserByEmail(cleanEmail) || findUserByUsername(cleanEmail);

    if (existingUser) {
      // If user already exists and has active paid or trial
      if (existingUser.account_type === 'paid') {
        return res.status(400).json({
          error: 'Este e-mail já possui uma assinatura ativa no ProTática. Faça login para acessar sua conta.',
          code: 'USER_EXISTS_PAID',
        });
      }

      if (existingUser.trial_status === 'active' || existingUser.trial_status === 'expired') {
        return res.status(400).json({
          error: 'Este e-mail já utilizou o período de teste grátis. Faça login ou adquira um plano para continuar.',
          code: 'TRIAL_ALREADY_USED',
        });
      }

      // If pending verification, resend verification token
      if (existingUser.trial_status === 'pending_verification' && !existingUser.email_verified) {
        console.log(`[TRIAL][TOKEN] Resending verification token for existing pending user (email: ${cleanEmail})`);
        const token = createVerificationToken(existingUser.id, 'trial_verify', 24);
        const origin = getPublicAppUrl();

        try {
          const emailResult = await sendTrialVerificationEmail({
            to: cleanEmail,
            name: existingUser.display_name,
            verificationToken: token.rawToken,
            appUrl: origin,
            userId: existingUser.id,
          });
          if (emailResult.success) {
            console.log(`[TRIAL][SMTP] Re-sent verification email successfully to ${cleanEmail}`);
          } else {
            console.warn(`[TRIAL][SMTP] Warning re-sending email to ${cleanEmail}: ${emailResult.error || 'SMTP issue'}`);
          }
        } catch (smtpErr: any) {
          console.error(`[TRIAL][SMTP] Error dispatching email to ${cleanEmail}:`, smtpErr.message);
        }

        return res.json({
          ok: true,
          message: 'Seu cadastro estava aguardando confirmação. Reenviamos o link de ativação para o seu e-mail!',
          alreadyRegistered: true,
        });
      }
    }

    // 1. [TRIAL][DATABASE] Create new trial user
    let newUser;
    try {
      newUser = createTrialUser({
        name: name.trim(),
        email: cleanEmail,
        phone: phone?.trim(),
        organization: organization?.trim(),
        usageProfile: usageProfile?.trim(),
      });
      console.log(`[TRIAL][DATABASE] Trial user record created successfully (id: ${newUser?.id}, email: ${cleanEmail})`);
    } catch (dbErr: any) {
      console.error(`[TRIAL][DATABASE] Database insert failed for ${cleanEmail}:`, dbErr.message);
      return res.status(500).json({ error: 'Erro no banco de dados ao registrar teste grátis.' });
    }

    if (!newUser) {
      return res.status(500).json({ error: 'Erro ao criar conta de teste. Tente novamente.' });
    }

    // 2. [TRIAL][TOKEN] Create 24h verification token
    let token;
    try {
      token = createVerificationToken(newUser.id, 'trial_verify', 24);
      console.log(`[TRIAL][TOKEN] 24h verification token created for user ${newUser.id}`);
    } catch (tokErr: any) {
      console.error(`[TRIAL][TOKEN] Token creation failed for user ${newUser.id}:`, tokErr.message);
      return res.status(500).json({ error: 'Erro ao gerar token de verificação.' });
    }

    // 3. [TRIAL][SMTP] Send confirmation email
    const origin = getPublicAppUrl();
    let emailSent = false;
    try {
      const emailResult = await sendTrialVerificationEmail({
        to: cleanEmail,
        name: newUser.display_name,
        verificationToken: token.rawToken,
        appUrl: origin,
        userId: newUser.id,
      });
      emailSent = !!emailResult.success;
      if (emailSent) {
        console.log(`[TRIAL][SMTP] Trial verification email dispatched to ${cleanEmail}`);
      } else {
        console.warn(`[TRIAL][SMTP] Email delivery notice for ${cleanEmail}: ${emailResult.error || 'SMTP not configured / simulated'}`);
      }
    } catch (smtpErr: any) {
      console.error(`[TRIAL][SMTP] SMTP dispatch exception for ${cleanEmail}:`, smtpErr.message);
    }

    // Notify administrators via Telegram
    notifyTrialRequested({
      name: newUser.display_name,
      email: cleanEmail,
      phone: phone?.trim(),
      organization: organization?.trim(),
      usageProfile: usageProfile?.trim(),
    }).catch(err => console.error('[Telegram Alert Error]:', err));

    logSubscriptionEvent(newUser.id, 'trial_requested', {
      ip,
      phone: phone?.trim(),
      organization: organization?.trim(),
      usageProfile: usageProfile?.trim(),
    });

    if (!emailSent) {
      return res.json({
        ok: true,
        emailSent: false,
        message: 'Cadastro realizado, mas não foi possível enviar o e-mail. Tente reenviar.',
      });
    }

    res.json({
      ok: true,
      emailSent: true,
      message: 'Cadastro para teste de 7 dias realizado com sucesso! Enviamos um link de confirmação para o seu e-mail.',
    });
  } catch (err: any) {
    console.error('[TRIAL][SYSTEM] Unexpected error processing trial request:', err);
    res.status(500).json({ error: err.message || 'Erro ao processar cadastro do teste grátis.' });
  }
});

// Re-send verification email for trial
const handleTrialResend = async (req: express.Request, res: express.Response) => {
  const cleanEmail = String(req.body.email || '').trim().toLowerCase();
  console.log(`[TRIAL RESEND] request received for ${cleanEmail}`);

  if (!cleanEmail || !cleanEmail.includes('@')) {
    return res.status(400).json({ ok: false, error: 'E-mail válido é obrigatório para reenviar ativação.' });
  }

  try {
    const user = findUserByEmail(cleanEmail) || findUserByUsername(cleanEmail);
    if (!user) {
      console.warn(`[TRIAL RESEND] user not found for ${cleanEmail}`);
      return res.status(404).json({ ok: false, error: 'Nenhum cadastro de teste encontrado para este e-mail.' });
    }

    console.log(`[TRIAL RESEND] user found: ${user.id} (${user.email || user.username})`);

    if (user.email_verified || user.trial_status === 'active' || user.account_type === 'paid') {
      return res.status(400).json({
        ok: false,
        error: 'Este e-mail já foi verificado e está ativo. Faça login na plataforma com suas credenciais.',
        alreadyActive: true,
      });
    }

    // Generate fresh 24h verification token (invalidating previous ones)
    const token = createVerificationToken(user.id, 'trial_verify', 24);
    console.log(`[TRIAL RESEND] token regenerated: ${token.tokenId}`);

    const origin = getPublicAppUrl();
    const emailResult = await sendTrialVerificationEmail({
      to: user.email || user.username,
      name: user.display_name,
      verificationToken: token.rawToken,
      appUrl: origin,
      userId: user.id,
    });

    if (!emailResult.success) {
      console.error(`[TRIAL RESEND] email failed for ${cleanEmail}:`, emailResult.error);
      return res.status(500).json({
        ok: false,
        emailSent: false,
        error: `Não foi possível enviar o e-mail: ${emailResult.error || 'Erro no servidor SMTP.'}`,
      });
    }

    console.log(`[TRIAL RESEND] email sent to ${cleanEmail}`);
    return res.json({
      ok: true,
      emailSent: true,
      message: 'Novo e-mail de ativação enviado com sucesso! Verifique sua caixa de entrada.',
    });
  } catch (err: any) {
    console.error(`[TRIAL RESEND] unexpected error for ${cleanEmail}:`, err);
    return res.status(500).json({ ok: false, error: err.message || 'Erro ao processar reenvio de e-mail.' });
  }
};

app.post('/api/trial/resend-verification', handleTrialResend);
app.post('/api/trial/resend', handleTrialResend);

// 2. Verify email token (validates token without consuming, so user can open link and set password)
const handleTrialVerify = async (req: express.Request, res: express.Response) => {
  console.log('[TRIAL VERIFY] request received');
  const rawToken = String(
    req.body?.token ||
    req.body?.verifyToken ||
    req.query?.token ||
    req.query?.verify_trial ||
    req.query?.verify_trial_token ||
    ''
  ).trim();

  const tokenPresent = Boolean(rawToken);
  console.log(`[TRIAL VERIFY] token present=${tokenPresent}`);

  if (!tokenPresent) {
    return res.status(400).json({
      ok: false,
      error: 'Token de confirmação é obrigatório.',
      code: 'TOKEN_REQUIRED',
    });
  }

  try {
    let inspection = inspectVerificationToken(rawToken, 'trial_verify');
    if (!inspection.found) {
      inspection = inspectVerificationToken(rawToken, 'set_password');
    }

    console.log(`[TRIAL VERIFY] token found=${inspection.found}`);
    console.log(`[TRIAL VERIFY] expired=${inspection.expired}`);
    console.log(`[TRIAL VERIFY] alreadyUsed=${inspection.alreadyUsed}`);

    if (!inspection.found) {
      return res.status(400).json({
        ok: false,
        error: 'Link de confirmação inválido.',
        code: 'INVALID_TOKEN',
      });
    }

    if (inspection.alreadyUsed) {
      return res.status(400).json({
        ok: false,
        error: 'Este link de confirmação já foi utilizado.',
        code: 'TOKEN_ALREADY_USED',
      });
    }

    if (inspection.expired) {
      return res.status(400).json({
        ok: false,
        error: 'Este link de confirmação expirou. Solicite um novo link.',
        code: 'TOKEN_EXPIRED',
      });
    }

    const userId = inspection.row.user_id;
    const user = findUserById(userId);

    if (!user) {
      return res.status(404).json({ ok: false, error: 'Usuário não encontrado para ativação.' });
    }

    console.log('[TRIAL VERIFY] success');

    return res.json({
      ok: true,
      valid: true,
      userId: user.id,
      email: user.email,
      name: user.display_name,
      token: rawToken,
      setPasswordToken: rawToken,
      expiresAtFormatted: '7 dias',
      message: 'E-mail validado com sucesso! Crie sua senha de acesso para liberar os 7 dias.',
    });
  } catch (err: any) {
    console.error('[TRIAL VERIFY] unexpected error:', err);
    return res.status(500).json({ ok: false, error: err.message || 'Erro ao validar confirmação de e-mail.' });
  }
};

app.get('/api/trial/verify-email', handleTrialVerify);
app.post('/api/trial/verify-email', handleTrialVerify);
app.get('/api/trial/verify', handleTrialVerify);
app.post('/api/trial/verify', handleTrialVerify);

// 3. Set password for trial user and activate 7 days access (consumes verification token)
app.post('/api/trial/set-password', async (req, res) => {
  const token = String(req.body?.token || req.body?.setPasswordToken || req.body?.verifyToken || '').trim();
  const password = String(req.body?.password || '').trim();

  if (!password || password.length < 6) {
    return res.status(400).json({ ok: false, error: 'A senha deve conter no mínimo 6 caracteres.' });
  }

  try {
    let userId: string | null = null;

    if (token) {
      // Consume token now upon successful password creation
      const tokenRecord = verifyAndConsumeToken(token, 'trial_verify') || verifyAndConsumeToken(token, 'set_password');
      if (!tokenRecord) {
        const insp = inspectVerificationToken(token, 'trial_verify');
        if (insp.alreadyUsed) {
          return res.status(400).json({ ok: false, error: 'Este link já foi utilizado para definir a senha.' });
        }
        if (insp.expired) {
          return res.status(400).json({ ok: false, error: 'Este link expirou. Solicite um novo link.' });
        }
        return res.status(400).json({ ok: false, error: 'Token de criação de senha inválido ou expirado.' });
      }
      userId = tokenRecord.user_id;
    } else {
      const authUser = getAuthUser(req);
      if (authUser) {
        userId = authUser.id;
      }
    }

    if (!userId) {
      return res.status(400).json({ ok: false, error: 'Identificação de usuário necessária para definir senha.' });
    }

    const updated = updateUserPassword(userId, password);
    if (!updated) {
      return res.status(500).json({ ok: false, error: 'Erro ao salvar nova senha no banco de dados.' });
    }

    // Activate trial in DB
    const activatedUser = activateTrialAfterVerification(userId) || findUserById(userId);
    if (!activatedUser) {
      return res.status(404).json({ ok: false, error: 'Usuário não encontrado.' });
    }

    // Dispatch trial activated notification email & telegram
    const origin = getPublicAppUrl();
    sendTrialActivatedEmail({
      to: activatedUser.email,
      name: activatedUser.display_name,
      expiresAt: activatedUser.trial_expires_at,
      appUrl: origin,
      userId: activatedUser.id,
    }).catch(err => console.error('[Trial Activated Email Error]:', err));

    notifyTrialActivated({
      name: activatedUser.display_name,
      email: activatedUser.email,
      expiresAt: activatedUser.trial_expires_at,
    }).catch(err => console.error('[Telegram Trial Activated Alert]:', err));

    logSubscriptionEvent(userId, 'trial_activated', {
      startedAt: activatedUser.trial_started_at,
      expiresAt: activatedUser.trial_expires_at,
    });
    logSubscriptionEvent(userId, 'password_set_by_user');

    // Auto-login: create session token
    const sessionToken = createAuthSession(activatedUser.id);

    return res.json({
      ok: true,
      user: activatedUser,
      token: sessionToken,
      message: 'Senha definida com sucesso! Seus 7 dias de teste grátis foram ativados.',
    });
  } catch (err: any) {
    console.error('[Set Password Error]:', err);
    return res.status(500).json({ ok: false, error: err.message || 'Erro ao definir senha.' });
  }
});

// 4. Get Current User Subscription Details
app.get('/api/subscription/me', requireAuth, (req, res) => {
  const authUser = (req as any).user;
  const user = findUserById(authUser.id);

  if (!user) {
    return res.status(404).json({ error: 'Usuário não encontrado.' });
  }

  const now = new Date().getTime();
  let daysRemaining = 0;
  let isExpired = false;

  if (user.role === 'admin') {
    isExpired = false;
    daysRemaining = 999;
  } else if (user.account_type === 'paid') {
    if (user.subscription_expires_at) {
      const exp = new Date(user.subscription_expires_at).getTime();
      const diffMs = exp - now;
      daysRemaining = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
      isExpired = diffMs <= 0;
    }
  } else {
    if (user.trial_expires_at) {
      const exp = new Date(user.trial_expires_at).getTime();
      const diffMs = exp - now;
      daysRemaining = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
      isExpired = diffMs <= 0;
    } else if (user.trial_status === 'expired') {
      isExpired = true;
      daysRemaining = 0;
    }
  }

  res.json({
    accountType: user.account_type,
    role: user.role,
    trialStatus: user.trial_status,
    trialStartedAt: user.trial_started_at,
    trialExpiresAt: user.trial_expires_at,
    subscriptionPlan: user.subscription_plan,
    subscriptionStatus: user.subscription_status,
    subscriptionStartedAt: user.subscription_started_at,
    subscriptionExpiresAt: user.subscription_expires_at,
    convertedFromTrial: user.converted_from_trial,
    emailVerified: user.email_verified,
    isBlocked: user.is_blocked,
    daysRemaining,
    isExpired,
  });
});

// 5. Checkout Session for Paid Plans
app.post('/api/subscription/checkout', async (req, res) => {
  const { planId } = req.body;
  const authUser = getAuthUser(req);
  const plan = getOfficialPlanById(String(planId || ''));
  if (!plan) return res.status(400).json({ error: 'Plano selecionado não reconhecido.' });

  try {
    const session = await createOfficialStripeCheckout(plan, authUser);
    res.json({ url: session.url });
  } catch (err: any) {
    console.error('[Subscription Checkout Error]:', err);
    res.status(500).json({ error: err.message || 'Erro ao iniciar checkout seguro do Stripe.' });
  }
});

// --- STRIPE SESSIONS & WEBHOOK INTEGRATIONS ---
app.post('/api/stripe/verify-session', async (req, res) => {
  const { sessionId } = req.body;
  if (!sessionId) return res.status(400).json({ error: 'Session ID é obrigatório para validação.' });

  try {
    const stripe = getStripeClient();
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status === 'paid') {
      const email = session.customer_details?.email || session.metadata?.userEmail;
      if (!email) throw new Error('Email não fornecido na sessão do Stripe.');

      const cleanEmail = email.trim().toLowerCase();
      const sessionKey = `processed_session_${sessionId}`;
      if (getSetting(sessionKey) === 'true') {
        return res.json({ ok: true, alreadyProcessed: true });
      }

      // Check if user already exists
      let existingUser = findUserByEmail(cleanEmail) || findUserByUsername(cleanEmail);
      if (!existingUser && session.client_reference_id) {
        existingUser = findUserById(session.client_reference_id);
      }

      const planId = String(session.metadata?.planId || '');
      const plan = getOfficialPlanById(planId);
      if (!plan) {
        return res.status(400).json({ error: 'A sessão paga não possui um plano oficial reconhecido.' });
      }
      const durationDays = plan.durationDays;
      const origin = getPublicAppUrl();
      let passwordPlain = '';
      let isNewUser = false;

      if (existingUser) {
        // Upgrade existing trial or regular user to paid
        activatePaidSubscription(existingUser.id, plan.name, durationDays, existingUser.account_type === 'trial');
        
        // Send paid activation email
        sendPaidAccessCredentialsEmail({
          to: existingUser.email || cleanEmail,
          name: existingUser.display_name,
          planName: plan.name,
          passwordPlain: null, // user already has a password
          appUrl: origin,
          userId: existingUser.id,
        }).catch(e => console.error('[SMTP] Erro envio email pago:', e));

        notifySubscriptionPaid({
          name: existingUser.display_name,
          email: existingUser.email || cleanEmail,
          planName: plan.name,
          amount: session.amount_total ? session.amount_total / 100 : 0,
          durationDays,
        }).catch(e => console.error('[Telegram] Erro alerta pago:', e));
      } else {
        // New user: create password and account
        isNewUser = true;
        // Cryptographically secure temporary password; user can change it after first login.
        passwordPlain = randomBytes(12).toString('base64url');

        const newUserId = createUserWithPassword(cleanEmail, cleanEmail.split('@')[0], passwordPlain);
        activatePaidSubscription(newUserId, plan.name, durationDays, false);

        sendPaidAccessCredentialsEmail({
          to: cleanEmail,
          name: cleanEmail.split('@')[0],
          planName: plan.name,
          passwordPlain,
          appUrl: origin,
          userId: newUserId,
        }).catch(e => console.error('[SMTP] Erro envio email novo pago:', e));

        notifySubscriptionPaid({
          name: cleanEmail.split('@')[0],
          email: cleanEmail,
          planName: plan.name,
          amount: session.amount_total ? session.amount_total / 100 : 0,
          durationDays,
        }).catch(e => console.error('[Telegram] Erro alerta pago:', e));
      }

      setSetting(sessionKey, 'true');

      return res.json({
        ok: true,
        alreadyProcessed: false,
        email: cleanEmail,
        passwordPlain: isNewUser ? passwordPlain : undefined,
        isNewUser,
        credentialsSent: true,
      });
    } else {
      return res.status(400).json({ error: 'O pagamento referente à sessão informada não está aprovado no Stripe.' });
    }
  } catch (err: any) {
    console.error('Erro de validação de sessão:', err);
    res.status(500).json({ error: err.message || 'Falha de validação segura do Stripe.' });
  }
});

// Stripe Webhook handler — cryptographically validates every event.
app.post('/api/stripe/webhook', async (req: any, res) => {
  try {
    const stripe = getStripeClient();
    const webhookSecret = String(process.env.STRIPE_WEBHOOK_SECRET || (process.env.NODE_ENV !== 'production' ? getSetting('stripe_webhook_secret') || '' : '')).trim();
    if (!webhookSecret) {
      return res.status(503).json({ error: 'STRIPE_WEBHOOK_SECRET não configurado.' });
    }

    const signature = req.headers['stripe-signature'];
    if (!signature || !req.rawBody) {
      return res.status(400).json({ error: 'Assinatura Stripe ausente.' });
    }

    const event = stripe.webhooks.constructEvent(req.rawBody, signature, webhookSecret);

    if (event.type === 'checkout.session.completed') {
      const session: any = event.data.object;
      if (session.payment_status === 'paid' || session.status === 'complete') {
        const sessionKey = `processed_session_${session.id}`;
        if (getSetting(sessionKey) !== 'true') {
          const email = session.customer_details?.email || session.customer_email || session.metadata?.userEmail;
          const planId = session.metadata?.planId || '';
          const plan = getOfficialPlanById(planId);
          if (email && plan) {
            const cleanEmail = String(email).trim().toLowerCase();
            let user = findUserByEmail(cleanEmail) || findUserByUsername(cleanEmail);
            if (!user && session.client_reference_id) user = findUserById(session.client_reference_id);

            if (user) {
              activatePaidSubscription(user.id, plan.name, plan.durationDays, user.account_type === 'trial');
              sendPaidAccessCredentialsEmail({
                to: user.email || cleanEmail, name: user.display_name, planName: plan.name, passwordPlain: null,
                appUrl: getPublicAppUrl(), userId: user.id,
              }).catch(console.error);
            } else {
              const tempPassword = randomUUID().replace(/-/g, '').slice(0, 14);
              const newUserId = createUserWithPassword(cleanEmail, cleanEmail.split('@')[0], tempPassword);
              activatePaidSubscription(newUserId, plan.name, plan.durationDays, false);
              sendPaidAccessCredentialsEmail({
                to: cleanEmail, name: cleanEmail.split('@')[0], planName: plan.name, passwordPlain: tempPassword,
                appUrl: getPublicAppUrl(), userId: newUserId,
              }).catch(console.error);
            }
            setSetting(sessionKey, 'true');
          }
        }
      }
    }

    // Renewal webhook for recurring subscriptions. Metadata is copied to the Subscription.
    if (event.type === 'invoice.paid') {
      const invoice: any = event.data.object;
      // The initial invoice is already handled by checkout.session.completed.
      if (invoice.billing_reason === 'subscription_create') {
        return res.json({ received: true });
      }
      const subscriptionId = typeof invoice.subscription === 'string' ? invoice.subscription : invoice.subscription?.id;
      if (subscriptionId) {
        const subscription: any = await stripe.subscriptions.retrieve(subscriptionId);
        const plan = getOfficialPlanById(subscription.metadata?.planId || '');
        const userId = subscription.metadata?.userId || '';
        const email = subscription.metadata?.userEmail || invoice.customer_email || '';
        const renewalKey = `processed_invoice_${invoice.id}`;
        if (plan && getSetting(renewalKey) !== 'true') {
          let user = userId ? findUserById(userId) : null;
          if (!user && email) user = findUserByUsername(String(email).toLowerCase());
          if (user) {
            activatePaidSubscription(user.id, plan.name, plan.durationDays, user.account_type === 'trial');
            setSetting(renewalKey, 'true');
          }
        }
      }
    }

    res.json({ received: true });
  } catch (err: any) {
    console.error('[Stripe Webhook Error]:', err);
    res.status(400).json({ error: 'Webhook Stripe inválido.' });
  }
});

// --- ADMIN SUBSCRIPTIONS ENDPOINTS ---
app.get('/api/admin/subscriptions', requireAdmin, (req, res) => {
  try {
    const filter = String(req.query.filter || 'all');
    const subscriptions = listAllSubscriptionsAdmin(filter);
    res.json({ subscriptions });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Erro ao carregar assinaturas do sistema.' });
  }
});

app.post('/api/admin/subscriptions/extend-trial', requireAdmin, (req, res) => {
  const { userId, days, reason } = req.body;
  const adminUser = (req as any).user;

  if (!userId || !days) {
    return res.status(400).json({ error: 'ID do usuário e quantidade de dias são obrigatórios.' });
  }

  try {
    const updated = adminExtendTrial(userId, parseInt(days, 10), adminUser.id, reason);
    if (!updated) return res.status(404).json({ error: 'Usuário não encontrado.' });
    res.json({ ok: true, user: updated });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Erro ao estender período de teste.' });
  }
});

app.post('/api/admin/subscriptions/toggle-block', requireAdmin, (req, res) => {
  const { userId, block, reason } = req.body;
  const adminUser = (req as any).user;

  if (!userId) {
    return res.status(400).json({ error: 'ID do usuário é obrigatório.' });
  }

  try {
    const updated = adminToggleBlockUser(userId, Boolean(block), adminUser.id, reason);
    if (!updated) return res.status(404).json({ error: 'Usuário não encontrado.' });
    res.json({ ok: true, user: updated });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Erro ao atualizar bloqueio de usuário.' });
  }
});

app.post('/api/admin/subscriptions/activate-paid', requireAdmin, (req, res) => {
  const { userId, planId, durationDays } = req.body;

  if (!userId || !planId) {
    return res.status(400).json({ error: 'ID do usuário e plano são obrigatórios.' });
  }

  try {
    const updated = activatePaidSubscription(userId, planId, parseInt(durationDays || '30', 10), false);
    if (!updated) return res.status(404).json({ error: 'Usuário não encontrado.' });
    res.json({ ok: true, user: updated });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Erro ao ativar assinatura paga.' });
  }
});

app.get('/api/admin/subscription-events', requireAdmin, (req, res) => {
  try {
    const events = listSubscriptionEvents(100);
    res.json({ events });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Erro ao buscar eventos de auditoria de assinaturas.' });
  }
});

app.get('/api/admin/email-logs', requireAdmin, (req, res) => {
  try {
    const logs = listEmailLogs(100);
    res.json({ logs });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Erro ao buscar registros de disparos de e-mail.' });
  }
});

// Admin endpoint to test SMTP email sending
app.post('/api/admin/email/test', requireAdmin, async (req, res) => {
  const { email } = req.body;
  const targetEmail = String(email || '').trim().toLowerCase();

  if (!targetEmail || !targetEmail.includes('@')) {
    return res.status(400).json({ success: false, error: 'E-mail de destino válido é obrigatório.' });
  }

  try {
    const result = await sendEmail({
      to: targetEmail,
      subject: 'ProTática - Teste de e-mail',
      text: 'Configuração de e-mail funcionando corretamente.',
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 24px; background-color: #0b1320; color: #e2e8f0; border-radius: 8px;">
          <h2 style="color: #10b981; margin-top: 0;">ProTática - Teste de e-mail</h2>
          <p style="font-size: 15px; color: #cbd5e1;">Configuração de e-mail funcionando corretamente.</p>
          <p style="font-size: 12px; color: #64748b; margin-top: 20px;">Disparado pelo painel administrativo em: ${new Date().toISOString()}</p>
        </div>
      `,
      type: 'admin_test_email',
      userId: (req as any).user?.id,
    });

    if (result.success) {
      return res.json({ success: true, messageId: result.messageId });
    } else {
      return res.status(500).json({ success: false, error: result.error || 'Falha ao enviar e-mail de teste.' });
    }
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || 'Erro ao processar disparo de e-mail de teste.' });
  }
});

app.post('/api/stripe/create-checkout-session', async (req, res) => {
  try {
    const requestedPlanId = String(req.body?.planId || '').trim();
    const legacyPlanId = requestedPlanId || resolveLegacyPlanId(String(req.body?.planName || ''));
    const plan = getOfficialPlanById(legacyPlanId || '');
    if (!plan) return res.status(400).json({ error: 'Plano inválido. O preço não pode ser informado pelo navegador.' });
    const session = await createOfficialStripeCheckout(plan, getAuthUser(req));
    res.json({ url: session.url });
  } catch (err: any) {
    console.error('Erro ao criar checkout Stripe:', err);
    res.status(500).json({ error: err.message || 'Erro ao iniciar checkout do Stripe.' });
  }
});

// --- ANALYSES CRUD & PDF ---
app.get('/api/analyses', requireAuth, (req, res) => {
  const user = (req as any).user;
  const ownerScope = getAnalysisOwnerScope(user);
  const id = req.query.id as string;
  const full = req.query.full === 'true';
  if (id) {
    const analysis = getAnalysisById(id, ownerScope);
    if (!analysis) return res.status(404).json({ error: 'Análise não encontrada.' });
    return res.json({ analysis: enrichAnalysisFromDb(analysis) });
  }
  if (full) {
    const analyses = listAllFullAnalyses(ownerScope);
    return res.json({ analyses });
  }
  const analyses = listAnalyses(20, ownerScope);
  res.json({ analyses });
});

app.delete('/api/analyses', requireAuth, (req, res) => {
  const user = (req as any).user;
  const id = req.query.id as string;
  if (!id) return res.status(400).json({ error: 'ID é obrigatório.' });
  const deleted = deleteAnalysisFromDb(id, getAnalysisOwnerScope(user));
  if (!deleted) return res.status(404).json({ error: 'Análise não encontrada.' });
  res.json({ ok: true });
});

app.get('/api/analyses/:id/pdf', requireAuth, async (req, res) => {
  const { id } = req.params;
  const user = (req as any).user;
  if (!id) return res.status(400).json({ error: 'ID da análise é obrigatório.' });

  try {
    const analysis = getAnalysisById(id, getAnalysisOwnerScope(user));
    if (!analysis) return res.status(404).json({ error: 'Análise não encontrada.' });
    const pdfResult = await generateAnalysisPdf(enrichAnalysisFromDb(analysis));
    if (!pdfResult.buffer || pdfResult.buffer.length === 0) {
      return res.status(500).json({ error: 'PDF_EMPTY: O relatório gerado está vazio.' });
    }
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${pdfResult.filename}"`);
    res.setHeader('Content-Length', pdfResult.size);
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.send(pdfResult.buffer);
  } catch (err: any) {
    const isNotFound = err.message?.includes('não encontrada');
    res.status(isNotFound ? 404 : 500).json({
      error: `PDF_GENERATION_ERROR: ${err.message || 'Erro ao compilar relatório PDF.'}`
    });
  }
});

app.post('/api/analyses/pdf', requireAuth, async (req, res) => {
  const { analysis } = req.body;
  if (!analysis) return res.status(400).json({ error: 'Objeto de análise é obrigatório.' });

  try {
    const pdfResult = await generateAnalysisPdf(analysis);
    if (!pdfResult.buffer || pdfResult.buffer.length === 0) {
      return res.status(500).json({ error: 'PDF_EMPTY: O relatório gerado está vazio.' });
    }
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${pdfResult.filename}"`);
    res.setHeader('Content-Length', pdfResult.size);
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.send(pdfResult.buffer);
  } catch (err: any) {
    res.status(500).json({
      error: `PDF_GENERATION_ERROR: ${err.message || 'Erro ao compilar relatório PDF.'}`
    });
  }
});

app.post('/api/verify-video', requireAuth, async (req, res) => {
  if (!enforceRateLimit(req, res, 'verify_video', 30, 60 * 60)) return;
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'URL do vídeo é obrigatória.' });
  try {
    const verifiedContext = await verifyVideoIdentity(url);
    res.json({ verifiedContext });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Vídeo não pôde ser identificado.' });
  }
});

// --- REAL VIDEO & MULTIMODAL ANALYSIS PIPELINE ---
app.post('/api/analyze', requireAuth, requireActiveSubscription, upload.single('videoFile'), async (req, res) => {
  // Logs de requisição de análise
  const user = (req as any).user || getAuthUser(req);
  if (!enforceRateLimit(req, res, `analyze:${user?.id || 'anonymous'}`, 20, 60 * 60)) return;

  if (user && user.role !== 'admin' && getPlanTier(user) === 'scout') {
    const monthStart = new Date();
    monthStart.setUTCDate(1);
    monthStart.setUTCHours(0, 0, 0, 0);
    const used = countAnalysesForUserSince(user.id, monthStart.toISOString());
    if (used >= 10) {
      return res.status(403).json({
        error: 'Seu plano Scout atingiu o limite de 10 análises neste mês.',
        code: 'MONTHLY_ANALYSIS_LIMIT',
        limit: 10,
        used,
      });
    }
  }

  console.log('[ANALYZE] request received');
  console.log(`[ANALYZE] userId=${user?.id || 'unknown'}`);
  const { url, mode = 'quick', clipStartSeconds, clipEndSeconds } = req.body;
  const apiKey = getGeminiApiKey();

  if (!apiKey) return res.status(500).json({ error: 'GEMINI_API_KEY não configurada.' });

  const startSec = Math.max(0, parseInt(clipStartSeconds || '0', 10));
  const endSec = Math.max(startSec + 30, parseInt(clipEndSeconds || '900', 10));
  const analysisMode = (mode === 'complete' || mode === 'detailed') ? mode : 'quick';

  let verifiedContext: VerifiedVideoContext;
  let localVideoPath: string | undefined = req.file?.path;

  if (req.file) {
    // Local uploaded file
    verifiedContext = {
      sourceUrl: `local://${req.file.originalname}`,
      videoId: `local_${randomUUID().slice(0, 8)}`,
      title: req.file.originalname.replace(/\.[^/.]+$/, ''),
      channelTitle: 'Arquivo Local',
      verifiedAt: new Date().toISOString(),
    };
  } else if (url) {
    try {
      verifiedContext = await verifyVideoIdentity(url);
    } catch (verifyErr: any) {
      return res.status(400).json({ error: verifyErr.message || 'URL de vídeo inválida.' });
    }
  } else {
    return res.status(400).json({ error: 'URL do vídeo ou arquivo local é obrigatório.' });
  }

  console.log(`[ANALYZE] videoId=${verifiedContext.videoId}`);
  console.log(`[ANALYZE] mode=${analysisMode}`);
  console.log('[ANALYZE] started');

  const analysisId = randomUUID();
  const sourceFingerprint = createHash('sha256')
    .update(`${verifiedContext.videoId}::${verifiedContext.title}::${verifiedContext.sourceUrl}`)
    .digest('hex');

  const analysisContext = {
    analysisId,
    sourceUrl: verifiedContext.sourceUrl,
    videoId: verifiedContext.videoId,
    videoTitle: verifiedContext.title,
    channelTitle: verifiedContext.channelTitle,
    clipStartSeconds: startSec,
    clipEndSeconds: endSec,
    sourceFingerprint,
  };

  // Logs obrigatórios de rastreabilidade do vídeo
  console.log(`[VIDEO]\nanalysisId=${analysisContext.analysisId}\nsourceUrl=${analysisContext.sourceUrl}\nvideoId=${analysisContext.videoId}\ntitle=${analysisContext.videoTitle}`);

  const ai = new GoogleGenAI({ 
    apiKey,
    httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
  });

  try {
    // --- ETAPA 1: EXTRAÇÃO AUDIOVISUAL E TRANSCRICIONAL REAL ---
    const evidence = await processMultimodalVideoEvidence(
      verifiedContext.videoId,
      verifiedContext.sourceUrl,
      analysisMode,
      startSec,
      endSec,
      localVideoPath,
      analysisId
    );

    // Emissão dos logs de extração de frames e transcrição
    console.log(`[FRAMES]\nrequested=${evidence.requestedFramesCount || (analysisMode === 'complete' ? 16 : 8)}\nextracted=${evidence.frames.length}\ntimestamps=${evidence.frames.map((f: any) => f.timestampSeconds).join(', ') || 'none'}`);
    console.log(`[TRANSCRIPT]\nvideoId=${analysisContext.videoId}\nsegments=${evidence.transcriptSegments.length}`);
    console.log(`[GEMINI]\nanalysisId=${analysisContext.analysisId}\nframesAttached=${evidence.frames.length}\ntranscriptAttached=${evidence.transcriptSegments.length > 0}`);

    for (const l of evidence.extractionLog) {
      console.log(l);
    }

    // --- ETAPA 2: PESQUISA GOOGLE SEARCH COMO FONTE SECUNDÁRIA ---
    const searchPrompt = `Pesquise no Google Search para identificar a partida de futebol deste vídeo do YouTube:
SOURCE VIDEO ID: "${verifiedContext.videoId}"
SOURCE VIDEO TITLE: "${verifiedContext.title}"
SOURCE URL: ${verifiedContext.sourceUrl}

DIRETRIZES:
1. Identifique os clubes exatos (Time A x Time B), a competição, a temporada e a data exata da partida correspondente a este vídeo.
2. Se o vídeo for de uma temporada específica, não confunda com jogos de anos anteriores.
3. Se encontrar a súmula oficial com escalação titular confirmada desta data, liste os titulares. Se não tiver certeza absoluta, deixe os arrays vazios.
4. Identifique o placar real final oficial.`;

    const SEARCH_SCHEMA = {
      type: Type.OBJECT,
      properties: {
        timeA: { type: Type.STRING },
        timeB: { type: Type.STRING },
        placarReal: { type: Type.STRING },
        competicao: { type: Type.STRING },
        temporada: { type: Type.STRING },
        data: { type: Type.STRING },
        estadio: { type: Type.STRING },
        cidade: { type: Type.STRING },
        escalaA: { type: Type.ARRAY, items: { type: Type.STRING } },
        escalaB: { type: Type.ARRAY, items: { type: Type.STRING } },
        fontesPesquisadas: { type: Type.ARRAY, items: { type: Type.STRING } }
      },
      required: ['timeA', 'timeB', 'placarReal', 'competicao', 'fontesPesquisadas']
    };

    let searchData: any = {};
    let sources: { title: string; uri: string }[] = [];

    try {
      const searchResponse = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: searchPrompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: SEARCH_SCHEMA,
          tools: [{ googleSearch: {} }]
        }
      });
      searchData = JSON.parse(searchResponse.text || '{}');
      const chunks = searchResponse.candidates?.[0]?.groundingMetadata?.groundingChunks;
      sources = chunks?.map((chunk: any) => ({
        uri: chunk.web?.uri,
        title: chunk.web?.title
      })).filter((s: any) => s.uri) || [];
    } catch (sErr) {
      console.warn('[SEARCH] Aviso na pesquisa secundária:', sErr);
    }

    // --- ETAPA 3: VALIDAÇÃO DE CONTEXTO E CÁLCULO DE STATUS ---
    let timeA = String(searchData?.timeA || '').trim();
    let timeB = String(searchData?.timeB || '').trim();
    if (!timeA || !timeB) {
      const vsMatch = verifiedContext.title.match(/(.+?)\s+(?:x|X|vs\.?|contra|-)\s+(.+?)(?:\||-|–|—|\(|\d{1,2}[\/\.]\d{1,2}|$)/i);
      if (vsMatch && vsMatch[1] && vsMatch[2]) {
        timeA = timeA || vsMatch[1].replace(/^(assista|ao vivo|melhores momentos|jogo completo|gols|resumo|transmissão de|highlights)\s*[:\-–—]?\s*/i, '').trim();
        timeB = timeB || vsMatch[2].replace(/\s*(gols|melhores momentos|resumo|jogo completo|ao vivo|highlights).*$/i, '').trim();
      }
    }
    timeA = timeA || 'Time A';
    timeB = timeB || 'Time B';

    const normalizedTeamA = normalizeTeamName(timeA);
    const normalizedTeamB = normalizeTeamName(timeB);
    const isLineupConfirmed = Array.isArray(searchData?.escalaA) && searchData.escalaA.length >= 7 && Array.isArray(searchData?.escalaB) && searchData.escalaB.length >= 7;

    // Separação estrita de evidências
    const hasVisualEvidence = Boolean(evidence.hasRealVideoFrames && evidence.frames.length > 0);
    const hasTranscriptEvidence = Boolean(evidence.hasTranscript && evidence.transcriptSegments.length > 0);
    const isIdentityConfirmed = Boolean(verifiedContext.videoId && (verifiedContext.title || verifiedContext.sourceUrl));

    // Métricas de cobertura visual
    const frameCount = evidence.frames.length;
    const firstTimestamp = frameCount > 0 ? evidence.frames[0].timestampSeconds : 0;
    const lastTimestamp = frameCount > 0 ? evidence.frames[frameCount - 1].timestampSeconds : 0;
    const analyzedDuration = Math.max(1, endSec - startSec);
    const coverageSpan = Math.max(0, lastTimestamp - firstTimestamp);
    const coverageRatio = frameCount > 1 ? Math.min(1, Math.max(0, coverageSpan / analyzedDuration)) : (frameCount === 1 ? 0.2 : 0);

    const visualCoverage = {
      frameCount,
      firstTimestamp,
      lastTimestamp,
      analyzedDuration,
      coverageRatio: Math.round(coverageRatio * 100) / 100
    };

    // Limiares para validação das seções visuais
    const enoughForTacticalShape = hasVisualEvidence && frameCount >= 6 && visualCoverage.coverageRatio >= 0.20;
    const enoughForVisualScouting = hasVisualEvidence && frameCount >= 8 && visualCoverage.coverageRatio >= 0.20;

    let isMatchContextCoherent = false;
    let isConflict = false;

    if (searchData?.timeA && searchData?.timeB) {
      const searchNormA = normalizeTeamName(searchData.timeA);
      const searchNormB = normalizeTeamName(searchData.timeB);
      if (searchNormA && searchNormB && (searchNormA === normalizedTeamA || searchNormA === normalizedTeamB)) {
        isMatchContextCoherent = true;
      } else if (normalizedTeamA && normalizedTeamB && searchNormA && searchNormB && searchNormA !== normalizedTeamA && searchNormB !== normalizedTeamB) {
        isConflict = true;
      }
    } else if (normalizedTeamA && normalizedTeamB && normalizedTeamA !== 'time a' && normalizedTeamB !== 'time b') {
      isMatchContextCoherent = true;
    }

    // Status global de validação
    let validationStatus: 'verified' | 'partial' | 'unverified' | 'conflict' = 'unverified';
    if (isConflict) {
      validationStatus = 'conflict';
    } else if (isIdentityConfirmed && hasVisualEvidence && isMatchContextCoherent && !isConflict) {
      validationStatus = 'verified';
    } else if (isIdentityConfirmed && hasTranscriptEvidence && isMatchContextCoherent) {
      validationStatus = 'partial';
    } else if (hasVisualEvidence || hasTranscriptEvidence || isMatchContextCoherent || searchData?.timeA) {
      validationStatus = 'partial';
    } else {
      validationStatus = 'unverified';
    }

    // Validação granular por seção
    const sectionValidation = {
      matchIdentity: (isConflict ? 'unverified' : (isIdentityConfirmed && (hasVisualEvidence || hasTranscriptEvidence) && isMatchContextCoherent ? 'verified' : (isIdentityConfirmed || isMatchContextCoherent || searchData?.timeA ? 'partial' : 'unverified'))) as 'verified' | 'partial' | 'unverified',
      score: (isMatchContextCoherent && searchData?.placarReal && searchData.placarReal !== 'Não identificado' ? 'verified' : (hasTranscriptEvidence || hasVisualEvidence ? 'partial' : 'unverified')) as 'verified' | 'partial' | 'unverified',
      tacticalShape: (enoughForTacticalShape ? 'verified' : (isLineupConfirmed ? 'partial' : 'unverified')) as 'verified' | 'partial' | 'unverified',
      // Storyboard frames alone cannot prove a full-match heatmap; without tracking data this is at most partial.
      heatmap: (hasVisualEvidence && frameCount >= 6 ? 'partial' : 'unverified') as 'verified' | 'partial' | 'unverified',
      scouting: (enoughForVisualScouting ? 'verified' : (hasTranscriptEvidence || isLineupConfirmed ? 'partial' : 'unverified')) as 'verified' | 'partial' | 'unverified',
      statistics: ((hasVisualEvidence || hasTranscriptEvidence) ? 'partial' : 'unverified') as 'verified' | 'partial' | 'unverified',
    };

    // Logs detalhados de auditoria e teste
    console.log('[VIDEO]', verifiedContext.videoId);
    console.log('[EVIDENCE] realFrames:', evidence.frames.length);
    console.log('[EVIDENCE] thumbnail:', evidence.hasThumbnailReference);
    console.log('[EVIDENCE] transcriptSegments:', evidence.transcriptSegments.length);
    console.log('[EVIDENCE] clipRange:', `${startSec}s - ${endSec}s (${formatSecondsToTimestamp(startSec)} - ${formatSecondsToTimestamp(endSec)})`);
    console.log('[VALIDATION] status:', validationStatus);

    // --- ETAPA 4: MONTAGEM DO PROMPT MULTIMODAL COM EVIDÊNCIAS ---
    const multimodalParts: any[] = [];

    // Adiciona frames visuais reais ou referência de thumbnail com aviso obrigatório
    if (evidence.frames.length > 0) {
      for (const frame of evidence.frames) {
        multimodalParts.push({
          inlineData: {
            mimeType: frame.mimeType,
            data: frame.base64
          }
        });
      }
    } else if (evidence.thumbnailFrame) {
      multimodalParts.push({
        text: 'ATENÇÃO CRÍTICA SOBRE A IMAGEM FORNECIDA:\nA imagem abaixo é apenas a THUMBNAIL do vídeo e NÃO representa um frame da partida.\nNÃO utilize esta imagem para inferir formação tática, posicionamento, jogadores, mapa de calor, eventos ou scouting.'
      });
      multimodalParts.push({
        inlineData: {
          mimeType: evidence.thumbnailFrame.mimeType,
          data: evidence.thumbnailFrame.base64
        }
      });
    }

    const promptText = `SISTEMA PROTÁTICA V3 — ANÁLISE TÁTICA MULTIMODAL E SCOUTING PROFISSIONAL
Você é um analista tático sênior nível UEFA Pro do ProTática.

DADOS DO VÍDEO ANALISADO:
- VIDEO ID: ${verifiedContext.videoId}
- TÍTULO: "${verifiedContext.title}"
- CANAL: "${verifiedContext.channelTitle}"
- INTERVALO DO CLIPE: ${startSec}s a ${endSec}s (${formatSecondsToTimestamp(startSec)} a ${formatSecondsToTimestamp(endSec)})
- MODO: ${analysisMode.toUpperCase()}

MATCH CONTEXT IDENTIFICADO:
- Time A (Mandante): ${timeA}
- Time B (Visitante): ${timeB}
- Competição: ${searchData?.competicao || 'Não identificada'}
- Temporada: ${searchData?.temporada || 'Não identificada'}
- Data do Jogo: ${searchData?.data || 'Não identificada'}
- Placar Real da Pesquisa: ${searchData?.placarReal || 'Não identificado'}

EVIDÊNCIA PRIMÁRIA AUDIOVISUAL:
- Frames visuais reais do vídeo: ${evidence.hasRealVideoFrames ? `${evidence.frames.length} frames capturados com minutagem real entre ${startSec}s e ${endSec}s.` : 'Evidência visual de frames do vídeo indisponível (apenas referência visual de capa fornecida).'}
${evidence.hasTranscript ? `\nTRANSCRIÇÃO DE ÁUDIO COM MINUTAGEM DO TRECHO (${startSec}s a ${endSec}s, modo ${analysisMode}):\n${evidence.transcriptFullText.slice(0, 4500)}` : '\nTranscrição textual: Não disponível diretamente no trecho.'}

DIRETRIZES FUNDAMENTAIS PARA AS SEÇÕES DA ANÁLISE:
1. FIDELIDADE ABSOLUTA AO VÍDEO ATUAL: Analise EXCLUSIVAMENTE as ações ocorridas entre ${formatSecondsToTimestamp(startSec)} e ${formatSecondsToTimestamp(endSec)} deste vídeo. NÃO utilize memórias de outros confrontos, temporadas passadas ou escalações genéricas.
2. GERAL: Forneça um resumo tático profundo da partida/lance contido no clipe, momentos-chave detalhados com timestamps reais entre ${formatSecondsToTimestamp(startSec)} e ${formatSecondsToTimestamp(endSec)}, contexto e conclusões objetivas.
3. FORMAÇÕES: Detalhe o esquema tático (ex: 4-3-3, 4-2-3-1, 3-5-2), titulares e destaques funcionais para Time A e Time B (utilize escalações oficiais confirmadas pela pesquisa ou observadas no jogo).
4. FASES DO JOGO: Detalhe a fase defensiva (posicionamento do bloco, compactação, pressão pós-perda, transição) e ofensiva (saída de bola, criação, finalização e movimentações) de cada time no trecho.
5. ESTATÍSTICAS & POSSE DE BOLA: NÃO INVENTE NÚMEROS. Só preencha posse, finalizações, finalizações no alvo, passes certos, faltas, desarmes, escanteios e impedimentos quando o valor estiver explicitamente observado no vídeo/transcrição ou confirmado por fonte confiável da partida. Quando não houver evidência suficiente, use 'Não disponível'.
6. MAPA DE CALOR & TERÇOS: Trate a distribuição espacial como observação qualitativa. Só informe percentuais se puderem ser derivados de evidência visual suficiente; caso contrário, use 'Não disponível'.
7. INDICADORES AVANÇADOS: NÃO estime xG nem outras métricas avançadas por plausibilidade. Informe xG, grandes chances e passes no terço final apenas quando houver fonte/medição explícita. Sem evidência, use 'Não disponível'.
8. SCOUTING INDIVIDUAL E IDENTIFICAÇÃO PROGRESSIVA: Analise de 3 a 6 jogadores em destaque. Se um jogador for identificado pelo número da camisa (ex: #8) mas seu nome completo não puder ser confirmado, use 'Jogador nº 8 – [Time]' e nivelConfianca 'media'/'baixa'. NUNCA atribua o nome de uma estrela que não participou do lance/jogo.
9. AUDITORIA DE PLACAR: Informe o placar final confirmado (${searchData?.placarReal || 'Não informado'}), placar visível no vídeo, fonte e confiança.
10. Toda a resposta DEVE ser um JSON estritamente válido em Português do Brasil de acordo com o esquema RESPONSE_SCHEMA.`;

    multimodalParts.push({ text: promptText });

    const aiResponse = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: multimodalParts,
      config: {
        responseMimeType: 'application/json',
        responseSchema: RESPONSE_SCHEMA,
        maxOutputTokens: 8192,
        temperature: 0.1,
      }
    });

    const rawText = aiResponse.text;
    if (!rawText) throw new Error('A IA não retornou conteúdo. Tente novamente.');

    const parsed = parseJsonResponse(rawText);
    if (!parsed) throw new Error('Falha ao processar o formato da análise. Tente novamente.');

    // --- ETAPA 5: SANITIZAÇÃO, AUDITORIA DE PLACAR E NORMALIZAÇÃO ---
    parsed.timeA = timeA;
    parsed.timeB = timeB;

    if (!parsed.contextoPartida) parsed.contextoPartida = {};
    parsed.contextoPartida.competicao = searchData?.competicao || parsed.contextoPartida.competicao || 'Não identificada';
    parsed.contextoPartida.temporada = searchData?.temporada || parsed.contextoPartida.temporada || 'Não identificada';
    parsed.contextoPartida.dataJogo = searchData?.data || parsed.contextoPartida.dataJogo || 'Não identificada';
    parsed.contextoPartida.estadio = searchData?.estadio || parsed.contextoPartida.estadio || 'Não identificado';
    parsed.contextoPartida.cidade = searchData?.cidade || parsed.contextoPartida.cidade || 'Não identificada';

    // 5 Fontes separadas de auditoria do placar
    const visualScore = parsed.placarAuditoria?.placarVisivel || null;
    const officialScore = searchData?.placarReal && searchData.placarReal !== 'Não identificado' ? searchData.placarReal : null;
    const transcriptScore = null;
    const aiInferenceScore = parsed.placar || null;
    const metadataScore = officialScore;

    if (!parsed.placarAuditoria) parsed.placarAuditoria = {};
    parsed.placarAuditoria.scoreEvidence = {
      videoVisual: visualScore,
      visual: visualScore,
      transcript: transcriptScore,
      metadata: metadataScore,
      officialSource: officialScore,
      aiInference: aiInferenceScore,
      ai: aiInferenceScore,
    };

    // Ajustes de Formações baseados em confiabilidade
    if (!enoughForTacticalShape && isLineupConfirmed && parsed.formacoes) {
      if (parsed.formacoes.timeA && parsed.formacoes.timeA.esquema) {
        if (!parsed.formacoes.timeA.destaquesFuncionais?.includes('fonte externa')) {
          parsed.formacoes.timeA.destaquesFuncionais = (parsed.formacoes.timeA.destaquesFuncionais ? parsed.formacoes.timeA.destaquesFuncionais + ' ' : '') + '(Formação informada por dados oficiais da partida.)';
        }
      }
      if (parsed.formacoes.timeB && parsed.formacoes.timeB.esquema) {
        if (!parsed.formacoes.timeB.destaquesFuncionais?.includes('fonte externa')) {
          parsed.formacoes.timeB.destaquesFuncionais = (parsed.formacoes.timeB.destaquesFuncionais ? parsed.formacoes.timeB.destaquesFuncionais + ' ' : '') + '(Formação informada por dados oficiais da partida.)';
        }
      }
    }

    // Ajustes de Scouting Individual com Identidade Progressiva
    if (Array.isArray(parsed.analiseJogadores)) {
      parsed.analiseJogadores = parsed.analiseJogadores.filter((p: any) => p && (p.nome || p.camisa));
      for (const p of parsed.analiseJogadores) {
        if (enoughForVisualScouting) {
          p.identificationSource = p.identificationSource || 'visual';
          p.visualConfidence = typeof p.visualConfidence === 'number' ? p.visualConfidence : 0.85;
          p.textualConfidence = typeof p.textualConfidence === 'number' ? p.textualConfidence : (hasTranscriptEvidence ? 0.90 : 0.50);
          p.identificacao = p.identificacao || 'Jogador identificado no vídeo.';
          p.nivelConfianca = p.nivelConfianca || 'alta';
        } else if (hasTranscriptEvidence) {
          p.identificationSource = 'transcript';
          p.visualConfidence = 0.0;
          p.textualConfidence = typeof p.textualConfidence === 'number' ? p.textualConfidence : 0.88;
          p.identificacao = p.identificacao || 'Jogador citado na partida.';
          p.nivelConfianca = p.nivelConfianca || 'media';
        } else {
          p.identificationSource = p.identificationSource || 'official-source';
          p.visualConfidence = 0.0;
          p.textualConfidence = 0.50;
          p.identificacao = p.identificacao || 'Jogador escalado na partida.';
          p.nivelConfianca = p.nivelConfianca || 'media';
        }

        // Emissão do log obrigatório [PLAYER ID]
        console.log(`[PLAYER ID]\nshirtNumber=${p.camisa || 'N/D'}\nteam=${p.time || 'N/D'}\nprobableName=${p.probableName || p.nome || 'N/D'}\nconfirmedName=${p.confirmedName || (p.nivelConfianca === 'alta' ? p.nome : 'Não confirmado')}\nconfidence=${p.nivelConfianca || 'baixa'}`);
      }
    }

    const normalized = normalizeAnalysisResponse({
      ...parsed,
      analysisId,
      videoUrl: verifiedContext.sourceUrl,
      videoId: verifiedContext.videoId,
      videoTitle: verifiedContext.title,
      sources,
      sourceFingerprint,
      validationStatus,
      sectionValidation,
      visualCoverage,
      verifiedVideoContext: verifiedContext,
      verificacaoAuditoria: {
        ...parsed.verificacaoAuditoria,
        partidaIdentificada: `${timeA} x ${timeB}`,
        modeloUsado: GEMINI_MODEL,
        trechoAnalisado: `${startSec}s - ${endSec}s (${formatSecondsToTimestamp(startSec)} - ${formatSecondsToTimestamp(endSec)})`,
        estrategiaAnalise: `Análise Audiovisual Multimodal (${evidence.frames.length} frames, ${evidence.transcriptSegments.length} falas) com Verificação Secundária`,
        nivelConfianca: validationStatus === 'verified' ? 'alta' : validationStatus === 'partial' ? 'media' : 'baixa',
        fontesPrincipais: sources.map((s: any) => s.title || s.uri)
      }
    });

    // Verificação de integridade estrita
    if (normalized.videoId !== verifiedContext.videoId || normalized.sourceFingerprint !== sourceFingerprint) {
      throw new Error('Falha de consistência entre vídeo e análise.');
    }

    console.log('[RESULT] attached videoId:', normalized.videoId);
    console.log('[VALIDATION] validationStatus:', normalized.validationStatus);

    const saved = saveAnalysis(normalized, user?.id);
    normalized.analysisId = saved.id;
    console.log('[DB] videoId salvo:', normalized.videoId, 'analysisId:', normalized.analysisId);

    // Auto-Publish Telegram somente se status for 'verified'
    try {
      const tgConfig = getTelegramConfig();
      if (tgConfig.active && tgConfig.autoPublish && tgConfig.hasToken && normalized.validationStatus === 'verified') {
        publishAnalysis(normalized, { isAuto: true }).catch((tgErr) => {
          console.warn('[Telegram Auto-Publish Error]:', tgErr);
        });
      }
    } catch (tgEx) {
      console.warn('[Telegram Auto-Publish Exception]:', tgEx);
    }

    res.json({ analysis: normalized });
  } catch (err: any) {
    console.error('Erro técnico na análise:', err);
    res.status(500).json({ error: err.message || 'Erro ao processar análise.' });
  } finally {
    if (localVideoPath && existsSync(localVideoPath)) {
      try { rmSync(localVideoPath, { force: true }); } catch {}
    }
    try {
      const tempDir = join('/tmp', 'protatica', analysisId);
      if (existsSync(tempDir)) {
        rmSync(tempDir, { recursive: true, force: true });
      }
    } catch {}
  }
});

// --- PERGUNTE AO SEU JOGO (INTERAÇÃO BASEADA EM EVIDÊNCIAS DA PARTIDA) ---
app.post('/api/match/ask', requireAuth, requireActiveSubscription, requirePlanAtLeast('performance'), async (req, res) => {
  try {
    const currentUser = (req as any).user;
    if (!enforceRateLimit(req, res, `match_ask:${currentUser?.id || 'unknown'}`, 30, 60 * 60)) return;
    const { question, analysisContext, analysisId } = req.body;
    if (!question || typeof question !== 'string' || question.trim().length === 0) {
      return res.status(400).json({ error: 'Pergunta inválida ou vazia.' });
    }

    let matchContext = analysisContext;
    if (!matchContext && analysisId) {
      matchContext = getAnalysisById(analysisId, getAnalysisOwnerScope(currentUser));
    }

    if (!matchContext) {
      return res.status(400).json({ error: 'Contexto da análise não encontrado para consulta.' });
    }

    const apiKey = getGeminiApiKey();
    if (!apiKey) {
      return res.status(500).json({ error: 'Chave do Gemini não configurada no servidor.' });
    }

    const ai = new GoogleGenAI({ apiKey });

    const systemPrompt = `Você é o "Pergunte ao seu Jogo" do ProTática, um assistente tático sênior nível UEFA Pro.
Sua missão é responder à pergunta do analista/treinador com precisão cirúrgica, BASEANDO-SE ESTRITAMENTE nos dados, eventos, estatísticas, escalações e trechos analisados desta partida.

REGRAS DE CONFIABILIDADE E ANTI-ALUCINAÇÃO:
1. Responda EXCLUSIVAMENTE com base no contexto fornecido do jogo abaixo.
2. Se a pergunta for sobre um lance, jogador ou estatística NÃO coberta ou não verificada no clipe/partida analisada, declare com clareza e elegância: "Não há evidência visual ou de dados suficiente nesta análise para responder com segurança sobre este ponto."
3. Sempre que citar uma ação tática (ex: pressão alta, saída de três, espaço nas costas dos laterais), cite minutos/timestamps ou trechos se disponíveis no contexto.
4. Forneça insights práticos: O que aconteceu (Diagnóstico), Por que aconteceu (Causa tática) e Como explorar/corrigir (Recomendação).
5. Mantenha tom profissional, analítico, objetivo e direto ao ponto.

DADOS DA PARTIDA ANALISADA:
Título: ${matchContext.videoTitle || matchContext.title || 'Partida'}
Equipes: ${matchContext.teamA || matchContext.timeA} x ${matchContext.teamB || matchContext.timeB}
Placar: ${matchContext.placar || 'Não identificado'}
Competição: ${matchContext.contextoPartida?.competicao || matchContext.competition || 'Geral'}
Fase Ofensiva: ${JSON.stringify(matchContext.faseOfensiva || {})}
Fase Defensiva: ${JSON.stringify(matchContext.faseDefensiva || {})}
Estatísticas: ${JSON.stringify(matchContext.estatisticas || {})}
Jogadores Catalogados: ${JSON.stringify(matchContext.analiseJogadores || [])}
Momentos-Chave / Timeline: ${JSON.stringify(matchContext.timelineEventos || matchContext.momentosChave || [])}
Resumo da Partida: ${matchContext.resumoPartida || ''}
Conclusão: ${matchContext.conclusao || ''}
`;

    const userPrompt = `PERGUNTA DO ANALISTA/TREINADOR:
"${question.trim()}"

Responda em formato estruturado (com tópicos claros, timestamps quando aplicável e recomendação prática).`;

    const chatResponse = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: [
        { role: 'user', parts: [{ text: systemPrompt }, { text: userPrompt }] }
      ],
      config: {
        maxOutputTokens: 2048,
        temperature: 0.2,
      }
    });

    const answer = chatResponse.text || 'Não foi possível gerar a resposta no momento.';
    res.json({ answer, timestamp: new Date().toISOString() });
  } catch (err: any) {
    console.error('Erro no endpoint Pergunte ao Jogo:', err);
    res.status(500).json({ error: err.message || 'Erro ao processar pergunta tática.' });
  }
});

// --- GERADOR DE PLANOS DE TREINO (TRAINING PLANS API) ---
app.get('/api/tactical/plans', requireAuth, (req, res) => {
  try {
    const user = (req as any).user;
    const plans = listTrainingPlans(user?.id);
    res.json({ plans });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Erro ao listar planos de treino.' });
  }
});

app.post('/api/tactical/plans', requireAuth, requireActiveSubscription, requirePlanAtLeast('performance'), (req, res) => {
  try {
    const user = (req as any).user;
    const plan = req.body;
    if (!plan.title || !plan.problemIdentified || !plan.objective) {
      return res.status(400).json({ error: 'Título, problema identificado e objetivo são obrigatórios.' });
    }
    const saved = saveTrainingPlan({ ...plan, userId: user?.id });
    res.json({ plan: saved });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Erro ao salvar plano de treino.' });
  }
});

app.delete('/api/tactical/plans/:id', requireAuth, (req, res) => {
  try {
    const user = (req as any).user;
    const success = deleteTrainingPlan(req.params.id, user?.id);
    res.json({ success });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Erro ao remover plano de treino.' });
  }
});

// --- QUADRO TÁTICO (TACTICAL BOARDS API) ---
app.get('/api/tactical/boards', requireAuth, (req, res) => {
  try {
    const user = (req as any).user;
    const boards = listTacticalBoards(user?.id);
    res.json({ boards });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Erro ao listar pranchetas táticas.' });
  }
});

app.post('/api/tactical/boards', requireAuth, requireActiveSubscription, requirePlanAtLeast('intelligence'), (req, res) => {
  try {
    const user = (req as any).user;
    const board = req.body;
    if (!board.title) {
      return res.status(400).json({ error: 'Título do quadro tático é obrigatório.' });
    }
    const saved = saveTacticalBoard({ ...board, userId: user?.id });
    res.json({ board: saved });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Erro ao salvar quadro tático.' });
  }
});

app.delete('/api/tactical/boards/:id', requireAuth, (req, res) => {
  try {
    const user = (req as any).user;
    const success = deleteTacticalBoard(req.params.id, user?.id);
    res.json({ success });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Erro ao remover quadro tático.' });
  }
});

// --- BIBLIOTECA DE EVIDÊNCIAS (SAVED EVIDENCES API) ---
app.get('/api/tactical/evidences', requireAuth, (req, res) => {
  try {
    const user = (req as any).user;
    const category = req.query.category as string | undefined;
    const evidences = listSavedEvidences(user?.id, category);
    res.json({ evidences });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Erro ao listar evidências.' });
  }
});

app.post('/api/tactical/evidences', requireAuth, requireActiveSubscription, requirePlanAtLeast('intelligence'), (req, res) => {
  try {
    const user = (req as any).user;
    const evidence = req.body;
    if (!evidence.title || !evidence.timestamp || !evidence.description) {
      return res.status(400).json({ error: 'Título, timestamp e descrição são obrigatórios.' });
    }
    const saved = saveEvidenceItem({ ...evidence, userId: user?.id });
    res.json({ evidence: saved });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Erro ao salvar evidência.' });
  }
});

app.delete('/api/tactical/evidences/:id', requireAuth, (req, res) => {
  try {
    const user = (req as any).user;
    const success = deleteSavedEvidence(req.params.id, user?.id);
    res.json({ success });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Erro ao remover evidência.' });
  }
});

// --- METAS DA EQUIPE (TEAM GOALS API) ---
app.get('/api/tactical/goals', requireAuth, (req, res) => {
  try {
    const user = (req as any).user;
    const goals = listTeamGoals(user?.id);
    res.json({ goals });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Erro ao listar metas da equipe.' });
  }
});

app.post('/api/tactical/goals', requireAuth, requireActiveSubscription, requirePlanAtLeast('performance'), (req, res) => {
  try {
    const user = (req as any).user;
    const goal = req.body;
    if (!goal.title || !goal.targetBehavior) {
      return res.status(400).json({ error: 'Título e comportamento alvo são obrigatórios.' });
    }
    const saved = saveTeamGoal({ ...goal, userId: user?.id });
    res.json({ goal: saved });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Erro ao salvar meta.' });
  }
});

app.delete('/api/tactical/goals/:id', requireAuth, (req, res) => {
  try {
    const user = (req as any).user;
    const success = deleteTeamGoal(req.params.id, user?.id);
    res.json({ success });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Erro ao remover meta.' });
  }
});

// --- MINHA EQUIPE (TEAMS API) ---
app.get('/api/tactical/teams', requireAuth, (req, res) => {
  try {
    const user = (req as any).user;
    const teams = listTeams(user?.id);
    res.json({ teams });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Erro ao listar equipes.' });
  }
});

app.post('/api/tactical/teams', requireAuth, (req, res) => {
  try {
    const user = (req as any).user;
    const team = req.body;
    if (!team.name || !team.category || !team.season) {
      return res.status(400).json({ error: 'Nome, categoria e temporada são obrigatórios.' });
    }
    const saved = saveTeam({ ...team, userId: user?.id });
    res.json({ team: saved });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Erro ao salvar equipe.' });
  }
});

app.delete('/api/tactical/teams/:id', requireAuth, (req, res) => {
  try {
    const user = (req as any).user;
    const success = deleteTeam(req.params.id, user?.id);
    res.json({ success });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Erro ao remover equipe.' });
  }
});

// --- DOSSIÊ DO ADVERSÁRIO (OPPONENT DOSSIERS API) ---
app.get('/api/tactical/dossiers', requireAuth, (req, res) => {
  try {
    const user = (req as any).user;
    const dossiers = listOpponentDossiers(user?.id);
    res.json({ dossiers });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Erro ao listar dossiês.' });
  }
});

app.post('/api/tactical/dossiers', requireAuth, requireActiveSubscription, requirePlanAtLeast('intelligence'), (req, res) => {
  try {
    const user = (req as any).user;
    const dossier = req.body;
    if (!dossier.opponentName || !dossier.payload) {
      return res.status(400).json({ error: 'Nome do adversário e conteúdo do dossiê são obrigatórios.' });
    }
    const saved = saveOpponentDossier({ ...dossier, userId: user?.id });
    res.json({ dossier: saved });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Erro ao salvar dossiê.' });
  }
});

app.delete('/api/tactical/dossiers/:id', requireAuth, (req, res) => {
  try {
    const user = (req as any).user;
    const success = deleteOpponentDossier(req.params.id, user?.id);
    res.json({ success });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Erro ao remover dossiê.' });
  }
});

// Geração automática de Dossiê tático baseado estritamente nas partidas selecionadas
app.post('/api/tactical/dossiers/generate', requireAuth, requireActiveSubscription, requirePlanAtLeast('intelligence'), async (req, res) => {
  try {
    const { opponentName, matchIds } = req.body;
    if (!opponentName || !Array.isArray(matchIds) || matchIds.length === 0) {
      return res.status(400).json({ error: 'Nome do adversário e ao menos 1 partida analisada são necessários.' });
    }

    const currentUser = (req as any).user;
    const selectedAnalyses = matchIds
      .map((id: string) => getAnalysisById(id, getAnalysisOwnerScope(currentUser)))
      .filter((a) => Boolean(a));

    if (selectedAnalyses.length === 0) {
      return res.status(400).json({ error: 'Nenhuma partida correspondente encontrada.' });
    }

    const apiKey = getGeminiApiKey();
    if (!apiKey) {
      return res.status(500).json({ error: 'Chave do Gemini não configurada no servidor.' });
    }

    const ai = new GoogleGenAI({ apiKey });

    const contextMatches = selectedAnalyses.map((m, idx) => ({
      partidaIndex: idx + 1,
      titulo: m.videoTitle || m.title || 'Jogo',
      placar: m.placar || 'N/A',
      times: `${m.teamA || m.timeA} x ${m.teamB || m.timeB}`,
      faseOfensiva: m.faseOfensiva || {},
      faseDefensiva: m.faseDefensiva || {},
      jogadores: m.analiseJogadores || [],
      estatisticas: m.estatisticas || {},
      momentosChave: m.momentosChave || m.timelineEventos || [],
      resumo: m.resumoPartida || '',
    }));

    const prompt = `Você é um Analista de Desempenho e Scout Sênior nível UEFA Pro do ProTática.
Analise as ${selectedAnalyses.length} partidas fornecidas do adversário "${opponentName}" e gere um Dossiê Tático completo e rigoroso, estritamente baseado nas evidências dessas partidas.

REGRAS CRÍTICAS:
1. Baseie-se EXCLUSIVAMENTE nos dados das partidas enviadas.
2. Não invente jogadores ou fatos ausentes do contexto.
3. Se um aspecto não estiver claro, aponte "Evidência insuficiente nas partidas analisadas".
4. Retorne EXCLUSIVAMENTE um objeto JSON válido (sem markdown em volta).

FORMATO JSON OBRIGATÓRIO:
{
  "opponentName": "${opponentName}",
  "totalMatchesAnalyzed": ${selectedAnalyses.length},
  "mostUsedFormation": "ex: 4-3-3 ou 4-2-3-1",
  "tacticalVariations": ["variação 1", "variação 2"],
  "buildUpPlay": "Descrição da saída de bola do adversário com base nos dados",
  "pressingStyle": "Comportamento de pressão do adversário (bloco alto, médio, pós-perda)",
  "offensiveTransition": "Como atacam ao recuperar a bola",
  "defensiveTransition": "Como reagem ao perder a bola (recomposição, vulnerabilidades)",
  "setPieces": "Comportamento em bolas paradas (escanteios, faltas laterais)",
  "keyPlayers": [
    {
      "name": "Nome",
      "position": "Posição",
      "number": "Camisa se disponível",
      "mainStrengths": "Pontos fortes observados",
      "vulnerabilities": "Pontos fracos/como neutralizar"
    }
  ],
  "strengths": ["Ponto forte 1", "Ponto forte 2"],
  "vulnerabilities": ["Vulnerabilidade 1", "Vulnerabilidade 2"],
  "recurringPatterns": ["Padrão 1 observado em X partidas", "Padrão 2"],
  "howToExploit": [
    {
      "conclusion": "Diretriz tática clara de como vencer/neutralizar",
      "occurrencesInMatches": "Identificado em ${selectedAnalyses.length} jogos",
      "relatedEvidence": "Trechos/momentos onde o padrão se confirmou",
      "confidenceLevel": "Alta"
    }
  ]
}

DADOS DAS PARTIDAS:
${JSON.stringify(contextMatches, null, 2)}
`;

    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        responseMimeType: 'application/json',
        temperature: 0.15,
      }
    });

    const text = response.text || '{}';
    let dossierData: any = {};
    try {
      dossierData = JSON.parse(text);
    } catch {
      const match = text.match(/\{[\s\S]*\}/);
      if (match) dossierData = JSON.parse(match[0]);
    }

    res.json({ dossier: dossierData });
  } catch (err: any) {
    console.error('Erro ao gerar dossiê:', err);
    res.status(500).json({ error: err.message || 'Erro ao gerar dossiê com IA.' });
  }
});

// ========================================================
// --- COMPETIÇÕES (COMPETITIONS API) ---
// ========================================================
app.get('/api/competitions', (req, res) => {
  try {
    const onlyActive = req.query.onlyActive === 'true';
    const competitions = listCompetitions(onlyActive);
    res.json({ competitions });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Erro ao listar competições.' });
  }
});

app.get('/api/competitions/:id', (req, res) => {
  try {
    const competition = getCompetitionById(req.params.id);
    if (!competition) {
      return res.status(404).json({ error: 'Competição não encontrada.' });
    }
    const matches = listMatches({ competitionId: competition.id });
    res.json({ competition, matches });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Erro ao buscar competição.' });
  }
});

app.post('/api/competitions', requireAdmin, (req, res) => {
  try {
    const { name, season } = req.body;
    if (!name || !season) {
      return res.status(400).json({ error: 'Nome e temporada são obrigatórios.' });
    }
    const saved = saveCompetition(req.body);
    res.json({ competition: saved });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Erro ao salvar competição.' });
  }
});

app.delete('/api/competitions/:id', requireAdmin, (req, res) => {
  try {
    const success = deleteCompetition(req.params.id);
    res.json({ success });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Erro ao remover competição.' });
  }
});

// ========================================================
// --- PARTIDAS (MATCHES API) ---
// ========================================================
app.get('/api/matches', (req, res) => {
  try {
    const { competitionId, isFeatured, status, limit } = req.query;
    const matches = listMatches({
      competitionId: competitionId as string,
      isFeatured: isFeatured !== undefined ? isFeatured === 'true' : undefined,
      status: status as string,
      limit: limit ? Number(limit) : undefined,
    });
    res.json({ matches });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Erro ao listar partidas.' });
  }
});

app.get('/api/matches/:id', (req, res) => {
  try {
    const match = getMatchById(req.params.id);
    if (!match) {
      return res.status(404).json({ error: 'Partida não encontrada.' });
    }
    let analysis = null;
    if (match.analysisId) {
      analysis = getPublicAnalysisById(match.analysisId);
    }
    res.json({ match, analysis });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Erro ao buscar detalhes da partida.' });
  }
});

app.post('/api/matches', requireAdmin, (req, res) => {
  try {
    const { competitionId, homeTeam, awayTeam, matchDate } = req.body;
    if (!competitionId || !homeTeam || !awayTeam || !matchDate) {
      return res.status(400).json({ error: 'Competição, mandante, visitante e data são obrigatórios.' });
    }
    const saved = saveMatch(req.body);
    res.json({ match: saved });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Erro ao salvar partida.' });
  }
});

app.post('/api/matches/:id/link-analysis', requireAdmin, (req, res) => {
  try {
    const { analysisId } = req.body;
    const match = linkMatchAnalysis(req.params.id, analysisId || null);
    if (!match) {
      return res.status(404).json({ error: 'Partida não encontrada.' });
    }
    res.json({ match });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Erro ao vincular análise à partida.' });
  }
});

app.delete('/api/matches/:id', requireAdmin, (req, res) => {
  try {
    const success = deleteMatch(req.params.id);
    res.json({ success });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Erro ao remover partida.' });
  }
});

// ========================================================
// --- CATÁLOGO & GERENCIAMENTO DE JOGADORES (PLAYERS API) ---
// ========================================================
app.get('/api/players/catalog', (req, res) => {
  try {
    const { search, club, status } = req.query;
    const players = listPlayerCatalog({
      search: search as string,
      club: club as string,
      status: status as string,
    });
    res.json({ players });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Erro ao listar catálogo de jogadores.' });
  }
});

app.get('/api/players/catalog/:id', (req, res) => {
  try {
    const player = getPlayerCatalogEntry(req.params.id);
    if (!player) {
      return res.status(404).json({ error: 'Jogador não encontrado no catálogo.' });
    }
    res.json({ player });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Erro ao buscar jogador.' });
  }
});

app.post('/api/players/catalog', requireAdmin, (req, res) => {
  try {
    const { displayName, club } = req.body;
    if (!displayName || !club) {
      return res.status(400).json({ error: 'Nome e clube do jogador são obrigatórios.' });
    }
    const saved = savePlayerCatalogEntry(req.body);
    res.json({ player: saved });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Erro ao salvar jogador no catálogo.' });
  }
});

app.delete('/api/players/catalog/:id', requireAdmin, (req, res) => {
  try {
    const success = deletePlayerCatalogEntry(req.params.id);
    res.json({ success });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Erro ao remover jogador do catálogo.' });
  }
});

// ========================================================
// --- ANÁLISES PÚBLICAS & VISIBILIDADE ---
// ========================================================
app.get('/api/analyses/public', (req, res) => {
  try {
    const analyses = listPublicAnalyses(30);
    res.json({ analyses });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Erro ao listar análises públicas.' });
  }
});

app.post('/api/analyses/:id/visibility', requireAdmin, (req, res) => {
  try {
    const { visibility } = req.body;
    if (!['private', 'public', 'featured'].includes(visibility)) {
      return res.status(400).json({ error: 'Visibilidade inválida (use private, public ou featured).' });
    }
    const success = updateAnalysisVisibility(req.params.id, visibility);
    res.json({ success });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Erro ao atualizar visibilidade da análise.' });
  }
});


// --- VITE AND SERVER BOOTSTRAP ---
async function startServer() {
  const server = http.createServer(app);

  if (process.env.NODE_ENV !== "production") {
    const isHmrDisabled = process.env.DISABLE_HMR === 'true';
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: isHmrDisabled ? false : { server },
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
    // Non-blocking SMTP verification check (does not send email)
    verifySmtpConnection().catch(err => console.error('[SMTP ERROR]:', err.message || err));
  });
}

startServer();
