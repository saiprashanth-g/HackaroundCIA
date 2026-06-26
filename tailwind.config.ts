import type { Config } from "tailwindcss";

/**
 * HackaroundCIA design system — premium / editorial, desktop-first.
 * Palette is fixed by the product spec. The only addition is `pending`
 * (status = needs_input), for which the source palette has no hue.
 */
const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#14213D", // primary text
        "navy-mid": "#2D4373", // secondary text
        paper: "#FBF8F2", // page
        card: "#F1EAD9", // card surface
        gold: "#E3B873", // accent — fills/borders only, never body text
        status: {
          urgent: "#E2967C",
          later: "#A8BEE0",
          done: "#A8CBAE",
          // needs_input — added muted neutral (spec palette has none)
          pending: "#8C8576",
        },
      },
      fontFamily: {
        serif: ["var(--font-serif)", "Georgia", "Cambria", "serif"],
        sans: ["var(--font-sans)", "system-ui", "-apple-system", "sans-serif"],
      },
      letterSpacing: {
        tightish: "-0.015em",
      },
      maxWidth: {
        canvas: "1180px",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(16px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.6s cubic-bezier(0.22, 1, 0.36, 1) both",
      },
    },
  },
  plugins: [],
};

export default config;
