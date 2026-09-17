import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type Language = 'pt' | 'en' | 'es';

interface TranslationDict {
    [key: string]: {
        pt: string;
        en: string;
        es: string;
    };
}

export const translations: TranslationDict = {
    // Header & Navigation
    title: { pt: 'PROTÁTICA', en: 'PROTACTICAL', es: 'PROTÁCTICA' },
    subtitle: { pt: 'Análise Tática Esportiva de Alta Performance', en: 'High-Performance Sports Tactical Analysis', es: 'Análisis Táctico Deportivo de Alto Rendimiento' },
    pdfReport: { pt: 'Relatório PDF', en: 'PDF Report', es: 'Informe PDF' },
    logout: { pt: 'Sair', en: 'Logout', es: 'Salir' },
    presentation: { pt: 'Apresentação', en: 'Presentation', es: 'Presentación' },
    pricing: { pt: 'Valores para Compra', en: 'Pricing', es: 'Precios de Compra' },
    start: { pt: 'Iniciar', en: 'Start', es: 'Iniciar' },
    login: { pt: 'Entrar', en: 'Login', es: 'Ingresar' },
    backToLanding: { pt: 'Voltar ao Início', en: 'Back', es: 'Volver' },
    restrictedAccess: { pt: 'Acesso Restrito PROTÁTICA', en: 'PROTACTICAL Restricted Access', es: 'Acceso Restringido PROTÁCTICA' },
    passwordPlaceholder: { pt: 'Insira a senha de acesso...', en: 'Enter access password...', es: 'Ingrese la contraseña de acceso...' },
    enterBtn: { pt: 'Entrar', en: 'Enter', es: 'Ingresar' },
    wrongPassword: { pt: 'Senha incorreta! Entre em contato com a equipe comercial.', en: 'Incorrect password! Contact the sales team.', es: '¡Contraseña incorrecta! Contacte al equipo comercial.' },

    // UrlInputForm
    analyzeByUrl: { pt: 'Analisar por URL', en: 'Analyze by URL', es: 'Analizar por URL' },
    analyzeByFile: { pt: 'Analisar por Arquivo', en: 'Analyze by File', es: 'Analizar por Archivo' },
    urlPlaceholder: { pt: 'Insira o link do YouTube...', en: 'Insert YouTube link...', es: 'Ingrese el enlace de YouTube...' },
    urlError: { pt: 'Por favor, insira um link válido do YouTube', en: 'Please, insert a valid YouTube link', es: 'Por favor, ingrese un enlace de YouTube válido' },
    analysisMode: { pt: 'Modo da análise', en: 'Analysis Mode', es: 'Modo de análisis' },
    quickMode: { pt: 'Rápida (Amostragem básica)', en: 'Quick (Basic sampling)', es: 'Rápida (Muestreo básico)' },
    detailedMode: { pt: 'Detalhada (Tática profunda)', en: 'Detailed (Deep tactical)', es: 'Detallada (Táctica profunda)' },
    completeMode: { pt: 'Completa (Tática + Validação de Placar)', en: 'Complete (Tactical + Score Audit)', es: 'Completa (Táctica + Auditoría de Marcador)' },
    quickHint: { pt: 'Ideal para um panorama geral rápido da partida.', en: 'Ideal for a quick general overview of the match.', es: 'Ideal para un panorama general rápido del partido.' },
    detailedHint: { pt: 'Focada em padrões táticos complexos, scouting de mais jogadores e fases de transição.', en: 'Focused on complex tactical patterns, player scouting and transitions.', es: 'Enfocado en patrones tácticos complejos, scouting de jugadores y transiciones.' },
    completeHint: { pt: 'O sistema realizará uma auditoria rigorosa do placar, buscando evidências visuais e narrativas no vídeo.', en: 'The system will conduct a strict score audit, finding visual and narrative evidence.', es: 'El sistema realizará una auditoría estricta del marcador, buscando evidencias visuales.' },
    videoClip: { pt: 'Trecho do vídeo', en: 'Video segment', es: 'Tramo del video' },
    clipFirst15: { pt: 'Rápido: primeiros 15 minutos', en: 'Quick: first 15 minutes', es: 'Rápido: primeros 15 minutos' },
    clipFirst30: { pt: 'Intermediário: primeiros 30 minutos', en: 'Intermediate: first 30 minutes', es: 'Intermedio: primeros 30 minutos' },
    clipFirst45: { pt: '1º tempo: 0 a 45 minutos', en: 'First half: 0 to 45 minutes', es: 'Primer tiempo: 0 a 45 minutos' },
    clipSecond45: { pt: '2º tempo: 45 a 90 minutos', en: 'Second half: 45 to 90 minutes', es: 'Segundo tiempo: 45 a 90 minutos' },
    clipFull: { pt: 'Partida completa + prorrogação/pênaltis', en: 'Full match + extra time/penalties', es: 'Partido completo + prórroga/penaltis' },
    clipCustom: { pt: 'Personalizado', en: 'Custom', es: 'Personalizado' },
    customStart: { pt: 'Início do trecho em minutos', en: 'Start time in minutes', es: 'Inicio del tramo en minutos' },
    customEnd: { pt: 'Fim do trecho em minutos', en: 'End time in minutes', es: 'Fin del tramo en minutos' },
    uploadHint: { pt: 'Clique para carregar um vídeo', en: 'Click to upload a video', es: 'Haga clic para cargar un video' },
    uploadLimit: { pt: 'Máx. 2GB. Para vídeos longos, a análise será feita por amostragem de quadros para otimizar.', en: 'Max. 2GB. For long videos, sampling frames will be used to optimize.', es: 'Máx. 2GB. Para videos largos, se usará muestreo de cuadros para optimizar.' },
    submitAnalyze: { pt: 'Analisar Partida', en: 'Analyze Match', es: 'Analizar Partido' },
    submitAnalyzeFile: { pt: 'Analisar Arquivo', en: 'Analyze File', es: 'Analizar Archivo' },
    submitLoading: { pt: 'Analisando e validando...', en: 'Analyzing and auditing...', es: 'Analizando y auditando...' },
    auditNote: { pt: 'O PROTÁTICA agora valida o placar com auditoria. Para maior fidelidade, escolha "Completa".', en: 'PROTACTICAL now validates the score with an audit. For maximum fidelity, select "Complete".', es: 'PROTÁCTICA ahora valida el marcador con auditoría. Para tener mayor fidelidad, elija "Completa".' },

    // History Panel
    historyTitle: { pt: 'Histórico de Análises', en: 'Analysis History', es: 'Historial de Análisis' },
    searchPlaceholder: { pt: 'Pesquisar partida...', en: 'Search match...', es: 'Buscar partido...' },
    historyEmpty: { pt: 'Nenhuma análise encontrada no histórico local.', en: 'No analysis found in local history.', es: 'Ningún análisis encontrado en el historial local.' },
    deleteConfirm: { pt: 'Tem certeza que deseja excluir esta análise?', en: 'Are you sure you want to delete this analysis?', es: '¿Está seguro que desea eliminar este análisis?' },

    // Tabs
    tabComparison: { pt: 'Comparativos e relatórios', en: 'Comparisons & Reports', es: 'Comparativas e Informes' },
    tabCurrent: { pt: 'Análise atual', en: 'Current Analysis', es: 'Análisis Actual' },
    welcomeTitle: { pt: 'PROTÁTICA com banco local ativo', en: 'PROTACTICAL with Active Local DB', es: 'PROTÁCTICA con Banco Local Activo' },
    welcomeText: { pt: 'Faça uma nova análise, abra um item do histórico salvo ou use a aba de comparativos.', en: 'Perform a new analysis, open a saved history item, or use comparisons.', es: 'Realice un nuevo análisis, abra un elemento guardado o use comparativas.' },

    // Comparison Dashboard
    dashboardTitle: { pt: 'Painel Comparativo de Desempenho', en: 'Performance Comparison Dashboard', es: 'Panel Comparativo de Rendimiento' },
    dashboardSubtitle: { pt: 'Acompanhe a evolução de métricas avançadas entre as análises salvas', en: 'Track advanced metrics development across saved analyses', es: 'Siga la evolución de métricas avanzadas entre los análisis guardados' },
    addAnalysisEmpty: { pt: 'Para gerar gráficos comparativos, você precisa ter pelo menos duas análises no histórico.', en: 'To generate comparison charts, you need at least two sports analyses saved.', es: 'Para generar gráficos comparativos, necesita al menos dos análisis guardados.' },
    ballPossession: { pt: 'Evolução da Posse de Bola (%)', en: 'Ball Possession Evolution (%)', es: 'Evolución de la Posesión del Balón (%)' },
    shotsAccuracy: { pt: 'Precisão e Volume de Finalizações', en: 'Shot Volume and Accuracy', es: 'Precisión y Volumen de Remates' },
    shotsTotal: { pt: 'Finalizações Totais', en: 'Total Shots', es: 'Remates Totales' },
    shotsOnTarget: { pt: 'No Alvo', en: 'On Target', es: 'Al Arco' },
    lastAnalyses: { pt: 'Últimas 5 análises no sistema', en: 'Last 5 analyses in the system', es: 'Últimos 5 análisis en el sistema' },

    // General Words
    portuguese: { pt: 'Português (Brasil)', en: 'Portuguese (Brazil)', es: 'Portugués (Brasil)' },
    english: { pt: 'Inglês', en: 'English', es: 'Inglés' },
    spanish: { pt: 'Espanhol', en: 'Spanish', es: 'Español' },
};

interface LanguageContextProps {
    language: Language;
    setLanguage: (lang: Language) => void;
    t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextProps | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [language, setLanguageState] = useState<Language>(() => {
        const stored = localStorage.getItem('protatica_lang') as Language;
        return (stored === 'pt' || stored === 'en' || stored === 'es') ? stored : 'pt';
    });

    const setLanguage = (lang: Language) => {
        setLanguageState(lang);
        localStorage.setItem('protatica_lang', lang);
    };

    const t = (key: string): string => {
        const entry = translations[key];
        if (!entry) return key;
        return entry[language] || entry['pt'];
    };

    return (
        <LanguageContext.Provider value={{ language, setLanguage, t }}>
            {children}
        </LanguageContext.Provider>
    );
};

export const useLanguage = () => {
    const context = useContext(LanguageContext);
    if (!context) {
        throw new Error('useLanguage deve ser usado dentro de um LanguageProvider');
    }
    return context;
};
