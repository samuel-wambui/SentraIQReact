import { BarChart3, ChevronLeft, ChevronRight, History, LayoutDashboard, MessageCircle, ShieldCheck, Users } from "lucide-react";
import { Link, NavLink } from "react-router-dom";
import { useUserRole, type UserRole } from "@/hooks/useUserRole";
import equityLogo from "@/assets/equity-logo.png";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarFooter,
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
  { title: "Overview", url: "/dashboard", icon: LayoutDashboard, roles: ["agent", "admin", "super_user"] },
  { title: "Mentions", url: "/messages", icon: MessageCircle, roles: ["agent", "admin", "super_user"] },
  { title: "Ticket History", url: "/ticket-history", icon: History, roles: ["agent", "admin", "super_user"] },
  { title: "Reports", url: "/reports", icon: BarChart3, roles: ["agent", "admin", "super_user"] },
  { title: "Admin", url: "/admin", icon: Users, roles: ["admin", "super_user"] },
  { title: "Super User", url: "/super-user", icon: ShieldCheck, roles: ["super_user"] },
];

export function AppSidebar() {
  const { open, toggleSidebar } = useSidebar();
  const { role } = useUserRole();

  const menuItems = role
    ? allMenuItems.filter((item) => item.roles.includes(role))
    : [];

  const workspaceItems = menuItems.filter((item) => !["Admin", "Super User"].includes(item.title));
  const managementItems = menuItems.filter((item) => ["Admin", "Super User"].includes(item.title));

  const renderMenuItems = (items: typeof menuItems) => (
    <SidebarMenu>
      {items.map((item) => (
        <SidebarMenuItem key={item.title}>
          <SidebarMenuButton asChild className="h-10 px-3 text-[13px]">
            <NavLink
              to={item.url}
              end
              className={({ isActive }) =>
                isActive
                  ? "bg-[#1769c2] font-semibold text-white shadow-sm hover:bg-[#1769c2]"
                  : "text-[#b8c5d8] hover:bg-[#1c2a3e] hover:text-white"
              }
            >
              <item.icon className="h-4 w-4" />
              {open && <span>{item.title}</span>}
            </NavLink>
          </SidebarMenuButton>
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  );

  return (
    <Sidebar collapsible="icon" className="border-r border-[#26344a] bg-[#101827] text-white">
      <div className="flex h-[52px] shrink-0 items-center border-b border-[#26344a] bg-[#0b1220] px-3 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
        <Link to="/dashboard" className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-8 w-10 shrink-0 items-center justify-center overflow-hidden rounded-sm bg-white px-0.5">
            <img src={equityLogo} alt="Equity" className="h-7 w-full object-contain" />
          </span>
          {open && <span className="truncate text-sm font-semibold text-white">SentraIQ</span>}
        </Link>
      </div>
      <SidebarContent className="gap-0 bg-[#101827] pt-3">
        <SidebarGroup className="px-2 py-1">
          <SidebarGroupLabel className="px-3 text-[9px] font-bold uppercase text-[#7f8da3]">
            Analytics
          </SidebarGroupLabel>
          <SidebarGroupContent>{renderMenuItems(workspaceItems)}</SidebarGroupContent>
        </SidebarGroup>
        {managementItems.length > 0 && (
          <SidebarGroup className="px-2 py-1">
            <SidebarGroupLabel className="px-3 text-[9px] font-bold uppercase text-[#7f8da3]">
              Workspace
            </SidebarGroupLabel>
            <SidebarGroupContent>{renderMenuItems(managementItems)}</SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
      <SidebarFooter className="border-t border-[#26344a] p-2">
        <button
          type="button"
          onClick={toggleSidebar}
          aria-label={open ? "Collapse sidebar" : "Expand sidebar"}
          title={open ? "Collapse sidebar" : "Expand sidebar"}
          className="flex h-8 w-full items-center justify-end rounded-sm px-2 text-[#aebbd0] transition-colors hover:bg-[#1c2a3e] hover:text-white group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
        >
          {open ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
      </SidebarFooter>
    </Sidebar>
  );
}
