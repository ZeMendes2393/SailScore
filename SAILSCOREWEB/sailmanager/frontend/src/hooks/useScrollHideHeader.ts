'use client';

import { useEffect, useRef, useState } from 'react';

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
  minScroll = 64,
  threshold = 12,
}: Options = {}) {
  const [hidden, setHidden] = useState(false);
  const lastYRef = useRef(0);
  const hiddenRef = useRef(false);

  useEffect(() => {
    let ticking = false;
    lastYRef.current = window.scrollY;
    hiddenRef.current = false;

    const setHiddenSafe = (next: boolean) => {
      if (hiddenRef.current === next) return;
      hiddenRef.current = next;
      setHidden(next);
    };

    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        const y = Math.max(window.scrollY, 0);
        if (forceVisible) {
          setHiddenSafe(false);
          lastYRef.current = y;
          return;
        }
        const prevY = lastYRef.current;
        const dy = y - prevY;
        lastYRef.current = y;

        if (y <= minScroll) {
          setHiddenSafe(false);
          return;
        }

        if (dy > threshold && y > minScroll + 24) {
          setHiddenSafe(true);
          return;
        }
        if (dy < -threshold) {
          setHiddenSafe(false);
        }
      });
    };

    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
    };
  }, [forceVisible, minScroll, threshold]);

  return { hidden: hidden && !forceVisible };
}
