import type { APIRoute } from 'astro';

export const GET: APIRoute = () => {
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><sitemap><loc>https://studytimeronline.com/sitemap-0.xml</loc></sitemap></sitemapindex>`,
    {
      headers: {
        'Content-Type': 'application/xml',
      },
    }
  );
};
