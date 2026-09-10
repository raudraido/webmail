"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useShallow } from "zustand/react/shallow";
import { Sun, Moon, Monitor, Check } from "lucide-react";
import { apiFetch, withBasePath } from "@/lib/browser-navigation";
import { useThemeStore } from "@/stores/theme-store";
import { useMenuNavigation } from "@/hooks/use-menu-navigation";
import { cn } from "@/lib/utils";
import { LanguageSwitcher } from "@/components/ui/language-switcher";

type AuthPhoto = {
  url: string;
  photographerName: string;
  photographerProfileUrl: string;
};

type Theme = "light" | "dark" | "system";

const THEME_OPTIONS: { value: Theme; icon: typeof Sun }[] = [
  { value: "light", icon: Sun },
  { value: "dark", icon: Moon },
  { value: "system", icon: Monitor },
];

// Icon-only theme toggle, bottom-left corner of the form column. Trigger
// deliberately carries no text label (unlike the old top-right version this
// replaces) - the corner is small and shared with nothing else, so the icon
// alone is enough; the opened dropdown still spells out each option since
// three similar-looking icons aren't self-explanatory on their own.
function ThemeToggle() {
  const t = useTranslations("settings.appearance.theme");
  const { theme, setTheme } = useThemeStore(
    useShallow((s) => ({ theme: s.theme, setTheme: s.setTheme }))
  );
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const close = useCallback(() => setOpen(false), []);
  const { menuRef: listRef, onKeyDown } = useMenuNavigation<HTMLDivElement>({
    open,
    onClose: close,
    triggerRef: buttonRef,
  });

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const current = THEME_OPTIONS.find((o) => o.value === theme) ?? THEME_OPTIONS[2];
  const CurrentIcon = current.icon;

  const handleSelect = (value: Theme) => {
    setTheme(value);
    setOpen(false);
  };

  return (
    <div className="absolute bottom-4 left-4 sm:left-6" ref={containerRef}>
      <button
        type="button"
        ref={buttonRef}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex items-center justify-center w-9 h-9 rounded-xl border transition-all duration-200",
          open
            ? "bg-secondary border-border text-foreground shadow-md"
            : "bg-background/60 backdrop-blur-sm border-border/50 text-muted-foreground hover:text-foreground hover:bg-secondary/80 hover:border-border"
        )}
        aria-label={`Theme: ${t(current.value)}`}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <CurrentIcon className="w-4 h-4" />
      </button>

      {open && (
        <div
          ref={listRef}
          onKeyDown={onKeyDown}
          // Opens upward (bottom-full, not top-full) - this trigger sits at
          // the bottom of the column, so a downward menu would spill off the
          // viewport instead of overlapping the form above it.
          className="absolute left-0 bottom-full mb-2 w-40 rounded-xl border border-border bg-background shadow-lg overflow-hidden animate-fade-in z-50"
          role="menu"
          aria-label="Theme selection"
        >
          {THEME_OPTIONS.map((option) => {
            const Icon = option.icon;
            const isActive = theme === option.value;
            return (
              <button
                key={option.value}
                type="button"
                role="menuitemradio"
                aria-checked={isActive}
                onClick={() => handleSelect(option.value)}
                className={cn(
                  "w-full flex items-center gap-3 px-3.5 py-2.5 text-sm transition-colors",
                  isActive
                    ? "bg-primary/10 text-foreground font-medium"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Icon className="w-4 h-4" />
                <span className="flex-1 text-start">{t(option.value)}</span>
                {isActive && <Check className="w-3.5 h-3.5 text-primary" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Reproduces majutaja.com's own auth-page chrome (the fork's previous
// in-house login screen): a fixed logo header, a fixed-width form panel next
// to a rotating Unsplash photo that grows/shrinks with the viewport, and a
// blurred brand-accent circle behind the form. Wraps every branch the login
// page can render (loading, config-error, no-server-url, demo-only, the full
// form) so the brand shell is present the whole time, not just once the form
// has mounted - callers just pass their existing branch content as children,
// nothing about that content's own logic changes here.
export function AuthShell({ children }: { children: React.ReactNode }) {
  const [photo, setPhoto] = useState<AuthPhoto | null>(null);
  const resolvedTheme = useThemeStore((s) => s.resolvedTheme);

  useEffect(() => {
    let cancelled = false;
    apiFetch("/api/auth-background")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: AuthPhoto | null) => {
        if (!cancelled && data) setPhoto(data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      {/* pointer-events-none: this header has no interactive content of its
          own directly - just a logo mark + wordmark and (below) the language
          switcher, which opts itself back into pointer-events - but as a
          full-width absolutely positioned element with an explicit z-index
          it forms a stacking context that paints, and hit-tests, above
          everything in the form column below it. Without this, clicks on
          anything in that same top band (previously the theme toggle, now
          the language switcher) would silently land on this header's empty
          space instead. */}
      {/* w-full lg:w-[410px]: matches the form column's own responsive width
          below exactly (that div's class is literally "relative w-full
          lg:w-[410px] lg:shrink-0"). This header has no positioned ancestor
          of its own (the root wrapper above is position:static), so its
          "absolute" resolves against the viewport - without capping its
          width here too, it would span the full page instead of just the
          column, and a right-aligned control inside it (the language
          switcher below) would land at the screen's right edge, over the
          photo pane, instead of the column's own top-right corner.
          Confirmed via a live boundingClientRect check before this fix:
          header was 1400px wide against a 410px column. */}
      <header className="absolute z-30 w-full lg:w-[410px] pointer-events-none">
        <div className="px-4 sm:px-6">
          <div className="flex h-16 items-center gap-2 md:h-20" suppressHydrationWarning>
            <img
              src={withBasePath(
                resolvedTheme === "dark"
                  ? "/branding/majutaja-icon-dark.svg"
                  : "/branding/majutaja-icon.svg"
              )}
              alt=""
              aria-hidden="true"
              className="h-7 w-7 md:h-8 md:w-8"
            />
            <span className="font-semibold text-lg md:text-xl text-gray-900 dark:text-white">
              majutaja
              <span className="text-[var(--brand-700)] dark:text-[var(--brand-300)]">.com</span>
            </span>
            {/* pointer-events-auto: the header itself is pointer-events-none
                (see comment above), so this - the only interactive thing in
                it - needs its own opt back in, or it renders but can't be
                clicked, same failure mode the old top-right theme toggle had
                before it moved out of this header entirely. */}
            <div className="ms-auto pointer-events-auto">
              <LanguageSwitcher />
            </div>
          </div>
        </div>
      </header>

      <main className="relative flex grow">
        <div
          className="pointer-events-none absolute bottom-0 left-0 -translate-x-1/3"
          aria-hidden="true"
        >
          <div className="h-80 w-80 rounded-full bg-gradient-to-tr from-[var(--brand-500)] opacity-40 blur-[160px]" />
        </div>

        <div className="relative w-full lg:w-[410px] lg:shrink-0">
          <div className="flex h-full flex-col justify-center before:min-h-[4rem] before:flex-1 after:flex-1 md:before:min-h-[5rem]">
            <div className="px-4 sm:px-6">
              <div className="mx-auto w-full max-w-sm">
                <div className="py-16 md:py-20">{children}</div>
              </div>
            </div>
          </div>
          <div className="absolute inset-x-0 bottom-4 text-center text-xs text-gray-400 dark:text-gray-500">
            © {new Date().getFullYear()} – majutaja.com™
          </div>
          {/* Mirrors the copyright line above (same bottom-4 offset within
              this same relative column) but corner-anchored to the left
              instead of centered, so it doesn't collide with that centered
              text. This column has no pointer-events restriction (unlike the
              header above), so no extra opt-in is needed here. */}
          <ThemeToggle />
        </div>

        <div className="relative hidden lg:block lg:min-w-0 lg:flex-1">
          {photo ? (
            <>
              <Image
                src={photo.url}
                alt=""
                fill
                sizes="(min-width: 1024px) calc(100vw - 410px), 0px"
                className="-z-10 object-cover"
                priority
              />
              <div
                className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/50 to-transparent"
                aria-hidden="true"
              />
              <div className="absolute bottom-4 right-4 text-xs text-white/80">
                Foto:{" "}
                <a
                  href={`${photo.photographerProfileUrl}?utm_source=majutaja_webmail&utm_medium=referral`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-white"
                >
                  {photo.photographerName}
                </a>{" "}
                /{" "}
                <a
                  href="https://unsplash.com/?utm_source=majutaja_webmail&utm_medium=referral"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-white"
                >
                  Unsplash
                </a>
              </div>
            </>
          ) : (
            <div
              className="absolute inset-0 bg-gradient-to-br from-[var(--brand-100)] to-[var(--brand-300)]"
              aria-hidden="true"
            />
          )}
        </div>
      </main>
    </div>
  );
}
