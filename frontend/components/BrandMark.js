import styles from "./BrandMark.module.css";

export default function BrandMark({ compact = false, tone = "light", label = "SignalFlow Studio" }) {
  const dark = tone === "dark";
  return (
    <span
      className={`${styles.mark} ${compact ? styles.compact : ""} ${dark ? styles.dark : styles.light}`}
      aria-label={label}
    >
      <span className={styles.glyph} aria-hidden="true">
        <span />
        <span />
        <span />
      </span>
      <span className={styles.copy}>
        <strong>SignalFlow</strong>
        {!compact && <small>STUDIO</small>}
      </span>
    </span>
  );
}
