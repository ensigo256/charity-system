"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { usePathname, useRouter } from "next/navigation";
import type { Permission } from "@/lib/permissions";
import { DashboardSidebar } from "@/components/dashboard/sidebar";
import { DashboardHeader } from "@/components/dashboard/header";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAuthenticated, isLoading, can } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace("/login");
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <p className="mt-4 text-foreground/70">Loading...</p>
        </div>
      </div>
    );
  }

  const routePermissions: Array<{
    prefix: string;
    permission: Permission;
  }> = [
    { prefix: "/dashboard/children", permission: "children.view" },
    { prefix: "/dashboard/sponsorships", permission: "sponsorships.view" },
    { prefix: "/dashboard/staff", permission: "staff.view" },
    { prefix: "/dashboard/blogs", permission: "blogs.view" },
    { prefix: "/dashboard/events", permission: "events.view" },
    { prefix: "/dashboard/gallery", permission: "gallery.view" },
    { prefix: "/dashboard/messages", permission: "messages.view" },
    { prefix: "/dashboard/users", permission: "users.manage" },
    { prefix: "/dashboard/settings", permission: "ach.settings.manage" },
  ];
  const requiredPermission = routePermissions.find(({ prefix }) =>
    pathname.startsWith(prefix),
  )?.permission ?? (pathname === "/dashboard" ? "dashboard.view" : undefined);

  if (requiredPermission && !can(requiredPermission)) {
    return (
      <main className="min-h-screen bg-background px-6 py-12 text-foreground">
        <div className="mx-auto flex min-h-[70vh] max-w-lg items-center justify-center text-center">
          <div className="rounded-xl border border-border bg-card p-8 shadow-sm">
            <h1 className="text-2xl font-bold">Access denied</h1>
            <p className="mt-3 text-foreground/70">
              Your account does not have permission to view this dashboard
              section.
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <div className="flex h-screen bg-background">
      <DashboardSidebar
        mobileOpen={mobileSidebarOpen}
        onMobileOpenChange={setMobileSidebarOpen}
      />
      <div className="flex-1 flex flex-col">
        <DashboardHeader
          onMenuClick={() => setMobileSidebarOpen(true)}
        />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
