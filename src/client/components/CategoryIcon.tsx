import type { ItemCategory } from "@/shared/domain";

const PATHS: Record<ItemCategory, string> = {
  // DE 刀片：長方形刀片與中央長槽
  blade: "M4 9h16v6H4z M8 12h8",
  // 刮鬍皂：皂盒與皂體
  soap: "M4 12h16v7H4z M6.5 12c0-2.5 2.5-4 5.5-4s5.5 1.5 5.5 4",
  // 鬚前油：滴管瓶
  preshave: "M10 3h4v3h-4z M9 6h6l1 4v10H8V10z M11.5 12v4",
  // 鬚後水：方肩瓶
  aftershave: "M10 3h4v4h-4z M8 7h8v13H8z M8 12h8",
  // 鬚刷：刷毛與握柄
  brush: "M8 3c0 3 -1 5 -1 7h10c0-2-1-4-1-7z M7 10h10l-1.5 10h-7z",
  // 安全刀架：刀頭與長柄
  razor: "M6 5h12v4H6z M9 7h6 M12 9v5 M10 14h4l-.8 6h-2.4z",
  other: "M12 4l7 4v8l-7 4-7-4V8z",
};

export function CategoryIcon({
  category,
  className,
}: {
  category: ItemCategory;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.35"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {PATHS[category].split(" M").map((d, i) => (
        <path key={i} d={i === 0 ? d : `M${d}`} />
      ))}
    </svg>
  );
}
