import styles from "./BrandMark.module.css";

export default function BrandMark({ compact = false, tone = "light", label = "SignalFlow Studio" }) {
  const dark = tone === "dark";
  return (
    <span
      className={`${styles.mark} ${compact ? styles.compact : ""} ${dark ? styles.dark : styles.light}`}
      aria-label={label}
    >
      <img className={styles.glyph} src="/icon.svg" alt="" aria-hidden="true" />
      <span className={styles.copy}>
        <strong>SignalFlow</strong>
        {!compact && <small>STUDIO</small>}
      </span>
    </span>
  );
}
