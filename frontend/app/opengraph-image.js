import { ImageResponse } from "next/og";

export const alt = "SignalFlow Studio content operating system — built around evidence, judgment, and approval";
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
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px" }}>
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
            <span
              style={{
                border: "1px solid rgba(216,189,124,.38)",
                borderRadius: "999px",
                padding: "10px 16px",
                color: "#d8bd7c",
                fontSize: "13px",
                fontWeight: 700,
                letterSpacing: "2px",
              }}
            >
              CONTENT OS · IN PROGRESS
            </span>
          </div>

          <div style={{ maxWidth: "960px", display: "flex", flexDirection: "column" }}>
            <span style={{ color: "#d8bd7c", fontSize: "20px", fontWeight: 700, letterSpacing: "4px" }}>
              DO THE WORK · KEEP THE CONTEXT
            </span>
            <span style={{ marginTop: "22px", fontFamily: "Georgia, serif", fontSize: "70px", lineHeight: .98, letterSpacing: "-4px" }}>
              Your work should not become a second content job.
            </span>
            <span style={{ marginTop: "28px", maxWidth: "900px", color: "rgba(255,253,248,.62)", fontSize: "23px", lineHeight: 1.45 }}>
              Approval-first content operations. A usable manual Studio today; broader signal, production, publishing, and memory automation as the product direction.
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            {["Signal", "Opportunity", "Story", "Produce", "Judge", "Remember"].map((label) => (
              <span
                key={label}
                style={{
                  border: "1px solid rgba(255,253,248,.14)",
                  borderRadius: "999px",
                  padding: "9px 14px",
                  color: "rgba(255,253,248,.72)",
                  fontSize: "13px",
                  fontWeight: 600,
                }}
              >
                {label}
              </span>
            ))}
          </div>
        </div>
      </div>
    ),
    size,
  );
}
