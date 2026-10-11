import styles from "./state.module.css";

export default function Loading() {
  return (
    <main className={styles.loadingPage}>
      <section
        className={styles.loadingShell}
        role="status"
        aria-live="polite"
        aria-busy="true"
        aria-label="Preparing SignalFlow workspace"
      >
        <div className={styles.loadingBrand} aria-hidden="true">
          <span className={styles.loadingMark}>
            <span />
            <span />
            <span />
          </span>
          <span>SignalFlow</span>
        </div>

        <div className={styles.loadingCopy}>
          <p className={styles.loadingEyebrow}>Preparing workspace</p>
          <h1>Bringing your signal into focus.</h1>
          <p>
            Restoring the latest opportunities, decisions, and planning context so you can continue where you left off.
          </p>
        </div>

        <div className={styles.loadingProgress} aria-hidden="true">
          <div className={styles.loadingTrack}>
            <span />
          </div>
          <div className={styles.loadingMeta}>
            <span>Synchronising workspace</span>
            <span className={styles.loadingPulse} />
          </div>
        </div>
      </section>
    </main>
  );
}
