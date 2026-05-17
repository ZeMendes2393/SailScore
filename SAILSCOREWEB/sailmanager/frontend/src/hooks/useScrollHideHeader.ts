'use client';

import { useEffect, useState } from 'react';

const MOBILE_MQ = '(max-width: 767px)';

type Options = {
  /** Mantém o header visível (ex.: menu mobile aberto). */
  forceVisible?: boolean;
  /** Scroll mínimo antes de poder esconder. */
  minScroll?: number;
  /** Delta de scroll para mudar estado. */
  threshold?: number;
};

/**
 * No mobile: esconde o header ao fazer scroll para baixo; mostra ao subir ou no topo.
 */
export function useScrollHideHeader({
  forceVisible = false,
  minScroll = 48,
  threshold = 6,
}: Options = {}) {
  const [hidden, setHidden] = useState(false);
  const [mobile, setMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(MOBILE_MQ);
    const syncMobile = () => setMobile(mq.matches);
    syncMobile();
    mq.addEventListener('change', syncMobile);

    let lastY = window.scrollY;
    let ticking = false;

    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        if (!mq.matches || forceVisible) {
          setHidden(false);
          lastY = window.scrollY;
          return;
        }
        const y = window.scrollY;
        if (y <= minScroll) {
          setHidden(false);
        } else if (y > lastY + threshold) {
          setHidden(true);
        } else if (y < lastY - threshold) {
          setHidden(false);
        }
        lastY = y;
      });
    };

    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      mq.removeEventListener('change', syncMobile);
      window.removeEventListener('scroll', onScroll);
    };
  }, [forceVisible, minScroll, threshold]);

  const effectiveHidden = mobile && hidden && !forceVisible;
  return { hidden: effectiveHidden, mobile };
}
