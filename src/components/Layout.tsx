import { ReactNode, useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import GrafanaDashboardPanel from "@/components/dashboard/GrafanaDashboardPanel";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { User } from "lucide-react";
import ProfileDialog from "@/components/profile/ProfileDialog";
import SettingsDialog from "@/components/profile/SettingsDialog";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useAuth } from "@/components/auth/AuthProvider";

interface LayoutProps {
  children?: ReactNode;
}

export const Layout = ({ children }: LayoutProps) => {
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const { user, signOut } = useAuth();
  const location = useLocation();
  const isDashboardRoute = location.pathname === "/dashboard";
  const [hasMountedGrafana, setHasMountedGrafana] = useState(isDashboardRoute);

  useEffect(() => {
    if (isDashboardRoute) {
      setHasMountedGrafana(true);
    }
  }, [isDashboardRoute]);

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <SidebarInset className="flex flex-1 flex-col">
          <Header
            actions={
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-[#b71c1c] hover:bg-[#b71c1c]/10"
                  >
                    <User className="h-5 w-5" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-56 bg-white p-2" align="end">
                  <div className="space-y-1">
                    <div className="px-3 py-2 text-sm">
                      <p className="font-medium">{user?.name || user?.username}</p>
                      <p className="text-xs text-muted-foreground">{user?.username}</p>
                    </div>
                    <Button
                      variant="ghost"
                      className="w-full justify-start"
                      onClick={() => setProfileDialogOpen(true)}
                    >
                      Profile
                    </Button>
                    <Button
                      variant="ghost"
                      className="w-full justify-start"
                      onClick={() => setSettingsDialogOpen(true)}
                    >
                      Settings
                    </Button>
                    <Button
                      variant="ghost"
                      className="w-full justify-start text-black hover:text-black"
                      onClick={signOut}
                    >
                      Sign Out
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
            }
          >
            <SidebarTrigger className="ml-2 text-[#b71c1c] hover:bg-[#b71c1c]/10" />
          </Header>
          <main className="flex-1 overflow-x-hidden p-6">
            <div className="space-y-6">
              {children ?? <Outlet />}
              {hasMountedGrafana && (
                <div
                  aria-hidden={!isDashboardRoute}
                  className={cn(!isDashboardRoute && "hidden")}
                >
                  <GrafanaDashboardPanel />
                </div>
              )}
            </div>
          </main>
          <Footer />
        </SidebarInset>
      </div>
      <ProfileDialog
        open={profileDialogOpen}
        onOpenChange={setProfileDialogOpen}
      />
      <SettingsDialog
        open={settingsDialogOpen}
        onOpenChange={setSettingsDialogOpen}
      />
    </SidebarProvider>
  );
};
