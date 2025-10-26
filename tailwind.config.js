// tailwind.config.js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{ts,tsx,js,jsx}",
    "./pages/**/*.{ts,tsx,js,jsx}",
    "./components/**/*.{ts,tsx,js,jsx}",
    "./src/**/*.{html,js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        // Primary deep indigo family (rich, professional)
        primary: {
          50:  "#eef2ff",
          100: "#e0e7ff",
          200: "#c7d2fe",
          300: "#a5b4fc",
          400: "#818cf8",
          500: "#6366f1", // tailwind indigo-500
          600: "#4f46e5",
          700: "#4338ca",
          800: "#3730a3",
          900: "#231c4b"  // deep
        },
        // Warm accent (amber/gold) for CTA & highlights
        accent: {
          50:  "#fff8ed",
          100: "#fff1d6",
          200: "#ffe3a8",
          300: "#ffd67a",
          400: "#ffc84d",
          500: "#f59e0b", // amber-500-like
          600: "#d97706",
          700: "#b45309",
          800: "#92400e",
          900: "#78350f"
        },
        // Rich neutrals for text, cards and subtle UI
        rich: {
          50:  "#f8fafc",
          100: "#f1f5f9",
          200: "#e2e8f0",
          300: "#cbd5e1",
          400: "#94a3b8",
          500: "#64748b",
          600: "#475569",
          700: "#334155",
          800: "#1f2937",
          900: "#0b1220"
        },
        // Surface/background tokens
        surface: {
          DEFAULT: "#ffffff",
          muted: "#f8fafc",
          elevated: "#ffffff"
        }
      },
      boxShadow: {
        "soft-lg": "0 10px 30px rgba(15, 23, 42, 0.08)",
        "float-md": "0 12px 30px rgba(2, 6, 23, 0.12)"
      },
      ringColor: {
        brand: "#6366f1"
      }
    }
  },
  plugins: []
};
