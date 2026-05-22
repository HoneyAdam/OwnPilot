import { useMemo } from 'react';
import DOMPurify__default from 'dompurify';
import type { WidgetTone } from './widget-types';
import { WidgetShell } from './WidgetShell';

// Handle both CJS (node test env) and ESM imports
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const DOMPurify = (DOMPurify__default as any).default ?? DOMPurify__default;

interface Props {
  data: unknown;
  tone?: WidgetTone;
  title?: string;
}

interface HtmlData {
  html: string;
  title?: string;
}

function isHtmlData(item: unknown): item is HtmlData {
  if (typeof item !== 'object' || item === null) return false;
  return typeof (item as Record<string, unknown>).html === 'string';
}

// Restrict URIs in href/src to http(s), mailto, and relative paths. The
// default DOMPurify allow-list also permits `tel:`, `xmpp:`, and a handful
// of niche schemes; we tighten so a sanitized blob cannot ship a
// surprise `data:`, `blob:`, or `vbscript:` link.
const SAFE_URI_RE = /^(?:(?:https?|mailto):|\/|#|[a-zA-Z0-9_./?=&%+-]+$)/i;

// Tags / attributes we accept. Explicit allow-listing means we don't rely
// on DOMPurify USE_PROFILES (which is implicit and version-dependent).
const ALLOWED_TAGS = [
  'p',
  'br',
  'b',
  'i',
  'em',
  'strong',
  'ul',
  'ol',
  'li',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'blockquote',
  'pre',
  'code',
  'a',
  'img',
  'table',
  'thead',
  'tbody',
  'tr',
  'th',
  'td',
  'div',
  'span',
] as const;

const ALLOWED_ATTR = ['href', 'src', 'alt', 'title', 'class', 'target', 'rel'] as const;

let dompurifyHooked = false;
function ensureDompurifyHook(): void {
  if (dompurifyHooked) return;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dp = DOMPurify as any;
  if (typeof dp.addHook !== 'function') return;
  // After sanitization, force `rel="noopener noreferrer"` on every
  // `<a target="_blank">` so a sanitized link cannot tabnab the parent
  // window via `window.opener`.
  dp.addHook('afterSanitizeAttributes', (node: Element) => {
    if (node.tagName === 'A' && node.getAttribute('target') === '_blank') {
      node.setAttribute('rel', 'noopener noreferrer');
    }
    // Strip target on non-_blank values to avoid `target="self"` shadowing.
    if (node.tagName === 'A') {
      const target = node.getAttribute('target');
      if (target && target !== '_blank') {
        node.removeAttribute('target');
      }
    }
  });
  dompurifyHooked = true;
}

function sanitizeHtml(html: string): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dp = DOMPurify as any;
  if (!dp || typeof dp.sanitize !== 'function') {
    // Fallback: strip all tags in non-DOMPurify environments (e.g., test SSR)
    return html.replace(/<[^>]*>/g, '').slice(0, 10000);
  }
  ensureDompurifyHook();
  // Explicit, restrictive config — no implicit profiles, no SVG/MathML
  // namespace, no `data:` URIs, no `style` attribute, no template
  // expressions. SAFE_FOR_TEMPLATES blocks mXSS via `{{}}` `${}` brackets.
  return dp.sanitize(html, {
    ALLOWED_TAGS: [...ALLOWED_TAGS],
    ALLOWED_ATTR: [...ALLOWED_ATTR],
    ALLOWED_URI_REGEXP: SAFE_URI_RE,
    ALLOW_DATA_ATTR: false,
    ALLOW_ARIA_ATTR: false,
    ALLOW_UNKNOWN_PROTOCOLS: false,
    USE_PROFILES: { html: true, svg: false, svgFilters: false, mathMl: false },
    SAFE_FOR_TEMPLATES: true,
    FORBID_TAGS: ['style', 'script', 'iframe', 'object', 'embed', 'form', 'meta', 'link', 'base'],
    FORBID_ATTR: ['style', 'onerror', 'onload', 'onclick', 'formaction', 'srcdoc'],
    KEEP_CONTENT: false,
    RETURN_TRUSTED_TYPE: false,
  });
}

function HtmlIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
      />
    </svg>
  );
}

export function HtmlWidget({ data, title: titleProp }: Props) {
  const record = typeof data === 'object' && data !== null ? data : {};
  const title = (record as { title?: string }).title || titleProp;

  const htmlContent = isHtmlData(data) ? data.html : typeof data === 'string' ? data : '';

  const sanitized = useMemo(() => sanitizeHtml(htmlContent), [htmlContent]);

  if (!htmlContent) {
    return (
      <WidgetShell title={title || 'HTML'} icon={<HtmlIcon />} tone="warning">
        <p className="text-sm text-text-secondary">No HTML content provided</p>
      </WidgetShell>
    );
  }

  return (
    <WidgetShell title={title || 'HTML'} icon={<HtmlIcon />}>
      <div
        className="prose prose-sm dark:prose-invert max-w-none"
        dangerouslySetInnerHTML={{ __html: sanitized }}
      />
    </WidgetShell>
  );
}
