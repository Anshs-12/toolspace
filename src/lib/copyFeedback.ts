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
  if (!icon) return;
  const prev = timers.get(btn);
  if (prev) {
    window.clearTimeout(prev);
    btn.querySelectorAll(':scope > .copy-tick').forEach((n) => n.remove());
  }
  const el = tick();
  // Same size and classes as the icon it replaces, so layout does not move
  el.setAttribute('class', `${icon.getAttribute('class') ?? ''} copy-tick`.trim());
  btn.setAttribute('data-copied', '');
  btn.insertBefore(el, icon);
  timers.set(
    btn,
    window.setTimeout(() => {
      el.remove();
      btn.removeAttribute('data-copied');
      timers.delete(btn);
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
