"use client";

import { sourceFilePresentation } from "../lib/studio/sourcePresentation.mjs";
import styles from "./SourceStage.module.css";

export default function SourceStage({
  hidden,
  form,
  onUpdateForm,
  fileInputRef,
  onFiles,
  files,
  sourceArtifactSummary,
  onRemoveFile,
}) {
  return (
    <section
      className={`${styles.root} panel composer-panel ${hidden ? "is-step-hidden" : ""}`}
      id="campaign-source"
    >
      <div className="panel-kicker">
        <span>01</span> Campaign brief
      </div>

      <label className="field">
        <span>Campaign name</span>
        <input
          value={form.projectName}
          onChange={(event) => onUpdateForm("projectName", event.target.value)}
          placeholder="e.g. SignalFlow public beta"
        />
      </label>

      <label className="field field--large">
        <span>What happened, and why should anyone care?</span>
        <textarea
          value={form.notes}
          onChange={(event) => onUpdateForm("notes", event.target.value)}
          placeholder="Paste the messy version: what you built, the problem, proof, launch details, quotes, numbers, and the action you want people to take."
        />
        <small>{form.notes.length.toLocaleString()} characters</small>
      </label>

      <div className="source-grid">
        <label className="field">
          <span>Links to extract</span>
          <textarea
            className="compact-textarea"
            value={form.links}
            onChange={(event) => onUpdateForm("links", event.target.value)}
            placeholder="Docs, landing page, research links…"
          />
        </label>
        <label className="field">
          <span>GitHub repository</span>
          <input
            value={form.repo}
            onChange={(event) => onUpdateForm("repo", event.target.value)}
            placeholder="https://github.com/owner/repo"
          />
        </label>
      </div>

      <div
        className="upload-zone"
        onClick={() => fileInputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            fileInputRef.current?.click();
          }
        }}
      >
        <input ref={fileInputRef} type="file" multiple hidden onChange={onFiles} />
        <div className="upload-zone__icon">＋</div>
        <div>
          <strong>Add source files</strong>
          <span>Text and code are extracted; images stay honest asset references.</span>
        </div>
        <span className="text-button" aria-hidden="true">
          Browse
        </span>
      </div>

      {files.length > 0 && (
        <>
          <div className="file-list" aria-label="Canonical campaign sources">
            {files.map((file, index) => {
              const sourceState = sourceFilePresentation(file);
              return (
                <div
                  key={file.sourceArtifact?.sourceArtifactId || `${file.name}-${index}`}
                  className="file-chip file-chip--canonical"
                >
                  <span className="file-chip__identity">
                    <span>{file.name}</span>
                    <small title={sourceState.versionId}>
                      {sourceState.evidenceLabel} · {Math.max(1, Math.round(file.size / 1024))} KB
                    </small>
                  </span>
                  <span
                    className={`source-state-badge is-${sourceState.state}`}
                    title={sourceState.description}
                  >
                    {sourceState.label}
                  </span>
                  <button
                    aria-label={`Remove ${file.name}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      onRemoveFile(index);
                    }}
                  >
                    ×
                  </button>
                </div>
              );
            })}
          </div>
          <div className="source-contract-summary" role="status" aria-live="polite">
            <strong>Source contract v1</strong>
            <span>{sourceArtifactSummary.usable_evidence || 0} usable</span>
            <i />
            <span>{sourceArtifactSummary.reference_only || 0} reference only</span>
            {(sourceArtifactSummary.processing || 0) > 0 && (
              <>
                <i />
                <span>{sourceArtifactSummary.processing} processing</span>
              </>
            )}
            {(sourceArtifactSummary.failed || 0) > 0 && (
              <>
                <i />
                <span>{sourceArtifactSummary.failed} failed</span>
              </>
            )}
          </div>
        </>
      )}
    </section>
  );
}
