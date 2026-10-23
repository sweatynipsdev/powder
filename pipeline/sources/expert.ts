// A local human forecaster's page, read through the WordPress REST API (e.g. the Mammoth
// Snowman's forecast page, which is edited in place rather than posted). The text goes to
// the writer only; the app shows who, when and a link, so their words aren't republished.

import type { ExpertPost } from '../../shared/types';
import type { ResortConfig } from '../config';
import { zonedTime } from '../clock';
import { fetchJson } from '../http';
import { htmlToText, truncate } from './text';

type ExpertConfig = NonNullable<ResortConfig['expert']>;

/** Enough of their discussion for the writer without the whole archive. */
const TEXT_MAX = 4000;

interface WpPage {
  modified_gmt?: string;
  link?: string;
  title?: { rendered?: string };
  content?: { rendered?: string };
}

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];

/** "Wednesday, October 21st, 2026 @ 2 PM" (local time) → ISO instant. */
export function parseDateline(text: string, tz: string): string | null {
  const m = text.match(/(?:\w+day),\s+(\w+)\s+(\d{1,2})(?:st|nd|rd|th)?,\s+(\d{4})\s*@\s*(\d{1,2})(?::(\d{2}))?\s*([AP])\.?M/i);
  if (!m) return null;
  const month = MONTHS.indexOf(m[1].toLowerCase()) + 1;
  if (!month) return null;
  let hour = Number(m[4]) % 12;
  if (m[6].toUpperCase() === 'P') hour += 12;
  return zonedTime(Number(m[3]), month, Number(m[2]), hour, Number(m[5] ?? 0), tz).toISOString();
}

export function parseExpertPage(cfg: ExpertConfig, page: WpPage, tz: string): ExpertPost {
  const html = page.content?.rendered;
  if (!html) throw new Error(`${cfg.source}: page has no content`);
  let text = htmlToText(html);
  if (cfg.cutAt) {
    const cut = text.indexOf(cfg.cutAt);
    if (cut > 0) text = text.slice(0, cut);
  }
  text = text.trim();
  // Edits like typo fixes move modified_gmt, so the dateline the forecaster writes wins.
  const publishedAt = parseDateline(text, tz) ?? (page.modified_gmt ? `${page.modified_gmt}Z` : null);
  const when = publishedAt
    ? new Date(publishedAt).toLocaleString('en-US', { timeZone: tz, weekday: 'long', hour: 'numeric', minute: '2-digit' })
    : null;
  return {
    source: cfg.source,
    author: cfg.author,
    // WordPress SEO titles sometimes end with a zip code ("… – 93546").
    title: htmlToText(page.title?.rendered ?? '').replace(/\s*[–-]\s*\d{5}$/, '') || `${cfg.source} forecast`,
    url: cfg.url,
    publishedAt,
    excerpt: `${cfg.author}'s local forecast${when ? `, updated ${when}` : ''}. Read the full discussion on ${cfg.source}.`,
    text: truncate(text, TEXT_MAX),
  };
}

export async function fetchExpert(r: ResortConfig): Promise<ExpertPost> {
  const cfg = r.expert;
  if (!cfg) throw new Error('no local expert configured');
  return parseExpertPage(cfg, await fetchJson<WpPage>(cfg.api), r.tz);
}
