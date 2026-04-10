export function isSafeRedirect(url) {
  if (!url) {
    return false;
  }

  return url.startsWith("/") && !url.startsWith("//");
}
