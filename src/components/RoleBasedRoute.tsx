import { Navigate } from "react-router-dom";
import { useUserRole, type UserRole } from "@/hooks/useUserRole";
import { useAuth } from "./auth/AuthProvider";

interface RoleBasedRouteProps {
  children: React.ReactNode;
  allowedRoles: Exclude<UserRole, null>[];
}

const RoleBasedRoute = ({ children, allowedRoles }: RoleBasedRouteProps) => {
  const { user, loading: authLoading } = useAuth();
  const { role, loading: roleLoading } = useUserRole();

  if (authLoading || roleLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!user || !role) {
    return <Navigate to="/auth" replace />;
  }

  if (!allowedRoles.includes(role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

export default RoleBasedRoute;
