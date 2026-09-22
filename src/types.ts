export type StatEvidenceSource =
  | 'SOURCE_VIDEO'
  | 'SOURCE_TRANSCRIPT'
  | 'SOURCE_OFFICIAL'
  | 'SOURCE_STAT_PROVIDER'
  | 'SOURCE_SEARCH'
  | 'SOURCE_INFERRED';

export interface TeamMetrics {
  timeA?: string;
  timeB?: string;
  source?: StatEvidenceSource;
  confidence?: 'alta' | 'media' | 'baixa';
  verified?: boolean;
  unavailableReason?: 'missing_source' | 'insufficient_visual_evidence' | 'not_reported' | 'conflicting_sources';
}

export interface MapaDeCalor {
  tercoDefensivo?: string;
  tercoMedio?: string;
  tercoOfensivo?: string;
}

export interface Estatisticas {
  posseDeBola?: TeamMetrics;
  finalizacoes?: TeamMetrics;
  finalizacoesNoAlvo?: TeamMetrics;
  passesCertos?: TeamMetrics;
  faltasCometidas?: TeamMetrics;
  desarmes?: TeamMetrics;
  escanteios?: TeamMetrics;
  impedimentos?: TeamMetrics;
  mapaDeCalor?: {
    timeA?: MapaDeCalor;
    timeB?: MapaDeCalor;
  };
}

export interface ScoreEvidence {
  videoVisual?: string | null;
  visual?: string | null;
  transcript?: string | null;
  metadata?: string | null;
  officialSource?: string | null;
  aiInference?: string | null;
  ai?: string | null;
}

export interface PlacarAuditoria {
  placarFinal?: string;
  placarVisivel?: string;
  fontePlacar?: string;
  confianca?: string;
  observacoes?: string;
  evidencias?: string[];
  scoreEvidence?: ScoreEvidence;
}

export type VideoValidationStatus = 'verified' | 'partial' | 'unverified' | 'conflict' | 'mismatch';

export interface SectionValidation {
  matchIdentity: 'verified' | 'partial' | 'unverified';
  score: 'verified' | 'partial' | 'unverified';
  possession?: 'verified' | 'partial' | 'unverified';
  shots?: 'verified' | 'partial' | 'unverified';
  shotsOnTarget?: 'verified' | 'partial' | 'unverified';
  xG?: 'verified' | 'partial' | 'unverified';
  bigChances?: 'verified' | 'partial' | 'unverified';
  tacticalShape: 'verified' | 'partial' | 'unverified';
  heatmap: 'verified' | 'partial' | 'unverified';
  scouting: 'verified' | 'partial' | 'unverified';
  statistics: 'verified' | 'partial' | 'unverified';
}

export interface MatchFingerprint {
  competition?: string;
  date?: string;
  homeTeam?: string;
  awayTeam?: string;
  fingerprintHash?: string;
  isConfirmedMatch?: boolean;
}

export interface VisualCoverage {
  frameCount: number;
  firstTimestamp: number;
  lastTimestamp: number;
  analyzedDuration: number;
  coverageRatio: number;
}

export interface VerifiedVideoContext {
  sourceUrl: string;
  videoId: string;
  title: string;
  channelTitle?: string;
  duration?: number;
  verifiedAt: string;
  thumbnailUrl?: string;
}

export interface PlayerAnalysis {
  visualId?: string;
  shirtNumber?: string;
  probableName?: string;
  confirmedName?: string;
  identificationConfidence?: 'alta' | 'media' | 'baixa' | string;
  nome?: string;
  time?: string;
  posicao?: string;
  camisa?: string;
  identificacao?: string;
  identificationSource?: 'visual' | 'transcript' | 'official-source' | 'video' | 'official_source' | 'inference';
  visualConfidence?: number;
  textualConfidence?: number;
  minutosObservados?: string;
  acoesPercebidas?: string[];
  pontosFortes?: string[];
  pontosAtencao?: string[];
  nivelConfianca?: string;
  analise?: string;
  photoConfidenceScore?: number;
  photoSource?: string;
  photoUrl?: string;
  manualVerified?: boolean;
}

