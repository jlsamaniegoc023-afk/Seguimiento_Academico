import React from 'react';
import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  Tooltip, 
  Legend, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  AreaChart, 
  Area 
} from 'recharts';

interface ComposicionChartProps {
  totalFormacion: number;
  totalAdicionales: number;
}

export function ComposicionChart({ totalFormacion, totalAdicionales }: ComposicionChartProps) {
  const data = [
    { name: 'Total Horas Formación', value: totalFormacion, color: '#39A900' },
    { name: 'Total Horas Adicionales', value: totalAdicionales, color: '#1666BA' },
  ];

  if (totalFormacion === 0 && totalAdicionales === 0) {
    return (
      <div className="h-full flex items-center justify-center text-xs text-slate-400 font-bold uppercase">
        Sin horas registradas
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={55}
          outerRadius={85}
          paddingAngle={4}
          dataKey="value"
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip 
          formatter={(val: number) => [`${val.toLocaleString('es-CO')} horas`, '']}
          contentStyle={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '12px', fontWeight: 'bold' }}
        />
        <Legend 
          verticalAlign="bottom" 
          height={36} 
          iconType="circle"
          wrapperStyle={{ fontSize: '11px', fontWeight: 'bold' }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

interface VinculacionChartProps {
  vincTotals: { [key: string]: number };
}

const VINC_COLORS: { [key: string]: string } = {
  'CONTRATISTA SENA': '#39A900',
  'CONTRATISTA': '#39A900',
  'CARRERA ADMINISTRATIVA': '#1666BA',
  'PLANTA': '#1666BA',
  'NOMBRAMIENTO PROVISIONAL': '#E07A00',
  'NOMBRAMIENTO ORDINARIO': '#7A4FBF',
};

export function VinculacionChart({ vincTotals }: VinculacionChartProps) {
  const data = Object.keys(vincTotals).map(key => ({
    name: key,
    value: vincTotals[key],
    color: VINC_COLORS[key] || '#64748b'
  })).filter(d => d.value > 0);

  if (data.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-xs text-slate-400 font-bold uppercase">
        Sin datos de vinculación
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={50}
          outerRadius={80}
          paddingAngle={3}
          dataKey="value"
        >
          {data.map((entry, index) => (
            <Cell key={`cell-vinc-${index}`} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip 
          formatter={(val: number) => [`${val.toLocaleString('es-CO')} horas`, '']}
          contentStyle={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '12px', fontWeight: 'bold' }}
        />
        <Legend 
          verticalAlign="bottom" 
          height={36} 
          iconType="circle"
          wrapperStyle={{ fontSize: '10px', fontWeight: 'bold' }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

interface TrendDataPoint {
  mes: string;
  total: number;
}

export function InstructorTrendChart({ data }: { data: TrendDataPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#39A900" stopOpacity={0.3}/>
            <stop offset="95%" stopColor="#39A900" stopOpacity={0}/>
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
        <XAxis dataKey="mes" tick={{ fontSize: 11, fontWeight: 'bold', fill: '#64748b' }} axisLine={false} />
        <YAxis tick={{ fontSize: 11, fontWeight: 'bold', fill: '#64748b' }} axisLine={false} />
        <Tooltip 
          formatter={(val: number) => [`${val} horas`, 'Total Horas']}
          contentStyle={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '12px', fontWeight: 'bold' }}
        />
        <Area type="monotone" dataKey="total" stroke="#39A900" strokeWidth={3} fillOpacity={1} fill="url(#colorTotal)" dot={{ r: 5, fill: '#39A900' }} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

interface BreakdownDataPoint {
  mes: string;
  formacion: number;
  adicionales: number;
}

export function InstructorBreakdownChart({ data }: { data: BreakdownDataPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
        <XAxis dataKey="mes" tick={{ fontSize: 11, fontWeight: 'bold', fill: '#64748b' }} axisLine={false} />
        <YAxis tick={{ fontSize: 11, fontWeight: 'bold', fill: '#64748b' }} axisLine={false} />
        <Tooltip 
          formatter={(val: number, name: string) => [
            `${val} horas`, 
            name === 'formacion' ? 'Horas Formación' : 'Horas Adicionales'
          ]}
          contentStyle={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '12px', fontWeight: 'bold' }}
        />
        <Legend wrapperStyle={{ fontSize: '11px', fontWeight: 'bold' }} />
        <Bar dataKey="formacion" name="Horas Formación" stackId="a" fill="#39A900" radius={[0, 0, 4, 4]} />
        <Bar dataKey="adicionales" name="Horas Adicionales" stackId="a" fill="#1666BA" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
