import Link from 'next/link';
import Image from 'next/image';
import { getTranslations } from 'next-intl/server';
import BookDemoForm from '@/components/landing/BookDemoForm';
import LandingTopNav from '@/components/landing/LandingTopNav';
import SailScorePublicContact from '@/components/SailScorePublicContact';

export default async function SailScoreLanding() {
  const t = await getTranslations('landing');

  return (
    <div className="sailscore-landing">
      <LandingTopNav />

      <section id="hero" className="ss-section ss-hero">
        <div className="ss-container ss-hero-grid">
          <div>
            <p className="ss-eyebrow">{t('hero.eyebrow')}</p>
            <h1 className="ss-h1">{t('hero.title')}</h1>
            <p className="ss-lead">{t('hero.lead')}</p>
            <div className="ss-hero-actions">
              <a className="ss-btn ss-btn-primary" href="#book-demo">
                {t('hero.bookDemo')}
              </a>
            </div>
            <p className="ss-microcopy">{t('hero.microcopy')}</p>
          </div>
          <div className="ss-visual-card">
            <p className="ss-visual-label">{t('hero.dashboardLabel')}</p>
            <Image
              className="ss-visual-block"
              src="/dashboard-preview.png"
              alt={t('hero.dashboardAlt')}
              width={1600}
              height={900}
              quality={100}
              priority
            />
            <p className="ss-visual-note">{t('hero.dashboardNote')}</p>
          </div>
        </div>
      </section>

      <section id="platform" className="ss-section ss-section-muted">
        <div className="ss-container">
          <h2 className="ss-h2">{t('platform.title')}</h2>
          <p className="ss-section-intro">{t('platform.intro')}</p>
          <div className="ss-modules-grid">
            <article className="ss-module">
              <span className="ss-module-kicker">{t('platform.module1Kicker')}</span>
              <h3 className="ss-h3">{t('platform.module1Title')}</h3>
              <p>{t('platform.module1Desc')}</p>
            </article>
            <article className="ss-module">
              <span className="ss-module-kicker">{t('platform.module2Kicker')}</span>
              <h3 className="ss-h3">{t('platform.module2Title')}</h3>
              <p>{t('platform.module2Desc')}</p>
            </article>
            <article className="ss-module">
              <span className="ss-module-kicker">{t('platform.module3Kicker')}</span>
              <h3 className="ss-h3">{t('platform.module3Title')}</h3>
              <p>{t('platform.module3Desc')}</p>
            </article>
            <article className="ss-module">
              <span className="ss-module-kicker">{t('platform.module4Kicker')}</span>
              <h3 className="ss-h3">{t('platform.module4Title')}</h3>
              <p>{t('platform.module4Desc')}</p>
            </article>
            <article className="ss-module">
              <span className="ss-module-kicker">{t('platform.module5Kicker')}</span>
              <h3 className="ss-h3">{t('platform.module5Title')}</h3>
              <p>{t('platform.module5Desc')}</p>
            </article>
            <article className="ss-module">
              <span className="ss-module-kicker">{t('platform.module6Kicker')}</span>
              <h3 className="ss-h3">{t('platform.module6Title')}</h3>
              <p>{t('platform.module6Desc')}</p>
            </article>
          </div>
        </div>
      </section>

      <section id="public-look" className="ss-section">
        <div className="ss-container">
          <div className="ss-spotlight">
            <div className="ss-spotlight-text">
              <p className="ss-eyebrow">{t('publicLook.eyebrow')}</p>
              <h2 className="ss-h2">{t('publicLook.title')}</h2>
              <p>{t('publicLook.description')}</p>
            </div>
            <div className="ss-spotlight-visual">
              <Image
                src="/public-website-preview.png"
                alt={t('publicLook.imageAlt')}
                width={1600}
                height={900}
                quality={95}
              />
              <p className="ss-visual-note">{t('publicLook.imageNote')}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="ss-section">
        <div className="ss-container">
          <div className="ss-spotlight">
            <div className="ss-spotlight-text">
              <p className="ss-eyebrow">{t('entriesSpotlight.eyebrow')}</p>
              <h2 className="ss-h2">{t('entriesSpotlight.title')}</h2>
              <p>{t('entriesSpotlight.description')}</p>
            </div>
            <div className="ss-spotlight-visual">
              <Image
                src="/screenshot-entries.png"
                alt={t('entriesSpotlight.imageAlt')}
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
          <h2 className="ss-h2">{t('features.title')}</h2>
          <div className="ss-grid ss-cards-3">
            <article className="ss-card"><h3 className="ss-h3">{t('features.card1Title')}</h3><p>{t('features.card1Desc')}</p></article>
            <article className="ss-card"><h3 className="ss-h3">{t('features.card2Title')}</h3><p>{t('features.card2Desc')}</p></article>
            <article className="ss-card"><h3 className="ss-h3">{t('features.card3Title')}</h3><p>{t('features.card3Desc')}</p></article>
            <article className="ss-card"><h3 className="ss-h3">{t('features.card4Title')}</h3><p>{t('features.card4Desc')}</p></article>
            <article className="ss-card"><h3 className="ss-h3">{t('features.card5Title')}</h3><p>{t('features.card5Desc')}</p></article>
            <article className="ss-card"><h3 className="ss-h3">{t('features.card6Title')}</h3><p>{t('features.card6Desc')}</p></article>
          </div>
        </div>
      </section>

      <section className="ss-section">
        <div className="ss-container">
          <div className="ss-spotlight ss-spotlight-reverse">
            <div className="ss-spotlight-text">
              <p className="ss-eyebrow">{t('scoringSpotlight.eyebrow')}</p>
              <h2 className="ss-h2">{t('scoringSpotlight.title')}</h2>
              <p>{t('scoringSpotlight.description')}</p>
            </div>
            <div className="ss-spotlight-visual">
              <Image
                src="/screenshot-scoring.png"
                alt={t('scoringSpotlight.imageAlt')}
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
          <h2 className="ss-h2">{t('benefits.title')}</h2>
          <div className="ss-grid ss-cards-3">
            <article className="ss-card"><h3 className="ss-h3">{t('benefits.card1Title')}</h3><p>{t('benefits.card1Desc')}</p></article>
            <article className="ss-card"><h3 className="ss-h3">{t('benefits.card2Title')}</h3><p>{t('benefits.card2Desc')}</p></article>
            <article className="ss-card"><h3 className="ss-h3">{t('benefits.card3Title')}</h3><p>{t('benefits.card3Desc')}</p></article>
            <article className="ss-card"><h3 className="ss-h3">{t('benefits.card4Title')}</h3><p>{t('benefits.card4Desc')}</p></article>
            <article className="ss-card"><h3 className="ss-h3">{t('benefits.card5Title')}</h3><p>{t('benefits.card5Desc')}</p></article>
            <article className="ss-card"><h3 className="ss-h3">{t('benefits.card6Title')}</h3><p>{t('benefits.card6Desc')}</p></article>
          </div>
        </div>
      </section>

      <section className="ss-section">
        <div className="ss-container">
          <div className="ss-spotlight">
            <div className="ss-spotlight-text">
              <p className="ss-eyebrow">{t('noticeSpotlight.eyebrow')}</p>
              <h2 className="ss-h2">{t('noticeSpotlight.title')}</h2>
              <p>{t('noticeSpotlight.description')}</p>
            </div>
            <div className="ss-spotlight-visual">
              <Image
                src="/screenshot-notice.png"
                alt={t('noticeSpotlight.imageAlt')}
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
          <h2 className="ss-h2">{t('socialProof.title')}</h2>
          <p className="ss-section-intro">{t('socialProof.intro')}</p>
          <div className="ss-chip-row" aria-label={t('socialProof.eventTypesAria')}>
            <span className="ss-chip">{t('socialProof.chip1')}</span>
            <span className="ss-chip">{t('socialProof.chip2')}</span>
            <span className="ss-chip">{t('socialProof.chip3')}</span>
            <span className="ss-chip">{t('socialProof.chip4')}</span>
            <span className="ss-chip">{t('socialProof.chip5')}</span>
            <span className="ss-chip">{t('socialProof.chip6')}</span>
          </div>
        </div>
      </section>

      <section id="personas" className="ss-section ss-section-muted">
        <div className="ss-container">
          <h2 className="ss-h2">{t('personas.title')}</h2>
          <div className="ss-persona-grid">
            <article className="ss-card">
              <h3 className="ss-h3">{t('personas.adminTitle')}</h3>
              <p>{t('personas.adminDesc')}</p>
            </article>
            <article className="ss-card">
              <h3 className="ss-h3">{t('personas.scorersTitle')}</h3>
              <p>{t('personas.scorersDesc')}</p>
            </article>
            <article className="ss-card">
              <h3 className="ss-h3">{t('personas.sailorsTitle')}</h3>
              <p>{t('personas.sailorsDesc')}</p>
            </article>
          </div>
        </div>
      </section>

      <section id="value-prop" className="ss-section ss-section-muted">
        <div className="ss-container ss-content-narrow">
          <h2 className="ss-h2">{t('valueProp.title')}</h2>
          <p>{t('valueProp.p1')}</p>
          <p>{t('valueProp.p2')}</p>
          <div className="ss-hero-actions">
            <a className="ss-btn ss-btn-primary" href="#features">{t('valueProp.exploreFeatures')}</a>
            <a className="ss-btn ss-btn-secondary" href="#how-it-works">{t('valueProp.seeWorkflow')}</a>
          </div>
        </div>
      </section>

      <section className="ss-section">
        <div className="ss-container">
          <div className="ss-spotlight ss-spotlight-reverse">
            <div className="ss-spotlight-text">
              <p className="ss-eyebrow">{t('resultsSpotlight.eyebrow')}</p>
              <h2 className="ss-h2">{t('resultsSpotlight.title')}</h2>
              <p>{t('resultsSpotlight.description')}</p>
            </div>
            <div className="ss-spotlight-visual">
              <Image
                src="/screenshot-results.png"
                alt={t('resultsSpotlight.imageAlt')}
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
          <h2 className="ss-h2">{t('howItWorks.title')}</h2>
          <div className="ss-grid ss-steps-3">
            <article className="ss-step"><span className="ss-step-number">1</span><h3 className="ss-h3">{t('howItWorks.step1Title')}</h3><p>{t('howItWorks.step1Desc')}</p></article>
            <article className="ss-step"><span className="ss-step-number">2</span><h3 className="ss-h3">{t('howItWorks.step2Title')}</h3><p>{t('howItWorks.step2Desc')}</p></article>
            <article className="ss-step"><span className="ss-step-number">3</span><h3 className="ss-h3">{t('howItWorks.step3Title')}</h3><p>{t('howItWorks.step3Desc')}</p></article>
          </div>
        </div>
      </section>

      <section id="faq" className="ss-section ss-section-muted">
        <div className="ss-container ss-content-narrow">
          <h2 className="ss-h2">{t('faq.title')}</h2>
          <details><summary>{t('faq.q1')}</summary><p>{t('faq.a1')}</p></details>
          <details><summary>{t('faq.q2')}</summary><p>{t('faq.a2')}</p></details>
          <details><summary>{t('faq.q3')}</summary><p>{t('faq.a3')}</p></details>
          <details><summary>{t('faq.q4')}</summary><p>{t('faq.a4')}</p></details>
        </div>
      </section>

      <section id="book-demo" className="ss-section ss-cta-band">
        <div className="ss-container ss-content-narrow ss-center">
          <h2 className="ss-h2">{t('cta.title')}</h2>
          <p>{t('cta.description')}</p>
          <BookDemoForm />
          <p className="ss-microcopy">{t('cta.microcopy')}</p>
        </div>
      </section>

      <footer
        id="footer-contact"
        className="border-t border-slate-800 bg-slate-900 text-slate-200"
        aria-label={t('footer.contactAria')}
      >
        <div className="ss-container py-10 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-8">
          <div>
            <p className="text-lg font-semibold text-white mb-1">SailScore</p>
            <p className="text-sm text-slate-400 max-w-md">{t('footer.tagline')}</p>
          </div>
          <SailScorePublicContact className="text-slate-300 shrink-0" />
        </div>
      </footer>

      <div className="ss-landing-staff-login" aria-label={t('staffAccessAria')}>
        <Link href="/admin/login">{t('staffSignIn')}</Link>
      </div>
    </div>
  );
}
