import { BarChart3, LayoutDashboard, MessageCircle, ShieldCheck, Users } from "lucide-react";
import { NavLink } from "react-router-dom";
import { useUserRole, type UserRole } from "@/hooks/useUserRole";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

type SidebarRole = Exclude<UserRole, null>;

const allMenuItems: Array<{
  title: string;
  url: string;
  icon: typeof LayoutDashboard;
  roles: SidebarRole[];
}> = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard, roles: ["agent", "admin", "super_user"] },
  { title: "Messages", url: "/messages", icon: MessageCircle, roles: ["agent", "admin", "super_user"] },
  { title: "Reports", url: "/reports", icon: BarChart3, roles: ["agent", "admin", "super_user"] },
  { title: "Admin", url: "/admin", icon: Users, roles: ["admin", "super_user"] },
  { title: "Super User", url: "/super-user", icon: ShieldCheck, roles: ["super_user"] },
];

export function AppSidebar() {
  const { open } = useSidebar();
  const { role } = useUserRole();

  const menuItems = role
    ? allMenuItems.filter((item) => item.roles.includes(role))
    : [];

  return (
    <Sidebar collapsible="icon" className="border-r bg-white text-foreground">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-foreground">Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end
                       className={({ isActive }) =>
                        isActive
                          ? "bg-muted text-foreground font-medium hover:bg-muted/80"
                          : "hover:bg-muted text-foreground"
                       }
                    >
                      <item.icon className="h-5 w-5" />
                      {open && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
