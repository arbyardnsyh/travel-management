import { defineConfig } from "astro/config";
import vercel from "@astrojs/vercel";
import tailwind from "@astrojs/tailwind";

export default defineConfig({
  output: "server",

  adapter: vercel(),

  integrations: [
    tailwind({
      applyBaseStyles: false,
    }),
  ],

  security: {
    checkOrigin: true,

    allowedDomains: [
      {
        protocol: "https",
        hostname: "travel-management-ten.vercel.app",
      },
      {
        protocol: "https",
        hostname: "*.vercel.app",
      },
    ],
  },

  server: {
    port: 4321,
  },

  vite: {
    ssr: {
      noExternal: ["bootstrap"],
    },
  },
});