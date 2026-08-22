import Link from "next/link";
import styles from "./state.module.css";

export default function NotFound() {
  return (
    <main className={styles.statePage}>
      <section className={styles.statePanel}>
        <p className={styles.eyebrow}>404</p>
        <div className={styles.pathMark}>?</div>
        <h1>This route is not in the flow</h1>
        <p>The surface you followed is not part of the current SignalFlow workspace. Return to Today and continue from the decisions that need you.</p>
        <div className={styles.actions}>
          <Link href="/today">Back to Today</Link>
        </div>
      </section>
    </main>
  );
}
