'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Archive, Bell, CheckCheck, Menu, Trash2 } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { apiRequest } from '@/lib/query-client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';

type NotificationItem = {
  _id: string;
  title: string;
  description: string;
  type: string;
  status: 'unread' | 'read' | 'archived' | 'deleted';
  linkTo?: string;
  createdAt?: string;
};

type DashboardHeaderProps = {
  onMenuClick: () => void;
};

async function fetchNotifications(): Promise<NotificationItem[]> {
  const response = await apiRequest('GET', '/notifications?limit=20');
  return response.json();
}

async function fetchUnreadCount(): Promise<number> {
  const response = await apiRequest('GET', '/notifications/unread-count');
  const data = await response.json();
  return Number(data?.count ?? 0);
}

export function DashboardHeader({ onMenuClick }: DashboardHeaderProps) {
  const { user, logout } = useAuth();
  const queryClient = useQueryClient();
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  const { data: notifications = [] } = useQuery<NotificationItem[]>({
    queryKey: ['notifications', 'inbox'],
    queryFn: fetchNotifications,
    enabled: Boolean(user),
    refetchInterval: 30000,
  });

  const { data: unreadCount = 0 } = useQuery<number>({
    queryKey: ['notifications', 'unread-count'],
    queryFn: fetchUnreadCount,
    enabled: Boolean(user),
    refetchInterval: 30000,
  });

  const refreshNotificationState = () => {
    void queryClient.invalidateQueries({ queryKey: ['notifications'] });
  };

  const handleNotificationAction = async (
    id: string,
    action: 'read' | 'archive',
  ) => {
    await apiRequest('PATCH', `/notifications/${id}/${action}`);
    refreshNotificationState();
  };

  const handleNotificationDelete = async (id: string) => {
    await apiRequest('DELETE', `/notifications/${id}`);
    refreshNotificationState();
  };

  const handleLogout = () => {
    logout();
  };

  return (
    <>
      <header className="flex min-h-16 items-center justify-between gap-3 border-b border-border bg-card px-4 py-3 sm:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={onMenuClick}
            aria-label="Open dashboard navigation"
          >
            <Menu />
          </Button>
          <h1 className="hidden truncate text-xl font-bold text-foreground sm:block">
            Dashboard
          </h1>
        </div>

        <div className="flex min-w-0 shrink-0 items-center gap-2 sm:gap-4">
          <div className="relative">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="relative rounded-full"
              onClick={() => setNotificationsOpen(true)}
              aria-label="Open notifications"
            >
              <Bell className="h-5 w-5" />
            </Button>
            {unreadCount > 0 ? (
              <Badge className="absolute -top-2 -right-1 min-w-5 justify-center px-1.5 py-0.5 text-[10px]">
                {unreadCount > 99 ? '99+' : unreadCount}
              </Badge>
            ) : null}
          </div>

          {user && (
            <>
              <div className="min-w-0 max-w-28 text-right sm:max-w-44">
                <p className="truncate text-sm font-medium text-foreground">{user.name}</p>
                <p className="hidden truncate text-xs text-foreground/60 sm:block">{user.email}</p>
              </div>
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground sm:h-10 sm:w-10">
                {user.name.charAt(0).toUpperCase()}
              </div>
            </>
          )}
          <Button
            onClick={handleLogout}
            variant="outline"
            size="sm"
            className="shrink-0 border-primary px-2 text-primary hover:bg-primary/10 sm:px-3"
          >
            <span className="sm:hidden">Exit</span>
            <span className="hidden sm:inline">Logout</span>
          </Button>
        </div>
      </header>

      <Sheet open={notificationsOpen} onOpenChange={setNotificationsOpen}>
        <SheetContent side="right" className="w-[92vw] p-0 sm:max-w-md">
          <SheetHeader className="border-b border-border p-4">
            <div className="flex items-center justify-between gap-3">
              <SheetTitle className="text-lg">Notifications</SheetTitle>
              <Badge variant={unreadCount > 0 ? 'default' : 'secondary'}>
                {unreadCount} unread
              </Badge>
            </div>
          </SheetHeader>

          <ScrollArea className="h-[calc(100vh-72px)]">
            <div className="space-y-3 p-3">
              {notifications.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border bg-muted/30 p-5 text-center text-sm text-foreground/60">
                  You have no notifications.
                </div>
              ) : (
                notifications.map((notification) => (
                  <div
                    key={notification._id}
                    className="rounded-xl border border-border bg-card p-3 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-foreground">
                          {notification.title}
                        </p>
                        <p className="mt-1 text-sm text-foreground/70">
                          {notification.description}
                        </p>
                        <p className="mt-2 text-[11px] uppercase tracking-wide text-foreground/45">
                          {notification.type.replace(/_/g, ' ')}
                        </p>
                      </div>
                      {notification.status === 'unread' ? (
                        <Badge variant="default" className="shrink-0">
                          New
                        </Badge>
                      ) : null}
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {notification.status !== 'read' ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 px-2 text-xs"
                          onClick={() => handleNotificationAction(notification._id, 'read')}
                        >
                          <CheckCheck className="mr-1 h-3.5 w-3.5" />
                          Read
                        </Button>
                      ) : null}

                      {notification.status !== 'archived' ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 px-2 text-xs"
                          onClick={() => handleNotificationAction(notification._id, 'archive')}
                        >
                          <Archive className="mr-1 h-3.5 w-3.5" />
                          Archive
                        </Button>
                      ) : null}

                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2 text-xs text-destructive hover:text-destructive"
                        onClick={() => handleNotificationDelete(notification._id)}
                      >
                        <Trash2 className="mr-1 h-3.5 w-3.5" />
                        Delete
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </>
  );
}
