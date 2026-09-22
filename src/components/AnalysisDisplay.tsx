import React from 'react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { Send, Search, Activity, Target, Flame, Users as UsersIcon, ShieldCheck, Sparkles, Video, MessageSquare, RefreshCw } from 'lucide-react';
import type { Analysis, Estatisticas, TeamMetrics } from '../types';
import PossessionChart from './PossessionChart';
import ShotsChart from './ShotsChart';
import HeatmapDisplay from './HeatmapDisplay';
import ErrorBoundary from './ErrorBoundary';
import { TelegramPublishModal } from './TelegramPublishModal';
import { PlayerPhoto } from './PlayerPhoto';
import { useLanguage } from '../context/LanguageContext';
import { exportAnalysisPdf } from '../utils/pdfDocumentBuilder';
import { ConfidenceIndexBadge } from './ConfidenceIndexBadge';
import { ThreeTacticalInsights } from './ThreeTacticalInsights';
import { VideoEvidenceTimeline } from './VideoEvidenceTimeline';
import { AskYourGameChat } from './AskYourGameChat';
import { getAuthHeaders } from '../services/geminiService';
import { hasValue, normalizeHeatPercent } from '../utils/normalizeAnalysis';

export interface AnalysisDisplayProps {
  analysis: Analysis;
  onGenerateTrainingPlan?: (problemText: string) => void;
}

export type SubTab = 'geral' | 'timeline' | 'chat' | 'posse' | 'finalizacoes' | 'calor' | 'scouting' | 'auditoria';

// DICTIONARY FOR MULTILANGUAGE LOCALIZATION
const loc: Record<string, any> = {
  pt: {
    tacticalReport: 'Relatório Tático Disponível',
    exportMessage: 'Exporte a análise atual completa para um documento PDF profissional com gráficos e estatísticas.',
    downloadBtn: 'Baixar PDF',
    generatingBtn: 'Gerando PDF...',
    tabGeral: 'Geral',
    tabTimeline: 'Evidências em Vídeo',
    tabChat: 'Pergunte ao Jogo',
    tabPosse: 'Posse de Bola',
    tabFinalizacoes: 'Finalizações',
    tabCalor: 'Mapa de Calor',
    tabScouting: 'Scouting',
    tabAuditoria: 'Auditoria & Confiança',
    videoIdentified: 'Vídeo Identificado',
    matchScore: 'Placar e Equipes',
    competition: 'Competição',
    stadium: 'Estádio',
    referee: 'Árbitro',
    date: 'Data do Jogo',
    generatedAt: 'Análise gerada em',
    summary: 'Resumo Geral da Partida',
    keyMoments: 'Momentos-Chave',
    tactics: 'Padrões Táticos e Organização',
    offensivePhase: 'Fase Ofensiva',
    defendingPhase: 'Fase Defensiva',
    statistics: 'Estatísticas Gerais',
    metric: 'Métrica',
    advancedIndicators: 'Indicadores Avançados',
    playersScouting: 'Scouting Individual de Jogadores',
    timeline: 'Linha do Tempo Tática',
    conclusions: 'Recomendações e Conclusão',
    auditReport: 'Relatório de Auditoria do Placar',
    confidence: 'Confiança',
    evidence: 'Evidências',
    observations: 'Observações de Auditoria',
    tacticalHeatmap: 'Mapa de Calor Tático',
    defendingThird: 'Terço Defensivo',
    middleThird: 'Terço Médio',
    attackingThird: 'Terço Ofensivo',
    downloading: 'Baixando...',
    rendering: 'Renderizando...',
    preparing: 'Preparando...',
    noData: 'Informações não disponíveis.',
    langSelector: 'Idioma do Relatório',
    scoutingTitle: 'Análise de Desempenho e Ações Percebidas',
    posseDeBola: 'Posse de Bola',
    finalizacoes: 'Finalizações',
    finalizacoesNoAlvo: 'No Alvo',
    passesCertos: 'Passes Certos',
    faltasCometidas: 'Faltas',
    desarmes: 'Desarmes',
    escanteios: 'Escanteios',
    impedimentos: 'Impedimentos',
    xG: 'Gols Esperados (xG)',
    grandesChances: 'Grandes Chances',
    passesTercoFinal: 'Passes no Terço Final',
    chutesNaArea: 'Chutes na Área',
    chutesForaDaArea: 'Chutes fora da Área',
    passesProgressivos: 'Passes Progressivos',
    cruzamentos: 'Cruzamentos',
    duelosGanhos: 'Duelos Ganhos',
    perdasDePosse: 'Perdas de Posse',
    recuperacoes: 'Recuperações',
    fieldTilt: 'Field Tilt',
    impact: 'Impacto Tático',
    timelineEvents: 'Linha do Tempo (Eventos)',
    concl: 'Conclusão e Auditoria',
    tacticalDetails: 'Detalhes Técnicos da Análise',
    strategyOfReview: 'Estratégia',
    modelUsed: 'Modelo',
    matchSegmentReviewed: 'Trecho',
    sourcesConfirmed: 'Fontes confirmadas (Busca Google)',
    playerAnalysisTitle: 'Análise de Jogadores',
    noPlayersTitle: 'Nenhum jogador catalogado individualmente',
    noPlayersDesc: 'A análise deste trecho focou nos padrões coletivos e dinâmicas táticas de equipe.',
    tacticalExplanation: 'Explicação Completa e Detalhes da Análise do Vídeo',
    reviewSubtitle: 'Revisão profunda dos eventos detectados, insights, observações táticas e validações empíricas.',
    descriptionMatch: 'Descrição da Partida e Resumo',
    keyMomentsTitle: 'Momentos-Chave e Timestamps',
    recomConclusions: 'Recomendações e Conclusões Técnicas',
    auditEvidence: 'Auditoria, Evidências & Métricas do Placar',
    confidenceAnalysis: 'Confiança da Análise',
    confirmedScore: 'Placar Final Confirmado',
    valSource: 'Fonte de Validação',
    scouActions: 'Ações percebidas',
    scouStrengths: 'Pontos fortes',
    scouAttention: 'Pontos de atenção',
    formAndFunctions: 'Formações e Funções',
    functionalHighlights: 'Destaques funcionais',
    tacticalInfoBlock: 'Posicionamento/Bloco',
    tacticalInfoComp: 'Compactação e Pressão',
    tacticalInfoTrans: 'Transição Defensiva',
    tacticalInfoBuild: 'Saída de bola',
    tacticalInfoCre: 'Criação/Progressão',
    tacticalInfoFin: 'Finalização e movimentação',
    heatmapTer: 'Mapa de Calor (terços)',
    advancedMetricsTitle: 'Indicadores avançados',
    noHeatmap: 'Mapa de calor indisponível por falta de evidência visual suficiente.',
    playerObserved: 'Jogador observado',
    camisaLabel: 'camisa',
    translatingText: 'Traduzindo conteúdo dinâmico...',
  },
  en: {
    tacticalReport: 'Tactical Report Available',
    exportMessage: 'Export the complete match analysis to a professional PDF document with charts and stats.',
    downloadBtn: 'Download PDF',
    generatingBtn: 'Generating PDF...',
    tabGeral: 'General',
    tabTimeline: 'Video Evidence',
    tabChat: 'Ask Your Game',
    tabPosse: 'Ball Possession',
    tabFinalizacoes: 'Shots',
    tabCalor: 'Heatmap',
    tabScouting: 'Scouting',
    tabAuditoria: 'Score Audit',
    videoIdentified: 'Identified Video',
    matchScore: 'Score & Teams',
    competition: 'Competition',
    stadium: 'Stadium',
    referee: 'Referee',
    date: 'Match Date',
    generatedAt: 'Analysis generated at',
    summary: 'General Match Summary',
    keyMoments: 'Key Moments',
    tactics: 'Tactical Patterns and Organization',
    offensivePhase: 'Offensive Phase',
    defendingPhase: 'Defensive Phase',
    statistics: 'Overall Statistics',
    metric: 'Metric',
    advancedIndicators: 'Advanced Indicators',
    playersScouting: 'Individual Player Scouting',
    timeline: 'Tactical Timeline',
    conclusions: 'Recommendations & Conclusion',
    auditReport: 'Score Audit Report',
    confidence: 'Confidence',
    evidence: 'Evidence',
    observations: 'Audit Observations',
    tacticalHeatmap: 'Tactical Heatmap',
    defendingThird: 'Defensive Third',
    middleThird: 'Middle Third',
    attackingThird: 'Attacking Third',
    downloading: 'Downloading...',
    rendering: 'Rendering...',
    preparing: 'Preparing...',
    noData: 'Information not available.',
    langSelector: 'Report Language',
    scoutingTitle: 'Performance Analysis & Observed Actions',
    posseDeBola: 'Ball Possession',
    finalizacoes: 'Shots',
    finalizacoesNoAlvo: 'Shots on Target',
    passesCertos: 'Passes Completed',
    faltasCometidas: 'Fouls',
    desarmes: 'Tackles',
    escanteios: 'Corners',
    impedimentos: 'Offsides',
    xG: 'Expected Goals (xG)',
    grandesChances: 'Big Chances',
    passesTercoFinal: 'Passes Final Third',
    chutesNaArea: 'Shots inside Box',
    chutesForaDaArea: 'Shots outside Box',
    passesProgressivos: 'Progressive Passes',
    cruzamentos: 'Crosses',
    duelosGanhos: 'Duels Won',
    perdasDePosse: 'Possession Lost',
    recuperacoes: 'Ball Recoveries',
    fieldTilt: 'Field Tilt',
    impact: 'Tactical Impact',
    timelineEvents: 'Timeline (Events)',
    concl: 'Conclusion and Audit',
    tacticalDetails: 'Technical details of analysis',
    strategyOfReview: 'Strategy',
    modelUsed: 'Model',
    matchSegmentReviewed: 'Segment',
    sourcesConfirmed: 'Confirmed sources (Google Search)',
    playerAnalysisTitle: 'Player Analysis',
    noPlayersTitle: 'No individual players recorded',
    noPlayersDesc: 'This analysis segment focused on collective team patterns and tactical dynamics.',
    tacticalExplanation: 'Complete Video Analysis Explanation & Details',
    reviewSubtitle: 'Deep review of detected events, insights, tactical observations, and empirical validations.',
    descriptionMatch: 'Match Description & Summary',
    keyMomentsTitle: 'Key Moments & Timestamps',
    recomConclusions: 'Technical Recommendations & Conclusions',
    auditEvidence: 'Audit, Evidence & Scoreboard Metrics',
    confidenceAnalysis: 'Analysis Confidence',
    confirmedScore: 'Confirmed Final Score',
    valSource: 'Validation Source',
    scouActions: 'Observed actions',
    scouStrengths: 'Strengths',
    scouAttention: 'Points of attention',
    formAndFunctions: 'Formations & Functions',
    functionalHighlights: 'Functional highlights',
    tacticalInfoBlock: 'Block / Positioning',
    tacticalInfoComp: 'Compactness & Pressing',
    tacticalInfoTrans: 'Defensive Transition',
    tacticalInfoBuild: 'Ball build-up',
    tacticalInfoCre: 'Creation & Progression',
    tacticalInfoFin: 'Finishing & movement',
    heatmapTer: 'Heatmap (thirds)',
    advancedMetricsTitle: 'Advanced indicators',
    noHeatmap: 'Heatmap not available.',
    playerObserved: 'Observed player',
    camisaLabel: 'shirt',
    translatingText: 'Translating dynamic content...',
  },
  es: {
    tacticalReport: 'Informe Táctico Disponible',
    exportMessage: 'Exporte el análisis completo del partido a un documento PDF profesional con gráficos y estadísticas.',
    downloadBtn: 'Descargar PDF',
    generatingBtn: 'Generando PDF...',
    tabGeral: 'General',
    tabTimeline: 'Evidencias en Video',
    tabChat: 'Pregunte a su Juego',
    tabPosse: 'Posesión de Balón',
    tabFinalizacoes: 'Remates',
    tabCalor: 'Mapa de Calor',
    tabScouting: 'Scouting',
    tabAuditoria: 'Auditoría de Marcador',
    videoIdentified: 'Video Identificado',
    matchScore: 'Marcador y Equipos',
    competition: 'Competición',
    stadium: 'Estadio',
    referee: 'Árbitro',
    date: 'Fecha del Partido',
    generatedAt: 'Análisis generado el',
    summary: 'Resumen General del Partido',
    keyMoments: 'Momentos Clave',
    tactics: 'Patrones Tácticos y Organización',
    offensivePhase: 'Fase Ofensiva',
    defendingPhase: 'Fase Defensiva',
    statistics: 'Estadísticas Generales',
    metric: 'Métrica',
    advancedIndicators: 'Indicadores Avanzados',
    playersScouting: 'Scouting Individual de Jugadores',
    timeline: 'Línea del Tiempo Táctica',
    conclusions: 'Recomendaciones y Conclusión',
    auditReport: 'Informe de Auditoría del Marcador',
    confidence: 'Confianza',
    evidence: 'Evidencias',
    observations: 'Observaciones de Auditoría',
    tacticalHeatmap: 'Mapa de Calor Tático',
    defendingThird: 'Tercio Defensivo',
    middleThird: 'Tercio Medio',
    attackingThird: 'Tercio Ofensivo',
    downloading: 'Descargando...',
    rendering: 'Renderizando...',
    preparing: 'Preparando...',
    noData: 'Información no disponible.',
    langSelector: 'Idioma del Informe',
    scoutingTitle: 'Análisis de Rendimiento y Acciones Percibidas',
    posseDeBola: 'Posesión de Balón',
    finalizacoes: 'Remates',
    finalizacoesNoAlvo: 'Al Arco',
    passesCertos: 'Pases Completados',
    faltasCometidas: 'Faltas',
    desarmes: 'Quites/Entradas',
    escanteios: 'Córneres',
    impedimentos: 'Fueras de Juego',
    xG: 'Goles Esperados (xG)',
    grandesChances: 'Grandes Oportunidades',
    passesTercoFinal: 'Pases en Zona de Ataque',
    chutesNaArea: 'Remates en el Área',
    chutesForaDaArea: 'Remates fuera del Área',
    passesProgressivos: 'Pases Progresivos',
    cruzamentos: 'Centros',
    duelosGanhos: 'Duelos Ganados',
    perdasDePosse: 'Posesiones Perdidas',
    recuperacoes: 'Recuperaciones',
    fieldTilt: 'Field Tilt',
    impact: 'Impacto Táctico',
    timelineEvents: 'Línea de Tiempo (Eventos)',
    concl: 'Conclusión y Auditoría',
    tacticalDetails: 'Detalles técnicos del análisis',
    strategyOfReview: 'Estrategia',
    modelUsed: 'Modelo',
    matchSegmentReviewed: 'Tramo',
    sourcesConfirmed: 'Fuentes confirmadas (Búsqueda Google)',
    playerAnalysisTitle: 'Análisis de Jugadores',
    noPlayersTitle: 'Sin jugadores registrados individualmente',
    noPlayersDesc: 'Este tramo de análisis se centró en patrones colectivos y dinámicas del equipo.',
    tacticalExplanation: 'Explicación Completa y Detalles del Análisis de Video',
    reviewSubtitle: 'Revisión profunda de eventos detectados, insights, observaciones tácticas y validaciones empíricas.',
    descriptionMatch: 'Descripción del Partido y Resumen',
    keyMomentsTitle: 'Momentos Clave y Timestamps',
    recomConclusions: 'Recomendaciones y Conclusiones Técnicas',
    auditEvidence: 'Auditoría, Evidencias y Métricas del Marcador',
    confidenceAnalysis: 'Confianza del Análisis',
    confirmedScore: 'Marcador Final Confirmado',
    valSource: 'Fuente de Validación',
    scouActions: 'Acciones percibidas',
    scouStrengths: 'Puntos fuertes',
    scouAttention: 'Puntos de atención',
    formAndFunctions: 'Formaciones y Funciones',
    functionalHighlights: 'Destaques funcionales',
    tacticalInfoBlock: 'Bloque / Posicionamiento',
    tacticalInfoComp: 'Compactación y Presión',
    tacticalInfoTrans: 'Transición Defensiva',
    tacticalInfoBuild: 'Salida de balón',
    tacticalInfoCre: 'Creación y progresión',
    tacticalInfoFin: 'Finalización y movimiento',
    heatmapTer: 'Mapa de Calor (tercios)',
    advancedMetricsTitle: 'Indicadores avanzados',
    noHeatmap: 'Mapa de calor no disponible.',
    playerObserved: 'Jugador observado',
    camisaLabel: 'camiseta',
    translatingText: 'Traduciendo contenido dinámico...',
  }
};

