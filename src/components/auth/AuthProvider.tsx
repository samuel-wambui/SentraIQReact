import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AUTH_SESSION_EXPIRED_EVENT, apiFetch } from "@/lib/api";
import {
  decodeJwtPayload,
  extractRolesFromPayload,
  getJwtExpirationMs,
  getJwtSubject,
  isJwtExpired,
  normalizeRoleValues,
} from "@/lib/authToken";
import {
  clearLegacyLocalAuthTokens,
  clearStoredAuthTokens,
  getStoredAccessToken,
  getStoredRefreshToken,
  setStoredAccessToken,
  setStoredAuthTokens,
} from "@/lib/authSession";

interface User {
  id: string;
  username: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  roles?: string[];
  loggedIn?: boolean;
  isOnShift?: boolean;
  isOnLeave?: boolean;
}

interface LoginResult {
  passwordChangeRequired: boolean;
}

interface AuthPayload {
  id?: string | number;
  username?: string;
  firstName?: string | null;
  firstname?: string | null;
  lastName?: string | null;
  lastname?: string | null;
  name?: string | null;
  accessToken?: string;
  refreshToken?: string;
  role?: unknown;
  roles?: unknown;
  authority?: unknown;
  authorities?: unknown;
  loggedIn?: boolean | null;
  isOnShift?: boolean | null;
  onShift?: boolean | null;
  isOnLeave?: boolean | null;
  onLeave?: boolean | null;
  passwordChangeRequired?: boolean | null;
  passwordChangeToken?: string | null;
  user?: AuthPayload;
  entity?: AuthPayload;
}

