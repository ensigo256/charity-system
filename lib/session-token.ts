let accessToken: string | null = null;

export const AUTH_SESSION_EXPIRED_EVENT = "charity-admin-session-expired";

export function getAccessToken() {
  return accessToken;
}

export function setAccessToken(token: string | null) {
  accessToken = token;
}