const AnalysisCard: React.FC<{ title: string; children: React.ReactNode; icon: React.ReactNode }> = ({ title, children, icon }) => (
  <div className="bg-[#2a0101]/60 rounded-lg shadow-lg p-6 border border-yellow-900/50 transform transition-transform duration-300 hover:scale-[1.01] hover:border-yellow-700/80 break-inside-avoid print:bg-white print:border print:border-gray-300 print:shadow-none print:transform-none print:text-black print:p-4 print:mb-4">
    <div className="flex items-center mb-4 print:border-b print:border-gray-300 print:pb-2">
      <div className="text-yellow-400 mr-3 print:text-black">{icon}</div>
      <h3 className="text-2xl font-bold text-yellow-100 print:text-black">{title}</h3>
    </div>
    <div className="text-yellow-101/80 leading-relaxed space-y-4 print:text-black">{children}</div>
  </div>
);

const SectionTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <h4 className="text-xl font-bold text-yellow-400 print:text-black print:font-bold">{children}</h4>
);

const TacticalInfo: React.FC<{ title: string; text?: string }> = ({ title, text }) => {
  if (!text) return null;
  return (
    <div>
      <h5 className="font-semibold text-lg text-yellow-200 print:text-black print:font-bold">{title}</h5>
      <p className="text-yellow-101/80 text-justify print:text-black whitespace-pre-wrap">{text}</p>
    </div>
  );
};

const MiniList: React.FC<{ items?: string[] }> = ({ items }) => {
  if (!items || !Array.isArray(items) || items.length === 0) return <span className="text-yellow-101/60 print:text-black">—</span>;
  return (
    <ul className="list-disc pl-5 space-y-1">
      {items.map((it, idx) => (
        <li key={idx}>{it}</li>
      ))}
    </ul>
  );
};

const formatDateTime = (value?: string) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('pt-BR');
};

