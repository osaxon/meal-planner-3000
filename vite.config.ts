import { defineConfig } from "vite-plus";
import { devtools } from "@tanstack/devtools-vite";

import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
const isTest = process.env["VITEST"] === "true";

const config = defineConfig({
  staged: {
    "*": "vp check --fix",
  },
  server: {
    host: true,
  },
  ssr: {},
  lint: { options: { typeAware: true, typeCheck: true } },
  plugins: [devtools(), tailwindcss(), ...(!isTest ? [tanstackStart()] : []), viteReact()],
});

export default config;
