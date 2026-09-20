import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: ["./src/**/*.{ts,tsx,mdx}"],
  theme: {
    container: {
      center: true,
      padding: { DEFAULT: "1rem", lg: "2rem" },
      // Cinema-wide. DESIGN.md: container max 1600px.
      screens: { "2xl": "1600px" },
    },
    extend: {
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: { DEFAULT: "hsl(var(--card))", foreground: "hsl(var(--card-foreground))" },
        popover: { DEFAULT: "hsl(var(--popover))", foreground: "hsl(var(--popover-foreground))" },
        primary: { DEFAULT: "hsl(var(--primary))", foreground: "hsl(var(--primary-foreground))" },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: { DEFAULT: "hsl(var(--muted))", foreground: "hsl(var(--muted-foreground))" },
        accent: { DEFAULT: "hsl(var(--accent))", foreground: "hsl(var(--accent-foreground))" },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
      },
      /**
       * DESIGN.md's four steps: sharp (4px) for buttons, subtle (6px) for links
       * and small containers, comfortable (8px) for containers and image cards,
       * generous (16px) for alert-style panels. Nothing is pill-shaped.
       */
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        panel: "1rem",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      /**
       * Runway's scale, as specified in DESIGN.md.
       *
       * Two rules do the work. Display sizes sit at line-height 1.0 with
       * negative tracking, which reads as a film title rather than a headline.
       * And negative tracking is the default even on body text (-0.16px at
       * 16px ≈ -0.01em), so the whole page runs slightly tighter than normal —
       * that compression is the editorial feel, and losing it loses the look.
       *
       * Micro labels are the exception: uppercase with *positive* tracking, so
       * they read as signposts against everything else.
       */
      fontSize: {
        micro: ["0.6875rem", { lineHeight: "1.3", letterSpacing: "0.032em" }],
        xs: ["0.8125rem", { lineHeight: "1.3", letterSpacing: "-0.016em" }],
        sm: ["0.875rem", { lineHeight: "1.35", letterSpacing: "-0.012em" }],
        base: ["1rem", { lineHeight: "1.45", letterSpacing: "-0.01em" }],
        lg: ["1.25rem", { lineHeight: "1.2", letterSpacing: "-0.012em" }],
        xl: ["1.5rem", { lineHeight: "1.05", letterSpacing: "-0.018em" }],
        "2xl": ["2.25rem", { lineHeight: "1.0", letterSpacing: "-0.025em" }],
        "3xl": ["2.5rem", { lineHeight: "1.0", letterSpacing: "-0.025em" }],
        "4xl": ["3rem", { lineHeight: "1.0", letterSpacing: "-0.025em" }],
        "5xl": ["4rem", { lineHeight: "1.0", letterSpacing: "-0.028em" }],
      },
      fontWeight: {
        // The precision detail: between regular and medium.
        450: "450",
      },
      keyframes: {
        "fade-up": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.5s cubic-bezier(0.22, 1, 0.36, 1) both",
        shimmer: "shimmer 1.8s infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
