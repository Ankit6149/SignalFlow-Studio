"use client";

import { useEffect, useMemo, useState } from "react";
import { createBrowserExactMediaPreviewAdapter } from "../lib/infrastructure/browserExactMediaPreviewAdapter.mjs";
import styles from "./ExactMediaRevisionPreview.module.css";

const LOCAL_WORKSPACE_ID = "local-personal";
const EMPTY_MEDIA_BINDINGS = Object.freeze([]);

function shortId(value) {
  const text = String(value || "");
  return text.length > 18 ? `…${text.slice(-16)}` : text;
}

export default function ExactMediaRevisionPreview({ mediaBindings = EMPTY_MEDIA_BINDINGS, onPreviewState = null }) {
  const [state, setState] = useState({ status: mediaBindings.length ? "loading" : "not_required", items: [], message: "" });
  const adapter = useMemo(() => createBrowserExactMediaPreviewAdapter({
    getStorage: () => window.localStorage,
    workspaceId: LOCAL_WORKSPACE_ID,
  }), []);

  useEffect(() => {
    let active = true;
    const urls = [];
    async function load() {
      if (!mediaBindings.length) {
        if (active) {
          setState({ status: "not_required", items: [], message: "" });
          onPreviewState?.({ required: false, ready: true, status: "not_required" });
        }
        return;
      }
      setState({ status: "loading", items: [], message: "" });
      onPreviewState?.({ required: true, ready: false, status: "loading" });
      try {
        const items = [];
        for (const binding of mediaBindings) {
          const resolved = await adapter.readExact({ assetId: binding.assetId, assetVersionId: binding.assetVersionId });
          const url = URL.createObjectURL(new Blob([resolved.bytes], { type: resolved.mimeType }));
          urls.push(url);
          items.push({ binding, asset: resolved.asset, url });
        }
        if (!active) return;
        setState({ status: "ready", items, message: "" });
        onPreviewState?.({ required: true, ready: true, status: "ready" });
      } catch (error) {
        if (!active) return;
        setState({
          status: "unavailable",
          items: [],
          message: error?.message || "The exact bound media cannot be previewed in this runtime.",
        });
        onPreviewState?.({ required: true, ready: false, status: "unavailable", code: error?.code || "preview_unavailable" });
      }
    }
    void load();
    return () => {
      active = false;
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [adapter, mediaBindings, onPreviewState]);

  if (!mediaBindings.length) return null;

  if (state.status === "loading") {
    return (
      <section className={styles.frame} aria-label="Exact media revision" aria-busy="true">
        <div className={styles.heading}><span>EXACT MEDIA · LOADING</span><p>Resolving the immutable AssetVersion bound to this revision.</p></div>
      </section>
    );
  }

  if (state.status === "unavailable") {
    return (
      <section className={`${styles.frame} ${styles.blocked}`} aria-label="Exact media revision">
        <div className={styles.heading}>
          <span>EXACT MEDIA · PREVIEW REQUIRED</span>
          <strong>Approval is blocked until this exact AssetVersion can be shown.</strong>
          <p>{state.message}</p>
        </div>
        <div className={styles.bindingList}>
          {mediaBindings.map((binding) => (
            <div key={`${binding.role}-${binding.assetVersionId}`}>
              <span>{binding.role.replace(/_/g, " ")}</span>
              <code>{shortId(binding.assetVersionId)}</code>
            </div>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className={styles.frame} aria-label="Exact media revision">
      <div className={styles.heading}>
        <span>EXACT MEDIA · VERIFIED PREVIEW</span>
        <strong>This is the visual attached to the revision you are judging.</strong>
        <p>Changing this visual creates a new immutable revision; it cannot silently inherit this revision&apos;s approval.</p>
      </div>
      <div className={styles.previewGrid}>
        {state.items.map(({ binding, asset, url }) => (
          <figure key={`${binding.role}-${binding.assetVersionId}`} className={styles.previewItem}>
            <img src={url} alt={asset.userMetadata?.altText || asset.originalName || "Exact review media"} />
            <figcaption>
              <div><span>{binding.role.replace(/_/g, " ")}</span><strong>{asset.originalName}</strong></div>
              <dl>
                <div><dt>AssetVersion</dt><dd>{shortId(binding.assetVersionId)}</dd></div>
                {binding.imageDerivativeVariantId && <div><dt>Derivative</dt><dd>{shortId(binding.imageDerivativeVariantId)}</dd></div>}
              </dl>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}
