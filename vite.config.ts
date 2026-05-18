import { defineConfig } from "vite-plus";
import { devtools } from "@tanstack/devtools-vite";

import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import netlify from "@netlify/vite-plugin-tanstack-start";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { nitro } from "nitro/vite";

const isTest = process.env["VITEST"] === "true";

const config = defineConfig({
  staged: {
    "*": "vp check --fix",
  },
  server: {
    host: true,
  },
  lint: { options: { typeAware: true, typeCheck: true } },
  resolve: { tsconfigPaths: true },
  plugins: [
    devtools(),
    ...(!isTest ? [nitro({ rollupConfig: { external: [/^@sentry\//] } })] : []),
    tailwindcss(),
    ...(!isTest ? [tanstackStart()] : []),
    viteReact(),
    netlify(),
  ],
});

export default config;
