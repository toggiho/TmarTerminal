/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: {
          base: "#070B14",
          surface: "#0D1526",
          elevated: "#111A2E",
          hover: "#182038",
        },
        accent: {
          purple: "#7C3AED",
          cyan: "#06B6D4",
          "purple-light": "#9F67FF",
          "cyan-light": "#22D3EE",
        },
        text: {
          primary: "#E6EDF3",
          secondary: "#8B949E",
          muted: "#484F58",
        },
        border: "rgba(139, 148, 158, 0.12)",
        success: "#3FB950",
        error: "#FF7B72",
        warning: "#D29922",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      backgroundImage: {
        "accent-gradient": "linear-gradient(135deg, #7C3AED, #06B6D4)",
        "surface-gradient": "linear-gradient(180deg, #0D1526 0%, #070B14 100%)",
      },
      boxShadow: {
        glow: "0 0 20px rgba(124, 58, 237, 0.3)",
        "glow-cyan": "0 0 20px rgba(6, 182, 212, 0.2)",
        panel: "0 8px 32px rgba(0,0,0,0.4)",
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "fade-in": "fadeIn 0.2s ease-out",
        "slide-up": "slideUp 0.25s ease-out",
      },
      keyframes: {
        fadeIn: { from: { opacity: "0" }, to: { opacity: "1" } },
        slideUp: {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
};
