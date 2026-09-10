import { getPathPrefix } from "@/lib/browser-navigation";

const UNSPLASH_ACCESS_KEY = process.env.UNSPLASH_ACCESS_KEY;

// Next's default responsive breakpoints (next.config.ts doesn't override
// `images.deviceSizes`/`qualities`) — these are exactly the widths/quality
// the <Image fill sizes="..." /> in AuthShell will request via
// `/_next/image` as visitors' viewports vary. Pre-hitting them here means
// Next's own image-optimizer cache is already warm by the time a real
// visitor asks, instead of the first visitor of each rotation paying the
// Unsplash-origin fetch + resize latency themselves.
const NEXT_IMAGE_DEVICE_SIZES = [640, 750, 828, 1080, 1200, 1920, 2048, 3840];
const NEXT_IMAGE_DEFAULT_QUALITY = 75;

function warmImageOptimizerCache(url: string): void {
  const prefix = getPathPrefix();
  for (const width of NEXT_IMAGE_DEVICE_SIZES) {
    fetch(
      `http://127.0.0.1:${process.env.PORT || "3000"}${prefix}/_next/image?url=${encodeURIComponent(url)}&w=${width}&q=${NEXT_IMAGE_DEFAULT_QUALITY}`
    ).catch(() => {});
  }
}

export type NaturePhoto = {
  url: string;
  width: number;
  height: number;
  blurHash: string | null;
  photographerName: string;
  photographerProfileUrl: string;
  photoPageUrl: string;
};

// Shared across every login-page render (single process) so the whole app
// shows one photo at a time, rotating on this TTL rather than per-visitor.
// Same recipe as majutaja.com's own /signin, /signup pages, ported here for
// the Bulwark login page's majutaja-brand shell.
let cached: { photo: NaturePhoto; fetchedAt: number } | null = null;
const CACHE_TTL_MS = 60 * 60 * 1000; // hourly rotation

// Dedupe concurrent callers during a cache miss/expiry into one Unsplash
// call instead of one per in-flight request.
let inFlight: Promise<void> | null = null;

async function refreshCache(): Promise<void> {
  if (!UNSPLASH_ACCESS_KEY) return;

  try {
    const res = await fetch(
      // Same three curated collections majutaja.com's own login pages use,
      // for a consistent brand look:
      //   1499877  "Landscape-Nature" — calm landscapes
      //   zc6Lgu23wc8  "Travel Landscape"
      //   LYsufXSpz_4  "Lifestyle"
      "https://api.unsplash.com/photos/random?collections=1499877,zc6Lgu23wc8,LYsufXSpz_4&orientation=landscape&content_filter=high",
      {
        headers: { Authorization: `Client-ID ${UNSPLASH_ACCESS_KEY}` },
        cache: "no-store",
      }
    );
    if (!res.ok) return;
    const data = await res.json();

    const photo: NaturePhoto = {
      url: `${data.urls.raw}&crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1920`,
      width: data.width,
      height: data.height,
      blurHash: data.blur_hash ?? null,
      photographerName: data.user.name,
      photographerProfileUrl: data.user.links.html,
      photoPageUrl: data.links.html,
    };

    // Unsplash API guidelines: a "download" trigger is required whenever a
    // photo is used as more than a simple hotlinked view (e.g. as a
    // background) — fired once per new photo, not per page render.
    const downloadLocation: string | undefined = data.links.download_location;
    if (downloadLocation) {
      fetch(`${downloadLocation}?client_id=${UNSPLASH_ACCESS_KEY}`).catch(
        () => {}
      );
    }

    cached = { photo, fetchedAt: Date.now() };
    warmImageOptimizerCache(photo.url);
  } catch {
    // Keep serving whatever's already cached (or null) on failure.
  }
}

async function ensureFresh(): Promise<void> {
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) return;
  if (!inFlight) {
    inFlight = refreshCache().finally(() => {
      inFlight = null;
    });
  }
  await inFlight;
}

export async function getNaturePhoto(): Promise<NaturePhoto | null> {
  await ensureFresh();
  return cached?.photo ?? null;
}

let warming = false;

// Called once from instrumentation.node.ts on server boot: fetches
// immediately, so the first real visitor after a deploy/restart never pays
// the Unsplash round-trip, then keeps refreshing proactively on the TTL so
// the same is true of every hourly rotation, not just the boot case. Same
// pattern as majutaja.com's own /signin, /signup pages. A no-op (besides the
// interval) when UNSPLASH_ACCESS_KEY isn't configured — the login page's
// photo panel just falls back to a plain brand-gradient background.
export async function warmNaturePhotoCache(): Promise<void> {
  if (warming) return;
  warming = true;
  await ensureFresh();
  setInterval(() => {
    ensureFresh();
  }, CACHE_TTL_MS);
}
