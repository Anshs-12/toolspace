import { useEffect, useSyncExternalStore } from 'react';
import { Button } from '@/components/ui/button';
import { analyticsAvailable, initConsent, isBannerOpen, openConsentSettings, readChoice, setChoice, subscribe } from '@/lib/consent';

const noServer = () => () => {};

/**
 * The Google Analytics opt-in (src/lib/consent.ts). Shown on the live site until
 * the visitor chooses, and again when reopened from "Cookie settings". Accept
 * and Reject are the same size and style.
 */
export function ConsentBanner() {
  const open = useSyncExternalStore(subscribe, isBannerOpen, () => false);
  useEffect(initConsent, []);
  if (!open) return null;
  return (
    <section
      role="region"
      aria-label="Analytics cookies"
      className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-[640px] rounded-lg border bg-background p-4 shadow-lg sm:inset-x-6 sm:bottom-6 sm:p-5"
    >
      <h2 className="text-[15px] font-semibold">Allow analytics cookies?</h2>
      <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted-foreground">
        If you accept, we use Google Analytics to see which pages are viewed, which tools are used and how pages are used. It sets cookies,
        and Google receives your IP address and browser and device information. What you type, paste, open or produce
        in a tool is not included. Nothing loads from Google unless you accept.{' '}
        <a href="/about/#analytics" className="underline underline-offset-2 hover:text-foreground">
          Details
        </a>
      </p>
      <div className="mt-3.5 grid grid-cols-2 gap-2.5 sm:flex sm:justify-end">
        <Button variant="outline" className="sm:min-w-28" onClick={() => setChoice('denied')}>
          Reject
        </Button>
        <Button variant="outline" className="sm:min-w-28" onClick={() => setChoice('granted')}>
          Accept
        </Button>
      </div>
    </section>
  );
}

/** Reopens the banner; shown wherever analytics could run. */
export function ConsentSettingsButton({ className, label = 'Cookie settings' }: { className?: string; label?: string }) {
  const available = useSyncExternalStore(noServer, analyticsAvailable, () => false);
  if (!available) return null;
  return (
    <button type="button" className={className} onClick={openConsentSettings}>
      {label}
    </button>
  );
}

/** The visitor's current choice, in words, for the About page. */
export function ConsentStatus() {
  const choice = useSyncExternalStore(subscribe, readChoice, () => null);
  const available = useSyncExternalStore(noServer, analyticsAvailable, () => false);
  if (!available) return null;
  const text = choice === 'granted' ? 'You accepted analytics cookies.' : choice === 'denied' ? 'You rejected analytics cookies.' : 'You haven’t chosen yet.';
  return (
    <p>
      {text}{' '}
      <ConsentSettingsButton label="Change your choice" className="font-medium underline underline-offset-2" />
    </p>
  );
}
