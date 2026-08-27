import type { Db } from "@/db/client";
import type { Auth } from "./auth";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  image: string | null;
};

export type AppEnv = {
  Bindings: Env;
  Variables: {
    db: Db;
    auth: Auth;
    /** 只在 requireAuth 之後才存在。 */
    user: SessionUser;
  };
};
