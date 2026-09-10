import { NextResponse } from "next/server";
import { getNaturePhoto } from "@/lib/unsplash";

// Server-side proxy so the Unsplash access key never reaches the browser —
// the login page's AuthShell fetches this route client-side instead of
// calling Unsplash directly. Ported from majutaja.com's own webmail fork.
export async function GET() {
  const photo = await getNaturePhoto();
  if (!photo) {
    return NextResponse.json(null);
  }
  return NextResponse.json({
    url: photo.url,
    photographerName: photo.photographerName,
    photographerProfileUrl: photo.photographerProfileUrl,
  });
}
