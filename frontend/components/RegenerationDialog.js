"use client";

import styles from "./RegenerationDialog.module.css";

export default function RegenerationDialog({
  open,
  editedCount,
  uneditedCount,
  channelCount,
  onClose,
  onRegenerateUnedited,
  onArchiveAndRegenerateAll,
}) {
  if (!open) return null;

  return (
    <div className={styles.backdrop} onMouseDown={onClose}>
      <section
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="regeneration-dialog-title"
        aria-describedby="regeneration-dialog-description"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className={styles.eyebrow}>Protect manual work</div>
        <h2 id="regeneration-dialog-title">Choose how to regenerate.</h2>
        <p id="regeneration-dialog-description">
          {editedCount} destination{editedCount === 1 ? " has" : "s have"} manual edits. SignalFlow will never replace them without a deliberate choice.
        </p>

        <div className={styles.options}>
          <button
            type="button"
            className={styles.option}
            autoFocus
            onClick={onRegenerateUnedited}
            disabled={uneditedCount === 0}
          >
            <strong>Regenerate only unedited destinations</strong>
            <span>
              Keep all {editedCount} edited drafts byte-for-byte unchanged and regenerate {uneditedCount} other destinations.
            </span>
          </button>

          <button
            type="button"
            className={styles.option}
            onClick={onArchiveAndRegenerateAll}
          >
            <strong>Archive edits and regenerate everything</strong>
            <span>
              Save the complete current campaign in Version history, then regenerate all {channelCount} selected destinations.
            </span>
          </button>
        </div>

        <div className={styles.footer}>
          <button type="button" onClick={onClose}>Cancel</button>
        </div>
      </section>
    </div>
  );
}
