import { ReactNode } from "react";
import { cn } from "../lib/utils";

export function Card({ className, children, title, action }: { className?: string; children: ReactNode; title?: ReactNode; action?: ReactNode }) {
  return (
    <div className={cn("bg-zinc-900/40 rounded-2xl border border-zinc-800/50 overflow-hidden flex flex-col shadow-inner", className)}>
      {(title || action) && (
        <div className="bg-zinc-950/50 px-6 py-4 border-b border-zinc-800 flex justify-between items-center">
          {title && <h3 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">{title}</h3>}
          {action && <div>{action}</div>}
        </div>
      )}
      <div className="flex-1 p-3 sm:p-4 min-h-0 min-w-0 relative">{children}</div>
    </div>
  );
}
