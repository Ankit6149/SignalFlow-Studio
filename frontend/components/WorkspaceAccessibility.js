"use client";

import { useEffect } from "react";
import {
  buildReviewTabSemantics,
  getAnnouncementSemantics,
  getReviewTabTargetIndex,
  getWorkspaceHeadingId,
} from "../lib/accessibility/workspaceAccessibility.mjs";
import { extractClipboardImageFiles } from "../lib/studio/clientReliability.mjs";

const WIDE_STUDIO_STYLES = `
@media (min-width: 68.01rem) {
  .app-shell .studio-page,
  .app-shell .studio-page[data-stage="source"],
  .app-shell .studio-page[data-stage="destinations"],
  .app-shell .studio-page[data-stage="review"] {
    width: min(112rem, calc(100vw - clamp(2rem, 4vw, 5rem)));
    max-width: none;
  }

  .app-shell .studio-grid:not(.studio-grid--review) {
    grid-template-columns: minmax(0, 1fr);
  }

  .app-shell .studio-grid:not(.studio-grid--review) .output-panel {
    border-left: 0;
  }

  .app-shell .studio-page[data-stage="source"] .composer-panel {
    grid-template-columns: minmax(0, 1.7fr) minmax(22rem, 0.8fr);
    column-gap: clamp(1.75rem, 2.8vw, 3.5rem);
  }

  .app-shell .studio-page[data-stage="destinations"] .output-panel {
    grid-template-columns: minmax(0, 1.75fr) minmax(22rem, 0.72fr);
    gap: 1.75rem clamp(1.75rem, 2.6vw, 3rem);
  }

  .app-shell .studio-page[data-stage="source"] .upload-zone {
    min-height: 8rem;
  }
}

@media (min-width: 88rem) {
  .app-shell .studio-page[data-stage="review"] .review-workspace {
    grid-template-columns: 11rem minmax(0, 1.6fr) minmax(19rem, 0.75fr);
    grid-template-areas:
      "status status status"
      "stale stale stale"
      "tabs nav inspector"
      "tabs editor inspector"
      "tabs editor actions"
      "tabs editor route"
      "tabs notes notes"
      "tabs export export";
    gap: 1rem 1.5rem;
  }

  .app-shell .studio-page[data-stage="review"] .review-tabs,
  .app-shell .studio-page[data-stage="review"] .review-inspector {
    position: sticky;
    top: calc(var(--app-header) + 1.25rem);
    align-self: start;
  }
}

@media (min-width: 96rem) {
  .app-shell .studio-page[data-stage="destinations"] .channel-picker {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
`;

function setAttributeIfChanged(element, name, value) {
  if (!element) return;
  const nextValue = String(value);
  if (element.getAttribute(name) !== nextValue) {
    element.setAttribute(name, nextValue);
  }
}

function getWorkspaceKind(main) {
  if (main.classList.contains("studio-page")) return "studio";
  if (main.classList.contains("settings-page")) return "settings";
  return "secondary";
}

function getTabLabel(button) {
  return button.querySelector("strong")?.textContent?.trim()
    || button.getAttribute("aria-label")?.split(":")[0]?.trim()
    || button.textContent?.trim()
    || "Draft";
}

