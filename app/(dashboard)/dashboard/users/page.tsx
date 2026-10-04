"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Clock3,
  KeyRound,
  LoaderCircle,
  Plus,
  Search,
  ShieldCheck,
  UserRoundCog,
  UserRoundX,
} from "lucide-react";
import { apiRequest } from "@/lib/query-client";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type AccountRole = "developer" | "admin" | "editor";

type ManagedUser = {
  id: string;
  username: string;
  role: AccountRole;
  isActive: boolean;
  createdAt: string;
  lastLogin: string | null;
  recentActiveSessions: number;
};

type UserSession = {
  sessionId: string;
  loginAt: string;
  lastActivityAt: string;
  expiresAt: string;
  loggedOutAt: string | null;
  revokedAt: string | null;
  revocationReason: string;
  ipAddress: string;
  userAgent: string;
  isRecentlyActive: boolean;
};

type UserList = {
  users: ManagedUser[];
  pagination: { page: number; limit: number; total: number; pageCount: number };
};

const PAGE_SIZE = 20;

function formatDate(value?: string | null) {
  if (!value) return "Never";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Unknown"
    : new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function roleLabel(role: AccountRole) {
  return role.charAt(0).toUpperCase() + role.slice(1);
}

export default function UsersPage() {
  const { can } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [dialog, setDialog] = useState<"create" | "edit" | "password" | "sessions" | null>(null);
  const [selectedUser, setSelectedUser] = useState<ManagedUser | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<AccountRole>("admin");
  const [formError, setFormError] = useState("");
  const [nowMs, setNowMs] = useState<number | null>(null);

  useEffect(() => {
    const updateNow = () => setNowMs(Date.now());
    updateNow();
    const intervalId = window.setInterval(updateNow, 30000);
    return () => window.clearInterval(intervalId);
  }, []);

  const { data, isLoading, isError, refetch } = useQuery<UserList>({
    queryKey: ["admin-users", page, search],
    queryFn: async () => {
      const query = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
      if (search) query.set("search", search);
      const response = await apiRequest("GET", `/auth/admin/users?${query}`);
      return response.json();
    },
    enabled: can("users.manage"),
    refetchInterval: 30_000,
  });

  const { data: sessionData, isLoading: sessionsLoading } = useQuery<{ sessions: UserSession[] }>({
    queryKey: ["admin-user-sessions", selectedUser?.id],
    queryFn: async () => {
      const response = await apiRequest("GET", `/auth/admin/users/${selectedUser?.id}/sessions?limit=50`);
      return response.json();
    },
    enabled: dialog === "sessions" && Boolean(selectedUser),
    refetchInterval: dialog === "sessions" ? 30_000 : false,
  });

  const refreshUsers = async () => {
    await queryClient.invalidateQueries({ queryKey: ["admin-users"] });
  };

  const createMutation = useMutation({
    mutationFn: async () => apiRequest("POST", "/auth/admin/register", { username: username.trim(), password, role }),
    onSuccess: async () => {
      setDialog(null);
      setUsername("");
      setPassword("");
      setRole("admin");
      setFormError("");
      await refreshUsers();
      toast({ title: "Account created", description: `${username.trim()} can now sign in.` });
    },
    onError: (error) => setFormError(error instanceof Error ? error.message : "Unable to create account."),
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!selectedUser) throw new Error("Select a user first.");
      return apiRequest("PATCH", `/auth/admin/users/${selectedUser.id}`, {
        username: username.trim(),
        role,
        ...(password ? { password } : {}),
      });
    },
    onSuccess: async () => {
      setDialog(null);
      setPassword("");
      setFormError("");
      await refreshUsers();
      toast({ title: "Account updated", description: "Changes were saved. Existing sessions are revoked when access changes." });
    },
    onError: (error) => setFormError(error instanceof Error ? error.message : "Unable to update account."),
  });

  const passwordMutation = useMutation({
    mutationFn: async () => {
      if (!selectedUser) throw new Error("Select a user first.");
      return apiRequest("PUT", `/auth/admin/users/${selectedUser.id}/password`, { password });
    },
    onSuccess: async () => {
      setDialog(null);
      setPassword("");
      setFormError("");
      await refreshUsers();
      toast({ title: "Password reset", description: "All of this user's sessions were revoked." });
    },
    onError: (error) => setFormError(error instanceof Error ? error.message : "Unable to reset password."),
  });

  const deactivateMutation = useMutation({
    mutationFn: async (user: ManagedUser) => apiRequest("DELETE", `/auth/admin/users/${user.id}`),
    onSuccess: async () => {
      await refreshUsers();
      toast({ title: "Account deactivated", description: "The account and its audit history are retained." });
    },
    onError: (error) => toast({ variant: "destructive", title: "Unable to deactivate account", description: error instanceof Error ? error.message : "Please try again." }),
  });

  const activateMutation = useMutation({
    mutationFn: async (user: ManagedUser) => apiRequest("PATCH", `/auth/admin/users/${user.id}`, { isActive: true }),
    onSuccess: async () => {
      await refreshUsers();
      toast({ title: "Account reactivated" });
    },
    onError: (error) => toast({ variant: "destructive", title: "Unable to reactivate account", description: error instanceof Error ? error.message : "Please try again." }),
  });

  const revokeMutation = useMutation({
    mutationFn: async ({ userId, sessionId }: { userId: string; sessionId?: string }) => {
      const path = sessionId
        ? `/auth/admin/users/${userId}/sessions/${sessionId}/revoke`
        : `/auth/admin/users/${userId}/sessions/revoke-all`;
      return apiRequest("POST", path);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-user-sessions", selectedUser?.id] }),
        refreshUsers(),
      ]);
      toast({ title: "Session access revoked" });
    },
    onError: (error) => toast({ variant: "destructive", title: "Unable to revoke session", description: error instanceof Error ? error.message : "Please try again." }),
  });

  const openCreate = () => {
    setSelectedUser(null);
    setUsername("");
    setPassword("");
    setRole("admin");
    setFormError("");
    setDialog("create");
  };

  const openEdit = (user: ManagedUser) => {
    setSelectedUser(user);
    setUsername(user.username);
    setPassword("");
    setRole(user.role);
    setFormError("");
    setDialog("edit");
  };

  const openPasswordReset = (user: ManagedUser) => {
    setSelectedUser(user);
    setPassword("");
    setFormError("");
    setDialog("password");
  };

  const runSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  };

  const saveAccount = () => {
    setFormError("");
    if (username.trim().length < 3) return setFormError("Username must be at least 3 characters.");
    const minimumLength = role === "developer" ? 12 : 6;
    if (dialog === "create" && password.length < minimumLength) {
      return setFormError(`${roleLabel(role)} passwords must be at least ${minimumLength} characters.`);
    }
    if (dialog === "edit" && role === "developer" && selectedUser?.role !== "developer" && password.length < 12) {
      return setFormError("Promoting to developer requires a new password of at least 12 characters.");
    }
    if (dialog === "edit") updateMutation.mutate();
    else createMutation.mutate();
  };

  const submitPasswordReset = () => {
    const minimumLength = selectedUser?.role === "developer" ? 12 : 6;
    if (password.length < minimumLength || password.length > 128) {
      setFormError(`Password must be between ${minimumLength} and 128 characters.`);
      return;
    }
    setFormError("");
    passwordMutation.mutate();
  };

  const busy = createMutation.isPending || updateMutation.isPending || passwordMutation.isPending;
  const pagination = data?.pagination;
  const users = data?.users || [];

  if (!can("users.manage")) {
    return <div className="p-8 text-sm text-destructive">You do not have permission to manage accounts.</div>;
  }

  return (
    <div className="min-w-0 space-y-6 p-4 sm:p-6 lg:p-8">
      <header className="flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Workspace access</p>
          <h1 className="mt-1 text-2xl font-semibold text-foreground">User management</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage team accounts, access levels, and sign-in history.</p>
        </div>
        <Button onClick={openCreate}><Plus className="mr-2 size-4" />Create user</Button>
      </header>

      <section className="grid gap-4 sm:grid-cols-3" aria-label="Account summary">
        <div className="border-l-2 border-primary px-4 py-2">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Accounts</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{pagination?.total ?? "—"}</p>
        </div>
        <div className="border-l-2 border-emerald-600 px-4 py-2">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Active on this page</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{users.filter((user) => user.isActive).length}</p>
        </div>
        <div className="border-l-2 border-amber-500 px-4 py-2">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Recently active sessions</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{users.reduce((count, user) => count + user.recentActiveSessions, 0)}</p>
        </div>
      </section>

      <Card className="overflow-hidden rounded-md border-border shadow-none">
        <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between">
          <form onSubmit={runSearch} className="flex w-full max-w-lg gap-2">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input aria-label="Search usernames" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Search username" className="pl-9" />
            </div>
            <Button type="submit" variant="outline">Search</Button>
          </form>
          <p className="text-sm text-muted-foreground">{pagination?.total ?? 0} accounts</p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center gap-2 p-12 text-sm text-muted-foreground"><LoaderCircle className="size-4 animate-spin" />Loading accounts</div>
        ) : isError ? (
          <div className="p-10 text-center"><p className="text-sm text-destructive">Unable to load accounts.</p><Button className="mt-3" variant="outline" onClick={() => void refetch()}>Retry</Button></div>
        ) : users.length === 0 ? (
          <div className="p-12 text-center"><UserRoundCog className="mx-auto size-8 text-muted-foreground" /><p className="mt-3 font-medium">No accounts found</p><p className="mt-1 text-sm text-muted-foreground">Try a different search or create an account.</p></div>
        ) : (
          <Table>
            <TableHeader><TableRow>
              <TableHead>Username</TableHead><TableHead>Role</TableHead><TableHead>Status</TableHead><TableHead>Last login</TableHead><TableHead>Session activity</TableHead><TableHead className="text-right">Actions</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.username}</TableCell>
                  <TableCell><Badge variant={user.role === "developer" ? "default" : "secondary"}>{roleLabel(user.role)}</Badge></TableCell>
                  <TableCell><Badge variant={user.isActive ? "outline" : "destructive"}>{user.isActive ? "Active" : "Deactivated"}</Badge></TableCell>
                  <TableCell>{formatDate(user.lastLogin)}</TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                      <span className={`size-2 rounded-full ${user.recentActiveSessions ? "bg-emerald-500" : "bg-muted-foreground/40"}`} />
                      {user.recentActiveSessions ? `${user.recentActiveSessions} recently active` : "No recent activity"}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" title="View login history" aria-label={`View login history for ${user.username}`} onClick={() => { setSelectedUser(user); setDialog("sessions"); }}><Clock3 className="size-4" /></Button>
                      <Button variant="ghost" size="icon" title="Edit account" aria-label={`Edit ${user.username}`} onClick={() => openEdit(user)}><UserRoundCog className="size-4" /></Button>
                      <Button variant="ghost" size="icon" title="Reset password" aria-label={`Reset password for ${user.username}`} onClick={() => openPasswordReset(user)}><KeyRound className="size-4" /></Button>
                      {user.isActive ? <Button variant="ghost" size="icon" title="Deactivate account" aria-label={`Deactivate ${user.username}`} disabled={deactivateMutation.isPending} onClick={() => { if (window.confirm(`Deactivate ${user.username}? Their sessions will be revoked. Their audit history will be retained.`)) deactivateMutation.mutate(user); }}><UserRoundX className="size-4 text-destructive" /></Button> : <Button variant="ghost" size="icon" title="Reactivate account" aria-label={`Reactivate ${user.username}`} disabled={activateMutation.isPending} onClick={() => activateMutation.mutate(user)}><ShieldCheck className="size-4 text-emerald-700" /></Button>}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        <footer className="flex items-center justify-between border-t border-border px-4 py-3">
          <p className="text-sm text-muted-foreground">Page {pagination?.page ?? page} of {Math.max(1, pagination?.pageCount ?? 1)}</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1 || isLoading} onClick={() => setPage((current) => Math.max(1, current - 1))}>Previous</Button>
            <Button variant="outline" size="sm" disabled={!pagination || page >= pagination.pageCount || isLoading} onClick={() => setPage((current) => current + 1)}>Next</Button>
          </div>
        </footer>
      </Card>

      <Dialog open={dialog === "create" || dialog === "edit"} onOpenChange={(open) => { if (!open && !busy) setDialog(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dialog === "create" ? "Create user account" : "Edit user account"}</DialogTitle>
            <DialogDescription>Accounts are for authorized team members. Passwords are stored as secure hashes and cannot be viewed later.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2"><Label htmlFor="managed-username">Username</Label><Input id="managed-username" autoComplete="off" value={username} onChange={(event) => setUsername(event.target.value)} /></div>
            <div className="space-y-2"><Label htmlFor="managed-role">Role</Label>
              <Select value={role} onValueChange={(value) => setRole(value as AccountRole)}><SelectTrigger id="managed-role" className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="admin">Admin</SelectItem><SelectItem value="editor">Editor</SelectItem><SelectItem value="developer">Developer</SelectItem></SelectContent></Select>
            </div>
            <div className="space-y-2"><Label htmlFor="managed-password">{dialog === "create" ? "Temporary password" : "New password (required when promoting to developer)"}</Label><Input id="managed-password" type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder={dialog === "create" ? `At least ${role === "developer" ? 12 : 6} characters` : "Leave blank to keep current password"} />
              <p className="text-xs text-muted-foreground">Minimum {role === "developer" ? 12 : 6} characters. Passwords cannot be viewed after saving.</p>
            </div>
            {formError ? <p role="alert" className="text-sm text-destructive">{formError}</p> : null}
          </div>
          <DialogFooter><Button variant="outline" disabled={busy} onClick={() => setDialog(null)}>Cancel</Button><Button disabled={busy} onClick={saveAccount}>{busy ? "Saving..." : dialog === "create" ? "Create account" : "Save changes"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialog === "password"} onOpenChange={(open) => { if (!open && !passwordMutation.isPending) setDialog(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reset password</DialogTitle><DialogDescription>Set a new password for {selectedUser?.username}. All active sessions will be revoked.</DialogDescription></DialogHeader>
          <div className="space-y-2"><Label htmlFor="reset-password">New password</Label><Input id="reset-password" type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} /><p className="text-xs text-muted-foreground">Minimum {selectedUser?.role === "developer" ? 12 : 6} characters.</p>{formError ? <p role="alert" className="text-sm text-destructive">{formError}</p> : null}</div>
          <DialogFooter><Button variant="outline" onClick={() => setDialog(null)}>Cancel</Button><Button disabled={passwordMutation.isPending} onClick={submitPasswordReset}>{passwordMutation.isPending ? "Resetting..." : "Reset password"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialog === "sessions"} onOpenChange={(open) => { if (!open) setDialog(null); }}>
        <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
          <DialogHeader><DialogTitle>Sign-in history</DialogTitle><DialogDescription>{selectedUser?.username} · recent activity means a valid session made an authenticated request in the last five minutes.</DialogDescription></DialogHeader>
          <div className="flex justify-end"><Button variant="outline" size="sm" disabled={revokeMutation.isPending} onClick={() => selectedUser && revokeMutation.mutate({ userId: selectedUser.id })}><ShieldCheck className="mr-2 size-4" />Revoke all sessions</Button></div>
          {sessionsLoading ? <div className="p-8 text-center text-sm text-muted-foreground">Loading sign-in history...</div> : sessionData?.sessions.length ? <div className="space-y-3">{sessionData.sessions.map((session) => {
            const expired = nowMs === null ? false : new Date(session.expiresAt).getTime() <= nowMs;
            const ended = Boolean(session.loggedOutAt || session.revokedAt || expired);
            const state = session.revokedAt ? "Revoked" : session.loggedOutAt ? "Logged out" : expired ? "Expired" : "No recent activity";
            return <article key={session.sessionId} className="rounded-md border border-border p-4">
              <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-medium">{session.isRecentlyActive ? "Recently active" : state}</p><p className="mt-1 text-sm text-muted-foreground">Signed in {formatDate(session.loginAt)}</p></div>{session.isRecentlyActive ? <Badge variant="outline" className="border-emerald-600 text-emerald-700">Recent activity</Badge> : <Badge variant="secondary">{state}</Badge>}</div>
              <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2"><div><dt className="text-xs uppercase text-muted-foreground">Last activity</dt><dd className="mt-1">{formatDate(session.lastActivityAt)}</dd></div><div><dt className="text-xs uppercase text-muted-foreground">End / expiry</dt><dd className="mt-1">{formatDate(session.loggedOutAt || session.revokedAt || session.expiresAt)}</dd></div><div><dt className="text-xs uppercase text-muted-foreground">IP address</dt><dd className="mt-1">{session.ipAddress || "Not recorded"}</dd></div><div className="min-w-0"><dt className="text-xs uppercase text-muted-foreground">Device</dt><dd className="mt-1 wrap-break-word">{session.userAgent || "Not recorded"}</dd></div></dl>
              {!ended ? <div className="mt-3 flex justify-end"><Button variant="outline" size="sm" disabled={revokeMutation.isPending} onClick={() => selectedUser && revokeMutation.mutate({ userId: selectedUser.id, sessionId: session.sessionId })}><UserRoundX className="mr-2 size-4" />Revoke session</Button></div> : null}
            </article>;
          })}</div> : <div className="p-8 text-center text-sm text-muted-foreground">No sign-ins have been recorded yet.</div>}
        </DialogContent>
      </Dialog>
    </div>
  );
}