interface AuthContextType {
  user: User | null;
  accessToken: string | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<LoginResult>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
  setUserAndToken: (token: string, user: User) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const INACTIVITY_TIMEOUT_MS = 5 * 60 * 1000;
const TOKEN_REFRESH_BUFFER_MS = 15 * 1000;

const clearStoredAuth = () => {
  clearStoredAuthTokens();
};

const toAuthUser = (source: AuthPayload, token?: string | null): User => {
  const tokenPayload = decodeJwtPayload(token);
  const firstName = source.firstName ?? source.firstname ?? undefined;
  const lastName = source.lastName ?? source.lastname ?? undefined;
  const roles = normalizeRoleValues(
    source.roles,
    source.role,
    source.authorities,
    source.authority,
    extractRolesFromPayload(tokenPayload)
  );

  return {
    id: String(source.id ?? source.username ?? ""),
    username: source.username ?? "",
    firstName,
    lastName,
    name:
      source.name ||
      (firstName && lastName
        ? `${firstName} ${lastName}`
        : undefined),
    roles,
    loggedIn: source.loggedIn ?? undefined,
    isOnShift: source.isOnShift ?? source.onShift ?? undefined,
    isOnLeave: source.isOnLeave ?? source.onLeave ?? undefined,
  };
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(() => {
    clearLegacyLocalAuthTokens();
    return getStoredAccessToken();
  });
  const [loading, setLoading] = useState(true);
  const expiredSessionHandledRef = useRef(false);
  const navigate = useNavigate();

  const logoutOnServer = useCallback(async (username?: string | null) => {
    if (!username) return;

    try {
      await apiFetch(`/api/auth/logout/${encodeURIComponent(username)}`, {
        method: "POST",
        auth: false,
      });
    } catch (error) {
      console.warn("Unable to update logout status", error);
    }
  }, []);

  const clearSession = useCallback(() => {
    clearStoredAuth();
    setAccessToken(null);
    setUser(null);
  }, []);

  const handleExpiredSession = useCallback(async (username?: string | null) => {
    if (expiredSessionHandledRef.current) return;
    expiredSessionHandledRef.current = true;

    await logoutOnServer(username);
    clearSession();
    navigate("/auth", { replace: true });
  }, [clearSession, logoutOnServer, navigate]);

  const setAuthenticatedSession = useCallback((
    token: string,
    refreshToken: string | null | undefined,
    source: AuthPayload
  ) => {
    expiredSessionHandledRef.current = false;
    setStoredAuthTokens(token, refreshToken);
    setAccessToken(token);
    setUser(toAuthUser(source, token));
  }, []);

  const refreshAccessToken = useCallback(async () => {
    const refreshToken = getStoredRefreshToken();
    const username =
      getJwtSubject(refreshToken) ?? user?.username ?? getJwtSubject(getStoredAccessToken());

    if (!refreshToken || isJwtExpired(refreshToken)) {
      await handleExpiredSession(username);
      return false;
    }

    try {
      const data = await apiFetch<AuthPayload>("/api/auth/refresh", {
        method: "POST",
        auth: false,
        body: { refreshToken },
      });
      const entity = data.entity ?? data;

      if (!entity.accessToken) {
        throw new Error("No accessToken returned from refresh");
      }

      setAuthenticatedSession(
        entity.accessToken,
        entity.refreshToken ?? refreshToken,
        entity.user ?? entity
      );
      return true;
    } catch (error) {
      console.warn("Unable to refresh token", error);
      await handleExpiredSession(username);
      return false;
    }
  }, [handleExpiredSession, setAuthenticatedSession, user?.username]);

  // Fetch current user (used on mount and can be called manually)
  const refreshUser = useCallback(async () => {
    const token = getStoredAccessToken();
    const username = getJwtSubject(token);

    if (!token) {
      clearSession();
      navigate("/auth", { replace: true });
      return;
    }

    if (isJwtExpired(token)) {
      await handleExpiredSession(username);
      return;
    }

    if (!username) {
      await handleExpiredSession(username);
      return;
    }

    expiredSessionHandledRef.current = false;
    setAccessToken(token);
    setUser(toAuthUser({ username, loggedIn: true }, token));
  }, [clearSession, handleExpiredSession, navigate]);

  // Load user on mount
  useEffect(() => {
    let isMounted = true;

    (async () => {
      if (!isMounted) return;
      setLoading(true);
      await refreshUser();
      if (isMounted) {
        setLoading(false);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [refreshUser]);

  const login = async (username: string, password: string): Promise<LoginResult> => {
    console.log("Attempting login with username:", username);
    setLoading(true);
    try {
      const data = await apiFetch<AuthPayload>(
        "/api/auth/login",
        {
          method: "POST",
          auth: false,
          body: { username, password },
        }
      );

      const entity = data.entity || data;
      if (entity.passwordChangeRequired) {
        if (!entity.passwordChangeToken) {
          throw new Error("Password change token was not returned from server");
        }

        clearSession();
        const params = new URLSearchParams({ token: entity.passwordChangeToken });
        navigate(`/set-password?${params}`, {
          replace: true,
          state: { username: entity.username },
        });
        return { passwordChangeRequired: true };
      }

      if (!entity.accessToken) {
        throw new Error("No accessToken returned from server");
      }

      const authUserSource = entity.user ?? entity;

      setAuthenticatedSession(entity.accessToken, entity.refreshToken, authUserSource);
      navigate("/");
      return { passwordChangeRequired: false };
    } catch (err) {
      console.error("login error:", err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const signOut = useCallback(async () => {
    await logoutOnServer(user?.username ?? getJwtSubject(accessToken));
    clearSession();
    navigate("/auth", { replace: true });
  }, [accessToken, clearSession, logoutOnServer, navigate, user?.username]);

  const setUserAndToken = useCallback((token: string, user: User) => {
    expiredSessionHandledRef.current = false;
    setStoredAccessToken(token);
    setAccessToken(token);
    setUser({
      ...user,
      roles:
        user.roles && user.roles.length > 0
          ? user.roles
          : extractRolesFromPayload(decodeJwtPayload(token)),
    });
  }, []);

  useEffect(() => {
    const onSessionExpired = () => {
      handleExpiredSession(user?.username ?? getJwtSubject(getStoredAccessToken()));
    };

    window.addEventListener(AUTH_SESSION_EXPIRED_EVENT, onSessionExpired);
    return () => window.removeEventListener(AUTH_SESSION_EXPIRED_EVENT, onSessionExpired);
  }, [handleExpiredSession, user?.username]);

  useEffect(() => {
    if (!accessToken) return;

    const expirationMs = getJwtExpirationMs(accessToken);
    if (expirationMs === null) return;

    const hasRefreshToken = Boolean(getStoredRefreshToken());
    const delay = Math.max(
      expirationMs - Date.now() - (hasRefreshToken ? TOKEN_REFRESH_BUFFER_MS : 0),
      0
    );

    const timeout = window.setTimeout(() => {
      if (hasRefreshToken) {
        refreshAccessToken();
        return;
      }

      handleExpiredSession(user?.username ?? getJwtSubject(accessToken));
    }, delay);

    return () => window.clearTimeout(timeout);
  }, [accessToken, handleExpiredSession, refreshAccessToken, user?.username]);

  useEffect(() => {
    if (!accessToken || !user?.username) return;

    let timeout: number | undefined;
    const resetInactivityTimer = () => {
      if (timeout !== undefined) {
        window.clearTimeout(timeout);
      }
      timeout = window.setTimeout(() => {
        logoutOnServer(user.username).finally(() => {
          clearSession();
          navigate("/auth", { replace: true });
        });
      }, INACTIVITY_TIMEOUT_MS);
    };

    const events = ["mousemove", "mousedown", "keydown", "scroll", "touchstart"];
    events.forEach((eventName) =>
      window.addEventListener(eventName, resetInactivityTimer, { passive: true })
    );
    resetInactivityTimer();

    return () => {
      if (timeout !== undefined) {
        window.clearTimeout(timeout);
      }
      events.forEach((eventName) => window.removeEventListener(eventName, resetInactivityTimer));
    };
  }, [accessToken, clearSession, logoutOnServer, navigate, user?.username]);

  return (
    <AuthContext.Provider
      value={{ user, accessToken, loading, login, signOut, refreshUser, setUserAndToken }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
