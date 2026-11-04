import { createContext, useContext } from "react";
import type { User } from "./types";
import type { PrincipalType } from "./api/http";
import type { AdminRole } from "./api/auth";

export interface AuthContextType {
  isLoggedIn: boolean;
  isAuthLoading: boolean;
  user: User | null;
  principalType: PrincipalType | null;
  guestLogin: (role: PrincipalType, code: string, adminRole?: AdminRole) => Promise<PrincipalType>;
  refreshProfile: () => Promise<User>;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextType>({
  isLoggedIn: false,
  isAuthLoading: true,
  user: null,
  principalType: null,
  guestLogin: async () => "USER",
  refreshProfile: async () => { throw new Error("인증 컨텍스트가 초기화되지 않았습니다."); },
  logout: () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}
