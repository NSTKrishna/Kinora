import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Kinora — a studio for generated motion";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * Generated rather than shipped as a file, so the card can never drift out of
 * step with the product name. Drawn here: no borrowed art, no screenshot.
 */
export default async function Image() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        background:
          "radial-gradient(120% 90% at 20% 15%, #fb6d2b55 0%, transparent 60%), radial-gradient(90% 70% at 75% 85%, #8c1f4b88 0%, transparent 65%), linear-gradient(140deg, #0a0a0b 0%, #1b0a14 55%, #241405 100%)",
        padding: 72,
        color: "#f5f1eb",
        fontFamily: "sans-serif",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
        <svg width="64" height="64" viewBox="0 0 24 24">
          <circle
            cx="12"
            cy="12"
            r="10"
            stroke="#f5f1eb"
            strokeWidth="1.5"
            opacity="0.4"
            fill="none"
          />
          <path d="M12 2a10 10 0 0 1 8.66 5L12 12Z" fill="#fb6d2b" />
          <path d="M20.66 17A10 10 0 0 1 3.34 17L12 12Z" fill="#f5f1eb" opacity="0.55" />
        </svg>
        <span style={{ fontSize: 44, fontWeight: 600, letterSpacing: -1 }}>Kinora</span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <span style={{ fontSize: 76, fontWeight: 600, letterSpacing: -2, lineHeight: 1.05 }}>
          A studio for generated motion.
        </span>
        <span style={{ fontSize: 30, color: "#a3a3ad", maxWidth: 860 }}>
          Images, video, one-tap effects and a director&apos;s panel. No account needed.
        </span>
      </div>
    </div>,
    size,
  );
}
