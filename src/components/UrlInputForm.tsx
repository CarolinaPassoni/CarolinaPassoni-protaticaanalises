import React, { useMemo, useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { verifyVideo } from '../services/geminiService';
import type { VerifiedVideoContext } from '../types';
import { CheckCircle2, Video, Loader2 } from 'lucide-react';

export type AnalysisMode = 'quick' | 'detailed' | 'complete';
export type AnalysisRequest =
    | { type: 'url'; url: string; mode: AnalysisMode; clipStartSeconds?: number; clipEndSeconds?: number }
    | { type: 'file'; file: File; mode?: AnalysisMode; clipStartSeconds?: number; clipEndSeconds?: number };

interface UrlInputFormProps {
    onSubmit: (request: AnalysisRequest) => void;
    isLoading: boolean;
    initialUrl?: string;
}

type ClipPreset = 'game15to30' | 'first5' | 'first15' | 'first30' | 'first45' | 'second45' | 'fullMatch' | 'custom';

const UrlInputForm: React.FC<UrlInputFormProps> = ({ onSubmit, isLoading, initialUrl }) => {
    const { t, language } = useLanguage();
    const [url, setUrl] = useState(initialUrl || '');

    useEffect(() => {
        if (initialUrl) {
            setUrl(initialUrl);
        }
    }, [initialUrl]);
    const [urlError, setUrlError] = useState<string | null>(null);
    const [mode, setMode] = useState<AnalysisMode>('quick');
    const [clipPreset, setClipPreset] = useState<ClipPreset>('game15to30');
    const [customStartMin, setCustomStartMin] = useState('0');
    const [customEndMin, setCustomEndMin] = useState('15');
    const [inputMethod, setInputMethod] = useState<'url' | 'file'>('url');
    const [file, setFile] = useState<File | null>(null);

    const [identifiedVideo, setIdentifiedVideo] = useState<VerifiedVideoContext | null>(null);
    const [isVerifyingVideo, setIsVerifyingVideo] = useState(false);

    useEffect(() => {
        const trimmed = url.trim();
        if (!trimmed) {
            setIdentifiedVideo(null);
            setIsVerifyingVideo(false);
            return;
        }

        const timer = setTimeout(async () => {
            const youtubeRegex = /^(https?:\/\/)?([a-zA-Z0-9-]+\.)?(youtube\.com|youtu\.?be)\/.+$/;
            if (youtubeRegex.test(trimmed)) {
                setIsVerifyingVideo(true);
                try {
                    const verified = await verifyVideo(trimmed);
                    setIdentifiedVideo(verified);
                } catch {
                    setIdentifiedVideo(null);
                } finally {
                    setIsVerifyingVideo(false);
                }
            } else {
                setIdentifiedVideo(null);
            }
        }, 500);

        return () => clearTimeout(timer);
    }, [url]);

    const clipOptions = useMemo(() => ({
        game15to30: {
            label: language === 'pt' ? 'Recomendado: jogo entre 15 e 30 minutos' : language === 'en' ? 'Recommended: gameplay from 15 to 30 minutes' : 'Recomendado: juego entre 15 y 30 minutos',
            start: 900,
            end: 1800,
            hint: language === 'pt' ? 'Evita a abertura da transmissão e aumenta a chance de analisar bola em jogo.' : language === 'en' ? 'Skips the broadcast intro and is more likely to contain active play.' : 'Evita la apertura de la transmisión y aumenta la posibilidad de analizar juego activo.'
        },
        first5: {
            label: language === 'pt' ? 'Abertura: primeiros 5 minutos' : language === 'en' ? 'Opening: first 5 minutes' : 'Apertura: primeros 5 minutos',
            start: 0,
            end: 300,
            hint: language === 'pt' ? 'Pode conter apenas vinheta, apresentação ou aquecimento e não gerar métricas.' : language === 'en' ? 'May contain only intro, presentation or warm-up and produce no metrics.' : 'Puede contener solo apertura, presentación o calentamiento y no generar métricas.'
        },
        first15: { 
            label: t('clipFirst15'), 
            start: 0, 
            end: 900, 
            hint: language === 'pt' ? 'Análise mais ampla; pode levar vários minutos no processamento nativo.' : language === 'en' ? 'Broader analysis; native processing may take several minutes.' : 'Análisis más amplio; el procesamiento nativo puede tardar varios minutos.' 
        },
        first30: { 
            label: t('clipFirst30'), 
            start: 0, 
            end: 1800, 
            hint: language === 'pt' ? 'Boa profundidade sem pesar tanto.' : language === 'en' ? 'Good depth without loading too much.' : 'Buena profundidad sin cargar demasiado.' 
        },
        first45: { 
            label: t('clipFirst45'), 
            start: 0, 
            end: 2700, 
            hint: language === 'pt' ? 'Mais demorado. Pode levar alguns minutos.' : language === 'en' ? 'Slower. May take a few minutes.' : 'Más lento. Puede tomar algunos minutos.' 
        },
        second45: { 
            label: t('clipSecond45'), 
            start: 2700, 
            end: 5400, 
            hint: language === 'pt' ? 'Mais demorado. Use quando quiser analisar a segunda etapa.' : language === 'en' ? 'Slower. Use when you want to analyze the second half.' : 'Más lento. Úselo para analizar el segundo tiempo.' 
        },
        fullMatch: { 
            label: t('clipFull'), 
            start: 0, 
            end: 9000, 
            hint: language === 'pt' ? 'Usa análise segmentada do vídeo inteiro. Tenta cobrir tempo normal, acréscimos, prorrogação e pênaltis.' : language === 'en' ? 'Uses segmented analysis of the full video. Covers normal, extra time and penalties.' : 'Usa análisis segmentado de todo el video. Cubre tiempo normal, prórroga y penales.' 
        },
    }), [t, language]);

    const selectedClip = useMemo(() => {
        if (clipPreset !== 'custom') return clipOptions[clipPreset];
        const start = Math.max(0, Number(customStartMin.replace(',', '.')) || 0) * 60;
        const rawEnd = Math.max(0, Number(customEndMin.replace(',', '.')) || 15) * 60;
        const end = rawEnd > start ? rawEnd : start + 900;
        return {
            label: language === 'pt' ? `Personalizado: ${Math.round(start / 60)} a ${Math.round(end / 60)} minutos` : language === 'en' ? `Custom: ${Math.round(start / 60)} to ${Math.round(end / 60)} minutes` : `Personalizado: ${Math.round(start / 60)} a ${Math.round(end / 60)} minutos`,
            start,
            end,
            hint: language === 'pt' ? 'Use trechos menores para evitar demora e limite de tokens.' : language === 'en' ? 'Use smaller segments to avoid delay and token limits.' : 'Use tramos más pequeños para evitar demoras y límites de tokens.',
        };
    }, [clipPreset, customStartMin, customEndMin, clipOptions, language]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            const MAX_FILE_SIZE_GB = 2;
            if (selectedFile.size > MAX_FILE_SIZE_GB * 1024 * 1024 * 1024) {
                alert(`O arquivo é muito grande (${(selectedFile.size / 1024 / 1024 / 1024).toFixed(2)}GB). O tamanho máximo é ${MAX_FILE_SIZE_GB}GB.`);
                setFile(null);
                e.target.value = '';
                return;
            }
            setFile(selectedFile);
        }
    };

    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (isLoading) return;
        setUrlError(null);

        if (inputMethod === 'url') {
            const trimmedUrl = url.trim();
            if (!trimmedUrl) return;

            // Regex simples para validar se é um link do YouTube (permite m.youtube, etc.)
            const youtubeRegex = /^(https?:\/\/)?([a-zA-Z0-9-]+\.)?(youtube\.com|youtu\.?be)\/.+$/;
            if (!youtubeRegex.test(trimmedUrl)) {
                setUrlError(t('urlError'));
                return;
            }

            onSubmit({
                type: 'url',
                url: trimmedUrl,
                mode,
                clipStartSeconds: selectedClip.start,
                clipEndSeconds: selectedClip.end,
            });
        } else if (inputMethod === 'file' && file) {
            onSubmit({ type: 'file', file });
        }
    };

    const TabButton: React.FC<{ active: boolean; onClick: () => void; children: React.ReactNode }> = ({ active, onClick, children }) => (
        <button
            type="button"
            role="tab"
            aria-selected={active}
            onClick={onClick}
            disabled={isLoading}
            className={`px-4 py-2 text-lg font-semibold border-b-4 transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-yellow-400/50 rounded-t-md ${
                active
                    ? 'border-yellow-500 text-yellow-200'
                    : 'border-transparent text-yellow-200/50 hover:text-yellow-200/80 hover:border-yellow-800/60'
            }`}
        >
            {children}
        </button>
    );

    return (
        <div className="p-4 md:p-6">
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div className="flex justify-center border-b border-yellow-900/50 mb-4" role="tablist">
                    <TabButton active={inputMethod === 'url'} onClick={() => setInputMethod('url')}>{t('analyzeByUrl')}</TabButton>
                    <TabButton active={inputMethod === 'file'} onClick={() => setInputMethod('file')}>{t('analyzeByFile')}</TabButton>
                </div>

                {inputMethod === 'url' && (
                    <div role="tabpanel" className="space-y-4">
                        <input
                            type="url"
                            value={url}
                            onChange={(e) => {
                                      setUrl(e.target.value);
                                if (urlError) setUrlError(null);
                            }}
                            placeholder={t('urlPlaceholder')}
                            className={`w-full bg-black/30 border rounded-md px-4 py-3 text-lg placeholder-gray-500 focus:ring-2 outline-none transition-all disabled:opacity-50 ${
                                      urlError 
                                    ? 'border-red-500 focus:ring-red-500 focus:border-red-500' 
                                    : 'border-yellow-800/60 focus:ring-yellow-500 focus:border-yellow-500'
                            }`}
                            required
                            disabled={isLoading}
                            aria-label={t('analyzeByUrl')}
                        />
                        {urlError && (
                            <p className="text-red-400 text-sm mt-1">{urlError}</p>
                        )}

                        {isVerifyingVideo && (
                            <div className="flex items-center gap-2 p-3 bg-yellow-950/30 border border-yellow-800/40 rounded-lg text-yellow-300 text-sm animate-pulse">
                                <Loader2 className="w-4 h-4 animate-spin text-yellow-400" />
                                <span>Verificando identidade e metadados do vídeo...</span>
                            </div>
                        )}

                        {identifiedVideo && !isVerifyingVideo && (
                            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 p-3 bg-black/40 border border-emerald-500/50 rounded-lg shadow-sm">
                                <img
                                    src={identifiedVideo.thumbnailUrl || `https://img.youtube.com/vi/${identifiedVideo.videoId}/hqdefault.jpg`}
                                    alt={identifiedVideo.title}
                                    className="w-24 h-16 object-contain bg-black/30 rounded border border-yellow-700/40 flex-shrink-0"
                                    referrerPolicy="no-referrer"
                                />
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold uppercase bg-emerald-900/60 text-emerald-300 border border-emerald-600/40">
                                            <CheckCircle2 className="w-3 h-3" /> VÍDEO IDENTIFICADO
                                        </span>
                                        <span className="text-[11px] text-yellow-400/80 font-mono">ID: {identifiedVideo.videoId}</span>
                                    </div>
                                    <p className="text-sm font-semibold text-yellow-100 truncate mt-1">{identifiedVideo.title}</p>
                                    <p className="text-xs text-yellow-300/60">{identifiedVideo.channelTitle || 'YouTube'}</p>
                                </div>
                            </div>
                        )}

                        <div className="grid md:grid-cols-2 gap-4">
                            <div className="bg-black/20 border border-yellow-900/40 rounded-md p-4">
                                <label className="block text-yellow-200 font-semibold mb-2" htmlFor="mode-select">{t('analysisMode')}</label>
                                <select
                                    id="mode-select"
                                    value={mode}
                                    onChange={(e) => {
                                        const nextMode = e.target.value as AnalysisMode;
                                        setMode(nextMode);
                                        if (nextMode === 'complete') setClipPreset('fullMatch');
                                    }}
                                    disabled={isLoading}
                                    className="w-full bg-[#260101] border border-yellow-800/60 rounded-md px-3 py-2 text-yellow-101 outline-none focus:ring-2 focus:ring-yellow-500"
                                >
                                    <option value="quick">{t('quickMode')}</option>
                                    <option value="detailed">{t('detailedMode')}</option>
                                    <option value="complete">{t('completeMode')}</option>
                                </select>
                                <div className="mt-2 text-xs text-yellow-400/70 border-l-2 border-yellow-600/50 pl-2">
                                    {mode === 'complete' 
                                        ? t('completeHint') 
                                        : mode === 'detailed' 
                                            ? t('detailedHint') 
                                            : t('quickHint')}
                                </div>
                            </div>

                            <div className="bg-black/20 border border-yellow-900/40 rounded-md p-4">
                                <label className="block text-yellow-200 font-semibold mb-2" htmlFor="clip-select">{t('videoClip')}</label>
                                <select
                                    id="clip-select"
                                    value={clipPreset}
                                    onChange={(e) => {
                                        const nextClip = e.target.value as ClipPreset;
                                        setClipPreset(nextClip);
                                        if (nextClip === 'fullMatch') setMode('complete');
                                    }}
                                    disabled={isLoading}
                                    className="w-full bg-[#260101] border border-yellow-800/60 rounded-md px-3 py-2 text-yellow-101 outline-none focus:ring-2 focus:ring-yellow-500"
                                >
                                    <option value="game15to30">{language === 'pt' ? 'Recomendado: jogo entre 15 e 30 minutos' : language === 'en' ? 'Recommended: gameplay from 15 to 30 minutes' : 'Recomendado: juego entre 15 y 30 minutos'}</option>
                                    <option value="first5">{language === 'pt' ? 'Teste rápido: primeiros 5 minutos' : language === 'en' ? 'Quick test: first 5 minutes' : 'Prueba rápida: primeros 5 minutos'}</option>
                                    <option value="first15">{t('clipFirst15')}</option>
                                    <option value="first30">{t('clipFirst30')}</option>
                                    <option value="first45">{t('clipFirst45')}</option>
                                    <option value="second45">{t('clipSecond45')}</option>
                                    <option value="fullMatch">{t('clipFull')}</option>
                                    <option value="custom">{t('clipCustom')}</option>
                                </select>
                                <p className="mt-2 text-xs text-yellow-400/70">{selectedClip.hint}</p>
                            </div>
                        </div>

                        {clipPreset === 'custom' && (
                            <div className="grid md:grid-cols-2 gap-4 bg-black/20 border border-yellow-900/40 rounded-md p-4">
                                <label className="text-yellow-200 font-semibold">
                                    {t('customStart')}
                                    <input
                                        type="number"
                                        min="0"
                                        step="1"
                                        value={customStartMin}
                                        onChange={(e) => setCustomStartMin(e.target.value)}
                                        disabled={isLoading}
                                        className="mt-2 w-full bg-[#260101] border border-yellow-800/60 rounded-md px-3 py-2 text-yellow-101 outline-none focus:ring-2 focus:ring-yellow-500"
                                    />
                                </label>
                                <label className="text-yellow-200 font-semibold">
                                    {t('customEnd')}
                                    <input
                                        type="number"
                                        min="1"
                                        step="1"
                                        value={customEndMin}
                                        onChange={(e) => setCustomEndMin(e.target.value)}
                                        disabled={isLoading}
                                        className="mt-2 w-full bg-[#260101] border border-yellow-800/60 rounded-md px-3 py-2 text-yellow-101 outline-none focus:ring-2 focus:ring-yellow-500"
                                    />
                                </label>
                            </div>
                        )}

                        <div className="rounded-md border border-yellow-900/40 bg-yellow-950/20 px-4 py-3 text-sm text-yellow-200/80">
                            {t('auditNote')}
                        </div>
                    </div>
                )}

                {inputMethod === 'file' && (
                    <div role="tabpanel" className="flex flex-col items-center gap-3">
                        <label htmlFor="file-upload" className="w-full text-center cursor-pointer bg-black/30 border-2 border-dashed border-yellow-800/60 rounded-md px-4 py-6 text-lg text-yellow-200/70 hover:border-yellow-600 hover:text-yellow-200 transition-colors">
                            {file ? `${language === 'pt' ? 'Arquivo selecionado' : language === 'en' ? 'Selected file' : 'Archivo seleccionado'}: ${file.name}` : t('uploadHint')}
                        </label>
                        <input
                            id="file-upload"
                            type="file"
                            onChange={handleFileChange}
                            accept="video/mp4,video/webm,video/quicktime,video/x-matroska,video/x-msvideo,video/x-flv"
                            className="sr-only"
                            disabled={isLoading}
                        />
                        <p className="text-xs text-yellow-400/60">{t('uploadLimit')}</p>
                    </div>
                )}

                <button
                    type="submit"
                    className="mt-2 bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 text-[#4a0404] font-bold py-3 px-6 rounded-md text-lg transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100"
                    disabled={isLoading || (inputMethod === 'url' && !url.trim()) || (inputMethod === 'file' && !file)}
                >
                    {isLoading ? t('submitLoading') : inputMethod === 'url' ? t('submitAnalyze') : t('submitAnalyzeFile')}
                </button>
            </form>
        </div>
    );
};

export default UrlInputForm;
