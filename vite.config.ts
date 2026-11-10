import { defineConfig } from "vite";

// Deux pages : la landing (/) et la carte (/carte/)
export default defineConfig({
  build: {
    rollupOptions: {
      input: { landing: "index.html", carte: "carte/index.html" },
    },
  },
});
