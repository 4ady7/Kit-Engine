import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";
import { kitApiPlugin } from "./server/plugin.ts";

export default defineConfig({
  plugins: [react(), tailwindcss(), kitApiPlugin()],
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "server/**/*.test.ts"],
  },
});

hii 