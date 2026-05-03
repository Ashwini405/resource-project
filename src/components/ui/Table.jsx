import { cn } from "../../lib/utils";

export function Table({ className, children }) {
  return (
    <div className="w-full overflow-auto">
      <table className={cn("w-full text-left text-sm text-slate-600 dark:text-slate-300", className)}>
        {children}
      </table>
    </div>
  );
}

export function TableHeader({ className, children }) {
  return (
    <thead className={cn("text-xs text-slate-500 uppercase bg-slate-50 dark:bg-slate-800/50 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700", className)}>
      {children}
    </thead>
  );
}

export function TableBody({ className, children }) {
  return <tbody className={cn("divide-y divide-slate-100 dark:divide-slate-700/50", className)}>{children}</tbody>;
}

export function TableRow({ className, children }) {
  return <tr className={cn("hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors", className)}>{children}</tr>;
}

export function TableHead({ className, children }) {
  return <th className={cn("px-6 py-3 font-medium whitespace-nowrap", className)}>{children}</th>;
}

export function TableCell({ className, children }) {
  return <td className={cn("px-6 py-4 whitespace-nowrap", className)}>{children}</td>;
}
