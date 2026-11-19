import { FormEvent, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { LockKeyhole } from "lucide-react";
import { z } from "zod";
import equityLogo from "@/assets/equity-logo.png";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api";

const passwordSchema = z
  .object({
    token: z.string().min(1, "Password reset token is missing"),
    newPassword: z.string().min(6, "Password must be at least 6 characters"),
    confirmPassword: z.string().min(6, "Confirm your new password"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "New password and confirmation must match",
    path: ["confirmPassword"],
  });

const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

const ResetPassword = () => {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const token = searchParams.get("token") ?? "";
  const isTemporaryPassword = location.pathname === "/set-password";
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const copy = useMemo(
    () =>
      isTemporaryPassword
        ? {
            title: "Choose New Password",
            description: "Your temporary password was accepted.",
            success: "Password changed",
          }
        : {
            title: "Reset Password",
            description: "Enter and confirm your new password.",
            success: "Password reset",
          },
    [isTemporaryPassword]
  );

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);

    try {
      const body = passwordSchema.parse({ token, newPassword, confirmPassword });
      await apiFetch(
        isTemporaryPassword
          ? "/api/auth/temporary-password/complete"
          : "/api/auth/password-reset/confirm",
        {
          method: "POST",
          auth: false,
          body,
        }
      );

      toast({
        title: copy.success,
        description: "You can now sign in with your new password.",
      });
      navigate("/auth", { replace: true });
    } catch (error: unknown) {
      if (error instanceof z.ZodError) {
        toast({
          title: "Validation error",
          description: error.errors[0].message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Password not updated",
          description: getErrorMessage(error, "An error occurred"),
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
    }
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
          <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
            <LockKeyhole className="h-5 w-5" />
          </div>
          <CardTitle className="text-2xl font-bold">{copy.title}</CardTitle>
          <CardDescription>{copy.description}</CardDescription>
        </CardHeader>
        <CardContent>
          {!token ? (
            <div className="space-y-4">
              <Alert variant="destructive">
                <AlertTitle>Invalid Link</AlertTitle>
                <AlertDescription>Password reset token is missing.</AlertDescription>
              </Alert>
              <Button asChild className="w-full">
                <Link to="/auth">Back to Sign In</Link>
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="grid gap-4">
              <div className="space-y-2">
                <Label htmlFor="new-password">New Password</Label>
                <Input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  placeholder="Enter new password"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm Password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder="Confirm new password"
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Updating..." : "Update Password"}
              </Button>
              <Button type="button" variant="ghost" asChild>
                <Link to="/auth">Back to Sign In</Link>
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ResetPassword;
