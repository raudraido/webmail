"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { apiFetch, withBasePath } from "@/lib/browser-navigation";
import { useThemeStore } from "@/stores/theme-store";

type AuthPhoto = {
  url: string;
  photographerName: string;
  photographerProfileUrl: string;
};

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
      <header className="absolute z-30 w-full">
        <div className="px-4 sm:px-6">
          <div className="flex h-16 items-center md:h-20">
            <img
              src={withBasePath(
                resolvedTheme === "dark"
                  ? "/branding/majutaja-logo-horizontal-dark.png"
                  : "/branding/majutaja-logo-horizontal.svg"
              )}
              alt="majutaja.com"
              className="h-7 w-auto md:h-8"
              suppressHydrationWarning
            />
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
