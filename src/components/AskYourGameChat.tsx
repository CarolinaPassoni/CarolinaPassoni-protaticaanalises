import React, { useState } from 'react';
import { Bot, Send, Sparkles, AlertCircle, HelpCircle, Loader2, User } from 'lucide-react';
import { Analysis } from '../types';
import { getAuthHeaders } from '../services/geminiService';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

interface AskYourGameChatProps {
  analysis: Analysis;
}

export const AskYourGameChat: React.FC<AskYourGameChatProps> = ({ analysis }) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: `Olá! Sou o assistente tático do ProTática. Estou conectado exclusivamente às evidências, estatísticas e lances de "${analysis.videoTitle || (analysis as any).title || 'esta partida'}". Como posso ajudar na sua análise técnica?`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const quickPrompts = [
    'Onde tivemos maior dificuldade?',
    'Como o adversário superou nossa pressão?',
    'Quais foram os principais erros defensivos?',
    'Quais foram nossos pontos fortes?',
    'O que devemos trabalhar no próximo treino?',
  ];

  const handleSendMessage = async (textToSend?: string) => {
    const query = (textToSend || inputValue).trim();
    if (!query || isLoading) return;

    const userMsg: Message = {
      role: 'user',
      content: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputValue('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/match/ask', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          question: query,
          analysisId: analysis.analysisId,
          analysisContext: analysis,
        }),
      });

      if (!res.ok) {
        throw new Error('Falha ao obter resposta do assistente tático.');
      }

      const data = await res.json();
      const assistantMsg: Message = {
        role: 'assistant',
        content: data.answer || 'Não há evidência suficiente nesta análise para responder com segurança.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'Não foi possível consultar o assistente no momento. Verifique a conexão com o servidor.',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-[#2a0101]/80 border border-yellow-500/30 rounded-2xl p-5 shadow-xl space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-yellow-900/40 pb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-yellow-500/10 text-yellow-400 border border-yellow-500/30">
            <Bot className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-yellow-200">PERGUNTE AO SEU JOGO</h3>
            <p className="text-[11px] text-yellow-100/60">
              Perguntas respondidas estritamente com base nos dados e evidências deste jogo
            </p>
          </div>
        </div>
        <span className="text-[10px] font-mono text-yellow-500/80 bg-yellow-950 px-2 py-0.5 rounded border border-yellow-900/40">
          Contexto Restrito
        </span>
      </div>

      {/* Quick Action Prompt Chips */}
      <div className="flex flex-wrap gap-1.5 pt-1">
        {quickPrompts.map((prompt, idx) => (
          <button
            key={idx}
            type="button"
            disabled={isLoading}
            onClick={() => handleSendMessage(prompt)}
            className="text-[11px] font-medium px-2.5 py-1 rounded-lg bg-yellow-950/40 hover:bg-yellow-900/50 border border-yellow-800/30 text-yellow-200 hover:text-yellow-100 transition-colors cursor-pointer disabled:opacity-50"
          >
            {prompt}
          </button>
        ))}
      </div>

      {/* Messages Scroll Area */}
      <div className="bg-black/30 border border-yellow-900/20 rounded-xl p-4 max-h-[350px] overflow-y-auto space-y-3">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex gap-2.5 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {msg.role === 'assistant' && (
              <div className="w-7 h-7 rounded-lg bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 flex items-center justify-center shrink-0 mt-0.5">
                <Bot className="h-4 w-4" />
              </div>
            )}

            <div
              className={`max-w-[82%] rounded-xl p-3 text-xs leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-yellow-500 text-black font-semibold shadow-md'
                  : 'bg-[#210202] border border-yellow-900/40 text-yellow-50/95 shadow-inner'
              }`}
            >
              <p className="whitespace-pre-line">{msg.content}</p>
              <span
                className={`block text-[9px] mt-1.5 ${
                  msg.role === 'user' ? 'text-black/60 text-right' : 'text-yellow-100/40'
                }`}
              >
                {msg.timestamp}
              </span>
            </div>

            {msg.role === 'user' && (
              <div className="w-7 h-7 rounded-lg bg-yellow-900/40 border border-yellow-600/30 text-yellow-200 flex items-center justify-center shrink-0 mt-0.5">
                <User className="h-4 w-4" />
              </div>
            )}
          </div>
        ))}

        {isLoading && (
          <div className="flex gap-2.5 items-center text-xs text-yellow-400/80 bg-[#210202] p-3 rounded-xl border border-yellow-900/30 w-fit">
            <Loader2 className="h-4 w-4 animate-spin text-yellow-400" />
            <span>Consultando evidências e estatísticas da partida...</span>
          </div>
        )}
      </div>

      {/* Input Field */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSendMessage();
        }}
        className="flex gap-2"
      >
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="Pergunte algo sobre esta partida..."
          disabled={isLoading}
          className="flex-grow bg-black/40 border border-yellow-900/50 rounded-xl px-3.5 py-2 text-xs text-yellow-50 placeholder-yellow-200/40 focus:border-yellow-500 focus:outline-none"
        />
        <button
          type="submit"
          disabled={!inputValue.trim() || isLoading}
          className="px-4 py-2 bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-400 hover:to-yellow-500 disabled:opacity-40 text-black font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
        >
          <Send className="h-3.5 w-3.5" />
          <span>Enviar</span>
        </button>
      </form>
    </div>
  );
};
