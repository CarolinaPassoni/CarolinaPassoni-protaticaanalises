export interface PlanDefinition {
  id: string;
  name: string;
  category: 'scout' | 'performance' | 'intelligence' | 'club' | 'bronze' | 'pro' | 'elite';
  billingCycle: 'monthly' | 'yearly';
  price: number; // in BRL
  priceFormatted: string;
  durationDays: number;
  description: string;
  pillarBadge?: string;
  pillarAction?: string;
  popular?: boolean;
  features: string[];
}

export const OFFICIAL_PLANS: Record<string, PlanDefinition> = {
  // PROTÁTICA SCOUT (R$ 59/mês ou R$ 495/ano) - ANALISAR
  scout_monthly: {
    id: 'scout_monthly',
    name: 'ProTática Scout',
    category: 'scout',
    billingCycle: 'monthly',
    price: 59.00,
    priceFormatted: 'R$ 59,00',
    durationDays: 30,
    pillarBadge: '🎥 ANALISAR',
    pillarAction: 'Comece a enxergar o jogo além do placar',
    description: 'Ideal para analistas autônomos, torcedores qualificados e estudantes de tática.',
    features: [
      'Até 10 análises completas de partidas/mês',
      'Modo de Análise Rápida e Detalhada',
      'Índice de Confiabilidade ProTática (Visual e Dados)',
      'Mapas de calor táticos e distribuição de terços',
      'Scouting individual inicial de atletas',
      'Exportação de Relatório PDF estruturado',
    ],
  },
  scout_yearly: {
    id: 'scout_yearly',
    name: 'ProTática Scout Anual',
    category: 'scout',
    billingCycle: 'yearly',
    price: 495.00,
    priceFormatted: 'R$ 495,00',
    durationDays: 365,
    pillarBadge: '🎥 ANALISAR',
    pillarAction: 'Comece a enxergar o jogo além do placar',
    description: 'Economia de R$ 213,00 no ano (apenas R$ 41,25/mês)',
    features: [
      'Até 10 análises completas de partidas/mês',
      'Modo de Análise Rápida e Detalhada',
      'Índice de Confiabilidade ProTática (Visual e Dados)',
      'Mapas de calor táticos e distribuição de terços',
      'Scouting individual inicial de atletas',
      'Exportação de Relatório PDF estruturado',
    ],
  },

  // PROTÁTICA PERFORMANCE (R$ 139/mês ou R$ 1.167/ano) - DECIDIR (⭐ MAIS ESCOLHIDO)
  performance_monthly: {
    id: 'performance_monthly',
    name: 'ProTática Performance',
    category: 'performance',
    billingCycle: 'monthly',
    price: 139.00,
    priceFormatted: 'R$ 139,00',
    durationDays: 30,
    popular: true,
    pillarBadge: '🧠 DECIDIR',
    pillarAction: 'Não apenas analise. Descubra o que fazer a seguir',
    description: 'Para treinadores, scouts profissionais e comissões técnicas focadas em evolução prática.',
    features: [
      'Análises ILIMITADAS de partidas em vídeo',
      'Linha do Tempo de Evidências com Timestamps clicáveis',
      'Pergunte ao seu Jogo (Chat contextualizado na partida)',
      '3 Principais Insights (Vulnerabilidade, Oportunidade, Recomendação)',
      'Gerador de Planos de Treino baseados em fraquezas do jogo',
      'Acompanhamento de Metas de Evolução da Equipe',
      'Exportação de relatórios customizados (Técnico e Treinador)',
    ],
  },
  performance_yearly: {
    id: 'performance_yearly',
    name: 'ProTática Performance Anual',
    category: 'performance',
    billingCycle: 'yearly',
    price: 1167.00,
    priceFormatted: 'R$ 1.167,00',
    durationDays: 365,
    popular: true,
    pillarBadge: '🧠 DECIDIR',
    pillarAction: 'Não apenas analise. Descubra o que fazer a seguir',
    description: 'Mais Escolhido — Economia de R$ 501,00 no ano (apenas R$ 97,25/mês)',
    features: [
      'Análises ILIMITADAS de partidas em vídeo',
      'Linha do Tempo de Evidências com Timestamps clicáveis',
      'Pergunte ao seu Jogo (Chat contextualizado na partida)',
      '3 Principais Insights (Vulnerabilidade, Oportunidade, Recomendação)',
      'Gerador de Planos de Treino baseados em fraquezas do jogo',
      'Acompanhamento de Metas de Evolução da Equipe',
      'Exportação de relatórios customizados (Técnico e Treinador)',
    ],
  },

  // PROTÁTICA INTELLIGENCE (R$ 319/mês ou R$ 2.679/ano) - PREPARAR
  intelligence_monthly: {
    id: 'intelligence_monthly',
    name: 'ProTática Intelligence',
    category: 'intelligence',
    billingCycle: 'monthly',
    price: 319.00,
    priceFormatted: 'R$ 319,00',
    durationDays: 30,
    pillarBadge: '🏆 PREPARAR',
    pillarAction: 'Prepare o jogo antes de entrar em campo',
    description: 'Para clubes, departamentos de análise de mercado e analistas que cruzam dados multi-jogos.',
    features: [
      'Dossiê Completo do Adversário (Cruzamento multi-partidas)',
      'Biblioteca Central de Evidências e Clipes Táticos',
      'Quadro Tático Interativo com Exportação de Prancheta',
      'Validação de Placar Multi-Fontes (Google Grounding)',
      'Até 5 analistas simultâneos na mesma organização',
      'Publicação e alertas automáticos via Telegram',
      'Suporte prioritário direto via WhatsApp',
    ],
  },
  intelligence_yearly: {
    id: 'intelligence_yearly',
    name: 'ProTática Intelligence Anual',
    category: 'intelligence',
    billingCycle: 'yearly',
    price: 2679.00,
    priceFormatted: 'R$ 2.679,00',
    durationDays: 365,
    pillarBadge: '🏆 PREPARAR',
    pillarAction: 'Prepare o jogo antes de entrar em campo',
    description: 'Economia de R$ 1.149,00 no ano (apenas R$ 223,25/mês)',
    features: [
      'Dossiê Completo do Adversário (Cruzamento multi-partidas)',
      'Biblioteca Central de Evidências e Clipes Táticos',
      'Quadro Tático Interativo com Exportação de Prancheta',
      'Validação de Placar Multi-Fontes (Google Grounding)',
      'Até 5 analistas simultâneos na mesma organização',
      'Publicação e alertas automáticos via Telegram',
      'Suporte prioritário direto via WhatsApp',
    ],
  },

  // PROTÁTICA CLUB (Sob Consulta) - GERENCIAR
  club_custom: {
    id: 'club_custom',
    name: 'ProTática Club',
    category: 'club',
    billingCycle: 'yearly',
    price: 0,
    priceFormatted: 'Sob Consulta',
    durationDays: 365,
    pillarBadge: '🏟️ GERENCIAR',
    pillarAction: 'Uma estrutura de inteligência para todo o clube',
    description: 'Solução corporativa completa para clubes profissionais, federações e academias de base.',
    features: [
      'ProTática Base (Módulo integrado Sub-10 ao Sub-20)',
      'Painéis multi-categorias e relatórios para a diretoria',
      'Treinamento e capacitação presencial/remota para a comissão',
      'Integrações personalizadas via API e banco dedicado',
      'Usuários e analistas ilimitados por divisão',
      'Consultoria tática e suporte 24/7 com SLA dedicado',
    ],
  },

  // Backward compatibility legacy aliases (mapping bronze -> scout, pro -> performance, elite -> intelligence)
  bronze_monthly: {
    id: 'bronze_monthly',
    name: 'ProTática Scout',
    category: 'bronze',
    billingCycle: 'monthly',
    price: 59.00,
    priceFormatted: 'R$ 59,00',
    durationDays: 30,
    pillarBadge: '🎥 ANALISAR',
    pillarAction: 'Comece a enxergar o jogo além do placar',
    description: 'Ideal para torcedores e analistas autônomos.',
    features: [
      'Até 10 análises completas/mês',
      'Modo de Análise Rápida e Detalhada',
      'Índice de Confiabilidade ProTática',
      'Mapas de calor táticos',
      'Scouting individual de atletas',
    ],
  },
  bronze_yearly: {
    id: 'bronze_yearly',
    name: 'ProTática Scout Anual',
    category: 'bronze',
    billingCycle: 'yearly',
    price: 495.00,
    priceFormatted: 'R$ 495,00',
    durationDays: 365,
    pillarBadge: '🎥 ANALISAR',
    pillarAction: 'Comece a enxergar o jogo além do placar',
    description: 'Economia de R$ 213,00 no ano (R$ 41,25/mês)',
    features: [
      'Até 10 análises completas/mês',
      'Modo de Análise Rápida e Detalhada',
      'Índice de Confiabilidade ProTática',
      'Mapas de calor táticos',
      'Scouting individual de atletas',
    ],
  },
  pro_monthly: {
    id: 'pro_monthly',
    name: 'ProTática Performance',
    category: 'pro',
    billingCycle: 'monthly',
    price: 139.00,
    priceFormatted: 'R$ 139,00',
    durationDays: 30,
    popular: true,
    pillarBadge: '🧠 DECIDIR',
    pillarAction: 'Não apenas analise. Descubra o que fazer a seguir',
    description: 'Para treinadores e scouts profissionais.',
    features: [
      'Análises ilimitadas de vídeos',
      'Linha do tempo de evidências',
      'Pergunte ao seu jogo',
      'Gerador de treinos corretivos',
      'Exportação em Relatório PDF',
    ],
  },
  pro_yearly: {
    id: 'pro_yearly',
    name: 'ProTática Performance Anual',
    category: 'pro',
    billingCycle: 'yearly',
    price: 1167.00,
    priceFormatted: 'R$ 1.167,00',
    durationDays: 365,
    popular: true,
    pillarBadge: '🧠 DECIDIR',
    pillarAction: 'Não apenas analise. Descubra o que fazer a seguir',
    description: 'Mais Escolhido - Economia de R$ 501,00 no ano (R$ 97,25/mês)',
    features: [
      'Análises ilimitadas de vídeos',
      'Linha do tempo de evidências',
      'Pergunte ao seu jogo',
      'Gerador de treinos corretivos',
      'Exportação em Relatório PDF',
    ],
  },
  elite_monthly: {
    id: 'elite_monthly',
    name: 'ProTática Intelligence',
    category: 'elite',
    billingCycle: 'monthly',
    price: 319.00,
    priceFormatted: 'R$ 319,00',
    durationDays: 30,
    pillarBadge: '🏆 PREPARAR',
    pillarAction: 'Prepare o jogo antes de entrar em campo',
    description: 'Integração corporativa e suporte especializado',
    features: [
      'Dossiê do Adversário Multi-Partidas',
      'Quadro Tático Interativo',
      'Acesso para até 5 analistas simultâneos',
      'Suporte prioritário via WhatsApp',
      'Exportações PDF e Telegram ilimitadas',
    ],
  },
  elite_yearly: {
    id: 'elite_yearly',
    name: 'ProTática Intelligence Anual',
    category: 'elite',
    billingCycle: 'yearly',
    price: 2679.00,
    priceFormatted: 'R$ 2.679,00',
    durationDays: 365,
    pillarBadge: '🏆 PREPARAR',
    pillarAction: 'Prepare o jogo antes de entrar em campo',
    description: 'Economia de R$ 1.149,00 no ano (R$ 223,25/mês)',
    features: [
      'Dossiê do Adversário Multi-Partidas',
      'Quadro Tático Interativo',
      'Acesso para até 5 analistas simultâneos',
      'Suporte prioritário via WhatsApp',
      'Exportações PDF e Telegram ilimitadas',
    ],
  },
};

export const OFFICIAL_PLANS_LIST: PlanDefinition[] = [
  OFFICIAL_PLANS.scout_monthly,
  OFFICIAL_PLANS.scout_yearly,
  OFFICIAL_PLANS.performance_monthly,
  OFFICIAL_PLANS.performance_yearly,
  OFFICIAL_PLANS.intelligence_monthly,
  OFFICIAL_PLANS.intelligence_yearly,
  OFFICIAL_PLANS.club_custom,
];

export function getPlanById(planId: string): PlanDefinition | null {
  if (!planId) return null;
  const normalizedId = planId.toLowerCase().trim();
  if (OFFICIAL_PLANS[normalizedId]) {
    return OFFICIAL_PLANS[normalizedId];
  }
  // Try matching name if passed
  const found = Object.values(OFFICIAL_PLANS).find(
    (p) => p.name.toLowerCase() === normalizedId || p.id.toLowerCase() === normalizedId
  );
  return found || null;
}

export const getOfficialPlanById = getPlanById;
