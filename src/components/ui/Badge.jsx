import { cn } from "../../lib/utils";

export function Badge({ children, status, className }) {
  const variants = {
    Approved: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
    Pending: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
    Rejected: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
    Active: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
    Completed: "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300",
  };

  const defaultVariant = "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300";

  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
        variants[status] || defaultVariant,
        className
      )}
    >
      {children || status}
    </span>
  );
}
