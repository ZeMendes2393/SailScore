'use client';

import Image from 'next/image';
import { useCallback, useEffect, useState } from 'react';
import { useScrollHideHeader } from '@/hooks/useScrollHideHeader';

const SECTION_LINKS = [
  { href: '#platform', label: 'Platform' },
  { href: '#features', label: 'Features' },
  { href: '#benefits', label: 'Benefits' },
  { href: '#social-proof', label: 'Use cases' },
  { href: '#how-it-works', label: 'How it works' },
  { href: '#faq', label: 'FAQ' },
  { href: '#book-demo', label: 'Contact' },
] as const;

export default function LandingTopNav() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { hidden: headerHidden } = useScrollHideHeader({
    forceVisible: menuOpen,
  });

  const closeMenu = useCallback(() => setMenuOpen(false), []);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeMenu();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [menuOpen, closeMenu]);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const onChange = () => {
      if (mq.matches) closeMenu();
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [closeMenu]);

  return (
    <>
      <header
        className={`ss-top-nav${headerHidden ? ' is-hidden' : ''}${menuOpen ? ' is-menu-open' : ''}`}
        aria-label="Page sections"
      >
        <div className="ss-container ss-top-nav-inner">
          <a href="#hero" className="ss-top-brand" aria-label="SailScore home" onClick={closeMenu}>
            <Image src="/sailscore-icon.png" alt="" width={40} height={40} priority />
            <span className="ss-top-brand-name">SailScore</span>
          </a>

          <nav className="ss-top-links ss-top-links-desktop" aria-label="Sections">
            {SECTION_LINKS.map((link) => (
              <a key={link.href} href={link.href}>
                {link.label}
              </a>
            ))}
          </nav>

          <button
            type="button"
            className="ss-top-menu-btn"
            aria-expanded={menuOpen}
            aria-controls="ss-top-mobile-panel"
            onClick={() => setMenuOpen((o) => !o)}
          >
            {menuOpen ? 'Close' : 'Menu'}
          </button>
        </div>

        <div
          id="ss-top-mobile-panel"
          className={`ss-top-mobile-panel${menuOpen ? ' is-open' : ''}`}
          hidden={!menuOpen}
        >
          <nav className="ss-container ss-top-mobile-links" aria-label="Sections">
            {SECTION_LINKS.map((link) => (
              <a key={link.href} href={link.href} onClick={closeMenu}>
                {link.label}
              </a>
            ))}
          </nav>
        </div>
      </header>
      <div
        className={`ss-top-nav-spacer${headerHidden && !menuOpen ? ' is-collapsed' : ''}`}
        aria-hidden
      />
      {menuOpen && (
        <button
          type="button"
          className="ss-top-nav-backdrop"
          aria-label="Close menu"
          onClick={closeMenu}
        />
      )}
    </>
  );
}
