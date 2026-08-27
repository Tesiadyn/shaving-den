export function Spinner({ label = "載入中" }: { label?: string }) {
  return (
    <span
      role="status"
      aria-label={label}
      className="inline-block size-5 animate-spin rounded-full border-2 border-(--color-line) border-t-(--color-brass)"
    />
  );
}
