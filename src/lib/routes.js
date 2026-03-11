export const DISCLAIMER_PATH = "/disclaimer";
export const DONATE_PATH = "/donate";

export function currentPath() {
  return window.location.pathname.replace(/\/$/, "") || "/";
}

export function isReservedPath(pathname) {
  return pathname === DISCLAIMER_PATH || pathname === DONATE_PATH;
}

export function tickerFromPath(pathname) {
  const cleaned = pathname.replace(/^\//, "").replace(/\/$/, "");
  if (!cleaned) return null;
  const parts = cleaned.split("/");
  const first = parts[0];
  if (!first) return null;
  // avoid reserved top-level paths like /disclaimer or /donate
  if (isReservedPath(`/${first}`)) return null;
  return decodeURIComponent(first).toUpperCase();
}

export function tabFromPath(pathname) {
  const cleaned = pathname.replace(/^\//, "").replace(/\/$/, "");
  if (!cleaned) return null;
  const parts = cleaned.split("/");
  if (parts.length < 2) return null;
  return decodeURIComponent(parts[1]);
}
