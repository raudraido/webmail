import { defineRouting } from 'next-intl/routing';

// Locale prefix mode can be configured via NEXT_PUBLIC_LOCALE_PREFIX.
// - "never"    (default): /settings - locale from cookie/Accept-Language
// - "always":             /en/settings - locale always in the URL
// - "as-needed":          /settings for default locale, /fr/settings otherwise
// When proxying Bulwark under a sub-path (NEXT_PUBLIC_BASE_PATH), "always" is
// recommended to avoid next-intl rewrite loops caused by locale detection
// conflicting with the proxy's path rewriting.
const localePrefix = (process.env.NEXT_PUBLIC_LOCALE_PREFIX ?? 'never') as
  | 'never'
  | 'always'
  | 'as-needed';

const SUPPORTED_LOCALES = ['ar', 'ca', 'cs', 'da', 'de', 'en', 'es', 'et', 'fa', 'fr', 'he', 'hu', 'it', 'ja', 'ko', 'lv', 'mn', 'nb', 'nl', 'pl', 'pt', 'ro', 'ru', 'sk', 'tr', 'uk', 'zh', 'zh-TW'] as const;

// Locale a visitor gets with no URL locale prefix and no NEXT_LOCALE cookie
// yet - i.e. the locale next-intl's middleware renders by default. Admins set
// this via NEXT_PUBLIC_DEFAULT_LOCALE at build time to localise greenfield
// deployments without having every user change their preference manually.
const envDefaultLocale = process.env.NEXT_PUBLIC_DEFAULT_LOCALE?.trim();
const resolvedDefaultLocale =
  envDefaultLocale && (SUPPORTED_LOCALES as readonly string[]).includes(envDefaultLocale)
    ? (envDefaultLocale as (typeof SUPPORTED_LOCALES)[number])
    : 'en';

export const routing = defineRouting({
  locales: SUPPORTED_LOCALES,
  defaultLocale: resolvedDefaultLocale,
  localePrefix,
  // Without this, next-intl's middleware negotiates the initial locale from
  // the visitor's Accept-Language header (and remembers that via its own
  // NEXT_LOCALE cookie) whenever there's no locale in the URL - meaning
  // NEXT_PUBLIC_DEFAULT_LOCALE above only ever won when Accept-Language
  // matched nothing at all, not the deterministic default the setting's name
  // implies. Confirmed live: an en-GB browser saw English instead of the
  // configured Estonian default. `localeDetection: false` disables both the
  // Accept-Language negotiation and its cookie, so defaultLocale always wins
  // for a visitor with no explicit choice - matching the same fix the old
  // in-house fork (root-fr/jmap-webmail) shipped for the same requirement
  // ("Eesti alati esimesena, sõltumata brauseri keelest"). A locale in the
  // URL (when NEXT_PUBLIC_LOCALE_PREFIX allows one) and this app's own
  // client-side language switcher (stores/locale-store.ts, independent of
  // next-intl's cookie) are unaffected - this only removes the automatic
  // guess for a visitor who hasn't chosen anything yet.
  localeDetection: false
});

export const locales = routing.locales;
export const defaultLocale = routing.defaultLocale;
export type Locale = (typeof locales)[number];
