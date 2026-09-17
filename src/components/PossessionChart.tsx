import React from 'react';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface PossessionChartProps {
    data: { name: string; value: number }[];
}

const COLORS = ['#facc15', '#b91c1c']; // Yellow, Red

const PossessionChart: React.FC<PossessionChartProps> = ({ data }) => {
    const total = data.reduce((acc, curr) => acc + (curr.value || 0), 0);

    if (total <= 0) {
        return (
            <div className="w-full h-full flex flex-col items-center justify-center text-center p-4">
                <span className="text-yellow-400/60 text-sm font-semibold">
                    Posse de bola não identificada para este trecho da partida.
                </span>
                <span className="text-yellow-300/40 text-xs mt-1">
                    Os dados estatísticos dependem da transmissão do vídeo ou fontes oficiais.
                </span>
            </div>
        );
    }

    return (
        <ResponsiveContainer width="100%" height="100%">
            <PieChart>
                <Tooltip
                    contentStyle={{
                        background: 'rgba(20, 0, 0, 0.9)',
                        borderColor: '#facc15',
                        borderRadius: '8px',
                        color: '#ffffff'
                    }}
                    formatter={(value: number) => `${value.toFixed(1)}%`}
                />
                <Legend iconType="circle" />
                <Pie
                    data={data}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    fill="#8884d8"
                    paddingAngle={5}
                    dataKey="value"
                    nameKey="name"
                >
                    {data.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                </Pie>
            </PieChart>
        </ResponsiveContainer>
    );
};

export default PossessionChart;
