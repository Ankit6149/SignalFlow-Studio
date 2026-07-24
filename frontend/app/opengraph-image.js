import { ImageResponse } from "next/og";

export const alt = "SignalFlow Studio — one product brief becoming a complete review-ready campaign";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          overflow: "hidden",
          background: "#11110f",
          color: "#fffdf8",
          padding: "58px",
          fontFamily: "Arial, sans-serif",
        }}
      >
        <div
          style={{
            position: "absolute",
            width: "580px",
            height: "580px",
            borderRadius: "50%",
            right: "-130px",
            top: "-230px",
            background: "rgba(216,189,124,.16)",
          }}
        />
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            border: "1px solid rgba(255,253,248,.16)",
            borderRadius: "34px",
            padding: "52px",
            background: "rgba(25,25,20,.9)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px", transform: "rotate(-8deg)" }}>
              <span style={{ width: "42px", height: "8px", borderRadius: "99px", background: "#d8bd7c" }} />
              <span style={{ width: "32px", height: "8px", marginLeft: "8px", borderRadius: "99px", background: "#d8bd7c" }} />
              <span style={{ width: "22px", height: "8px", marginLeft: "16px", borderRadius: "99px", background: "#d8bd7c" }} />
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ fontSize: "27px", fontWeight: 700, letterSpacing: "-1px" }}>SignalFlow</span>
              <span style={{ marginTop: "5px", color: "rgba(255,253,248,.46)", fontSize: "11px", letterSpacing: "5px" }}>STUDIO</span>
            </div>
          </div>

          <div style={{ maxWidth: "930px", display: "flex", flexDirection: "column" }}>
            <span style={{ color: "#d8bd7c", fontSize: "20px", fontWeight: 700, letterSpacing: "4px" }}>
              ONE BRIEF · EVERY CHANNEL
            </span>
            <span style={{ marginTop: "22px", fontFamily: "Georgia, serif", fontSize: "72px", lineHeight: .98, letterSpacing: "-4px" }}>
              Turn product context into a campaign people can trust.
            </span>
            <span style={{ marginTop: "28px", maxWidth: "820px", color: "rgba(255,253,248,.6)", fontSize: "24px", lineHeight: 1.45 }}>
              Twelve editable destinations. Review-first publishing. Local templates or your own model.
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
            {["in", "X", "IG", "r/", "YT", "@"].map((mark) => (
              <span
                key={mark}
                style={{
                  width: "50px",
                  height: "50px",
                  border: "1px solid rgba(255,253,248,.16)",
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "rgba(255,253,248,.78)",
                  fontSize: "17px",
                  fontWeight: 700,
                }}
              >
                {mark}
              </span>
            ))}
          </div>
        </div>
      </div>
    ),
    size,
  );
}
