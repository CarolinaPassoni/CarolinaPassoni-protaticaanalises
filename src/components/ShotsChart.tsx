import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface ShotsChartProps {
    data: { name: string; [key: string]: string | number }[];
    timeA: string;
    timeB: string;
}

const ShotsChart: React.FC<ShotsChartProps> = ({ data, timeA, timeB }) => {
    const hasAnyShots = data.some(item => {
        const valA = Number(item[timeA]) || 0;
        const valB = Number(item[timeB]) || 0;
        return valA > 0 || valB > 0;
    });

    if (!hasAnyShots) {
        return (
            <div className="w-full h-full flex flex-col items-center justify-center text-center p-4">
                <span className="text-yellow-400/60 text-sm font-semibold">
                    Nenhuma finalização registrada ou identificada no trecho analisado.
                </span>
                <span className="text-yellow-300/40 text-xs mt-1">
                    Trechos de posse ou marcação podem não conter chutes a gol.
                </span>
            </div>
        );
    }

    return (
        <ResponsiveContainer width="100%" height="100%">
            <BarChart
                data={data}
                margin={{
                    top: 10,
                    right: 30,
                    left: 10,
                    bottom: 5,
                }}
            >
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(250, 204, 21, 0.15)" />
                <XAxis dataKey="name" stroke="#fde047" />
                <YAxis stroke="#fde047" allowDecimals={false}/>
                <Tooltip
                     contentStyle={{
                        background: 'rgba(20, 0, 0, 0.9)',
                        borderColor: '#facc15',
                        borderRadius: '8px',
                        color: '#ffffff'
                    }}
                />
                <Legend />
                <Bar dataKey={timeA} fill="#facc15" radius={[4, 4, 0, 0]} />
                <Bar dataKey={timeB} fill="#b91c1c" radius={[4, 4, 0, 0]} />
            </BarChart>
        </ResponsiveContainer>
    );
};

export default ShotsChart;
