// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';
import cloudflare from '@astrojs/cloudflare';

// https://astro.build/config
export default defineConfig({
  site: 'https://studytimeronline.com',
  adapter: cloudflare(),
  // /study-stats only shows this device's data, so it's noindex and left out of the sitemap.
  integrations: [sitemap({ filter: (page) => !page.includes('/study-stats') })],
  vite: {
    plugins: [tailwindcss()],
  },
});