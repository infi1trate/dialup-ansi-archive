// When the room's toys come alive. Pure, shared by the room and its tests.
export const TOY_UNLOCK_SECONDS = 180;
export const SITE_SECONDS_KEY = "dialup.site.seconds";
/** Toys stay inert for a first-time caller: live after one finished call, or after three minutes on the site while not on that first call. Degauss is not a toy here: it is always live. */
export function toysLive(o: { calls: number; siteSeconds: number; inCall: boolean }) {
  return o.calls >= 1 || (o.siteSeconds >= TOY_UNLOCK_SECONDS && !o.inCall);
}
export const IN_CALL_STATES = ["dialing", "handshake", "session"];
