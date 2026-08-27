import { createAuthClient } from "better-auth/react";

// 同源部署，baseURL 用預設的 window.location.origin 即可。
export const authClient = createAuthClient({ basePath: "/api/auth" });

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  image: string | null;
};

/**
 * 包一層薄的介面，只曝露 UI 真正用得到的東西。
 * 同時避免把 better-auth 的內部型別洩漏到整個 client。
 */
export function useSession(): {
  user: SessionUser | null;
  isPending: boolean;
} {
  const { data, isPending } = authClient.useSession();
  return {
    user: data
      ? {
          id: data.user.id,
          name: data.user.name,
          email: data.user.email,
          image: data.user.image ?? null,
        }
      : null,
    isPending,
  };
}

export async function signInWithGoogle(
  callbackURL = "/den",
): Promise<{ error?: string }> {
  const res = await authClient.signIn.social({
    provider: "google",
    callbackURL,
  });
  return res.error ? { error: res.error.message ?? "登入失敗" } : {};
}

export async function signOut(): Promise<void> {
  await authClient.signOut();
  window.location.href = "/";
}
