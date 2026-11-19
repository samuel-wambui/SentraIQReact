import { ReactNode, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { ChevronDown } from "lucide-react";
import ProfileDialog from "@/components/profile/ProfileDialog";
import SettingsDialog from "@/components/profile/SettingsDialog";
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
  const isDashboard = location.pathname === "/dashboard";

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <SidebarInset className="flex flex-1 flex-col">
          <Header
            title={isDashboard ? "Equity Bank Social Intelligence" : "SentraIQ"}
            subtitle={isDashboard ? "Real-time monitoring of customer mentions and sentiment" : "Support operations"}
            actions={
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    className="h-9 gap-2 px-1.5 text-left text-white hover:bg-white/10 hover:text-white"
                  >
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#1d4ed8] text-xs font-semibold text-white">
                      {(user?.firstName || user?.username || "U").slice(0, 1).toUpperCase()}
                    </span>
                    <span className="hidden min-w-0 sm:block">
                      <span className="block max-w-28 truncate text-xs font-semibold text-white">
                        {user?.name || user?.firstName || user?.username}
                      </span>
                      <span className="block text-[10px] text-white/70">Support agent</span>
                    </span>
                    <ChevronDown className="hidden h-4 w-4 text-white/70 sm:block" />
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
            <SidebarTrigger className="ml-0 text-slate-300 hover:bg-[#1c2a3e] hover:text-white" />
          </Header>
          <main className="flex-1 overflow-x-hidden bg-[#0b1220] p-4 sm:p-6 lg:p-8">
            <div className="space-y-6">
              {children ?? <Outlet />}
            </div>
          </main>
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
