import { defineConfig } from "vite";

export default defineConfig(({ mode }) => ({
  base: mode === "github-pages" ? "/tests/" : "/",
  server: {
    host: "0.0.0.0",
  },
}));
