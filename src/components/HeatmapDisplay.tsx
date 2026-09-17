import React from 'react';
import type { MapaDeCalor } from '../types';

interface HeatmapDisplayProps {
    data?: { timeA?: MapaDeCalor; timeB?: MapaDeCalor };
    timeA: string;
    timeB: string;
}

const parsePercent = (str?: string) => {
    if (!str) return 0;
    return parseFloat(String(str).replace('%', '')) || 0;
};

const TeamHeatmap: React.FC<{ teamName: string; teamData?: MapaDeCalor; color: string }> = ({ teamName, teamData, color }) => {
    const hasData = Boolean(teamData?.tercoDefensivo || teamData?.tercoMedio || teamData?.tercoOfensivo);

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

    const safeDef = teamData?.tercoDefensivo || '—';
    const safeMed = teamData?.tercoMedio || '—';
    const safeOf = teamData?.tercoOfensivo || '—';

    const opDef = Math.max(0.15, Math.min(0.9, (parsePercent(teamData?.tercoDefensivo) || 33) / 100));
    const opMed = Math.max(0.15, Math.min(0.9, (parsePercent(teamData?.tercoMedio) || 33) / 100));
    const opOf = Math.max(0.15, Math.min(0.9, (parsePercent(teamData?.tercoOfensivo) || 33) / 100));

    return (
        <div>
            <h6 className="text-center font-bold text-lg mb-2 text-yellow-200">{teamName}</h6>
            <div className="flex w-full h-16 rounded-lg overflow-hidden border-2 border-yellow-800/50 shadow-inner">
                <div 
                    className="flex-1 flex items-center justify-center transition-all" 
                    style={{ backgroundColor: color, opacity: opDef }}
                >
                    <span className="font-bold text-white text-sm drop-shadow">{safeDef}</span>
                </div>
                <div 
                    className="flex-1 flex items-center justify-center transition-all border-x border-black/30" 
                    style={{ backgroundColor: color, opacity: opMed }}
                >
                    <span className="font-bold text-white text-sm drop-shadow">{safeMed}</span>
                </div>
                <div 
                    className="flex-1 flex items-center justify-center transition-all" 
                    style={{ backgroundColor: color, opacity: opOf }}
                >
                    <span className="font-bold text-white text-sm drop-shadow">{safeOf}</span>
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
