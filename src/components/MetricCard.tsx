import { ReactNode } from "react";
import { cn } from "../lib/utils";

interface MetricCardProps {
  title: string;
  value: string | number;
  icon?: ReactNode;
  subtitle?: string;
  className?: string;
  trend?: number;
}

export function MetricCard({ title, value, icon, subtitle, className, trend }: MetricCardProps) {
  return (
    <div className={cn("bg-zinc-200 p-5 rounded-2xl border border-zinc-300 shadow-sm flex flex-col", className)}>
      <div className="flex justify-between items-start mb-1">
        <h3 className="text-zinc-600 text-[10px] font-bold uppercase tracking-widest">{title}</h3>
        {icon && <div className="text-zinc-600">{icon}</div>}
      </div>
      <div className="mt-auto flex items-baseline justify-between pt-2">
        <h2 className="text-2xl font-bold font-mono tracking-tight text-zinc-900">{value}</h2>
        {(subtitle || trend !== undefined) && (
          <div className="flex items-center gap-2 text-xs">
            {trend !== undefined && (
              <span className={cn("font-medium", trend >= 0 ? "text-emerald-600" : "text-rose-600")}>
                {trend >= 0 ? "+" : ""}{trend}%
              </span>
            )}
            {subtitle && <span className="text-zinc-500 font-medium">{subtitle}</span>}
          </div>
        )}
      </div>
    </div>
  );
}
