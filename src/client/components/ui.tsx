import type {
  ButtonHTMLAttributes,
  CSSProperties,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";

export function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

const BUTTON_BASE =
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium whitespace-nowrap transition disabled:cursor-not-allowed disabled:opacity-55";

const BUTTON_VARIANTS = {
  primary:
    "bg-(--color-ink) text-(--color-paper) hover:opacity-88 shadow-xs",
  secondary:
    "border border-(--color-line) bg-(--color-surface) text-(--color-ink) hover:border-(--color-brass)",
  ghost: "text-(--color-ink-soft) hover:bg-(--color-brass-soft) hover:text-(--color-ink)",
  danger:
    "border border-red-300 text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/40",
} as const;

export function Button({
  variant = "secondary",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof BUTTON_VARIANTS;
}) {
  return (
    <button
      type="button"
      className={cx(BUTTON_BASE, BUTTON_VARIANTS[variant], className)}
      {...props}
    />
  );
}

const CONTROL =
  "w-full rounded-lg border border-(--color-line) bg-(--color-surface) px-3 py-2 text-sm text-(--color-ink) transition placeholder:text-(--color-ink-faint) focus:border-(--color-brass) focus:outline-none";

export function Input({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cx(CONTROL, className)} {...props} />;
}

export function Textarea({
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea className={cx(CONTROL, "resize-y", className)} {...props} />
  );
}

export function Select({
  className,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cx(CONTROL, "pr-8", className)} {...props} />;
}

export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium tracking-wide text-(--color-ink-soft)">
        {label}
      </span>
      {children}
      {hint && !error && (
        <span className="mt-1 block text-xs text-(--color-ink-faint)">
          {hint}
        </span>
      )}
      {error && (
        <span className="mt-1 block text-xs text-red-600 dark:text-red-400">
          {error}
        </span>
      )}
    </label>
  );
}

export function Card({
  className,
  style,
  children,
}: {
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  return (
    <div
      style={style}
      className={cx(
        "rounded-xl border border-(--color-line) bg-(--color-surface)",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-dashed border-(--color-line) px-6 py-14 text-center">
      <p className="text-sm font-medium text-(--color-ink)">{title}</p>
      {description && (
        <p className="mx-auto mt-1.5 max-w-sm text-sm text-(--color-ink-soft)">
          {description}
        </p>
      )}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}

export function ErrorNote({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
      {children}
    </p>
  );
}

/**
 * 1–5 分的感受評分輸入。點已選中的分數可以取消（回到「沒填」）。
 * 兩端的說明文字一直顯示，因為「4 分的滑順度」本身讀不出方向。
 */
export function RatingInput({
  label,
  low,
  high,
  value,
  onChange,
}: {
  label: string;
  low: string;
  high: string;
  value: number | null;
  onChange: (value: number | null) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <span className="w-14 shrink-0 text-xs font-medium text-(--color-ink-soft)">
        {label}
      </span>

      <div className="flex items-center gap-1.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            aria-label={`${label} ${n} 分`}
            aria-pressed={value === n}
            onClick={() => onChange(value === n ? null : n)}
            className={cx(
              "size-7 rounded-full border transition",
              value !== null && n <= value
                ? "border-(--color-brass) bg-(--color-brass)"
                : "border-(--color-line) hover:border-(--color-brass)",
            )}
          />
        ))}
      </div>

      <span className="text-xs text-(--color-ink-faint)">
        {low} → {high}
      </span>

      {value !== null && (
        <button
          type="button"
          onClick={() => onChange(null)}
          className="text-xs text-(--color-ink-faint) transition hover:text-(--color-ink)"
        >
          清除
        </button>
      )}
    </div>
  );
}

/** 唯讀的評分顯示，用在日誌列表。 */
export function RatingDots({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <span
      className="inline-flex items-baseline gap-1 text-xs whitespace-nowrap"
      aria-label={`${label} ${value} 分，滿分 5 分`}
    >
      <span className="text-(--color-ink-faint)">{label}</span>
      <span className="text-(--color-brass)" aria-hidden>
        {"●".repeat(value)}
        <span className="text-(--color-line)">{"●".repeat(5 - value)}</span>
      </span>
    </span>
  );
}
