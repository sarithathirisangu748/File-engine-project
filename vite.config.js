import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { apiMiddleware } from "./apiServer.js";

export default defineConfig({
  plugins: [
    react(),
    {
      name: "file-search-engine-api",
      configureServer(server) {
        server.middlewares.use(apiMiddleware);
      },
    },
  ],
});
