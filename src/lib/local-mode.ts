export function isLocalMode(): boolean {
  const mode = process.env.NEXT_PUBLIC_AUTH_MODE;
  if (mode === "local") return true;
  if (mode === "firebase") return false;
  return process.env.NODE_ENV !== "production";
}
