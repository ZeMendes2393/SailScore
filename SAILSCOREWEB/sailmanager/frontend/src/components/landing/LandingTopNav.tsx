'use client';

import Image from 'next/image';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useScrollHideHeader } from '@/hooks/useScrollHideHeader';
import LanguageSwitcher from '@/components/LanguageSwitcher';

const SECTION_HREFS = [
  '#platform',
  '#features',
  '#benefits',
  '#social-proof',
  '#how-it-works',
  '#faq',
  '#book-demo',
] as const;

const SECTION_KEYS = [
  'platform',
  'features',
  'benefits',
  'useCases',
  'howItWorks',
  'faq',
  'contact',
] as const;

export default function LandingTopNav() {
  const t = useTranslations('landing.nav');
  const tCommon = useTranslations('common');
  const [menuOpen, setMenuOpen] = useState(false);
  const { hidden: headerHidden } = useScrollHideHeader({
    forceVisible: menuOpen,
  });

  const sectionLinks = useMemo(
    () =>
      SECTION_HREFS.map((href, i) => ({
        href,
        label: t(SECTION_KEYS[i]),
      })),
    [t]
  );

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
        aria-label={t('sectionsAria')}
      >
        <div className="ss-container ss-top-nav-inner">
          <a href="#hero" className="ss-top-brand" aria-label={t('homeAria')} onClick={closeMenu}>
            <Image src="/sailscore-icon.png" alt="" width={40} height={40} priority />
            <span className="ss-top-brand-name">SailScore</span>
          </a>

          <div className="ss-top-nav-end">
            <nav className="ss-top-links ss-top-links-desktop" aria-label={t('sectionsAria')}>
              {sectionLinks.map((link) => (
                <a key={link.href} href={link.href}>
                  {link.label}
                </a>
              ))}
            </nav>

            <LanguageSwitcher theme="on-light" className="ss-top-lang-desktop shrink-0" />
          </div>

          <button
            type="button"
            className="ss-top-menu-btn"
            aria-expanded={menuOpen}
            aria-controls="ss-top-mobile-panel"
            onClick={() => setMenuOpen((o) => !o)}
          >
            {menuOpen ? tCommon('close') : t('menu')}
          </button>
        </div>

        <div
          id="ss-top-mobile-panel"
          className={`ss-top-mobile-panel${menuOpen ? ' is-open' : ''}`}
          hidden={!menuOpen}
        >
          <nav className="ss-container ss-top-mobile-links" aria-label={t('sectionsAria')}>
            <div className="ss-top-mobile-lang">
              <LanguageSwitcher theme="on-light" />
            </div>
            {sectionLinks.map((link) => (
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
          aria-label={t('closeMenu')}
          onClick={closeMenu}
        />
      )}
    </>
  );
}
