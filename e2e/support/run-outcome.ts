/**
 * The shared project is reused across runs and gets reset every time
 * regardless of whether this run's tests passed or failed — leftover
 * captcha configs, services, organizations, invites, etc. from a failed run
 * are exactly the kind of state that makes the NEXT run flaky, so keeping
 * the project around "to inspect a failure" does more harm than good by
 * default. Set E2E_KEEP_PROJECT=1 to opt out when you deliberately want to
 * inspect post-failure state.
 */
export function shouldDeleteSharedProject(): boolean {
  return process.env.E2E_KEEP_PROJECT !== "1"
}
