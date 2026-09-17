import React from 'react';
import { useLanguage, Language } from '../context/LanguageContext';
import { Globe } from 'lucide-react';

const LanguageSelector: React.FC = () => {
    const { language, setLanguage, t } = useLanguage();

    const options: { code: Language; label: string; flag: string }[] = [
        { code: 'pt', label: 'Português (Brasil)', flag: '🇧🇷' },
        { code: 'en', label: 'English', flag: '🇬🇧' },
        { code: 'es', label: 'Español', flag: '🇪🇸' },
    ];

    return (
        <div className="sticky top-0 z-50 bg-[#2a0101] border-b border-yellow-500/30 px-4 py-2 flex justify-between items-center shadow-lg print:hidden">
            <div className="flex items-center gap-2 text-yellow-300">
                <Globe className="h-4 w-4 animate-pulse" />
                <span className="text-xs uppercase font-semibold tracking-wider">
                    {language === 'pt' ? 'Idioma do Sistema' : language === 'en' ? 'System Language' : 'Idioma del Sistema'}
                </span>
            </div>
            
            <div className="flex bg-black/40 p-1 rounded-full border border-yellow-900/40">
                {options.map((opt) => {
                    const isSelected = language === opt.code;
                    return (
                        <button
                            key={opt.code}
                            onClick={() => setLanguage(opt.code)}
                            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold cursor-pointer transition-all duration-300 focus:outline-none ${
                                isSelected
                                    ? 'bg-gradient-to-r from-yellow-500 to-yellow-600 text-[#4a0404] shadow-md scale-105'
                                    : 'text-yellow-100/70 hover:text-yellow-200 hover:bg-white/5'
                            }`}
                        >
                            <span className="text-sm">{opt.flag}</span>
                            <span>{opt.label.split(' ')[0]}</span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

export default LanguageSelector;
