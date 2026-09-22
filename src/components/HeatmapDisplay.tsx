import React from 'react';
import type { MapaDeCalor } from '../types';

interface HeatmapDisplayProps {
    data?: { timeA?: MapaDeCalor; timeB?: MapaDeCalor };
    timeA: string;
    timeB: string;
}

const normalizeHeatPercent = (value?: string): string | undefined => {
    if (value === null || value === undefined) return undefined;
    const raw = String(value).trim().replace(',', '.');
    const match = raw.match(/^(\d{1,3}(?:\.\d{1,2})?)\s*%?$/);
    if (!match) return undefined;

    const num = Number(match[1]);
    if (!Number.isFinite(num) || num < 0 || num > 100) return undefined;

    return `${Number.isInteger(num) ? num : Math.round(num * 10) / 10}%`;
};

const parsePercent = (str?: string) => {
    const normalized = normalizeHeatPercent(str);
    if (!normalized) return 0;
    return parseFloat(normalized.replace('%', '')) || 0;
};

const TeamHeatmap: React.FC<{ teamName: string; teamData?: MapaDeCalor; color: string }> = ({ teamName, teamData, color }) => {
    const safeDef = normalizeHeatPercent(teamData?.tercoDefensivo);
    const safeMed = normalizeHeatPercent(teamData?.tercoMedio);
    const safeOf = normalizeHeatPercent(teamData?.tercoOfensivo);
    const hasData = Boolean(safeDef || safeMed || safeOf);

    if (!hasData) {
        return (
            <div className="bg-black/20 p-4 rounded-xl border border-yellow-900/30">
                <h6 className="text-center font-bold text-lg mb-2 text-yellow-200">{teamName}</h6>
                <p className="text-center text-yellow-400/60 text-xs py-4">
                    Distribuição por terços de campo não identificada para {teamName}.
                </p>
            </div>
        );
    }

    const displayDef = safeDef || '—';
    const displayMed = safeMed || '—';
    const displayOf = safeOf || '—';

    const opDef = Math.max(0.15, Math.min(0.9, (parsePercent(safeDef) || 33) / 100));
    const opMed = Math.max(0.15, Math.min(0.9, (parsePercent(safeMed) || 33) / 100));
    const opOf = Math.max(0.15, Math.min(0.9, (parsePercent(safeOf) || 33) / 100));

    return (
        <div>
            <h6 className="text-center font-bold text-lg mb-2 text-yellow-200">{teamName}</h6>
            <div className="flex w-full h-16 rounded-lg overflow-hidden border-2 border-yellow-800/50 shadow-inner">
                <div 
                    className="flex-1 flex items-center justify-center transition-all" 
                    style={{ backgroundColor: color, opacity: opDef }}
                >
                    <span className="font-bold text-white text-sm drop-shadow">{displayDef}</span>
                </div>
                <div 
                    className="flex-1 flex items-center justify-center transition-all border-x border-black/30" 
                    style={{ backgroundColor: color, opacity: opMed }}
                >
                    <span className="font-bold text-white text-sm drop-shadow">{displayMed}</span>
                </div>
                <div 
                    className="flex-1 flex items-center justify-center transition-all" 
                    style={{ backgroundColor: color, opacity: opOf }}
                >
                    <span className="font-bold text-white text-sm drop-shadow">{displayOf}</span>
                </div>
            </div>
            <div className="flex w-full text-xs text-center text-yellow-300/70 mt-1.5 font-medium">
                <div className="flex-1">Terço Defensivo</div>
                <div className="flex-1">Terço Médio</div>
                <div className="flex-1">Terço Ofensivo</div>
            </div>
        </div>
    );
};

const HeatmapDisplay: React.FC<HeatmapDisplayProps> = ({ data, timeA, timeB }) => {
    if (!data?.timeA && !data?.timeB) {
        return (
            <div className="text-center py-8">
                <p className="text-yellow-400/60 text-sm font-semibold">
                    Mapa de calor indisponível por falta de evidência visual suficiente.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
           <TeamHeatmap teamName={timeA} teamData={data.timeA} color="#facc15" />
           <TeamHeatmap teamName={timeB} teamData={data.timeB} color="#b91c1c" />
        </div>
    );
};

export default HeatmapDisplay;
