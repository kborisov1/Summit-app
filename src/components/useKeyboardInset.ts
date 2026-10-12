import { useEffect } from 'react';

/** How much of the screen the on-screen keyboard has to take before we treat it as open. */
const KEYBOARD_MIN_PX = 150;

/**
 * Keeps the layout inside the part of the screen that is actually visible.
 * Mobile Safari leaves the layout viewport full-height when the keyboard
 * opens and pans the page instead, so the question and climber slide out of
 * view. This publishes the visible height as `--visible-height` and flags
 * `keyboard-open` on the root element so the styles can fit that space.
 */
export function useKeyboardInset(): void {
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const root = document.documentElement;

    const update = () => {
      const open = window.innerHeight - viewport.height > KEYBOARD_MIN_PX;
      root.style.setProperty('--visible-height', `${viewport.height}px`);
      root.classList.toggle('keyboard-open', open);
      // Undo the pan Safari applied to reveal the focused field.
      if (open) window.scrollTo(0, 0);
    };

    update();
    viewport.addEventListener('resize', update);
    viewport.addEventListener('scroll', update);
    return () => {
      viewport.removeEventListener('resize', update);
      viewport.removeEventListener('scroll', update);
      root.style.removeProperty('--visible-height');
      root.classList.remove('keyboard-open');
    };
  }, []);
}
