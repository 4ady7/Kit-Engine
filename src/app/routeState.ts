export type SharedRouteState = "ready" | "loading" | "failed";

/** The screen may show the store only when it is the configuration named by the URL. */
export function sharedRouteState(
  routeId: string | undefined,
  configurationId: string | null,
  failedRoute: string | null,
): SharedRouteState {
  if (!routeId || routeId === configurationId) return "ready";
  if (failedRoute === routeId) return "failed";
  return "loading";
}
