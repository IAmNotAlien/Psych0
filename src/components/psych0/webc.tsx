'use client';
/* PSYCH0 — custom web components usable inside any post body:
 *   <psych0-counter to="1337" suffix="+"></psych0-counter>
 *   <psych0-vote id="my-thing" label="SHIP IT"></psych0-vote>
 * They pass through the markdown @html sanitizer (no script, no event attrs)
 * and register themselves once, client-side. */
import { useEffect } from 'react';

let registered = false;

function register() {
  if (registered || typeof window === 'undefined') return;
  registered = true;

  if (!customElements.get('psych0-counter')) {
    class P0Counter extends HTMLElement {
      connectedCallback() {
        const to = parseInt(this.getAttribute('to') || '100', 10) || 100;
        const from = parseInt(this.getAttribute('from') || '0', 10) || 0;
        const suffix = this.getAttribute('suffix') || '';
        const dur = 1200;
        this.style.fontWeight = '700';
        this.style.color = 'var(--acc)';
        const t0 = performance.now();
        const tick = (t: number) => {
          const k = Math.min(1, (t - t0) / dur);
          const eased = 1 - Math.pow(1 - k, 3);
          this.textContent = Math.round(from + (to - from) * eased).toString() + suffix;
          if (k < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }
    }
    customElements.define('psych0-counter', P0Counter);
  }

  if (!customElements.get('psych0-vote')) {
    class P0Vote extends HTMLElement {
      connectedCallback() {
        const id = this.getAttribute('id') || 'vote';
        const label = this.getAttribute('label') || '▲ VOTE';
        this.style.display = 'inline-block';
        this.innerHTML = `<button type="button" class="btn p0vote" data-vote="${id}">${label} · <span class="p0vcount">…</span></button>`;
        const btn = this.querySelector('button') as HTMLButtonElement | null;
        const countEl = this.querySelector('.p0vcount') as HTMLElement | null;
        const key = 'psych0.voted.' + id;
        fetch('/api/vote?id=' + encodeURIComponent(id))
          .then(r => r.json())
          .then(j => { if (countEl) countEl.textContent = String(j.n ?? 0); })
          .catch(() => { if (countEl) countEl.textContent = '0'; });
        btn?.addEventListener('click', () => {
          try { if (localStorage.getItem(key)) { btn.textContent = label + ' · VOTED'; return; } localStorage.setItem(key, '1'); } catch { /* private mode */ }
          fetch('/api/vote', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
            .then(r => r.json())
            .then(j => { if (countEl) countEl.textContent = String(j.n ?? 1); if (btn) btn.textContent = label + ' · VOTED'; })
            .catch(() => {});
        });
      }
    }
    customElements.define('psych0-vote', P0Vote);
  }
}

export function WebComponents() {
  useEffect(() => { register(); }, []);
  return null;
}