export interface TimelineEvent {
  minuto?: string;
  tempo?: string;
  timestamp?: string;
  time?: string;
  equipe?: string;
  tipo?: string;
  descricao?: string;
  impactoTatico?: string;
  grauImpacto?: 'alto' | 'medio' | 'baixo' | string;
  clipeSugerido?: { inicio?: string; fim?: string; motivo?: string };
}

export interface ContextoPartida {
  competicao?: string;
  temporada?: string;
  fase?: string;
  dataJogo?: string;
  estadio?: string;
  cidade?: string;
  arbitro?: string;
  publico?: string;
  condicoesClimaticas?: string;
}

export interface VerificacaoAuditoria {
  partidaIdentificada?: string;
  trechoAnalisado?: string;
  modeloUsado?: string;
  modelosUsadosNosTrechos?: string;
  segmentosAnalisados?: string;
  estrategiaAnalise?: string;
  observacoes?: string;
  nivelConfianca?: string;
  fontesPrincipais?: string[];
  fpsVideoUsado?: string;
  resolucaoMidia?: string;
  duracaoTrechoMinutos?: number;
}

export interface Analysis {
  analysisId?: string;
  createdAt?: string;
  videoTitle: string;
  videoUrl?: string;
  videoId?: string;
  timeA: string;
  timeB: string;
  placar: string;
  placarAuditoria?: PlacarAuditoria;
  resumoPartida: string;
  momentosChave: string;
  contextoPartida?: ContextoPartida;
  formacoes?: {
    timeA: { esquema?: string; titulares?: string[]; destaquesFuncionais?: string };
    timeB: { esquema?: string; titulares?: string[]; destaquesFuncionais?: string };
  };
  faseDefensiva?: {
    timeA: { posicionamento?: string; compactacao_pressao?: string; transicao?: string };
    timeB: { posicionamento?: string; compactacao_pressao?: string; transicao?: string };
  };
  faseOfensiva?: {
    timeA: { saidaDeBola?: string; criacao?: string; finalizacao_movimentacao?: string };
    timeB: { saidaDeBola?: string; criacao?: string; finalizacao_movimentacao?: string };
  };
  pressao?: {
    timeA: { alturaBloco?: string; gatilhos?: string; comportamentoSemBola?: string; ppdaEstimado?: string; recuperacaoAlta?: string };
    timeB: { alturaBloco?: string; gatilhos?: string; comportamentoSemBola?: string; ppdaEstimado?: string; recuperacaoAlta?: string };
  };
  modeloDeJogo?: {
    timeA: { organizacao?: string; saidaDeBola?: string; progressao?: string; tercoFinal?: string; finalizacao?: string; transicaoOfensiva?: string; transicaoDefensiva?: string; contraPressao?: string };
    timeB: { organizacao?: string; saidaDeBola?: string; progressao?: string; tercoFinal?: string; finalizacao?: string; transicaoOfensiva?: string; transicaoDefensiva?: string; contraPressao?: string };
  };
  estatisticas: Estatisticas;
  indicadoresAvancados?: Record<string, TeamMetrics>;
  pontosFortes?: { timeA?: string[]; timeB?: string[] };
  pontosFracos?: { timeA?: string[]; timeB?: string[] };
  analiseJogadores?: PlayerAnalysis[];
  linhaDoTempo?: TimelineEvent[];
  ajustesTreinadores?: string;
  recomendacoesTaticas?: { timeA?: string[]; timeB?: string[] };
  conclusaoRecomendacoes: string;
  verificacaoAuditoria?: VerificacaoAuditoria;
  sources?: { title: string; uri: string }[];
  sourceFingerprint?: string;
  validationStatus?: VideoValidationStatus;
  sectionValidation?: SectionValidation;
  visualCoverage?: VisualCoverage;
  matchFingerprint?: MatchFingerprint;
  verifiedVideoContext?: VerifiedVideoContext;
  indiceConfianca?: any;
}

export interface AnalysisHistoryItem {
  id: string;
  createdAt: string;
  videoTitle: string;
  timeA: string;
  timeB: string;
  placar: string;
  confidence?: string;
  // Compatibility fields
  title?: string;
  score?: string;
  created_at?: string;
  teamA?: string;
  teamB?: string;
  competition?: string;
  estatisticas?: Estatisticas;
  analiseJogadores?: PlayerAnalysis[];
  faseOfensiva?: any;
  faseDefensiva?: any;
}

