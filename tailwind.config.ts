import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#F5F6F8",
        surface: "#FFFFFF",
        ink: "#101C2C",
        muted: "#64707D",
        border: "#E1E4E9",
        navy: {
          DEFAULT: "#16324F",
          dark: "#0E2036",
        },
        teal: {
          DEFAULT: "#0E7C86",
          light: "#E3F2F1",
        },
        amber: {
          DEFAULT: "#B4630A",
          light: "#FBEDE0",
        },
      },
      fontFamily: {
        sans: [
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
        display: ["Georgia", "Cambria", "Times New Roman", "serif"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(16, 28, 44, 0.04), 0 1px 12px rgba(16, 28, 44, 0.04)",
      },
    },
  },
  plugins: [],
};

export default config;