const StatisticsTable: React.FC<{ stats: Estatisticas; timeA: string; timeB: string; currentLang: string }> = ({ stats, timeA, timeB, currentLang }) => {
  const statRows: { label: string; key: keyof Omit<Estatisticas, 'mapaDeCalor'>; localKey: string }[] = [
    { label: 'Posse de Bola', key: 'posseDeBola', localKey: 'posseDeBola' },
    { label: 'Finalizações', key: 'finalizacoes', localKey: 'finalizacoes' },
    { label: 'No Alvo', key: 'finalizacoesNoAlvo', localKey: 'finalizacoesNoAlvo' },
    { label: 'Passes Certos', key: 'passesCertos', localKey: 'passesCertos' },
    { label: 'Faltas', key: 'faltasCometidas', localKey: 'faltasCometidas' },
    { label: 'Desarmes', key: 'desarmes', localKey: 'desarmes' },
    { label: 'Escanteios', key: 'escanteios', localKey: 'escanteios' },
    { label: 'Impedimentos', key: 'impedimentos', localKey: 'impedimentos' },
  ];

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-center bg-[#4a0404]/50 rounded-lg print:bg-white print:border print:border-gray-300">
        <thead className="text-lg text-yellow-200 print:text-black print:bg-gray-100">
          <tr>
            <th className="p-3 font-bold text-left">{timeA}</th>
            <th className="p-3 font-bold">{loc[currentLang].metric}</th>
            <th className="p-3 font-bold text-right">{timeB}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-yellow-900/70 print:divide-gray-300">
          {statRows.map((row) => (
            <tr key={row.key} className="text-yellow-101/90 hover:bg-[#4a0404]/80 print:text-black">
              <td className="p-3 font-mono text-xl text-left">{safeMetric((stats?.[row.key] as any)?.timeA)}</td>
              <td className="p-3 font-semibold text-yellow-400/80 print:text-black">{(loc[currentLang] as any)[row.localKey] || row.label}</td>
              <td className="p-3 font-mono text-xl text-right">{safeMetric((stats?.[row.key] as any)?.timeB)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const AdvancedMetricsTable: React.FC<{ metrics?: Record<string, TeamMetrics | undefined>; timeA: string; timeB: string; currentLang: string }> = ({
  metrics,
  timeA,
  timeB,
  currentLang,
}) => {
  if (!metrics || typeof metrics !== 'object' || Array.isArray(metrics)) return null;

  const rows = Object.entries(metrics)
    .filter(([, v]) => {
      return v && typeof v === 'object' && !Array.isArray(v) &&
        (hasValue((v as any).timeA) || hasValue((v as any).timeB));
    })
    .map(([k, v]) => ({ k, v: v as TeamMetrics }));

  if (rows.length === 0) return null;

  const labelMap: Record<string, string> = {
    xG: (loc[currentLang] as any).xG || 'xG',
    grandesChances: (loc[currentLang] as any).grandesChances || 'Grandes chances',
    chutesNaArea: (loc[currentLang] as any).chutesNaArea || 'Chutes na área',
    chutesForaDaArea: (loc[currentLang] as any).chutesForaDaArea || 'Chutes fora da área',
    passesTercoFinal: (loc[currentLang] as any).passesTercoFinal || 'Passes no terço final',
    passesProgressivos: (loc[currentLang] as any).passesProgressivos || 'Passes progressivos',
    cruzamentos: (loc[currentLang] as any).cruzamentos || 'Cruzamentos',
    duelosGanhos: (loc[currentLang] as any).duelosGanhos || 'Duelos ganhos',
    perdasDePosse: (loc[currentLang] as any).perdasDePosse || 'Perdas de posse',
    recuperacoes: (loc[currentLang] as any).recuperacoes || 'Recuperações',
    fieldTilt: (loc[currentLang] as any).fieldTilt || 'Field tilt',
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-center bg-[#4a0404]/30 rounded-lg border border-yellow-900/40">
        <thead className="text-sm text-yellow-200/90">
          <tr>
            <th className="p-3 font-bold text-left">{timeA}</th>
            <th className="p-3 font-bold">{loc[currentLang].metric}</th>
            <th className="p-3 font-bold text-right">{timeB}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-yellow-900/50">
          {rows.map(({ k, v }) => (
            <tr key={k} className="text-yellow-101/90 hover:bg-[#4a0404]/50">
              <td className="p-3 font-mono text-left">{safeMetric(v.timeA)}</td>
              <td className="p-3 font-semibold text-yellow-400/80">{labelMap[k] || k}</td>
              <td className="p-3 font-mono text-right">{safeMetric(v.timeB)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const SummaryIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
);
const TimelineIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);
const KeyMomentsIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.951.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.196-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118L2.05 10.1c-.783-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
  </svg>
);
const TacticIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M12 15C13.6569 15 15 13.6569 15 12C15 10.3431 13.6569 9 12 9C10.3431 9 9 10.3431 9 12C9 13.6569 10.3431 15 12 15Z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const StatsIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0h6m6 0v-6a2 2 0 00-2-2h-2a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2z" />
  </svg>
);
const ContextIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor">
    <path d="M8 7V3M16 7V3M4 11h16M5 5h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const PlayersIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor">
    <path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <circle cx="8.5" cy="7" r="4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const parsePercent = (val: string) => {
  if (!hasValue(val)) return 0;
  return parseFloat(String(val).replace('%', '').replace(',', '.')) || 0;
};
const parseIntSimple = (val: string) => {
  if (!hasValue(val)) return 0;
  return parseInt(String(val), 10) || 0;
};

const safeMetric = (value: any, fallback = '—'): string =>
  hasValue(value) ? String(value).trim() : fallback;

const safePair = (a: any, b: any, fallback = 'Não disponível'): string => {
  const left = safeMetric(a);
  const right = safeMetric(b);
  if (left === '—' && right === '—') return fallback;
  return `${left} - ${right}`;
};

// Extractor of all Dynamic Portuguese texts from the Analysis object
const getTextsToTranslate = (anal: Analysis) => {
  const dict: Record<string, string> = {};
  if (!anal) return dict;
  
  if (anal.resumoPartida) dict.resumoPartida = anal.resumoPartida;
  if (anal.momentosChave) dict.momentosChave = anal.momentosChave;
  if (anal.conclusaoRecomendacoes) dict.conclusaoRecomendacoes = anal.conclusaoRecomendacoes;
  if (anal.ajustesTreinadores) dict.ajustesTreinadores = anal.ajustesTreinadores;
  
  if (anal.contextoPartida) {
    if (anal.contextoPartida.competicao) dict['ctx_competicao'] = anal.contextoPartida.competicao;
    if (anal.contextoPartida.fase) dict['ctx_fase'] = anal.contextoPartida.fase;
    if (anal.contextoPartida.estadio) dict['ctx_estadio'] = anal.contextoPartida.estadio;
    if (anal.contextoPartida.cidade) dict['ctx_cidade'] = anal.contextoPartida.cidade;
    if (anal.contextoPartida.arbitro) dict['ctx_arbitro'] = anal.contextoPartida.arbitro;
    if (anal.contextoPartida.condicoesClimaticas) dict['ctx_clima'] = anal.contextoPartida.condicoesClimaticas;
  }
  
  if (anal.formacoes) {
    if (anal.formacoes.timeA?.destaquesFuncionais) dict['form_dest_A'] = anal.formacoes.timeA.destaquesFuncionais;
    if (anal.formacoes.timeB?.destaquesFuncionais) dict['form_dest_B'] = anal.formacoes.timeB.destaquesFuncionais;
  }
  
  if (anal.faseDefensiva) {
    if (anal.faseDefensiva.timeA?.posicionamento) dict['fd_pos_A'] = anal.faseDefensiva.timeA.posicionamento;
    if (anal.faseDefensiva.timeA?.compactacao_pressao) dict['fd_comp_A'] = anal.faseDefensiva.timeA.compactacao_pressao;
    if (anal.faseDefensiva.timeA?.transicao) dict['fd_tr_A'] = anal.faseDefensiva.timeA.transicao;
    
    if (anal.faseDefensiva.timeB?.posicionamento) dict['fd_pos_B'] = anal.faseDefensiva.timeB.posicionamento;
    if (anal.faseDefensiva.timeB?.compactacao_pressao) dict['fd_comp_B'] = anal.faseDefensiva.timeB.compactacao_pressao;
    if (anal.faseDefensiva.timeB?.transicao) dict['fd_tr_B'] = anal.faseDefensiva.timeB.transicao;
  }
  
  if (anal.faseOfensiva) {
    if (anal.faseOfensiva.timeA?.saidaDeBola) dict['fo_saida_A'] = anal.faseOfensiva.timeA.saidaDeBola;
    if (anal.faseOfensiva.timeA?.criacao) dict['fo_cri_A'] = anal.faseOfensiva.timeA.criacao;
    if (anal.faseOfensiva.timeA?.finalizacao_movimentacao) dict['fo_fin_A'] = anal.faseOfensiva.timeA.finalizacao_movimentacao;
    
    if (anal.faseOfensiva.timeB?.saidaDeBola) dict['fo_saida_B'] = anal.faseOfensiva.timeB.saidaDeBola;
    if (anal.faseOfensiva.timeB?.criacao) dict['fo_cri_B'] = anal.faseOfensiva.timeB.criacao;
    if (anal.faseOfensiva.timeB?.finalizacao_movimentacao) dict['fo_fin_B'] = anal.faseOfensiva.timeB.finalizacao_movimentacao;
  }
  
  if (anal.placarAuditoria) {
    if (anal.placarAuditoria.observacoes) dict['pa_obs'] = anal.placarAuditoria.observacoes;
    if (anal.placarAuditoria.fontePlacar) dict['pa_fonte'] = anal.placarAuditoria.fontePlacar;
  }
  
  if (Array.isArray(anal.analiseJogadores)) {
    anal.analiseJogadores.forEach((pl, idx) => {
      if (!pl) return;
      if (pl.posicao) dict[`pl_pos_${idx}`] = pl.posicao;
      if (pl.analise) dict[`pl_an_${idx}`] = pl.analise;
      if (Array.isArray(pl.acoesPercebidas)) {
        pl.acoesPercebidas.forEach((ac, aidx) => {
          if (ac) dict[`pl_ac_${idx}_${aidx}`] = ac;
        });
      }
      if (Array.isArray(pl.pontosFortes)) {
        pl.pontosFortes.forEach((pf, pfidx) => {
          if (pf) dict[`pl_pf_${idx}_${pfidx}`] = pf;
        });
      }
      if (Array.isArray(pl.pontosAtencao)) {
        pl.pontosAtencao.forEach((pa, paidx) => {
          if (pa) dict[`pl_pa_${idx}_${paidx}`] = pa;
        });
      }
    });
  }
  
  if (Array.isArray(anal.linhaDoTempo)) {
    anal.linhaDoTempo.forEach((ev, idx) => {
      if (!ev) return;
      if (ev.tipo) dict[`ev_tipo_${idx}`] = ev.tipo;
      if (ev.descricao) dict[`ev_desc_${idx}`] = ev.descricao;
      if (ev.impactoTatico) dict[`ev_imp_${idx}`] = ev.impactoTatico;
    });
  }
  
  return dict;
};

const AnalysisDisplay: React.FC<AnalysisDisplayProps> = ({ analysis, onGenerateTrainingPlan }) => {
  const { language: currentLang, setLanguage: setCurrentLang } = useLanguage();
  const [activeSubTab, setActiveSubTab] = React.useState<SubTab>('geral');
  const [isExporting, setIsExporting] = React.useState(false);
  const [exportMessage, setExportMessage] = React.useState('');
  const [isTelegramModalOpen, setIsTelegramModalOpen] = React.useState(false);
  const [isRecalculatingMetrics, setIsRecalculatingMetrics] = React.useState(false);
  const [metricsMessage, setMetricsMessage] = React.useState('');
  const [, setMetricsRevision] = React.useState(0);
  const automaticCompletionAttemptRef = React.useRef<string | null>(null);
  
  // Translating States
  const [isTranslating, setIsTranslating] = React.useState(false);
  const [translationCache, setTranslationCache] = React.useState<Record<string, Record<string, string>>>({});

  // Dynamic Translation Trigger
  React.useEffect(() => {
    if (currentLang === 'pt') return;
    const translationId = analysis.analysisId || 'current';
    if (translationCache[translationId]?.[currentLang]) return;

    const performTranslation = async () => {
      setIsTranslating(true);
      try {
        const texts = getTextsToTranslate(analysis);
        const res = await fetch('/api/translate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ texts, targetLang: currentLang }),
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || 'Erro no servidor de tradução.');
        }
        const data = await res.json();
        
        setTranslationCache(prev => ({
          ...prev,
          [translationId]: {
            ...prev[translationId],
            [currentLang]: data.translated || {}
          }
        }));
      } catch (e: any) {
        console.error('Translation error:', e);
        alert(`Erro de tradução: ${e.message || 'Não foi possível se comunicar com o serviço de tradução. Verifique se o servidor está ativo.'}`);
      } finally {
        setIsTranslating(false);
      }
    };

    performTranslation();
  }, [currentLang, analysis]);

  // Translate Content Helper
  const t = (key: string, original: string) => {
    if (currentLang === 'pt') return original;
    if (!original) return '';
    const translationId = analysis.analysisId || 'current';
    const cache = translationCache[translationId]?.[currentLang];
    if (cache && cache[key]) {
      return cache[key];
    }
    return original;
  };

  const handleRecalculateMetrics = async () => {
    if (!analysis.analysisId) {
      setMetricsMessage('Salve a análise antes de recalcular as métricas.');
      return;
    }

    setIsRecalculatingMetrics(true);
    setMetricsMessage('Gemini analisando novamente o trecho para completar métricas, fase ofensiva e fase defensiva...');

    try {
      const response = await fetch(
        `/api/analyses/${encodeURIComponent(analysis.analysisId)}/recalculate-metrics`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...getAuthHeaders(),
          },
        }
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || 'Falha ao recalcular métricas.');
      }

      if (data.analysis) {
        Object.assign(analysis as any, data.analysis);
        setMetricsRevision((v) => v + 1);
      }

      setMetricsMessage(
        'Métricas e análise tática do trecho recalculadas e salvas. Posse, mapa de calor, fase ofensiva e fase defensiva foram atualizados a partir do vídeo.'
      );
    } catch (err: any) {
      setMetricsMessage(
        err?.message || 'Não foi possível recalcular as métricas agora.'
      );
    } finally {
      setIsRecalculatingMetrics(false);
    }
  };

  const handleExportPDF = async () => {
    setIsExporting(true);
    setExportMessage(loc[currentLang].preparing || 'Preparando...');

    try {
      setExportMessage(loc[currentLang].rendering || 'Gerando relatório completo...');
      await exportAnalysisPdf(analysis);
      setExportMessage(loc[currentLang].downloading || 'Concluído!');
    } catch (error: any) {
      console.error('[PDF] Falha na exportação:', error);
      alert(`Não foi possível exportar para PDF.\n\nDetalhes: ${error?.message || error}`);
    } finally {
      setIsExporting(false);
      setExportMessage('');
    }
  };

  const teamAName = analysis.timeA || 'Time A';
  const teamBName = analysis.timeB || 'Time B';

  const possessionData = [
    { name: teamAName, value: parsePercent(analysis.estatisticas?.posseDeBola?.timeA || '') },
    { name: teamBName, value: parsePercent(analysis.estatisticas?.posseDeBola?.timeB || '') },
  ];

  const heatmapA = analysis.estatisticas?.mapaDeCalor?.timeA;
  const heatmapB = analysis.estatisticas?.mapaDeCalor?.timeB;
  const hasHeatmapThirds = Boolean(
    normalizeHeatPercent(heatmapA?.tercoDefensivo) ||
    normalizeHeatPercent(heatmapA?.tercoMedio) ||
    normalizeHeatPercent(heatmapA?.tercoOfensivo) ||
    normalizeHeatPercent(heatmapB?.tercoDefensivo) ||
    normalizeHeatPercent(heatmapB?.tercoMedio) ||
    normalizeHeatPercent(heatmapB?.tercoOfensivo)
  );

  const shotsData = [
    {
      name: (loc[currentLang] as any).finalizacoes || 'Finalizações',
      [teamAName]: parseIntSimple(analysis.estatisticas?.finalizacoes?.timeA || '0'),
      [teamBName]: parseIntSimple(analysis.estatisticas?.finalizacoes?.timeB || '0'),
    },
    {
      name: (loc[currentLang] as any).finalizacoesNoAlvo || 'No Alvo',
      [teamAName]: parseIntSimple(analysis.estatisticas?.finalizacoesNoAlvo?.timeA || '0'),
      [teamBName]: parseIntSimple(analysis.estatisticas?.finalizacoesNoAlvo?.timeB || '0'),
    },
  ];

  const metricsAudit = analysis.verificacaoAuditoria as any;
  const metricsEstimated = metricsAudit?.metricasOrigem === 'estimativa_visual_trecho';
  const hasDefensiveTacticalAnalysis = Boolean(
    hasValue(analysis.faseDefensiva?.timeA?.posicionamento) &&
    hasValue(analysis.faseDefensiva?.timeA?.compactacao_pressao) &&
    hasValue(analysis.faseDefensiva?.timeA?.transicao) &&
    hasValue(analysis.faseDefensiva?.timeB?.posicionamento) &&
    hasValue(analysis.faseDefensiva?.timeB?.compactacao_pressao) &&
    hasValue(analysis.faseDefensiva?.timeB?.transicao)
  );

  const hasOffensiveTacticalAnalysis = Boolean(
    hasValue(analysis.faseOfensiva?.timeA?.saidaDeBola) &&
    hasValue(analysis.faseOfensiva?.timeA?.criacao) &&
    hasValue(analysis.faseOfensiva?.timeA?.finalizacao_movimentacao) &&
    hasValue(analysis.faseOfensiva?.timeB?.saidaDeBola) &&
    hasValue(analysis.faseOfensiva?.timeB?.criacao) &&
    hasValue(analysis.faseOfensiva?.timeB?.finalizacao_movimentacao)
  );

  const needsMetricRecalc = Boolean(
    analysis.analysisId &&
    analysis.videoUrl &&
    (
      !hasValue(analysis.estatisticas?.posseDeBola?.timeA) ||
      !hasValue(analysis.estatisticas?.posseDeBola?.timeB) ||
      !hasValue(analysis.estatisticas?.finalizacoes?.timeA) ||
      !hasValue(analysis.estatisticas?.finalizacoes?.timeB) ||
      !hasValue(analysis.estatisticas?.finalizacoesNoAlvo?.timeA) ||
      !hasValue(analysis.estatisticas?.finalizacoesNoAlvo?.timeB) ||
      !hasValue(analysis.indicadoresAvancados?.xG?.timeA) ||
      !hasValue(analysis.indicadoresAvancados?.xG?.timeB) ||
      !hasValue(analysis.indicadoresAvancados?.grandesChances?.timeA) ||
      !hasValue(analysis.indicadoresAvancados?.grandesChances?.timeB) ||
      !hasHeatmapThirds ||
      !hasDefensiveTacticalAnalysis ||
      !hasOffensiveTacticalAnalysis
    )
  );

  // Análises antigas incompletas são complementadas automaticamente ao abrir.
  // Uma tentativa por montagem evita chamadas duplicadas ou loop em caso de falha.
  React.useEffect(() => {
    const analysisId = String(analysis.analysisId || '').trim();
    if (!needsMetricRecalc || !analysisId || isRecalculatingMetrics) return;
    if (automaticCompletionAttemptRef.current === analysisId) return;

    automaticCompletionAttemptRef.current = analysisId;
    void handleRecalculateMetrics();
  }, [analysis.analysisId, needsMetricRecalc]);

  const contexto = analysis.contextoPartida;
  const verificacao = analysis.verificacaoAuditoria;
  const placarAuditoria = analysis.placarAuditoria;

  return (
    <div id="tactical-report-content" className="p-4 md:p-6 space-y-8 print:space-y-4 print:p-0 relative">
      {/* Report Actions Bar */}
      <div 
        id="report-action-bar"
        data-html2canvas-ignore="true" 
        className="flex flex-wrap justify-between items-center bg-[#2a0101]/80 border border-yellow-900/60 rounded-xl p-4 gap-3 shadow-md print:hidden"
      >
        <div className="flex items-center gap-3">
          <div className="bg-yellow-900/40 p-2 rounded-lg text-yellow-500">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div>
            <h4 id="action-bar-title" className="text-yellow-105 font-bold text-sm">{loc[currentLang].tacticalReport}</h4>
            <p className="text-[#fdba74]/65 text-xs">{loc[currentLang].exportMessage}</p>
          </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          {/* LANGUAGE SELECTOR */}
          <div className="flex items-center gap-1.5 bg-black/40 border border-yellow-900/40 p-1 rounded-lg">
            <button
              type="button"
              onClick={() => setCurrentLang('pt')}
              className={`cursor-pointer px-2.5 py-1 text-xs rounded transition-all font-semibold flex items-center gap-1.5 ${currentLang === 'pt' ? 'bg-[#d97706] text-white font-bold' : 'text-yellow-200/60 hover:text-yellow-105'}`}
              title="Português (Brasil)"
            >
              <span>🇧🇷</span> <span className="hidden sm:inline">Brasil</span>
            </button>
            <button
              type="button"
              onClick={() => setCurrentLang('en')}
              className={`cursor-pointer px-2.5 py-1 text-xs rounded transition-all font-semibold flex items-center gap-1.5 ${currentLang === 'en' ? 'bg-[#d97706] text-white font-bold' : 'text-yellow-200/60 hover:text-yellow-105'}`}
              title="English"
            >
              <span>🇬🇧</span> <span className="hidden sm:inline">English</span>
            </button>
            <button
              type="button"
              onClick={() => setCurrentLang('es')}
              className={`cursor-pointer px-2.5 py-1 text-xs rounded transition-all font-semibold flex items-center gap-1.5 ${currentLang === 'es' ? 'bg-[#d97706] text-white font-bold' : 'text-yellow-200/60 hover:text-yellow-105'}`}
              title="Español"
            >
              <span>🇪🇸</span> <span className="hidden sm:inline">Español</span>
            </button>
          </div>

          <button
            id="btn-telegram-publish"
            type="button"
            onClick={() => setIsTelegramModalOpen(true)}
            className="flex items-center gap-1.5 bg-[#2a0101] hover:bg-[#3a0202] border border-yellow-500/50 text-yellow-300 hover:text-yellow-100 cursor-pointer font-bold px-3.5 py-2 rounded-lg text-sm transition-all focus:outline-none shadow-md shadow-black/40"
            title="Publicar esta análise no Canal ou Grupo VIP do Telegram"
          >
            <Send className="h-4 w-4 text-yellow-400" />
            <span>Telegram</span>
          </button>

          <button
            id="btn-export-pdf"
            type="button"
            onClick={handleExportPDF}
            disabled={isExporting}
            className="flex items-center gap-2 bg-[#d97706] hover:bg-[#b45309] disabled:bg-yellow-900/40 text-yellow-50 cursor-pointer font-bold px-4 py-2 rounded-lg text-sm transition-all focus:outline-none shadow-md shadow-yellow-950/45 disabled:cursor-not-allowed"
          >
            {isExporting ? (
              <>
                <svg className="animate-spin h-4 w-4 text-yellow-50" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>{exportMessage}</span>
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                <span>{loc[currentLang].downloadBtn}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {metricsMessage && (
        <div
          data-html2canvas-ignore="true"
          className="rounded-xl border border-emerald-900/40 bg-emerald-950/20 px-4 py-3 text-sm text-emerald-200 print:hidden"
        >
          {metricsMessage}
        </div>
      )}

      {metricsEstimated && (
        <div className="rounded-xl border border-sky-900/40 bg-sky-950/20 px-4 py-3 text-sm text-sky-100">
          <div className="font-bold">Métricas estimadas a partir do vídeo</div>
          <div className="mt-1 text-xs text-sky-200/75">
            Referem-se somente ao trecho {metricsAudit?.metricasTrecho || 'analisado'}.
            Posse, mapa territorial e xG são estimativas visuais do Gemini; não representam
            estatísticas oficiais da partida completa.
            {metricsAudit?.metricasConfianca ? ` Confiança da leitura: ${metricsAudit.metricasConfianca}%.` : ''}
          </div>
        </div>
      )}

      {/* TRANSLATION LOADING HUD */}
      {isTranslating && (
        <div data-html2canvas-ignore="true" className="bg-yellow-900/30 text-yellow-300 px-4 py-2 text-xs font-semibold rounded-lg flex items-center gap-2 animate-pulse justify-center border border-yellow-800/30">
          <svg className="animate-spin h-4 w-4 text-yellow-300" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span>{loc[currentLang].translatingText}</span>
        </div>
      )}

      {/* MATCH CARD HEADER */}
      <div className="bg-[#2a0101]/50 backdrop-blur-sm rounded-lg p-6 border border-yellow-900/50 print:bg-white print:border-b print:border-gray-300 text-center">
        <div className="mb-4">
          <div className="flex items-center justify-center gap-2 mb-1">
            <span className="text-yellow-500/80 text-xs uppercase tracking-widest font-bold">{loc[currentLang].videoIdentified}</span>
            {analysis.validationStatus === 'verified' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-950/80 text-emerald-300 border border-emerald-500/40">
                <ShieldCheck className="w-3 h-3 text-emerald-400" /> VÍDEO VALIDADO 1:1
              </span>
            )}
          </div>
          <h2 className="text-yellow-200 text-lg md:text-xl font-semibold italic">"{analysis.videoTitle}"</h2>
          {analysis.verifiedVideoContext?.channelTitle && (
            <p className="text-xs text-yellow-300/70 mt-0.5">Canal: {analysis.verifiedVideoContext.channelTitle}</p>
          )}
          {analysis.videoUrl && (
            <div className="mt-2 text-xs md:text-sm">
              <a
                href={analysis.videoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-yellow-300/90 hover:text-yellow-200 underline break-all print:text-black print:no-underline"
              >
                {analysis.videoUrl}
              </a>
            </div>
          )}
          {(analysis.analysisId || analysis.createdAt || analysis.videoId) && (
            <div className="mt-3 flex flex-wrap justify-center gap-3 text-xs text-yellow-301/70">
              {analysis.videoId && <span className="px-2 py-1 rounded-full border border-yellow-900/40 bg-black/20 font-mono">Video ID: {analysis.videoId}</span>}
              {analysis.analysisId && <span className="px-2 py-1 rounded-full border border-yellow-900/40 bg-black/20">ID: {analysis.analysisId}</span>}
              {analysis.createdAt && <span className="px-2 py-1 rounded-full border border-yellow-900/40 bg-black/20">{loc[currentLang].generatedAt}: {formatDateTime(analysis.createdAt)}</span>}
            </div>
          )}
        </div>
        <div className="flex justify-between items-center">
          <div className="w-1/3 text-xl md:text-3xl font-bold text-yellow-200 print:text-black">{analysis.timeA}</div>
          <div className="w-1/3">
            <p className="text-4xl md:text-6xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-yellow-500 py-2 print:text-black">
              {analysis.placar}
            </p>
            <p className="text-yellow-400/70 text-sm print:text-gray-600">{loc[currentLang].matchScore}</p>
          </div>
          <div className="w-1/3 text-xl md:text-3xl font-bold text-yellow-200 print:text-black">{analysis.timeB}</div>
        </div>
        {placarAuditoria && (placarAuditoria.fontePlacar || placarAuditoria.confianca || placarAuditoria.observacoes) && (
          <div className="mt-5 text-left bg-black/20 border border-yellow-900/40 rounded-lg p-4 max-w-3xl mx-auto print:bg-white print:border-gray-300">
            <div className="text-yellow-200 font-bold mb-2 print:text-black">{loc[currentLang].auditReport}</div>
            <div className="grid md:grid-cols-3 gap-3 text-sm text-yellow-101/80 print:text-black">
              {placarAuditoria.placarFinal && <div><span className="text-yellow-200 font-semibold print:text-black">{loc[currentLang].confirmedScore}:</span> {placarAuditoria.placarFinal}</div>}
              {placarAuditoria.placarVisivel && <div><span className="text-yellow-200 font-semibold print:text-black">{loc[currentLang].evidence}:</span> {placarAuditoria.placarVisivel}</div>}
              {placarAuditoria.fontePlacar && <div><span className="text-yellow-200 font-semibold print:text-black">{loc[currentLang].valSource}:</span> {t('pa_fonte', placarAuditoria.fontePlacar)}</div>}
              {placarAuditoria.confianca && <div><span className="text-yellow-200 font-semibold print:text-black">{loc[currentLang].confidence}:</span> {placarAuditoria.confianca}</div>}
            </div>
            {placarAuditoria.observacoes && <div className="text-yellow-101/75 text-sm mt-3 whitespace-pre-wrap print:text-black">{t('pa_obs', placarAuditoria.observacoes)}</div>}
            {placarAuditoria.evidencias && placarAuditoria.evidencias.length > 0 && (
              <div className="mt-3 text-sm text-yellow-101/75 print:text-black">
                <span className="text-yellow-200 font-semibold print:text-black">{loc[currentLang].evidence}:</span>
                <MiniList items={placarAuditoria.evidencias} />
              </div>
            )}
          </div>
        )}
      </div>

      {/* CONFIDENCE & VALIDATION INDEX GAUGE */}
      <ConfidenceIndexBadge analysis={analysis} />

      {/* SUB-TABS HORIZONTAL NAVIGATION - Sticky & Highlighted */}
      <div 
        id="tactical-subtabs-nav"
        data-html2canvas-ignore="true" 
        className="sticky top-0 z-30 bg-[#1a0000]/95 backdrop-blur-md py-3 px-2 -mx-2 sm:mx-0 sm:px-3 rounded-xl border border-yellow-500/30 shadow-xl print:hidden flex items-center gap-2 overflow-x-auto scrollbar-thin scrollbar-thumb-yellow-600/50 scrollbar-track-black/40"
      >
        {[
          { id: 'geral', label: loc[currentLang].tabGeral || 'Geral', icon: <Search className="h-4 w-4" /> },
          { id: 'timeline', label: loc[currentLang].tabTimeline || 'Evidências em Vídeo', icon: <Video className="h-4 w-4" /> },
          { id: 'chat', label: loc[currentLang].tabChat || 'Pergunte ao Jogo', icon: <MessageSquare className="h-4 w-4" /> },
          { id: 'posse', label: loc[currentLang].tabPosse || 'Posse de Bola', icon: <Activity className="h-4 w-4" /> },
          { id: 'finalizacoes', label: loc[currentLang].tabFinalizacoes || 'Finalizações', icon: <Target className="h-4 w-4" /> },
          { id: 'calor', label: loc[currentLang].tabCalor || 'Mapa de Calor', icon: <Flame className="h-4 w-4" /> },
          { id: 'scouting', label: loc[currentLang].tabScouting || 'Scouting', icon: <UsersIcon className="h-4 w-4" /> },
          { id: 'auditoria', label: loc[currentLang].tabAuditoria || 'Auditoria & Confiança', icon: <ShieldCheck className="h-4 w-4" /> },
        ].map((tab) => {
          const isActive = activeSubTab === tab.id;
          return (
            <button
              key={tab.id}
              id={`subtab-btn-${tab.id}`}
              type="button"
              onClick={() => setActiveSubTab(tab.id as SubTab)}
              className={`px-4 py-2.5 rounded-xl text-xs md:text-sm font-bold flex items-center gap-2 whitespace-nowrap transition-all cursor-pointer shadow-sm shrink-0 ${
                isActive
                  ? 'bg-gradient-to-r from-yellow-400 via-yellow-500 to-yellow-600 text-black shadow-lg shadow-yellow-500/25 font-extrabold border border-yellow-300 ring-2 ring-yellow-400/30 scale-[1.02]'
                  : 'bg-[#2a0101]/80 text-yellow-200/75 hover:text-yellow-100 hover:bg-[#3d0202] border border-yellow-900/40 hover:border-yellow-700/60'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ======================================================== */}
      {/* 1. ABA: GERAL */}
      {/* ======================================================== */}
      {(isExporting || activeSubTab === 'geral') && (
        <div className="space-y-8 print:block print:space-y-6">
          {/* 3 TOP TACTICAL INSIGHTS */}
          <ThreeTacticalInsights 
            analysis={analysis} 
            onGenerateTrainingPlan={onGenerateTrainingPlan} 
          />

          {/* EXPLANATION AND DETAILED ANALYSIS */}
          <div className="bg-[#2a0101]/60 border border-yellow-900/40 backdrop-blur-sm rounded-lg p-6 space-y-6 print:bg-white print:border-zinc-300 print:text-black">
            <div className="border-b border-yellow-500/35 pb-3">
              <h3 className="text-2xl font-extrabold text-yellow-300 uppercase tracking-wide print:text-zinc-900">
                🔍 {loc[currentLang].tacticalExplanation}
              </h3>
              <p className="text-yellow-300/60 text-sm mt-1 print:text-zinc-500">
                {loc[currentLang].reviewSubtitle}
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 print:block print:space-y-4">
              <div className="space-y-4">
                <div>
                  <h4 className="text-yellow-200 font-bold text-lg mb-1.5 flex items-center gap-2 print:text-zinc-800">
                    📋 {loc[currentLang].descriptionMatch}
                  </h4>
                  <p className="text-yellow-101/90 leading-relaxed text-sm whitespace-pre-wrap bg-black/25 p-4 rounded border border-yellow-900/20 print:bg-transparent print:border-zinc-300 print:text-zinc-800 animate-fadeIn">
                    {t('resumoPartida', analysis.resumoPartida) || loc[currentLang].noData}
                  </p>
                </div>

                <div>
                  <h4 className="text-yellow-200 font-bold text-lg mb-1.5 flex items-center gap-2 print:text-zinc-800">
                    ⏱️ {loc[currentLang].keyMomentsTitle}
                  </h4>
                  <div className="text-yellow-101/90 leading-relaxed text-sm whitespace-pre-wrap bg-black/25 p-4 rounded border border-yellow-900/20 max-h-[300px] overflow-y-auto print:bg-transparent print:border-zinc-300 print:text-zinc-800">
                    {t('momentosChave', analysis.momentosChave) || loc[currentLang].noData}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <h4 className="text-yellow-200 font-bold text-lg mb-1.5 flex items-center gap-2 print:text-zinc-800">
                    💡 {loc[currentLang].recomConclusions}
                  </h4>
                  <p className="text-yellow-101/90 leading-relaxed text-sm whitespace-pre-wrap bg-black/25 p-4 rounded border border-yellow-900/20 print:bg-transparent print:border-zinc-300 print:text-zinc-800">
                    {t('conclusaoRecomendacoes', analysis.conclusaoRecomendacoes) || loc[currentLang].noData}
                  </p>
                </div>

                {placarAuditoria && (
                  <div>
                    <h4 className="text-yellow-200 font-bold text-lg mb-1.5 flex items-center gap-2 print:text-zinc-800">
                      🛡️ {loc[currentLang].auditEvidence}
                    </h4>
                    <div className="bg-black/25 p-4 rounded border border-yellow-900/20 space-y-2 text-sm text-yellow-101/85 print:bg-transparent print:border-zinc-300 print:text-zinc-800">
                      <div className="flex justify-between border-b border-yellow-950/30 pb-1">
                        <span className="font-semibold text-yellow-200">{loc[currentLang].confidenceAnalysis}:</span>
                        <span className="capitalize px-2 py-0.5 rounded text-xs bg-yellow-950 border border-yellow-500/40 font-bold text-yellow-200 print:bg-zinc-100 print:text-zinc-900">
                          {placarAuditoria.confianca || "Alta"}
                        </span>
                      </div>
                      {placarAuditoria.placarFinal && (
                        <div className="flex justify-between border-b border-yellow-950/30 pb-1">
                          <span className="font-semibold text-yellow-200">{loc[currentLang].confirmedScore}:</span>
                          <span className="font-mono font-bold text-yellow-300 print:text-zinc-900">{placarAuditoria.placarFinal}</span>
                        </div>
                      )}
                      {placarAuditoria.fontePlacar && (
                        <div className="flex justify-between border-b border-yellow-950/30 pb-1">
                          <span className="font-semibold text-yellow-200">{loc[currentLang].valSource}:</span>
                          <span>{t('pa_fonte', placarAuditoria.fontePlacar)}</span>
                        </div>
                      )}
                      {placarAuditoria.observacoes && (
                        <div className="mt-2 text-xs text-yellow-101/75 italic">
                          "{t('pa_obs', placarAuditoria.observacoes)}"
                        </div>
                      )}
                      {placarAuditoria.evidencias && placarAuditoria.evidencias.length > 0 && (
                        <div className="mt-2 text-xs">
                          <span className="font-semibold text-yellow-200 block mb-1">{loc[currentLang].evidence}:</span>
                          <ul className="list-disc pl-5 space-y-1 text-yellow-300/85">
                            {placarAuditoria.evidencias.map((ev, idx) => (
                              <li key={idx}>{ev}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* MATCH CONTEXT CARD */}
          {contexto && (contexto.competicao || contexto.dataJogo || contexto.estadio) && (
            <AnalysisCard title={loc[currentLang].competition} icon={<ContextIcon />}>
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <div><span className="text-yellow-200 font-semibold">{loc[currentLang].competition}:</span> {t('ctx_competicao', contexto.competicao) || '—'}</div>
                  <div><span className="text-yellow-200 font-semibold">Temporada:</span> {contexto.temporada || '—'}</div>
                  <div><span className="text-yellow-200 font-semibold">Fase:</span> {t('ctx_fase', contexto.fase) || '—'}</div>
                  <div><span className="text-yellow-200 font-semibold">{loc[currentLang].date}:</span> {contexto.dataJogo || '—'}</div>
                </div>
                <div className="space-y-2">
                  <div><span className="text-yellow-200 font-semibold">{loc[currentLang].stadium}:</span> {t('ctx_estadio', contexto.estadio) || '—'}</div>
                  <div><span className="text-yellow-200 font-semibold">Cidade:</span> {t('ctx_cidade', contexto.cidade) || '—'}</div>
                  <div><span className="text-yellow-200 font-semibold">{loc[currentLang].referee}:</span> {t('ctx_arbitro', contexto.arbitro) || '—'}</div>
                  <div><span className="text-yellow-200 font-semibold">Público/Clima:</span> {(contexto.publico || '—') + (contexto.condicoesClimaticas ? ` | ${t('ctx_clima', contexto.condicoesClimaticas)}` : '')}</div>
                </div>
              </div>
            </AnalysisCard>
          )}

          {/* BRIEF OVERVIEW CARDS */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 print:block print:space-y-4">
            <AnalysisCard title={loc[currentLang].summary} icon={<SummaryIcon />}>
              <p>{t('resumoPartida', analysis.resumoPartida)}</p>
            </AnalysisCard>
            <AnalysisCard title={loc[currentLang].keyMoments} icon={<KeyMomentsIcon />}>
              <div className="whitespace-pre-wrap">{t('momentosChave', analysis.momentosChave)}</div>
            </AnalysisCard>
          </div>

          {/* FORMATIONS AND SCHEMES */}
          {analysis.formacoes && (analysis.formacoes.timeA?.esquema || analysis.formacoes.timeB?.esquema) && (
            <AnalysisCard title={loc[currentLang].formAndFunctions} icon={<TacticIcon />}>
              <div className="grid md:grid-cols-2 gap-8">
                <div className="space-y-3">
                  <SectionTitle>{analysis.timeA}</SectionTitle>
                  <div><span className="text-yellow-200 font-semibold">Esquema:</span> {analysis.formacoes.timeA?.esquema || '—'}</div>
                  <div>
                    <span className="text-yellow-200 font-semibold">Titulares:</span>
                    <MiniList items={analysis.formacoes.timeA?.titulares} />
                  </div>
                  {analysis.formacoes.timeA?.destaquesFuncionais && (
                    <TacticalInfo title={loc[currentLang].functionalHighlights} text={t('form_dest_A', analysis.formacoes.timeA?.destaquesFuncionais)} />
                  )}
                </div>
                <div className="space-y-3">
                  <SectionTitle>{analysis.timeB}</SectionTitle>
                  <div><span className="text-yellow-200 font-semibold">Esquema:</span> {analysis.formacoes.timeB?.esquema || '—'}</div>
                  <div>
                    <span className="text-yellow-200 font-semibold">Titulares:</span>
                    <MiniList items={analysis.formacoes.timeB?.titulares} />
                  </div>
                  {analysis.formacoes.timeB?.destaquesFuncionais && (
                    <TacticalInfo title={loc[currentLang].functionalHighlights} text={t('form_dest_B', analysis.formacoes.timeB?.destaquesFuncionais)} />
                  )}
                </div>
              </div>
            </AnalysisCard>
          )}

          {/* DEFENSIVE PHASES */}
          <AnalysisCard title={loc[currentLang].defendingPhase} icon={<TacticIcon />}>
            {!hasDefensiveTacticalAnalysis && (
              <div className="mb-5 rounded-xl border border-amber-800/40 bg-amber-950/20 px-4 py-3 text-sm text-amber-200">
                O sistema está completando automaticamente a fase defensiva a partir do trecho do vídeo.
              </div>
            )}
            <div className="grid md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <SectionTitle>{analysis.timeA}</SectionTitle>
                <TacticalInfo title={loc[currentLang].tacticalInfoBlock} text={t('fd_pos_A', analysis.faseDefensiva?.timeA?.posicionamento)} />
                <TacticalInfo title={loc[currentLang].tacticalInfoComp} text={t('fd_comp_A', analysis.faseDefensiva?.timeA?.compactacao_pressao)} />
                <TacticalInfo title={loc[currentLang].tacticalInfoTrans} text={t('fd_tr_A', analysis.faseDefensiva?.timeA?.transicao)} />
              </div>
              <div className="space-y-4">
                <SectionTitle>{analysis.timeB}</SectionTitle>
                <TacticalInfo title={loc[currentLang].tacticalInfoBlock} text={t('fd_pos_B', analysis.faseDefensiva?.timeB?.posicionamento)} />
                <TacticalInfo title={loc[currentLang].tacticalInfoComp} text={t('fd_comp_B', analysis.faseDefensiva?.timeB?.compactacao_pressao)} />
                <TacticalInfo title={loc[currentLang].tacticalInfoTrans} text={t('fd_tr_B', analysis.faseDefensiva?.timeB?.transicao)} />
              </div>
            </div>
          </AnalysisCard>

          {/* OFFENSIVE PHASES */}
          <AnalysisCard title={loc[currentLang].offensivePhase} icon={<TacticIcon />}>
            {!hasOffensiveTacticalAnalysis && (
              <div className="mb-5 rounded-xl border border-amber-800/40 bg-amber-950/20 px-4 py-3 text-sm text-amber-200">
                O sistema está completando automaticamente a fase ofensiva a partir do trecho do vídeo.
              </div>
            )}
            <div className="grid md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <SectionTitle>{analysis.timeA}</SectionTitle>
                <TacticalInfo title={loc[currentLang].tacticalInfoBuild} text={t('fo_saida_A', analysis.faseOfensiva?.timeA?.saidaDeBola)} />
                <TacticalInfo title={loc[currentLang].tacticalInfoCre} text={t('fo_cri_A', analysis.faseOfensiva?.timeA?.criacao)} />
                <TacticalInfo title={loc[currentLang].tacticalInfoFin} text={t('fo_fin_A', analysis.faseOfensiva?.timeA?.finalizacao_movimentacao)} />
              </div>
              <div className="space-y-4">
                <SectionTitle>{analysis.timeB}</SectionTitle>
                <TacticalInfo title={loc[currentLang].tacticalInfoBuild} text={t('fo_saida_B', analysis.faseOfensiva?.timeB?.saidaDeBola)} />
                <TacticalInfo title={loc[currentLang].tacticalInfoCre} text={t('fo_cri_B', analysis.faseOfensiva?.timeB?.criacao)} />
                <TacticalInfo title={loc[currentLang].tacticalInfoFin} text={t('fo_fin_B', analysis.faseOfensiva?.timeB?.finalizacao_movimentacao)} />
              </div>
            </div>
          </AnalysisCard>

          {/* EVENT TIMELINE */}
          {analysis.linhaDoTempo && Array.isArray(analysis.linhaDoTempo) && analysis.linhaDoTempo.length > 0 && (
            <AnalysisCard title={loc[currentLang].timelineEvents} icon={<TimelineIcon />}>
              <div className="relative border-l border-yellow-800/40 ml-4 pl-6 space-y-6">
                {analysis.linhaDoTempo.map((evt, idx) => {
                  const tipoNormalized = String(evt.tipo || '').toLowerCase();
                  let badgeEmoji = '📋';
                  if (tipoNormalized.includes('gol')) badgeEmoji = '⚽';
                  else if (tipoNormalized.includes('substitu') || tipoNormalized.includes('troca')) badgeEmoji = '🔄';
                  else if (tipoNormalized.includes('amarelo') || tipoNormalized.includes('cartao amarelo')) badgeEmoji = '🟨';
                  else if (tipoNormalized.includes('vermelho') || tipoNormalized.includes('cartao vermelho')) badgeEmoji = '🟥';
                  else if (tipoNormalized.includes('lesao') || tipoNormalized.includes('contusao')) badgeEmoji = '🚑';
                  else if (tipoNormalized.includes('perigo') || tipoNormalized.includes('chute') || tipoNormalized.includes('finalizac')) badgeEmoji = '🔥';
                  else if (tipoNormalized.includes('posse') || tipoNormalized.includes('tatic')) badgeEmoji = '🛡️';

                  return (
                    <div key={idx} className="relative">
                      <div className="absolute -left-10 mt-1 flex h-7 w-7 items-center justify-center rounded-full bg-yellow-950 border border-yellow-500/50 text-sm shadow-md">
                        {badgeEmoji}
                      </div>
                      <div className="bg-black/10 border border-yellow-900/15 p-3 rounded-lg">
                        <div className="flex flex-wrap items-center gap-2 mb-1.5">
                          <span className="text-xs font-bold text-yellow-300 bg-yellow-950/50 border border-yellow-500/30 px-2 py-0.5 rounded">
                            {evt.minuto ? `${evt.minuto}'` : '—'}
                          </span>
                          {evt.time && (
                            <span className="text-sm font-semibold text-yellow-105">
                              {evt.time}
                            </span>
                          )}
                          {evt.tipo && (
                            <span className="text-[10px] uppercase font-semibold bg-black/30 border border-yellow-800/20 text-yellow-400 px-1.5 py-0.5 rounded">
                              {t(`ev_tipo_${idx}`, evt.tipo)}
                            </span>
                          )}
                        </div>
                        {evt.descricao && <p className="text-yellow-101/90 text-sm leading-relaxed">{t(`ev_desc_${idx}`, evt.descricao)}</p>}
                        {evt.impactoTatico && (
                          <div className="text-xs text-yellow-400/75 italic mt-1.5 border-l-2 border-yellow-500/30 pl-2">
                            <span className="font-semibold not-italic text-yellow-400/90">{loc[currentLang].impact}:</span> {t(`ev_imp_${idx}`, evt.impactoTatico)}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </AnalysisCard>
          )}

          {/* FINAL CONCLUSIONS */}
          <AnalysisCard title={loc[currentLang].concl} icon={<SummaryIcon />}>
            <div className="whitespace-pre-wrap">{t('conclusaoRecomendacoes', analysis.conclusaoRecomendacoes)}</div>
          </AnalysisCard>
        </div>
      )}

      {/* ======================================================== */}
      {/* ABA: TIMELINE DE EVIDÊNCIAS EM VÍDEO & CLIPES */}
      {/* ======================================================== */}
      {(isExporting || activeSubTab === 'timeline') && (
        <div className="space-y-6 print:block">
          <VideoEvidenceTimeline 
            analysis={analysis} 
            onSeekTimestamp={(sec) => {
              if (analysis.videoUrl) {
                const url = new URL(analysis.videoUrl);
                url.searchParams.set('t', `${sec}s`);
                window.open(url.toString(), '_blank');
              }
            }}
          />
        </div>
      )}

      {/* ======================================================== */}
      {/* ABA: PERGUNTE AO SEU JOGO (INTERACTIVE AI ASSISTANT) */}
      {/* ======================================================== */}
      {(isExporting || activeSubTab === 'chat') && (
        <div className="space-y-6 print:hidden">
          <AskYourGameChat analysis={analysis} />
        </div>
      )}

      {/* ======================================================== */}
      {/* 2. ABA: POSSE DE BOLA */}
      {/* ======================================================== */}
      {(isExporting || activeSubTab === 'posse') && (
        <div className="space-y-8 print:block print:space-y-6">
          <AnalysisCard title={loc[currentLang].posseDeBola} icon={<Activity className="h-6 w-6 text-yellow-400" />}>
            {/* POSSESSION HIGHLIGHT CARDS */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              <div className="bg-[#4a0404]/50 border border-yellow-900/60 rounded-xl p-5 text-center">
                <span className="text-yellow-300 font-bold text-lg block">{analysis.timeA}</span>
                <span className="text-4xl md:text-5xl font-extrabold text-yellow-100 font-mono mt-1 block">
                  {safeMetric(analysis.estatisticas?.posseDeBola?.timeA, 'Não disponível')}
                </span>
                <span className="text-xs text-yellow-400/70 uppercase tracking-wider font-semibold mt-1 block">
                  {loc[currentLang].posseDeBola}
                </span>
              </div>
              <div className="bg-[#4a0404]/50 border border-yellow-900/60 rounded-xl p-5 text-center">
                <span className="text-yellow-300 font-bold text-lg block">{analysis.timeB}</span>
                <span className="text-4xl md:text-5xl font-extrabold text-yellow-100 font-mono mt-1 block">
                  {safeMetric(analysis.estatisticas?.posseDeBola?.timeB, 'Não disponível')}
                </span>
                <span className="text-xs text-yellow-400/70 uppercase tracking-wider font-semibold mt-1 block">
                  {loc[currentLang].posseDeBola}
                </span>
              </div>
            </div>

            {/* POSSESSION CHART */}
            <div className="h-72 mb-8 bg-black/25 p-4 rounded-xl border border-yellow-900/30">
              <ErrorBoundary>
                <PossessionChart data={possessionData} />
              </ErrorBoundary>
            </div>

            {/* POSSESSION METRICS TABLE */}
            <div className="space-y-4">
              <SectionTitle>{loc[currentLang].statistics}</SectionTitle>
              <StatisticsTable stats={analysis.estatisticas} timeA={analysis.timeA} timeB={analysis.timeB} currentLang={currentLang} />
            </div>

            {/* BALL BUILD-UP TACTICAL DETAILS */}
            {(analysis.faseOfensiva?.timeA?.saidaDeBola || analysis.faseOfensiva?.timeB?.saidaDeBola) && (
              <div className="mt-8 pt-6 border-t border-yellow-900/40">
                <SectionTitle>{loc[currentLang].tacticalInfoBuild}</SectionTitle>
                <div className="grid md:grid-cols-2 gap-6 mt-4">
                  {analysis.faseOfensiva?.timeA?.saidaDeBola && (
                    <div className="bg-black/25 p-4 rounded-xl border border-yellow-900/30">
                      <h5 className="font-bold text-yellow-300 mb-1">{analysis.timeA}</h5>
                      <p className="text-yellow-101/80 text-sm leading-relaxed whitespace-pre-wrap">{t('fo_saida_A', analysis.faseOfensiva.timeA.saidaDeBola)}</p>
                    </div>
                  )}
                  {analysis.faseOfensiva?.timeB?.saidaDeBola && (
                    <div className="bg-black/25 p-4 rounded-xl border border-yellow-900/30">
                      <h5 className="font-bold text-yellow-300 mb-1">{analysis.timeB}</h5>
                      <p className="text-yellow-101/80 text-sm leading-relaxed whitespace-pre-wrap">{t('fo_saida_B', analysis.faseOfensiva.timeB.saidaDeBola)}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </AnalysisCard>
        </div>
      )}

      {/* ======================================================== */}
      {/* 3. ABA: FINALIZAÇÕES */}
      {/* ======================================================== */}
      {(isExporting || activeSubTab === 'finalizacoes') && (
        <div className="space-y-8 print:block print:space-y-6">
          <AnalysisCard title={loc[currentLang].finalizacoes} icon={<Target className="h-6 w-6 text-yellow-400" />}>
            {/* SHOTS HIGHLIGHT CARDS */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-[#4a0404]/50 border border-yellow-900/60 rounded-xl p-4 text-center">
                <span className="text-xs text-yellow-400/80 uppercase font-semibold block">{loc[currentLang].finalizacoes}</span>
                <span className="text-2xl md:text-3xl font-extrabold text-yellow-100 font-mono mt-1 block">
                  {safePair(analysis.estatisticas?.finalizacoes?.timeA, analysis.estatisticas?.finalizacoes?.timeB)}
                </span>
                <span className="text-[11px] text-yellow-300/60 mt-1 block truncate">{analysis.timeA} vs {analysis.timeB}</span>
              </div>
              <div className="bg-[#4a0404]/50 border border-yellow-900/60 rounded-xl p-4 text-center">
                <span className="text-xs text-yellow-400/80 uppercase font-semibold block">{loc[currentLang].finalizacoesNoAlvo}</span>
                <span className="text-2xl md:text-3xl font-extrabold text-yellow-100 font-mono mt-1 block">
                  {safePair(analysis.estatisticas?.finalizacoesNoAlvo?.timeA, analysis.estatisticas?.finalizacoesNoAlvo?.timeB)}
                </span>
                <span className="text-[11px] text-yellow-300/60 mt-1 block truncate">{analysis.timeA} vs {analysis.timeB}</span>
              </div>
              <div className="bg-[#4a0404]/50 border border-yellow-900/60 rounded-xl p-4 text-center">
                <span className="text-xs text-yellow-400/80 uppercase font-semibold block">{metricsEstimated ? 'xG estimado (IA)' : (loc[currentLang].xG || 'xG')}</span>
                <span className="text-2xl md:text-3xl font-extrabold text-yellow-100 font-mono mt-1 block">
                  {safePair(analysis.indicadoresAvancados?.xG?.timeA, analysis.indicadoresAvancados?.xG?.timeB)}
                </span>
                <span className="text-[11px] text-yellow-300/60 mt-1 block truncate">{analysis.timeA} vs {analysis.timeB}</span>
              </div>
              <div className="bg-[#4a0404]/50 border border-yellow-900/60 rounded-xl p-4 text-center">
                <span className="text-xs text-yellow-400/80 uppercase font-semibold block">{loc[currentLang].grandesChances || 'Chances'}</span>
                <span className="text-2xl md:text-3xl font-extrabold text-yellow-100 font-mono mt-1 block">
                  {safePair(analysis.indicadoresAvancados?.grandesChances?.timeA, analysis.indicadoresAvancados?.grandesChances?.timeB)}
                </span>
                <span className="text-[11px] text-yellow-300/60 mt-1 block truncate">{analysis.timeA} vs {analysis.timeB}</span>
              </div>
            </div>

            {/* SHOTS CHART */}
            <div className="h-72 mb-8 bg-black/25 p-4 rounded-xl border border-yellow-900/30">
              <ErrorBoundary>
                <ShotsChart data={shotsData} timeA={analysis.timeA} timeB={analysis.timeB} />
              </ErrorBoundary>
            </div>

            {/* ADVANCED SHOT METRICS */}
            <div className="space-y-4">
              <SectionTitle>{loc[currentLang].advancedIndicators}</SectionTitle>
              <AdvancedMetricsTable metrics={analysis.indicadoresAvancados} timeA={analysis.timeA} timeB={analysis.timeB} currentLang={currentLang} />
            </div>

            {/* FINISHING AND MOVEMENT DETAILS */}
            {(analysis.faseOfensiva?.timeA?.finalizacao_movimentacao || analysis.faseOfensiva?.timeB?.finalizacao_movimentacao) && (
              <div className="mt-8 pt-6 border-t border-yellow-900/40">
                <SectionTitle>{loc[currentLang].tacticalInfoFin}</SectionTitle>
                <div className="grid md:grid-cols-2 gap-6 mt-4">
                  {analysis.faseOfensiva?.timeA?.finalizacao_movimentacao && (
                    <div className="bg-black/25 p-4 rounded-xl border border-yellow-900/30">
                      <h5 className="font-bold text-yellow-300 mb-1">{analysis.timeA}</h5>
                      <p className="text-yellow-101/80 text-sm leading-relaxed whitespace-pre-wrap">{t('fo_fin_A', analysis.faseOfensiva.timeA.finalizacao_movimentacao)}</p>
                    </div>
                  )}
                  {analysis.faseOfensiva?.timeB?.finalizacao_movimentacao && (
                    <div className="bg-black/25 p-4 rounded-xl border border-yellow-900/30">
                      <h5 className="font-bold text-yellow-300 mb-1">{analysis.timeB}</h5>
                      <p className="text-yellow-101/80 text-sm leading-relaxed whitespace-pre-wrap">{t('fo_fin_B', analysis.faseOfensiva.timeB.finalizacao_movimentacao)}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </AnalysisCard>
        </div>
      )}

      {/* ======================================================== */}
      {/* 4. ABA: MAPA DE CALOR */}
      {/* ======================================================== */}
      {(isExporting || activeSubTab === 'calor') && (
        <div className="space-y-8 print:block print:space-y-6">
          <AnalysisCard title={loc[currentLang].tacticalHeatmap} icon={<Flame className="h-6 w-6 text-yellow-400" />}>
            {/* HEATMAP VISUALIZER */}
            <div className="bg-black/30 p-6 rounded-2xl border border-yellow-900/40">
              {analysis.estatisticas?.mapaDeCalor?.timeA && analysis.estatisticas?.mapaDeCalor?.timeB ? (
                <HeatmapDisplay data={analysis.estatisticas.mapaDeCalor} timeA={analysis.timeA} timeB={analysis.timeB} />
              ) : (
                <div className="text-center py-12 space-y-2">
                  <Flame className="w-12 h-12 text-yellow-500/40 mx-auto" />
                  <p className="text-yellow-200 font-semibold">{loc[currentLang].noHeatmap}</p>
                </div>
              )}
            </div>

            {/* THIRDS DISTRIBUTION METRICS */}
            {hasHeatmapThirds && (
              <div className="mt-8">
                <SectionTitle>{loc[currentLang].heatmapTer}</SectionTitle>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                  <div className="bg-black/25 p-4 rounded-xl border border-yellow-900/30 text-center">
                    <span className="text-xs uppercase font-bold text-yellow-400/80 block">{loc[currentLang].defendingThird}</span>
                    <div className="flex justify-around items-center mt-3 text-lg font-mono font-bold text-yellow-100">
                      <div>
                        <span className="text-xs text-yellow-300 block">{analysis.timeA}</span>
                        {normalizeHeatPercent(heatmapA?.tercoDefensivo) || '—'}
                      </div>
                      <div className="text-yellow-600">vs</div>
                      <div>
                        <span className="text-xs text-yellow-300 block">{analysis.timeB}</span>
                        {normalizeHeatPercent(heatmapB?.tercoDefensivo) || '—'}
                      </div>
                    </div>
                  </div>

                  <div className="bg-black/25 p-4 rounded-xl border border-yellow-900/30 text-center">
                    <span className="text-xs uppercase font-bold text-yellow-400/80 block">{loc[currentLang].middleThird}</span>
                    <div className="flex justify-around items-center mt-3 text-lg font-mono font-bold text-yellow-100">
                      <div>
                        <span className="text-xs text-yellow-300 block">{analysis.timeA}</span>
                        {normalizeHeatPercent(heatmapA?.tercoMedio) || '—'}
                      </div>
                      <div className="text-yellow-600">vs</div>
                      <div>
                        <span className="text-xs text-yellow-300 block">{analysis.timeB}</span>
                        {normalizeHeatPercent(heatmapB?.tercoMedio) || '—'}
                      </div>
                    </div>
                  </div>

                  <div className="bg-black/25 p-4 rounded-xl border border-yellow-900/30 text-center">
                    <span className="text-xs uppercase font-bold text-yellow-400/80 block">{loc[currentLang].attackingThird}</span>
                    <div className="flex justify-around items-center mt-3 text-lg font-mono font-bold text-yellow-100">
                      <div>
                        <span className="text-xs text-yellow-300 block">{analysis.timeA}</span>
                        {normalizeHeatPercent(heatmapA?.tercoOfensivo) || '—'}
                      </div>
                      <div className="text-yellow-600">vs</div>
                      <div>
                        <span className="text-xs text-yellow-300 block">{analysis.timeB}</span>
                        {normalizeHeatPercent(heatmapB?.tercoOfensivo) || '—'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ASSOCIATED ADVANCED INDICATORS */}
            <div className="mt-8 pt-6 border-t border-yellow-900/40">
              <SectionTitle>{loc[currentLang].advancedMetricsTitle}</SectionTitle>
              <div className="mt-4">
                <AdvancedMetricsTable metrics={analysis.indicadoresAvancados} timeA={analysis.timeA} timeB={analysis.timeB} currentLang={currentLang} />
              </div>
            </div>
          </AnalysisCard>
        </div>
      )}

      {/* ======================================================== */}
      {/* 5. ABA: SCOUTING INDIVIDUAL DE JOGADORES */}
      {/* ======================================================== */}
      {(isExporting || activeSubTab === 'scouting') && (
        <div className="space-y-8 print:block print:space-y-6">
          <AnalysisCard title={loc[currentLang].playersScouting} icon={<UsersIcon className="h-6 w-6 text-yellow-400" />}>
            {analysis.analiseJogadores && Array.isArray(analysis.analiseJogadores) && analysis.analiseJogadores.length > 0 ? (
              <div className="grid grid-cols-1 gap-6">
                {analysis.analiseJogadores.map((player, idx) => (
                  <div 
                    key={idx} 
                    className="bg-black/30 border border-yellow-900/40 rounded-2xl p-5 md:p-6 shadow-xl flex flex-col md:flex-row gap-6 transition-all hover:border-yellow-600/50"
                  >
                    {/* PHOTO COLUMN (4:5 Ratio with badges) */}
                    <div className="w-full sm:w-48 md:w-52 shrink-0 flex flex-col items-center">
                      <div className="relative w-full rounded-xl overflow-hidden shadow-lg border border-yellow-900/60 bg-black/40">
                        <PlayerPhoto
                          playerName={player.nome}
                          teamName={player.time || (player.identificacao?.includes(analysis.timeA) ? analysis.timeA : analysis.timeB)}
                          season={analysis.contextoPartida?.temporada}
                          position={player.posicao}
                          shirtNumber={player.camisa}
                          manualVerified={player.manualVerified}
                          index={idx}
                          className="w-full"
                        />
                        {/* Top shirt badge */}
                        {player.camisa && (
                          <div className="absolute top-2 left-2 bg-black/85 backdrop-blur-md border border-yellow-500/60 text-yellow-300 font-extrabold text-xs px-2.5 py-1 rounded-md shadow-md">
                            Nº {player.camisa}
                          </div>
                        )}
                        {/* Bottom position badge */}
                        {player.posicao && (
                          <div className="absolute bottom-2 inset-x-2 bg-black/85 backdrop-blur-md border border-yellow-500/40 text-yellow-200 text-center font-bold text-xs py-1 px-2 rounded-md shadow-md truncate">
                            {t(`pl_pos_${idx}`, player.posicao)}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* PLAYER DATA COLUMN */}
                    <div className="flex-grow space-y-4">
                      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-yellow-900/30 pb-3">
                        <div>
                          <h4 className="text-2xl md:text-3xl font-extrabold text-yellow-200">
                            {player.nome || loc[currentLang].playerObserved}
                          </h4>
                          <div className="flex flex-wrap items-center gap-2 mt-1.5 text-xs md:text-sm">
                            {player.time && (
                              <span className="bg-yellow-950/70 border border-yellow-500/40 text-yellow-300 px-3 py-0.5 rounded-full font-semibold">
                                {player.time}
                              </span>
                            )}
                            {player.minutosObservados && (
                              <span className="text-yellow-200/70">
                                ⏱️ {player.minutosObservados}
                              </span>
                            )}
                            {player.identificacao && (
                              <span className="px-2.5 py-0.5 rounded-full text-xs bg-yellow-950/40 border border-yellow-800/40 text-yellow-300/80">
                                🔍 {player.identificacao}
                              </span>
                            )}
                          </div>
                        </div>
                        {player.nivelConfianca && (
                          <div className="text-xs uppercase tracking-wider font-bold px-3 py-1 rounded-full bg-yellow-950 border border-yellow-500/40 text-yellow-300">
                            {loc[currentLang].confidence}: {player.nivelConfianca}
                          </div>
                        )}
                      </div>

                      {/* INDIVIDUAL ANALYSIS */}
                      {player.analise && (
                        <div>
                          <h5 className="text-xs uppercase font-bold text-yellow-400/80 mb-1 tracking-wider">
                            {loc[currentLang].scoutingTitle}
                          </h5>
                          <p className="text-yellow-101/90 text-sm leading-relaxed whitespace-pre-wrap bg-black/25 p-4 rounded-xl border border-yellow-900/25">
                            {t(`pl_an_${idx}`, player.analise)}
                          </p>
                        </div>
                      )}

                      {/* ACTIONS / STRENGTHS / ATTENTION IN 3 COLUMNS */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs md:text-sm">
                        {player.acoesPercebidas && player.acoesPercebidas.length > 0 && (
                          <div className="bg-black/20 p-3 rounded-xl border border-yellow-900/20">
                            <div className="text-yellow-300 font-bold mb-2 flex items-center gap-1.5">
                              <span>⚡</span> {loc[currentLang].scouActions}
                            </div>
                            <MiniList items={player.acoesPercebidas?.map((ac, aidx) => t(`pl_ac_${idx}_${aidx}`, ac))} />
                          </div>
                        )}
                        {player.pontosFortes && player.pontosFortes.length > 0 && (
                          <div className="bg-black/20 p-3 rounded-xl border border-yellow-900/20">
                            <div className="text-yellow-300 font-bold mb-2 flex items-center gap-1.5">
                              <span>🛡️</span> {loc[currentLang].scouStrengths}
                            </div>
                            <MiniList items={player.pontosFortes?.map((pf, pfidx) => t(`pl_pf_${idx}_${pfidx}`, pf))} />
                          </div>
                        )}
                        {player.pontosAtencao && player.pontosAtencao.length > 0 && (
                          <div className="bg-black/20 p-3 rounded-xl border border-yellow-900/20">
                            <div className="text-yellow-300 font-bold mb-2 flex items-center gap-1.5">
                              <span>⚠️</span> {loc[currentLang].scouAttention}
                            </div>
                            <MiniList items={player.pontosAtencao?.map((pa, paidx) => t(`pl_pa_${idx}_${paidx}`, pa))} />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-[#2a0101]/40 border border-yellow-900/30 rounded-2xl p-10 text-center space-y-3">
                <UsersIcon className="w-12 h-12 text-yellow-500/40 mx-auto" />
                <h4 className="text-yellow-200 font-bold text-lg">{loc[currentLang].noPlayersTitle}</h4>
                <p className="text-yellow-101/60 text-sm max-w-md mx-auto">{loc[currentLang].noPlayersDesc}</p>
              </div>
            )}
          </AnalysisCard>
        </div>
      )}

      {/* ======================================================== */}
      {/* 6. ABA: AUDITORIA DE PLACAR */}
      {/* ======================================================== */}
      {(isExporting || activeSubTab === 'auditoria') && (
        <div className="space-y-8 print:block print:space-y-6">
          <AnalysisCard title={loc[currentLang].auditReport} icon={<ShieldCheck className="h-6 w-6 text-yellow-400" />}>
            {/* SCORE AUDIT REPORT */}
            {placarAuditoria ? (
              <div className="bg-black/30 border border-yellow-900/40 rounded-xl p-6 space-y-4">
                <div className="grid md:grid-cols-2 gap-4 text-sm text-yellow-101/90">
                  <div className="bg-black/25 p-3 rounded-lg border border-yellow-900/20">
                    <span className="text-yellow-300 font-semibold block text-xs uppercase">{loc[currentLang].confirmedScore}</span>
                    <span className="text-xl font-bold font-mono text-yellow-100 mt-1 block">{placarAuditoria.placarFinal || '—'}</span>
                  </div>
                  <div className="bg-black/25 p-3 rounded-lg border border-yellow-900/20">
                    <span className="text-yellow-300 font-semibold block text-xs uppercase">{loc[currentLang].evidence}</span>
                    <span className="text-xl font-bold font-mono text-yellow-100 mt-1 block">{placarAuditoria.placarVisivel || '—'}</span>
                  </div>
                  <div className="bg-black/25 p-3 rounded-lg border border-yellow-900/20">
                    <span className="text-yellow-300 font-semibold block text-xs uppercase">{loc[currentLang].valSource}</span>
                    <span className="text-sm font-semibold text-yellow-200 mt-1 block">{t('pa_fonte', placarAuditoria.fontePlacar) || '—'}</span>
                  </div>
                  <div className="bg-black/25 p-3 rounded-lg border border-yellow-900/20">
                    <span className="text-yellow-300 font-semibold block text-xs uppercase">{loc[currentLang].confidence}</span>
                    <span className="text-sm font-semibold text-yellow-200 mt-1 block">{placarAuditoria.confianca || '—'}</span>
                  </div>
                </div>

                {placarAuditoria.observacoes && (
                  <div className="bg-black/25 p-4 rounded-lg border border-yellow-900/20">
                    <span className="text-yellow-300 font-semibold block text-xs uppercase mb-1">{loc[currentLang].observations}</span>
                    <p className="text-yellow-101/80 text-sm whitespace-pre-wrap">{t('pa_obs', placarAuditoria.observacoes)}</p>
                  </div>
                )}

                {placarAuditoria.evidencias && placarAuditoria.evidencias.length > 0 && (
                  <div className="bg-black/25 p-4 rounded-lg border border-yellow-900/20">
                    <span className="text-yellow-300 font-semibold block text-xs uppercase mb-2">{loc[currentLang].evidence}</span>
                    <MiniList items={placarAuditoria.evidencias} />
                  </div>
                )}
              </div>
            ) : (
              <p className="text-yellow-101/60 text-sm">{loc[currentLang].noData}</p>
            )}

            {/* TECHNICAL DETAILS & VALIDATION SOURCES */}
            {verificacao && (
              <div className="mt-8 pt-6 border-t border-yellow-900/40">
                <SectionTitle>{loc[currentLang].tacticalDetails}</SectionTitle>
                <div className="mt-4 p-5 rounded-xl bg-black/25 border border-yellow-900/30 text-sm space-y-3">
                  {verificacao.estrategiaAnalise && (
                    <div>
                      <span className="text-yellow-300 font-semibold">{loc[currentLang].strategyOfReview}:</span>{' '}
                      <span className="text-yellow-101/90">{verificacao.estrategiaAnalise}</span>
                    </div>
                  )}
                  {verificacao.modeloUsado && (
                    <div>
                      <span className="text-yellow-300 font-semibold">{loc[currentLang].modelUsed}:</span>{' '}
                      <span className="text-yellow-101/90">{verificacao.modeloUsado}</span>
                    </div>
                  )}
                  {verificacao.trechoAnalisado && (
                    <div>
                      <span className="text-yellow-300 font-semibold">{loc[currentLang].matchSegmentReviewed}:</span>{' '}
                      <span className="text-yellow-101/90">{verificacao.trechoAnalisado}</span>
                    </div>
                  )}
                  {verificacao.observacoes && (
                    <div className="text-yellow-101/70 italic bg-black/30 p-3 rounded border border-yellow-900/20">
                      "{verificacao.observacoes}"
                    </div>
                  )}
                  
                  {verificacao.fontesPrincipais && Array.isArray(verificacao.fontesPrincipais) && verificacao.fontesPrincipais.length > 0 && (
                    <div className="mt-4 pt-3 border-t border-yellow-900/30">
                      <div className="text-yellow-300 font-bold mb-2">{loc[currentLang].sourcesConfirmed}</div>
                      <ul className="space-y-1.5">
                        {verificacao.fontesPrincipais.map((src: any, idx: number) => {
                          const isObj = typeof src === 'object' && src !== null;
                          const uri = isObj ? src.uri : src;
                          const title = isObj ? src.title : src;
                          return (
                            <li key={idx}>
                              <a 
                                href={uri} 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                className="text-yellow-400 hover:text-yellow-200 underline flex items-center gap-1.5 text-xs break-all"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                </svg>
                                {title}
                              </a>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            )}
          </AnalysisCard>
        </div>
      )}

      {/* TELEGRAM PUBLISH MODAL */}
      <TelegramPublishModal 
        analysis={analysis}
        isOpen={isTelegramModalOpen}
        onClose={() => setIsTelegramModalOpen(false)}
        pdfFilename={`analise-tatica-${analysis.timeA || 'TimeA'}-${analysis.timeB || 'TimeB'}.pdf`}
      />
    </div>
  );
};

export default AnalysisDisplay;
