import type { ReactNode } from 'react';

interface StatCardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon: ReactNode;
  trend?: {
    value: string;
    positive: boolean;
  };
  accentColor?: 'indigo' | 'emerald' | 'amber' | 'rose' | 'blue';
}

export function StatCard({
  title,
  value,
  subtitle,
  icon,
  trend,
  accentColor = 'indigo',
}: StatCardProps) {
  const iconColors = {
    indigo: 'bg-indigo-50 text-indigo-600 border-indigo-100',
    emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    amber: 'bg-amber-50 text-amber-600 border-amber-100',
    rose: 'bg-rose-50 text-rose-600 border-rose-100',
    blue: 'bg-blue-50 text-blue-600 border-blue-100',
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{title}</p>
          <p className="text-2xl font-bold tracking-tight text-slate-900">{value}</p>
          {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
        </div>
        <div className={`p-3 rounded-xl border ${iconColors[accentColor]}`}>
          {icon}
        </div>
      </div>

      {trend && (
        <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-1.5 text-xs">
          <span
            className={`font-semibold ${
              trend.positive ? 'text-emerald-600' : 'text-rose-600'
            }`}
          >
            {trend.positive ? '↑' : '↓'} {trend.value}
          </span>
          <span className="text-slate-400">vs last month</span>
        </div>
      )}
    </div>
  );
}
