import { site } from "@/content/site";

/**
 * Absolute base URL for metadata, sitemap and robots. Set NEXT_PUBLIC_SITE_URL
 * once the real domain is live; until then Vercel deployments use their own URL
 * so Open Graph images resolve.
 */
export const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : site.url);
