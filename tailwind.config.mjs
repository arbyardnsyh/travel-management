import forms from '@tailwindcss/forms';

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  // We use Tailwind only for the /admin dashboard utility needs and a few
  // helper utilities on the public site. Both templates keep their original
  // Bootstrap-based design system, so Tailwind's preflight (base reset) is
  // disabled in astro.config.mjs to avoid clobbering Bootstrap styles.
  important: false,
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#0d6efd',
          dark: '#0a58ca',
        },
      },
    },
  },
  plugins: [forms],
};
