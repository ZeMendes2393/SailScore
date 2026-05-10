import Link from 'next/link';
import Image from 'next/image';

export default function SailScoreLanding() {
  return (
    <div className="sailscore-landing">
      <header className="ss-top-nav" aria-label="Page sections">
        <div className="ss-container ss-top-nav-inner">
          <a href="#hero" className="ss-top-brand" aria-label="SailScore home">
            <Image
              src="/sailscore-icon.png"
              alt="SailScore"
              width={40}
              height={40}
              priority
            />
            <span className="ss-top-brand-name">SailScore</span>
          </a>
          <nav className="ss-top-links" aria-label="Sections">
            <a href="#platform">Platform</a>
            <a href="#features">Features</a>
            <a href="#benefits">Benefits</a>
            <a href="#social-proof">Clients</a>
            <a href="#how-it-works">How it works</a>
            <a href="#faq">FAQ</a>
            <a href="#final-cta">Contact</a>
          </nav>
        </div>
      </header>

      <section id="hero" className="ss-section ss-hero">
        <div className="ss-container ss-hero-grid">
          <div>
            <p className="ss-eyebrow">Practical regatta operations software</p>
            <h1 className="ss-h1">Run Better Regattas with Faster Scoring and Clearer Operations</h1>
            <p className="ss-lead">
              SailScore helps clubs and race teams handle setup, entries, scoring, notices, and results in one structured workflow.
            </p>
            <div className="ss-hero-actions">
              <a className="ss-btn ss-btn-primary" href="#final-cta">Book a Demo</a>
              <a className="ss-btn ss-btn-secondary" href="#final-cta">Start Free Trial</a>
            </div>
            <p className="ss-microcopy">Built for real race-day pressure.</p>
          </div>
          <div className="ss-visual-card">
            <p className="ss-visual-label">Main Dashboard Preview</p>
            <Image
              className="ss-visual-block"
              src="/dashboard-preview.png"
              alt="SailScore dashboard preview"
              width={1600}
              height={900}
              quality={100}
              priority
            />
            <p className="ss-visual-note">Production dashboard screenshot</p>
          </div>
        </div>
      </section>

      <section id="platform" className="ss-section ss-section-muted">
        <div className="ss-container">
          <h2 className="ss-h2">One platform, six practical capabilities</h2>
          <p className="ss-section-intro">
            Organize race office operations from setup to publishing with one connected workflow.
          </p>
          <div className="ss-modules-grid">
            <article className="ss-module">
              <span className="ss-module-kicker">Capability 1</span>
              <h3 className="ss-h3">Setup &amp; Configuration</h3>
              <p>Create regattas, define classes, schedules, and core settings in minutes.</p>
            </article>
            <article className="ss-module">
              <span className="ss-module-kicker">Capability 2</span>
              <h3 className="ss-h3">Entries &amp; Registration</h3>
              <p>Centralize online entries and participant records with cleaner validation.</p>
            </article>
            <article className="ss-module">
              <span className="ss-module-kicker">Capability 3</span>
              <h3 className="ss-h3">Scoring Workflow</h3>
              <p>Support race-day scoring teams with fast updates and clear controls.</p>
            </article>
            <article className="ss-module">
              <span className="ss-module-kicker">Capability 4</span>
              <h3 className="ss-h3">Results Publishing</h3>
              <p>Publish race and overall standings quickly with consistent visibility.</p>
            </article>
            <article className="ss-module">
              <span className="ss-module-kicker">Capability 5</span>
              <h3 className="ss-h3">Notice Board &amp; Decisions</h3>
              <p>Keep official notices and hearing decisions in one trusted channel.</p>
            </article>
            <article className="ss-module">
              <span className="ss-module-kicker">Capability 6</span>
              <h3 className="ss-h3">Sailor Access</h3>
              <p>Give sailors and coaches a simple, role-based view of updates and results.</p>
            </article>
          </div>
        </div>
      </section>

      <section className="ss-section">
        <div className="ss-container">
          <div className="ss-spotlight">
            <div className="ss-spotlight-text">
              <p className="ss-eyebrow">Entries</p>
              <h2 className="ss-h2">Centralized entry management</h2>
              <p>
                Keep all entries organized in one place, with class filters, status indicators, and clean validation to prevent duplicates and missing data.
              </p>
            </div>
            <div className="ss-spotlight-visual">
              <Image
                src="/screenshot-entries.png"
                alt="Entry management screen in SailScore"
                width={1600}
                height={900}
                quality={95}
              />
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="ss-section ss-section-muted">
        <div className="ss-container">
          <h2 className="ss-h2">Everything needed to run a regatta, in one platform</h2>
          <div className="ss-grid ss-cards-3">
            <article className="ss-card"><h3 className="ss-h3">Regatta Setup &amp; Management</h3><p>Configure events, classes, schedules, and settings with clear admin control.</p></article>
            <article className="ss-card"><h3 className="ss-h3">Entry Management</h3><p>Collect and organize sailor and boat data in one flow.</p></article>
            <article className="ss-card"><h3 className="ss-h3">Live Scoring Workflow</h3><p>Support scorers with race-day tools built for speed and accuracy.</p></article>
            <article className="ss-card"><h3 className="ss-h3">Results Calculation &amp; Publishing</h3><p>Publish race and overall standings with confidence.</p></article>
            <article className="ss-card"><h3 className="ss-h3">Notice Board &amp; Communications</h3><p>Centralize notices, decisions, and updates in one official channel.</p></article>
            <article className="ss-card"><h3 className="ss-h3">Role-Based Access</h3><p>Give admins, scorers, and sailors the right visibility.</p></article>
          </div>
        </div>
      </section>

      <section className="ss-section">
        <div className="ss-container">
          <div className="ss-spotlight ss-spotlight-reverse">
            <div className="ss-spotlight-text">
              <p className="ss-eyebrow">Scoring</p>
              <h2 className="ss-h2">A faster scoring workflow</h2>
              <p>
                Score race input quickly with a structured race-day flow that reduces manual steps and keeps your team aligned.
              </p>
            </div>
            <div className="ss-spotlight-visual">
              <Image
                src="/screenshot-scoring.png"
                alt="Scoring workflow screen in SailScore"
                width={1600}
                height={900}
                quality={95}
              />
            </div>
          </div>
        </div>
      </section>

      <section id="benefits" className="ss-section">
        <div className="ss-container">
          <h2 className="ss-h2">Why teams choose SailScore</h2>
          <div className="ss-grid ss-cards-3">
            <article className="ss-card"><h3 className="ss-h3">Faster scoring workflow</h3><p>Reduce manual steps and move from race input to published standings quickly.</p></article>
            <article className="ss-card"><h3 className="ss-h3">Clear official communication</h3><p>Keep notices, updates, and protest communications in one visible place.</p></article>
            <article className="ss-card"><h3 className="ss-h3">Structured operations</h3><p>Standardize setup, entries, and race-office tasks across events.</p></article>
            <article className="ss-card"><h3 className="ss-h3">Professional club experience</h3><p>Keep your organization&apos;s visual identity and participant context.</p></article>
            <article className="ss-card"><h3 className="ss-h3">Better transparency</h3><p>Give sailors and coaches clear access to updates and results.</p></article>
            <article className="ss-card"><h3 className="ss-h3">Reliable under pressure</h3><p>Use practical tools designed for real race-day conditions.</p></article>
          </div>
        </div>
      </section>

      <section className="ss-section">
        <div className="ss-container">
          <div className="ss-spotlight">
            <div className="ss-spotlight-text">
              <p className="ss-eyebrow">Notice Board</p>
              <h2 className="ss-h2">Official communication, in one place</h2>
              <p>
                Publish notices, hearing decisions, and updates in a single trusted channel that sailors and coaches can rely on.
              </p>
            </div>
            <div className="ss-spotlight-visual">
              <Image
                src="/screenshot-notice.png"
                alt="Notice Board screen in SailScore"
                width={1600}
                height={900}
                quality={95}
              />
            </div>
          </div>
        </div>
      </section>

      <section id="social-proof" className="ss-section ss-section-muted">
        <div className="ss-container">
          <h2 className="ss-h2">Trusted by clubs and race teams</h2>
          <p className="ss-section-intro">
            Practical software for local club events and multi-class championships.
          </p>
          <div className="ss-chip-row" aria-label="Client examples">
            <span className="ss-chip">Clube de Vela do Tejo</span>
            <span className="ss-chip">RCN Sample Team</span>
            <span className="ss-chip">Atlantic Series</span>
            <span className="ss-chip">Junior Circuit</span>
            <span className="ss-chip">Coastal Cup</span>
            <span className="ss-chip">Class Association Events</span>
          </div>
        </div>
      </section>

      <section id="personas" className="ss-section ss-section-muted">
        <div className="ss-container">
          <h2 className="ss-h2">Built for every role in race operations</h2>
          <div className="ss-persona-grid">
            <article className="ss-card">
              <h3 className="ss-h3">For Admins</h3>
              <p>Manage setup, classes, branding, and visibility from one control point.</p>
            </article>
            <article className="ss-card">
              <h3 className="ss-h3">For Scorers</h3>
              <p>Work faster on race day with a cleaner scoring and publishing flow.</p>
            </article>
            <article className="ss-card">
              <h3 className="ss-h3">For Sailors &amp; Coaches</h3>
              <p>Follow entries, notices, and standings in one consistent public view.</p>
            </article>
          </div>
        </div>
      </section>

      <section id="value-prop" className="ss-section ss-section-muted">
        <div className="ss-container ss-content-narrow">
          <h2 className="ss-h2">When race day gets busy, operations should stay clear</h2>
          <p>
            Many regattas still run on disconnected tools, manual updates, and scattered communication. That slows scoring and delays final
            results.
          </p>
          <p>
            SailScore brings the full process into one system, so your team can move faster, stay aligned, and publish accurate outcomes with
            confidence.
          </p>
          <div className="ss-hero-actions">
            <a className="ss-btn ss-btn-primary" href="#features">Explore features</a>
            <a className="ss-btn ss-btn-secondary" href="#how-it-works">See workflow</a>
          </div>
        </div>
      </section>

      <section className="ss-section">
        <div className="ss-container">
          <div className="ss-spotlight ss-spotlight-reverse">
            <div className="ss-spotlight-text">
              <p className="ss-eyebrow">Results</p>
              <h2 className="ss-h2">Publish trusted standings, fast</h2>
              <p>
                Race and overall standings are presented clearly for sailors and coaches, with consistent formatting across every event.
              </p>
            </div>
            <div className="ss-spotlight-visual">
              <Image
                src="/screenshot-results.png"
                alt="Results publishing screen in SailScore"
                width={1600}
                height={900}
                quality={95}
              />
            </div>
          </div>
        </div>
      </section>

      <section id="how-it-works" className="ss-section">
        <div className="ss-container">
          <h2 className="ss-h2">Simple workflow, from setup to final results</h2>
          <div className="ss-grid ss-steps-3">
            <article className="ss-step"><span className="ss-step-number">1</span><h3 className="ss-h3">Configure your event</h3><p>Set classes, schedules, roles, and operational rules.</p></article>
            <article className="ss-step"><span className="ss-step-number">2</span><h3 className="ss-h3">Run race-day operations</h3><p>Manage entries, scoring, and official communication in real time.</p></article>
            <article className="ss-step"><span className="ss-step-number">3</span><h3 className="ss-h3">Publish trusted outcomes</h3><p>Release clear race and overall results to sailors and coaches quickly.</p></article>
          </div>
        </div>
      </section>

      <section id="faq" className="ss-section ss-section-muted">
        <div className="ss-container ss-content-narrow">
          <h2 className="ss-h2">Quick answers</h2>
          <details><summary>Is SailScore only for large regattas?</summary><p>No. It works for local club events and larger multi-class regattas.</p></details>
          <details><summary>Can we keep our current workflow?</summary><p>Yes. SailScore supports practical race-office processes and improves them gradually.</p></details>
          <details><summary>Can sailors and coaches view updates clearly?</summary><p>Yes. Results and official communications are centralized for better visibility.</p></details>
          <details><summary>Can we use our club branding?</summary><p>Yes. SailScore supports organization-specific visual identity in key areas.</p></details>
        </div>
      </section>

      <section id="final-cta" className="ss-section ss-cta-band">
        <div className="ss-container ss-content-narrow ss-center">
          <h2 className="ss-h2">Ready for a more organized and faster race day?</h2>
          <p>See how SailScore fits your regatta workflow and helps your team deliver clear, trusted results.</p>
          <div className="ss-hero-actions ss-center">
            <a className="ss-btn ss-btn-primary" href="#hero">
              Book a Demo
            </a>
            <a className="ss-btn ss-btn-secondary" href="/register">Start Free Trial</a>
          </div>
          <p className="ss-microcopy">No hard sell - just a practical walkthrough.</p>
        </div>
      </section>

      <div className="ss-landing-staff-login" aria-label="Staff access">
        <Link href="/admin/login">Staff sign-in</Link>
      </div>
    </div>
  );
}