export default function WorkspaceAccessibility() {
  useEffect(() => {
    let scheduled = false;
    let focusFrame = 0;
    let lastWorkspaceSignature = "";
    const tablistHandlers = new Map();
    const uploadHandlers = new Map();

    function focusWorkspace(main) {
      window.cancelAnimationFrame(focusFrame);
      focusFrame = window.requestAnimationFrame(() => {
        if (!document.contains(main)) return;
        main.focus({ preventScroll: true });
      });
    }

    function dispatchFilesToUpload(input, files) {
      const nextFiles = Array.from(files || []).filter(Boolean);
      if (!input || !nextFiles.length || typeof DataTransfer !== "function") return false;

      const transfer = new DataTransfer();
      nextFiles.forEach((file) => transfer.items.add(file));
      input.files = transfer.files;
      input.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    }

    function handleDocumentPaste(event) {
      const sourceWorkspace = document.querySelector('.studio-page[data-stage="source"]');
      if (!sourceWorkspace || !sourceWorkspace.contains(event.target)) return;

      const images = extractClipboardImageFiles(event.clipboardData);
      if (!images.length) return;

      const input = sourceWorkspace.querySelector('.upload-zone input[type="file"]');
      if (!dispatchFilesToUpload(input, images)) return;
      event.preventDefault();
    }

    function handleUploadDragOver(event) {
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
    }

    function handleUploadDrop(event) {
      event.preventDefault();
      const input = event.currentTarget.querySelector('input[type="file"]');
      dispatchFilesToUpload(input, event.dataTransfer?.files);
    }

    function enhanceWorkspace() {
      const main = document.querySelector("main#workspace-content");
      if (!main) {
        lastWorkspaceSignature = "";
        return;
      }

      const heading = main.querySelector("h1");
      if (!heading) return;
      const kind = getWorkspaceKind(main);
      const headingId = getWorkspaceHeadingId({ kind, heading: heading.textContent });
      if (heading.id !== headingId) heading.id = headingId;
      main.tabIndex = -1;
      setAttributeIfChanged(main, "aria-labelledby", heading.id);

      const signature = [kind, main.dataset.stage || "", heading.textContent?.trim() || ""].join("|");
      if (signature !== lastWorkspaceSignature) {
        lastWorkspaceSignature = signature;
        focusWorkspace(main);
      }
    }

    function enhanceAnnouncements() {
      document.querySelectorAll(".toast").forEach((toast) => {
        const type = toast.classList.contains("toast--error") ? "error" : "information";
        const semantics = getAnnouncementSemantics(type);
        setAttributeIfChanged(toast, "role", semantics.role);
        setAttributeIfChanged(toast, "aria-live", semantics.live);
        setAttributeIfChanged(toast, "aria-atomic", semantics.atomic);
      });
    }

    function enhanceUpload() {
      uploadHandlers.forEach((handlers, element) => {
        if (document.contains(element)) return;
        element.removeEventListener("dragover", handlers.dragover);
        element.removeEventListener("drop", handlers.drop);
        uploadHandlers.delete(element);
      });

      const upload = document.querySelector(".upload-zone[role='button']");
      if (!upload) return;

      const title = upload.querySelector("div strong");
      const description = upload.querySelector("div span");
      const action = upload.querySelector(".text-button");
      if (title && title.textContent !== "Drop, browse, or paste source files") {
        title.textContent = "Drop, browse, or paste source files";
      }
      if (description) {
        const copy = "Paste screenshots with Ctrl+V or ⌘V. Text and code are extracted; images remain visual asset references.";
        if (description.textContent !== copy) description.textContent = copy;
        if (!description.id) description.id = "source-upload-description";
        setAttributeIfChanged(upload, "aria-describedby", description.id);
      }
      if (action && action.textContent?.trim() !== "Browse files") {
        action.textContent = "Browse files";
      }
      setAttributeIfChanged(
        upload,
        "aria-label",
        "Add source files by browsing, dropping files, or pasting screenshots from the clipboard.",
      );

      if (!uploadHandlers.has(upload)) {
        const handlers = {
          dragover: handleUploadDragOver,
          drop: handleUploadDrop,
        };
        upload.addEventListener("dragover", handlers.dragover);
        upload.addEventListener("drop", handlers.drop);
        uploadHandlers.set(upload, handlers);
      }
    }

    function handleTablistKeyDown(event) {
      const tab = event.target.closest("button[role='tab']");
      if (!tab || !event.currentTarget.contains(tab)) return;
      const tabs = Array.from(event.currentTarget.querySelectorAll(":scope > button[role='tab']"));
      const targetIndex = getReviewTabTargetIndex({
        key: event.key,
        currentIndex: tabs.indexOf(tab),
        count: tabs.length,
      });
      if (targetIndex === null) return;

      event.preventDefault();
      const targetId = tabs[targetIndex]?.id;
      tabs[targetIndex]?.click();
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          const target = targetId ? document.getElementById(targetId) : null;
          if (target) target.focus({ preventScroll: true });
        });
      });
    }

    function enhanceReviewTabs() {
      const tablist = document.querySelector(".review-tabs");
      if (!tablist) return;
      const tabs = Array.from(tablist.querySelectorAll(":scope > button"));
      if (!tabs.length) return;

      setAttributeIfChanged(tablist, "role", "tablist");
      setAttributeIfChanged(tablist, "aria-label", "Campaign draft destinations");
      setAttributeIfChanged(tablist, "aria-orientation", "horizontal");

      const activeIndex = Math.max(0, tabs.findIndex((tab) => tab.classList.contains("is-active")));
      const semantics = buildReviewTabSemantics({
        labels: tabs.map(getTabLabel),
        activeIndex,
      });

      tabs.forEach((tab, index) => {
        const tabSemantics = semantics[index];
        tab.id = tabSemantics.id;
        tab.tabIndex = tabSemantics.tabIndex;
        setAttributeIfChanged(tab, "role", "tab");
        setAttributeIfChanged(tab, "aria-selected", tabSemantics.selected);
        setAttributeIfChanged(tab, "aria-controls", tabSemantics.controls);
      });

      const selectedTab = tabs[activeIndex];
      const panel = document.querySelector(".review-workspace .native-preview");
      if (panel && selectedTab) {
        panel.id = "review-draft-panel";
        setAttributeIfChanged(panel, "role", "tabpanel");
        setAttributeIfChanged(panel, "aria-labelledby", selectedTab.id);
        const editor = panel.querySelector("textarea");
        setAttributeIfChanged(editor, "aria-labelledby", selectedTab.id);
      }

      if (!tablistHandlers.has(tablist)) {
        tablist.addEventListener("keydown", handleTablistKeyDown);
        tablistHandlers.set(tablist, handleTablistKeyDown);
      }
    }

    function scan() {
      scheduled = false;
      enhanceWorkspace();
      enhanceAnnouncements();
      enhanceUpload();
      enhanceReviewTabs();
    }

    function scheduleScan() {
      if (scheduled) return;
      scheduled = true;
      window.requestAnimationFrame(scan);
    }

    document.addEventListener("paste", handleDocumentPaste);
    const observer = new MutationObserver(scheduleScan);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class", "data-stage"],
    });
    scan();

    return () => {
      observer.disconnect();
      document.removeEventListener("paste", handleDocumentPaste);
      window.cancelAnimationFrame(focusFrame);
      tablistHandlers.forEach((handler, tablist) => {
        tablist.removeEventListener("keydown", handler);
      });
      tablistHandlers.clear();
      uploadHandlers.forEach((handlers, upload) => {
        upload.removeEventListener("dragover", handlers.dragover);
        upload.removeEventListener("drop", handlers.drop);
      });
      uploadHandlers.clear();
    };
  }, []);

  return <style>{WIDE_STUDIO_STYLES}</style>;
}
