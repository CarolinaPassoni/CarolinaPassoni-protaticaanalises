import React from 'react';

interface LoadingSpinnerProps {
    step?: string;
    pct?: number | null;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ step, pct }) => {
    const messages = [
        'Preparando o trecho selecionado...',
        'Validando placar e evidências visuais...',
        'Avaliando organização tática...',
        'Analisando eventos e transições...',
        'Gerando relatório completo...',
        'Finalizando auditoria da análise...'
    ];
    const [fallbackMessage, setFallbackMessage] = React.useState(messages[0]);

    React.useEffect(() => {
        let index = 0;
        const intervalId = setInterval(() => {
            index = (index + 1) % messages.length;
            setFallbackMessage(messages[index]);
        }, 3500);

        return () => clearInterval(intervalId);
    }, [messages]);

    const activeMessage = step || fallbackMessage;

    return (
        <div className="flex flex-col items-center justify-center space-y-4 my-8 text-center bg-[#2a0101]/40 border border-yellow-900/30 rounded-xl p-8 shadow-xl">
            <div className="relative flex items-center justify-center">
                <div className="w-16 h-16 border-4 border-dashed rounded-full animate-spin border-yellow-400"></div>
                {pct !== null && (
                    <div className="absolute font-mono text-xs font-bold text-yellow-250">
                        {pct}%
                    </div>
                )}
            </div>
            <p className="text-xl text-yellow-300 font-semibold" id="loading-spinner-message">
                {activeMessage}
            </p>
            {pct !== null && (
                <div className="w-full max-w-md bg-yellow-950/40 rounded-full h-2.5 overflow-hidden border border-yellow-900/30">
                    <div 
                        className="bg-gradient-to-r from-yellow-500 to-yellow-300 h-2.5 rounded-full transition-all duration-500"
                        style={{ width: `${pct}%` }}
                    />
                </div>
            )}
            <p className="text-sm text-yellow-200/60 max-w-xl">
                O PROTÁTICA está enviando o trecho público do YouTube diretamente ao Gemini 3.8 para análise multimodal. A pesquisa secundária está desativada para preservar a cota. O tempo varia conforme a duração do trecho e a demanda da API; mantenha esta tela aberta até a conclusão.
            </p>
        </div>
    );
};

export default LoadingSpinner;
