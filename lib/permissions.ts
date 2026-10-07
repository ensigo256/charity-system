export const roles = ["developer", "admin", "editor"] as const;

export type UserRole = (typeof roles)[number];

export type Permission =
  | "dashboard.view"
  | "analytics.view"
  | "children.view"
  | "children.manage"
  | "sponsorships.view"
  | "sponsorships.manage"
  | "staff.view"
  | "staff.manage"
  | "blogs.view"
  | "blogs.manage"
  | "events.view"
  | "events.manage"
  | "gallery.view"
  | "gallery.manage"
  | "content.view"
  | "content.manage"
  | "donations.view"
  | "settings.view"
  | "ach.settings.manage"
  | "newsletter.view"
  | "messages.view"
  | "messages.manage"
  | "data.export"
  | "users.manage";

const rolePermissions: Record<UserRole, readonly Permission[]> = {
  developer: [
    "dashboard.view",
    "analytics.view",
    "children.view",
    "children.manage",
    "sponsorships.view",
    "sponsorships.manage",
    "staff.view",
    "staff.manage",
    "blogs.view",
    "blogs.manage",
    "events.view",
    "events.manage",
    "gallery.view",
    "gallery.manage",
    "content.view",
    "content.manage",
    "donations.view",
    "settings.view",
    "messages.view",
    "messages.manage",
    "newsletter.view",
    "data.export",
    "users.manage",
  ],
  admin: [
    "dashboard.view",
    "children.view",
    "children.manage",
    "sponsorships.view",
    "sponsorships.manage",
    "staff.view",
    "staff.manage",
    "messages.view",
    "messages.manage",
    "ach.settings.manage",
  ],
  editor: [
    "blogs.view",
    "blogs.manage",
    "events.view",
    "events.manage",
    "gallery.view",
    "gallery.manage",
  ],
};

export function normalizeRole(value: unknown): UserRole | null {
  const role = String(value || "").toLowerCase();
  return roles.includes(role as UserRole) ? (role as UserRole) : null;
}

export function hasPermission(
  role: UserRole | string | null | undefined,
  permission: Permission,
) {
  const normalizedRole = normalizeRole(role);
  return normalizedRole
    ? rolePermissions[normalizedRole].includes(permission)
    : false;
}
