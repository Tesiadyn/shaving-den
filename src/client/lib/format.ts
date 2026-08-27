const DATE_FMT = new Intl.DateTimeFormat("zh-TW", {
  year: "numeric",
  month: "long",
  day: "numeric",
});

const WEEKDAY_FMT = new Intl.DateTimeFormat("zh-TW", { weekday: "short" });

export function formatDate(ms: number): string {
  const d = new Date(ms);
  return `${DATE_FMT.format(d)} ${WEEKDAY_FMT.format(d)}`;
}

/** <input type="date"> 需要當地時區的 YYYY-MM-DD，不能用 toISOString（那是 UTC）。 */
export function toDateInputValue(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** 把 <input type="date"> 的值轉回當地時區當天 00:00 的 epoch ms。 */
export function fromDateInputValue(value: string): number {
  return new Date(`${value}T00:00:00`).getTime();
}

/**
 * 比較的是日曆天，不是經過的毫秒數。
 * 刮鬍紀錄存的是當地午夜，用 (now - ms) 四捨五入的話，
 * 今天下午看今天早上的紀錄會被算成「昨天」。
 */
function startOfDay(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function relativeDays(ms: number): string {
  const days = Math.round(
    (startOfDay(Date.now()) - startOfDay(ms)) / 86_400_000,
  );
  if (days <= 0) return "今天";
  if (days === 1) return "昨天";
  if (days < 30) return `${days} 天前`;
  if (days < 365) return `${Math.round(days / 30)} 個月前`;
  return `${Math.round(days / 365)} 年前`;
}
