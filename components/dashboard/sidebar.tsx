"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import type { Permission } from "@/lib/permissions";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/query-client";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

const sidebarItems = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: "📊",
    permission: "dashboard.view",
  },
  {
    href: "/dashboard/children",
    label: "Children",
    icon: "🧒",
    permission: "children.view",
  },
  {
    href: "/dashboard/sponsorships",
    label: "Sponsors",
    icon: "💝",
    permission: "sponsorships.view",
  },
  // { href: "/dashboard/programs", label: "Programs", icon: "📚" },
  {
    href: "/dashboard/staff",
    label: "Staff & Volunteers",
    icon: "👥",
    permission: "staff.view",
  },
  {
    href: "/dashboard/blogs",
    label: "Blogs",
    icon: "📖",
    permission: "blogs.view",
  },
  {
    href: "/dashboard/gallery",
    label: "Gallery",
    icon: "🖼️",
    permission: "gallery.view",
  },
  {
    href: "/dashboard/events",
    label: "Events",
    icon: "📅",
    permission: "events.view",
  },
  {
    href: "/dashboard/messages",
    label: "Messages",
    icon: "✉️",
    permission: "messages.view",
  },
  {
    href: "/dashboard/users",
    label: "User management",
    icon: "🔐",
    permission: "users.manage",
  },
  {
    href: "/dashboard/settings",
    label: "ACH settings",
    icon: "⚙️",
    permission: "ach.settings.manage",
  },
];

type DashboardSidebarProps = {
  mobileOpen: boolean;
  onMobileOpenChange: (open: boolean) => void;
};

export function DashboardSidebar({
  mobileOpen,
  onMobileOpenChange,
}: DashboardSidebarProps) {
  const pathname = usePathname();
  const { can } = useAuth();
  const { data: unreadData } = useQuery<{ count: number }>({
    queryKey: ["messages", "unread-count"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/messages/unread-count");
      return response.json();
    },
    enabled: can("messages.view"),
    refetchInterval: 30000,
  });
  const visibleItems = sidebarItems.filter((item) =>
    can(item.permission as Permission),
  );

  const navigation = (
    <>
      {/* Logo */}
      <div className="p-6 border-b border-border">
        <Link
          href="/"
          className="flex items-center gap-2 font-bold text-lg text-foreground"
        >
          <span className="w-8 h-8 bg-transparent rounded-full flex items-center justify-center text-primary-foreground">
            <img src="/logo.png" alt="Seeds of Love" />
          </span>
          Seeds of Love
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2">
        {visibleItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => onMobileOpenChange(false)}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                isActive
                  ? "bg-primary text-primary-foreground font-medium"
                  : "text-foreground/70 hover:bg-background hover:text-foreground"
              }`}
            >
              <span className="text-lg">{item.icon}</span>
              <span>{item.label}</span>
              {item.href === "/dashboard/messages" && unreadData?.count ? (
                <span className="ml-auto min-w-5 rounded-full bg-destructive px-1.5 py-0.5 text-center text-xs font-semibold text-destructive-foreground">
                  {unreadData.count > 99 ? "99+" : unreadData.count}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-border">
        <p className="text-xs text-foreground/50 text-center">
          © 2024 Seeds of Love Foundation
        </p>
      </div>
    </>
  );

  return (
    <>
      <aside className="hidden w-64 flex-col border-r border-border bg-card lg:flex">
        {navigation}
      </aside>
      <Sheet open={mobileOpen} onOpenChange={onMobileOpenChange}>
        <SheetContent
          side="left"
          className="w-64 bg-card p-0 [&>button]:hidden"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>Dashboard navigation</SheetTitle>
            <SheetDescription>Navigate through the dashboard.</SheetDescription>
          </SheetHeader>
          <div className="flex h-full flex-col">{navigation}</div>
        </SheetContent>
      </Sheet>
    </>
  );
}