export type JogadorScouting = PlayerAnalysis;

export interface TelegramConfig {
  active: boolean;
  hasToken: boolean;
  channelId: string;
  vipGroupId: string;
  autoPublish: boolean;
  autoSendReport: boolean;
  autoSendHeatmaps: boolean;
  sendAlerts: boolean;
  webhookSecret?: string;
  botInfo?: {
    username?: string;
    firstName?: string;
    id?: number;
  } | null;
}

export interface TelegramMessageLog {
  id: number;
  chat_id: string;
  tipo: string;
  conteudo_resumido: string;
  status: 'sucesso' | 'erro' | string;
  erro?: string;
  created_at: string;
}

export type AccountType = 'admin' | 'trial' | 'paid';

export type AccountAccessStatus =
  | 'trial_active'
  | 'trial_expired'
  | 'paid_active'
  | 'paid_expired'
  | 'blocked'
  | 'admin';

export interface User {
  id: string;
  username: string;
  email: string;
  name: string;
  displayName?: string;
  role: 'admin' | 'user';
  account_type?: AccountType;
  accountType?: AccountType;
  phone?: string;
  organization?: string;
  usage_profile?: string;
  usageProfile?: string;
  trial_used?: number;
  trialUsed?: boolean | number;
  trial_started_at?: string;
  trialStartedAt?: string;
  trial_expires_at?: string;
  trialExpiresAt?: string;
  trial_status?: 'none' | 'pending_verification' | 'active' | 'expired';
  trialStatus?: 'none' | 'pending_verification' | 'active' | 'expired';
  subscription_status?: 'active' | 'past_due' | 'cancelled' | 'expired';
  subscriptionStatus?: 'active' | 'past_due' | 'cancelled' | 'expired';
  subscription_plan?: string;
  subscriptionPlan?: string;
  subscription_started_at?: string;
  subscriptionStartedAt?: string;
  subscription_expires_at?: string;
  subscriptionExpiresAt?: string;
  converted_from_trial?: number;
  convertedFromTrial?: boolean | number;
  email_verified?: number;
  emailVerified?: boolean | number;
  is_blocked?: number;
  isBlocked?: boolean | number;
  last_login_at?: string;
  lastLoginAt?: string;
  created_at?: string;
  createdAt?: string;
  updated_at?: string;
  updatedAt?: string;
  accessStatus?: AccountAccessStatus;
  daysRemaining?: number;
  timeRemainingFormatted?: string;
}

export interface SubscriptionEvent {
  id: number;
  user_id?: string;
  userId?: string;
  event_type?: string;
  eventType?: string;
  details_json?: string;
  details?: any;
  metadata?: any;
  created_at?: string;
  createdAt?: string;
  username?: string;
  email?: string;
}

export interface EmailLog {
  id: number;
  user_id?: string;
  userId?: string;
  email?: string;
  recipientEmail?: string;
  type?: string;
  templateType?: string;
  subject?: string;
  status: string;
  provider_message_id?: string;
  error_summary?: string;
  errorMessage?: string;
  created_at?: string;
  createdAt?: string;
  sentAt?: string;
}

export type FeatureStatus = 'available' | 'beta' | 'coming_soon';

export interface EvidenceItem {
  id?: string;
  timestamp: string;
  description: string;
  team?: string;
  player?: string;
  source?: 'visual' | 'transcript' | 'official' | 'inferred' | string;
  confidence?: 'alta' | 'media' | 'baixa' | number;
  category?: 'ataque' | 'defesa' | 'pressao' | 'transicao' | 'finalizacoes' | 'bolas_paradas' | 'erros' | 'boas_acoes' | 'jogadores' | 'personalizado';
  videoUrl?: string;
  analysisId?: string;
  createdAt?: string;
}

export interface ConfidenceMetrics {
  overallPercent: number;
  visualEvidencePercent: number;
  matchDataPercent: number;
  transcriptPercent: number;
  aiInferencePercent: number;
  rating: 'alta' | 'media' | 'baixa';
}

