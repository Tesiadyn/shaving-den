import { NavLink, Outlet } from "react-router";
import { signOut, useSession } from "../lib/auth";

const NAV = [
  { to: "/den", label: "收藏" },
  { to: "/shaves", label: "刮鬍日誌" },
  { to: "/stats", label: "統計" },
];

export function Layout() {
  const { user } = useSession();

  return (
    <div className="min-h-full">
      <header className="sticky top-0 z-20 border-b border-(--color-line) bg-(--color-paper)/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-6 px-4 sm:px-6">
          <NavLink
            to="/den"
            className="text-sm font-semibold tracking-tight text-(--color-ink)"
          >
            Shaving Den
          </NavLink>

          <nav className="flex items-center gap-1">
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                className={({ isActive }) =>
                  `rounded-md px-3 py-1.5 text-sm transition ${
                    isActive
                      ? "bg-(--color-brass-soft) font-medium text-(--color-ink)"
                      : "text-(--color-ink-soft) hover:text-(--color-ink)"
                  }`
                }
              >
                {n.label}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-3">
            {user?.image && (
              <img
                src={user.image}
                alt=""
                referrerPolicy="no-referrer"
                className="size-7 rounded-full border border-(--color-line)"
              />
            )}
            <button
              type="button"
              onClick={() => signOut()}
              className="text-sm text-(--color-ink-faint) transition hover:text-(--color-ink)"
            >
              登出
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <Outlet />
      </div>
    </div>
  );
}
