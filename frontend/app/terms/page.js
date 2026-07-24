export const metadata = {
  title: "Terms",
  description: "Terms for using the SignalFlow Studio campaign creation and publishing workflow.",
  alternates: { canonical: "/terms" },
};

function LegalBrand() {
  return (
    <span className="brand-mark brand-mark--dark brand-mark--compact" aria-label="SignalFlow Studio">
      <span className="brand-mark__glyph" aria-hidden="true"><span /><span /><span /></span>
      <span className="brand-mark__copy"><strong>SignalFlow</strong></span>
    </span>
  );
}

export default function TermsPage() {
  return (
    <main className="legal-shell">
      <header className="legal-nav">
        <a href="/"><LegalBrand /></a>
        <a href="/">Back to SignalFlow</a>
      </header>
      <article className="legal-content">
        <p className="eyebrow eyebrow--dark"><span /> Product policy</p>
        <h1>Terms</h1>
        <p>Effective July 24, 2026</p>

        <section>
          <h2>Using SignalFlow Studio</h2>
          <p>
            SignalFlow Studio is a campaign drafting, review, export, and supported publishing workflow. You may
            use it only for lawful content and source material that you own or are authorized to process. You are
            responsible for the campaigns, files, links, credentials, and accounts you provide.
          </p>
        </section>

        <section>
          <h2>Generated drafts require review</h2>
          <p>
            Generated text may be incomplete, inaccurate, generic, or unsuitable for a specific audience. Treat
            every output as an editable draft. Verify facts, claims, links, names, legal disclosures, accessibility
            details, and platform requirements before publishing or distributing the content.
          </p>
        </section>

        <section>
          <h2>Publishing actions</h2>
          <p>
            SignalFlow does not promise that every destination supports direct publishing. In the current release,
            direct OAuth connector paths exist for LinkedIn, X, and Reddit when deployment credentials and account
            permissions are properly configured. Other destinations use copy, export, and open-platform workflows.
            Platform APIs, permissions, rate limits, reviews, outages, and policy changes remain outside SignalFlow's
            control.
          </p>
        </section>

        <section>
          <h2>External services</h2>
          <p>
            Model providers, social networks, GitHub, public websites, and the hosting platform are independent
            services with their own terms, privacy practices, limits, and charges. You are responsible for the
            accounts, API keys, permissions, and costs connected to those services.
          </p>
        </section>

        <section>
          <h2>Prohibited use</h2>
          <ul>
            <li>Do not submit credentials, private data, or copyrighted material you are not authorized to use.</li>
            <li>Do not use SignalFlow for spam, deception, impersonation, harassment, illegal activity, or platform abuse.</li>
            <li>Do not bypass access controls, security protections, provider restrictions, or destination policies.</li>
            <li>Do not represent an unreviewed generated claim as verified fact.</li>
          </ul>
        </section>

        <section>
          <h2>Availability and changes</h2>
          <p>
            The project may change, pause, remove, or replace features without guaranteeing uninterrupted service.
            Local browser data can be lost when site data is cleared or a browser changes. Keep exports of material
            that matters to you.
          </p>
        </section>

        <section>
          <h2>No professional advice or guaranteed outcome</h2>
          <p>
            SignalFlow does not provide legal, financial, compliance, employment, medical, or other professional
            advice. It does not guarantee reach, engagement, search ranking, model citations, platform approval,
            revenue, or any other campaign result.
          </p>
        </section>

        <section>
          <h2>Open-source license and responsibility</h2>
          <p>
            Source-code use is governed by the license included in the public repository. To the extent permitted
            by applicable law, the software is provided without warranties, and you remain responsible for how you
            configure, deploy, modify, and use it.
          </p>
        </section>

        <section>
          <h2>Questions</h2>
          <p>
            Product and terms questions can be raised through the public GitHub issue tracker. Do not include API
            keys, OAuth tokens, private campaign data, or other secrets in a public issue.
          </p>
          <p><a href="https://github.com/Ankit6149/SignalFlow-Studio/issues">Open the GitHub issue tracker</a></p>
        </section>
      </article>
    </main>
  );
}