export interface TacticalInsight {
  type: 'vulnerabilidade' | 'oportunidade' | 'recomendacao';
  title: string;
  description: string;
  confidence?: 'alta' | 'media' | 'baixa' | number;
  evidences?: EvidenceItem[];
  timestamps?: string[];
}

export interface TrainingPlan {
  id: string;
  userId?: string;
  analysisId?: string;
  title: string;
  problemIdentified: string;
  objective: string;
  duration: string;
  playersCount: string;
  materials: string;
  organization: string;
  execution: string;
  expectedBehaviors: string[];
  observationPoints: string[];
  progression: string;
  regression: string;
  nextMatchIndicators: string[];
  createdAt: string;
  updatedAt?: string;
}

export interface TacticalBoardData {
  id: string;
  userId?: string;
  title: string;
  formationA: string;
  formationB: string;
  playersA: Array<{ id: string; number: string; name: string; x: number; y: number; role?: string }>;
  playersB: Array<{ id: string; number: string; name: string; x: number; y: number; role?: string }>;
  drawings: Array<{ id: string; type: 'arrow' | 'line' | 'circle' | 'zone' | 'text'; points: number[]; text?: string; color: string }>;
  notes?: string;
  previewImage?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface TeamGoal {
  id: string;
  userId?: string;
  title: string;
  targetBehavior: string;
  currentStatus: 'baixo' | 'moderado' | 'bom' | 'muito_bom' | string;
  progressHistory: Array<{ matchTitle: string; date: string; value: string; note?: string }>;
  targetPeriod: string;
  achieved: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface OpponentDossierData {
  opponentName: string;
  analyzedMatchesCount: number;
  matches: Array<{ id: string; title: string; date: string; score: string }>;
  mostUsedFormation: string;
  tacticalVariations: string[];
  buildUpPatterns: string;
  pressingPatterns: string;
  offensiveTransition: string;
  defensiveTransition: string;
  setPieces: string;
  keyPlayers: Array<{ name: string; position: string; importance: string; notes: string }>;
  strengths: string[];
  vulnerabilities: string[];
  recurrentPatterns: string[];
  howToFace: Array<{
    opportunity: string;
    detectionFrequency: string;
    evidences: Array<{ matchTitle: string; timestamp: string; description: string }>;
    tacticalRecommendation: string;
  }>;
}

export interface PlanDefinition {
  id: string;
  name: string;
  category: 'scout' | 'performance' | 'intelligence' | 'club' | 'bronze' | 'pro' | 'elite';
  price: string;
  period: string;
  headline?: string;
  subheadline?: string;
  pillarBadge?: string;
  pillarAction?: string;
  description: string;
  features: string[];
  popular?: boolean;
  ctaText?: string;
  ctaSecondaryText?: string;
  status?: FeatureStatus;
}

export type AnalysisVisibility = 'private' | 'public' | 'featured';

export interface Competition {
  id: string;
  name: string;
  slug: string;
  country?: string;
  region?: string;
  logoUrl?: string;
  season: string;
  isActive: boolean;
  displayOrder: number;
  matchesCount?: number;
  analysesCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface Match {
  id: string;
  competitionId: string;
  competitionName?: string;
  competitionLogo?: string;
  homeTeam: string;
  awayTeam: string;
  homeTeamLogo?: string;
  awayTeamLogo?: string;
  /** URL do vídeo-fonte (YouTube) usada para iniciar a análise diretamente da partida. */
  videoUrl?: string;
  matchDate: string;
  round?: string;
  stadium?: string;
  status: 'scheduled' | 'finished' | 'live' | 'finished_waiting_video';
  analysisId?: string | null;
  isFeatured: boolean;
  featuredPlayerName?: string;
  featuredPlayerPhoto?: string;
  featuredPlayerPosition?: string;
  featuredPlayerTeam?: string;
  homeScore?: number | null;
  awayScore?: number | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface PlayerCatalogItem {
  id: string;
  normalizedName: string;
  displayName: string;
  club: string;
  position?: string;
  shirtNumber?: string;
  season?: string;
  photoUrl?: string;
  photoSource?: string;
  photoVerified: boolean;
  adminVerified: boolean;
  status: 'confirmed' | 'unconfirmed' | 'admin_verified';
  createdAt?: string;
  updatedAt?: string;
}
