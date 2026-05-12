import { Link, useRouterState } from "@tanstack/react-router";
import { Home, Tag, Settings, UtensilsCrossed, CalendarDays, ShoppingCart } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "#/components/ui/sidebar";
import { SidebarUserMenu } from "#/components/sidebar-user-menu";
import type { FileRouteTypes } from "#/routeTree.gen";
import type { LucideIcon } from "lucide-react";

type NavItem = {
  title: string;
  href: FileRouteTypes["to"];
  icon: LucideIcon;
};

const navItems: NavItem[] = [
  { title: "Home", href: "/", icon: Home },
  { title: "Schedule", href: "/schedule", icon: CalendarDays },
  { title: "Shopping list", href: "/shopping-list", icon: ShoppingCart },
  { title: "Meal Pool", href: "/meals", icon: UtensilsCrossed },
  { title: "Categories", href: "/categories", icon: Tag },
  { title: "Preferences", href: "/preferences", icon: Settings },
];

export function AppSidebar() {
  const routerState = useRouterState();
  const currentPath = routerState.location.pathname;

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link to="/">
                <div className="bg-primary text-primary-foreground flex size-8 items-center justify-center rounded-md text-sm font-bold">
                  S
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">Starter</span>
                  <span className="truncate text-xs text-muted-foreground">Template</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={currentPath === item.href}>
                    <Link to={item.href}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarUserMenu />
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
