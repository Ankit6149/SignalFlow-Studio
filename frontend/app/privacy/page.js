export const metadata = {
  title: "Privacy",
  description: "How SignalFlow Studio handles campaign data, model keys, uploaded text, and social connector sessions.",
  alternates: { canonical: "/privacy" },
};

function LegalBrand() {
  return (
    <span className="brand-mark brand-mark--dark brand-mark--compact" aria-label="SignalFlow Studio">
      <span className="brand-mark__glyph" aria-hidden="true"><span /><span /><span /></span>
      <span className="brand-mark__copy"><strong>SignalFlow</strong></span>
    </span>
  );
}

export default function PrivacyPage() {
  return (
    <main className="legal-shell">
      <header className="legal-nav">
        <a href="/"><LegalBrand /></a>
        <a href="/">Back to SignalFlow</a>
      </header>
      <article className="legal-content">
        <p className="eyebrow eyebrow--dark"><span /> Product policy</p>
        <h1>Privacy</h1>
        <p>Effective July 24, 2026</p>

        <section>
          <h2>Plain-language summary</h2>
          <p>
            SignalFlow Studio is designed around reviewable, browser-local campaign work. Saved campaigns are
            stored in the browser you are using. The hosted application processes the information needed to
            generate a campaign, but it does not silently publish content or sell personal data.
          </p>
        </section>

        <section>
          <h2>Information you choose to provide</h2>
          <p>
            A campaign may include product notes, audience information, public URLs, a public GitHub repository
            reference, uploaded text or code files, media-file metadata, model settings, and the channel drafts
            you edit. Do not submit secrets, private credentials, or information you are not authorized to use.
          </p>
        </section>

        <section>
          <h2>Browser-local campaign storage</h2>
          <p>
            When you save a campaign to the local library, the campaign package is stored in this browser using
            local storage. Clearing browser data, using another browser, or using another device can make that
            local library unavailable. Export important campaigns before clearing local data.
          </p>
        </section>

        <section>
          <h2>Uploaded files and public source extraction</h2>
          <p>
            Supported text, Markdown, CSV, JSON, and code files are read in the browser and relevant text is sent
            with the generation request. Image and video uploads are treated as asset references in the active
            campaign route; they are not represented as automatically understood visual content. Public links
            and public GitHub repositories may be requested by the server to extract relevant context.
          </p>
        </section>

        <section>
          <h2>Model providers and temporary keys</h2>
          <p>
            When you select an external model provider, the campaign context is sent to that provider to perform
            the requested generation. A temporary provider key entered in the studio is used for that request and
            is not saved in the local campaign library. The chosen provider has its own terms and privacy policy.
            The deterministic local template route does not require an external model call.
          </p>
        </section>

        <section>
          <h2>Owner access and social connectors</h2>
          <p>
            The hosted owner session uses an access cookie and may also support a browser-held bearer token for
            compatibility. LinkedIn, X, and Reddit OAuth sessions are encrypted in HTTP-only cookies. Those raw
            social access tokens are not returned to page JavaScript. Direct publishing is attempted only after
            explicit approval, and success is shown only after the destination confirms it.
          </p>
        </section>

        <section>
          <h2>Operational data</h2>
          <p>
            The hosting platform may process standard technical information needed to deliver and secure the
            service, such as request metadata, timestamps, IP-derived network information, device or browser
            details, and error logs. SignalFlow does not add advertising trackers in the current product.
          </p>
        </section>

        <section>
          <h2>Deletion and control</h2>
          <ul>
            <li>Delete individual campaigns from the local library.</li>
            <li>Clear the complete browser-local library from Settings.</li>
            <li>Disconnect an official social connector from the Connections page.</li>
            <li>Close the owner session from Settings.</li>
            <li>Clear site data in your browser to remove browser-held SignalFlow data.</li>
          </ul>
        </section>

        <section>
          <h2>Open-source project and questions</h2>
          <p>
            SignalFlow Studio is maintained through its public GitHub repository. Privacy questions, security
            concerns, and correction requests can be raised through the repository issue tracker without posting
            credentials or sensitive personal data in a public issue.
          </p>
          <p><a href="https://github.com/Ankit6149/SignalFlow-Studio/issues">Open the GitHub issue tracker</a></p>
        </section>
      </article>
    </main>
  );
}
