import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { getStoredAccessToken } from "@/lib/authSession";
import { decodeJwtPayload, normalizeRoleValues } from "@/lib/authToken";

export type UserRole = "admin" | "agent" | "super_user" | null;

const extractRoleFromAuthorities = (roles: string[] = []): UserRole => {
  if (roles.some((role) => /^(ROLE_)?(SUPERUSER|SUPER_USER)$/i.test(role))) {
    return "super_user";
  }
  if (roles.some((role) => /^(ROLE_)?ADMIN$/i.test(role))) {
    return "admin";
  }
  if (roles.some((role) => /^(ROLE_)?(AGENT|ANALYST|USER)$/i.test(role))) {
    return "agent";
  }
  return null;
};

export const useUserRole = () => {
  const { user } = useAuth();
  const [role, setRole] = useState<UserRole>(null);
  const [authorities, setAuthorities] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setRole(null);
      setAuthorities([]);
      setLoading(false);
      return;
    }

    const determineUserRole = () => {
      setLoading(true);

      try {
        const token = getStoredAccessToken();
        if (!token) {
          setRole(null);
          setAuthorities([]);
          setLoading(false);
          return;
        }

        const decoded = decodeJwtPayload(token);
        const tokenAuthorities = normalizeRoleValues(
          decoded?.role,
          decoded?.roles,
          decoded?.authority,
          decoded?.authorities,
          user.roles
        );

        if (tokenAuthorities.length === 0) {
          setRole(null);
          setAuthorities([]);
          setLoading(false);
          return;
        }

        setAuthorities(tokenAuthorities);

        const userRole = extractRoleFromAuthorities(tokenAuthorities);
        setRole(userRole);
      } catch {
        setRole(null);
        setAuthorities([]);
      } finally {
        setLoading(false);
      }
    };

    determineUserRole();
  }, [user]);

  const isSuperUser = role === "super_user";
  const isAdmin = role === "admin" || isSuperUser;
  const isAgent = role === "agent" || isAdmin;

  const hasAuthority = (authority: string): boolean => {
    return authorities.includes(authority);
  };

  return {
    role,
    authorities,
    loading,
    isAdmin,
    isAgent,
    isSuperUser,
    hasAuthority,
  };
};
