import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#12202b",       // near-black petrol, primary text
        petrol: "#0d4f5c",    // deep teal - Bidvest Noonan brand family
        petrolDark: "#083a44",
        petrolLight: "#e6eef0",
        accent: "#c8a24a",    // brushed brass - "badge/id" accent, not the AI-default terracotta
        surface: "#f5f7f7",
        line: "#dde3e3",
        danger: "#a3352b",
      },
      fontFamily: {
        display: ["var(--font-display)"],
        sans: ["var(--font-sans)"],
        mono: ["var(--font-mono)"],
      },
      borderRadius: {
        sm: "4px",
        md: "6px",
      },
    },
  },
  plugins: [],
};
export default config;
