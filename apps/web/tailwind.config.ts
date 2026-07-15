import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      boxShadow: {
        panel: "0 10px 40px rgba(15, 23, 42, 0.07)"
      }
    }
  },
  plugins: []
} satisfies Config;
