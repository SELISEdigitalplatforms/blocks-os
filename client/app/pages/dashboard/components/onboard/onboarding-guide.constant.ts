/**
 * The onboarding brief handed to a coding agent, still carrying its
 * `{{PLACEHOLDER}}` tokens - `resolveOnboardingGuide` fills them in from the
 * selected project.
 *
 * Held as a plain string constant rather than a raw file import, so it travels
 * with the module graph and needs nothing bundler-specific. Backticks and
 * backslashes are escaped for the template literal; the text itself is ordinary
 * markdown.
 */
export const ONBOARDING_GUIDE_TEMPLATE = `Read https://raw.githubusercontent.com/SELISEdigitalplatforms/blocks-skills/main/BOOTSTRAP.md and follow it to bootstrap this repo, then get me set up on project {{X_BLOCKS_KEY}} and show me what's already there.`;
