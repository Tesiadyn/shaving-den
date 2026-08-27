import type { ReactNode } from "react";
import { useSession } from "../lib/auth";
import { Login } from "../pages/Login";
import { Spinner } from "./Spinner";

/**
 * 未登入一律顯示登入頁（不做 redirect，省掉一層路由狀態）。
 * 真正的權限把關在 Worker 端 —— 這裡只是 UI。
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const { user, isPending } = useSession();

  if (isPending) {
    return (
      <div className="flex min-h-full items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (!user) return <Login />;

  return <>{children}</>;
}
