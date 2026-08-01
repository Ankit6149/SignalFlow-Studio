export const CAPTURE_PROVIDERS = {
  manual: {
    id: "manual",
    label: "Manual Upload",
    description: "Upload your own screenshots, screen recordings, logos, or documents.",
    requiresBrowserMedia: false,
    requiresServerSide: false
  },
  browser: {
    id: "browser",
    label: "Browser Screen Recorder",
    description: "Capture your screen or window directly using navigator.mediaDevices.",
    requiresBrowserMedia: true,
    requiresServerSide: false
  }
};
