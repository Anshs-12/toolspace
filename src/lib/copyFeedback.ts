/**
 * Visual feedback for copy buttons: the button's icon turns into an animated tick for a moment.
 * The button is the last one clicked (tracked at module load). Every successful navigator.clipboard
 * write triggers it, so each copy button gets the same feedback. The "Copied" toast is shown by the caller.
 */
const TICK_MS = 1600;
const SVG_NS = 'http://www.w3.org/2000/svg';

let lastButton: Element | null = null;
let lastAt = 0;

if (typeof document !== 'undefined') {
  // A floating tick would detach from its control if the page moves, so drop it on scroll or resize
  const dropBadges = () => document.querySelectorAll('.copy-badge').forEach((n) => n.remove());
  window.addEventListener('scroll', dropBadges, { capture: true, passive: true });
  window.addEventListener('resize', dropBadges, { passive: true });
  document.addEventListener(
    'click',
    (e) => {
      const t = e.target instanceof Element ? e.target : null;
      lastButton = t?.closest('button, [role="menuitem"]') ?? null;
      lastAt = Date.now();
    },
    true,
  );
}

const timers = new WeakMap<Element, number>();
const badges = new WeakMap<Element, Element>();

function tick(): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2.5');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('class', 'copy-tick');
  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', 'M4 12.5l5.5 5.5L20 6.5');
  path.setAttribute('pathLength', '1');
  svg.appendChild(path);
  return svg;
}

/** Turn the clicked copy button's icon into an animated tick for a moment. Does nothing if no button was just clicked or it has no icon. */
export function markCopied() {
  const btn = lastButton;
  if (!btn || !btn.isConnected || Date.now() - lastAt > 3000) return;
  const icon = btn.querySelector(':scope > svg:not(.copy-tick)');
  const prev = timers.get(btn);
  if (prev) {
    window.clearTimeout(prev);
    btn.querySelectorAll(':scope > .copy-tick').forEach((n) => n.remove());
    badges.get(btn)?.remove();
  }
  let el: Element | null = null;
  if (icon) {
    el = tick();
    // Same size and classes as the icon it replaces, so layout does not move
    el.setAttribute('class', `${icon.getAttribute('class') ?? ''} copy-tick`.trim());
    btn.insertBefore(el, icon);
  } else if (btn.closest('td')) {
    // JSON table cells are packed edge to edge, so there is no room for a tick without covering text.
    // The cell itself flashes green instead (CSS on [data-copied]); the "Copied" toast confirms it.
  } else {
    // No icon (color swatches, JSON paths): a small tick floats near the control. It lives on <body>
    // (position: fixed), so it never clips and never shifts layout, and sits where it covers no text.
    const r = btn.getBoundingClientRect();
    const badge = document.createElement('span');
    badge.className = 'copy-badge';
    badge.setAttribute('aria-hidden', 'true');
    const size = 20;
    let x: number;
    let y: number;
    if (btn.hasAttribute('data-hex')) {
      x = r.right - size - 4; // inside the swatch's top-right corner, over the color
      y = r.top + 4;
    } else {
      x = r.right + 6; // just right of the path row, in empty space
      y = r.top + (r.height - size) / 2;
    }
    badge.style.left = `${Math.min(Math.max(x, 2), window.innerWidth - size - 2)}px`;
    badge.style.top = `${Math.max(y, 2)}px`;
    badge.appendChild(tick());
    document.body.appendChild(badge);
    badges.set(btn, badge);
    el = badge;
  }
  btn.setAttribute('data-copied', '');
  timers.set(
    btn,
    window.setTimeout(() => {
      el?.remove();
      btn.removeAttribute('data-copied');
      timers.delete(btn);
      badges.delete(btn);
    }, TICK_MS),
  );
}

/** Run markCopied after every successful clipboard write, so no copy button needs its own wiring. */
function hookClipboard() {
  if (typeof navigator === 'undefined' || !navigator.clipboard) return;
  const clip = navigator.clipboard as Clipboard & { __tick?: boolean };
  if (clip.__tick) return;
  for (const name of ['writeText', 'write'] as const) {
    const orig = clip[name]?.bind(clip) as ((d: never) => Promise<void>) | undefined;
    if (!orig) continue;
    try {
      Object.defineProperty(clip, name, {
        configurable: true,
        value: (data: never) => orig(data).then(() => markCopied()),
      });
    } catch {
      /* clipboard object is locked down; the toast still shows */
    }
  }
  try {
    Object.defineProperty(clip, '__tick', { value: true });
  } catch {
    /* ignore */
  }
}
hookClipboard();
