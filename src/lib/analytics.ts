import { useEffect, useRef } from 'react';
import { trackToolRun } from './consent';

/**
 * Counts successful tool use with both analytics services, each with only the
 * page's static tool ID: Umami (public/umami.js) as a `tool-run` event, whose
 * payload public/umami-config.js rebuilds from an allowlist; and Google
 * Analytics (src/lib/consent.ts, only after the visitor accepts) as `tool_run`.
 * Nothing about the input or the result is sent.
 *
 * A tool reports its result with `useToolRun(key)`: a string that changes when
 * the result changes (usually the output itself), or null/'' while there is no
 * meaningful successful result (empty input, an error, nothing produced yet).
 * The key is only compared in this tab, never sent.
 *
 * An event is sent when a result
 *   - appears after the visitor has interacted with the tool (so the sample
 *     shown on load, or input restored from a share link or storage, is not a run),
 *   - stays the same for TOOL_RUN_SETTLE_MS (so typing isn't counted per keystroke),
 *   - and differs from the last result counted (so an unchanged result counts once).
 */

/** The Umami event name; public/umami-config.js accepts only this one. */
export const TOOL_RUN_EVENT = 'tool-run';
/** How long a new result must stay unchanged before it counts. */
export const TOOL_RUN_SETTLE_MS = 2000;

/** Events inside the tool's workspace that mean the visitor is using it. */
const INTERACTIONS = ['pointerdown', 'keydown', 'input', 'change', 'paste', 'drop'] as const;

let interacted = false;
let listening = false;

function listenForInteraction() {
  if (listening || typeof document === 'undefined') return;
  listening = true;
  const mark = (e: Event) => {
    // Capture phase on document runs before React's handlers, so the result this causes sees `interacted`
    if (!interacted && e.isTrusted && e.target instanceof Element && e.target.closest('.workspace')) interacted = true;
  };
  for (const type of INTERACTIONS) document.addEventListener(type, mark, { capture: true, passive: true });
}

/** The page's static tool ID (#root's data-page, written at build time). */
function toolId(): string | null {
  return document.getElementById('root')?.dataset.page ?? null;
}

type Umami = { track: (name: string, data: Record<string, string>) => unknown };

function sendToolRun() {
  const tool = toolId();
  if (!tool) return;
  const umami = (window as { umami?: Umami }).umami;
  // No tracker (blocked, not loaded, or off): nothing to do
  if (umami && typeof umami.track === 'function') void umami.track(TOOL_RUN_EVENT, { tool });
  trackToolRun(tool);
}

export function useToolRun(result: string | null | undefined | false) {
  const key = result || null;
  /** The last result counted, or before any interaction, the result on screen. */
  const counted = useRef<string | null>(null);

  useEffect(listenForInteraction, []);

  useEffect(() => {
    if (!interacted) {
      counted.current = key;
      return;
    }
    if (key === null || key === counted.current) return;
    const timer = setTimeout(() => {
      counted.current = key;
      sendToolRun();
    }, TOOL_RUN_SETTLE_MS);
    return () => clearTimeout(timer);
  }, [key]);
}
