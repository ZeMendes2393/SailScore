'use client';

import Image from 'next/image';
import { useScrollHideHeader } from '@/hooks/useScrollHideHeader';

export default function LandingTopNav() {
  const { hidden: headerHidden } = useScrollHideHeader();

  return (
    <>
      <header
        className={`ss-top-nav${headerHidden ? ' is-hidden' : ''}`}
        aria-label="Page sections"
      >
        <div className="ss-container ss-top-nav-inner">
          <a href="#hero" className="ss-top-brand" aria-label="SailScore home">
            <Image src="/sailscore-icon.png" alt="SailScore" width={40} height={40} priority />
            <span className="ss-top-brand-name">SailScore</span>
          </a>
          <nav className="ss-top-links" aria-label="Sections">
            <a href="#platform">Platform</a>
            <a href="#features">Features</a>
            <a href="#benefits">Benefits</a>
            <a href="#social-proof">Use cases</a>
            <a href="#how-it-works">How it works</a>
            <a href="#faq">FAQ</a>
            <a href="#book-demo">Contact</a>
          </nav>
        </div>
      </header>
      <div className={`ss-top-nav-spacer${headerHidden ? ' is-collapsed' : ''}`} aria-hidden />
    </>
  );
}
