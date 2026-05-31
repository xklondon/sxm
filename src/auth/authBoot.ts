export function isPublicAuthPath(pathname: string): boolean {
  return (
    pathname === '/login' ||
    pathname.endsWith('/login') ||
    pathname === '/join-table' ||
    pathname.endsWith('/join-table')
  );
}

/** Block the whole app on session check only for protected routes. */
export function shouldShowGlobalSessionLoading(
  pathname: string,
  authLoading: boolean,
  onlineMode: boolean,
): boolean {
  return onlineMode && authLoading && !isPublicAuthPath(pathname);
}
