import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/components/auth/AuthProvider";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import equityLogo from "@/assets/equity-logo.png";

const authSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  fullName: z.string().min(2, "Full name must be at least 2 characters").optional(),
});

const resetRequestSchema = z.object({
  identifier: z.string().min(3, "Enter your username or email address"),
});

const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [resetIdentifier, setResetIdentifier] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { login, user, loading: authLoading } = useAuth();

  useEffect(() => {
    if (!authLoading && user) {
      navigate("/", { replace: true });
    }
  }, [authLoading, navigate, user]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Validate input
      const validationData = isLogin 
        ? { username, password }
        : { username, password, fullName };
      
      authSchema.parse(validationData);

      if (isLogin) {
        const result = await login(username, password);
        if (!result.passwordChangeRequired) {
          toast({
            title: "Login successful",
            description: "Welcome back!",
          });
        }
      } else {
        await apiFetch("/api/auth/signup", {
          method: "POST",
          auth: false,
          body: validationData,
        });

        toast({
          title: "Account created",
          description: "Your account has been created successfully. You can now log in.",
        });
        setIsLogin(true);
      }

    } catch (error: unknown) {
      if (error instanceof z.ZodError) {
        toast({
          title: "Validation error",
          description: error.errors[0].message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Authentication error",
          description: getErrorMessage(error, "An error occurred"),
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordResetRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      resetRequestSchema.parse({ identifier: resetIdentifier });
      await apiFetch("/api/auth/password-reset/request", {
        method: "POST",
        auth: false,
        body: { identifier: resetIdentifier.trim() },
      });

      toast({
        title: "Reset link sent",
        description: "If the account exists, a password reset link has been sent.",
      });
      setResetIdentifier("");
      setIsForgotPassword(false);
      setIsLogin(true);
    } catch (error: unknown) {
      if (error instanceof z.ZodError) {
        toast({
          title: "Validation error",
          description: error.errors[0].message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Reset request failed",
          description: getErrorMessage(error, "An error occurred"),
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const toggleAuthMode = () => {
    setIsForgotPassword(false);
    setIsLogin(!isLogin);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-secondary p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <img 
            src={equityLogo} 
            alt="Equity Bank Logo" 
            className="mx-auto mb-4 h-16 object-contain"
          />
          <CardTitle className="text-2xl font-bold">
            {isForgotPassword ? "Reset Password" : isLogin ? "Sign In" : "Create Account"}
          </CardTitle>
          <CardDescription>
            Equity Bank SentraIQ
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isForgotPassword ? (
            <form onSubmit={handlePasswordResetRequest} className="grid gap-4">
              <div className="space-y-2">
                <Label htmlFor="reset-identifier">Username or Email</Label>
                <Input
                  id="reset-identifier"
                  type="text"
                  placeholder="SW1234 or name@example.com"
                  value={resetIdentifier}
                  onChange={(e) => setResetIdentifier(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Sending..." : "Send Reset Link"}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleAuth} className="grid gap-4">
            {!isLogin && (
              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name</Label>
                <Input
                  id="fullName"
                  type="text"
                  placeholder="John Doe"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required={!isLogin}
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                type="username"
                placeholder="SW1234"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <Button 
              type="submit" 
              className="w-full"
              disabled={loading}
            >
              {loading ? "Please wait..." : (isLogin ? "Sign In" : "Sign Up")}
            </Button>
            </form>
          )}
          <div className="mt-4 text-center">
            {isLogin && !isForgotPassword && (
              <button
                type="button"
                onClick={() => setIsForgotPassword(true)}
                className="mb-3 block w-full text-sm text-primary hover:underline"
              >
                Forgot password?
              </button>
            )}
            <button
              type="button"
              onClick={isForgotPassword ? () => { setIsForgotPassword(false); setIsLogin(true); } : toggleAuthMode}
              className="text-sm text-primary hover:underline"
            >
              {isForgotPassword
                ? "Back to sign in"
                : isLogin 
                ? "Don't have an account? Sign up" 
                : "Already have an account? Sign in"}
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;
