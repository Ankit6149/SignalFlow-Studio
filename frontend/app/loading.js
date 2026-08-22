import styles from "./state.module.css";

export default function Loading() {
  return (
    <main className={styles.statePage}>
      <section className={styles.statePanel}>
        <p className={styles.eyebrow}>SignalFlow</p>
        <div className={styles.loader} aria-label="Loading SignalFlow">
          <span />
          <span />
          <span />
        </div>
        <h1>Preparing your workspace</h1>
        <p>Loading your Signals, decisions, planning context, and current workspace state.</p>
      </section>
    </main>
  );
}
