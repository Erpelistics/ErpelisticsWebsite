# Festival application page — URL-parameter personalization

## Context

`content/Festival-Bewerbung/` (committed in `5ac8b1b`) is a hidden, unlisted
page bundle (`params.private: true`) at `/festival-bewerbung/` (DE) and
`/en/festival-application/` (EN), used to send festivals a self-contained
booking page (bio, photos, music, showreel, contact) instead of a Google
Drive folder.

This follow-up adds lightweight personalization: appending `?festival=Name`
to the link should make the page greet that festival by name, so it reads
as a page made specifically for them.

Hugo is a static site generator — there is no per-request server-side
rendering, so personalization must happen client-side, after the static
HTML has loaded, via JavaScript reading `window.location.search`.

## Requirements

1. `?festival=<name>` in the URL personalizes:
   - The page's `<h1>` heading (currently "Festival-Bewerbung" / "Festival
     Application").
   - The greeting line at the top of the letter (currently "Liebes
     Festival-Team," / "Dear Festival Team,").
2. **Hard requirement:** the page must be fully valid and read naturally
   with the parameter missing, misspelled, or stripped by an email client —
   i.e. with no JavaScript-driven change at all. This is not an edge case
   to tolerate; the unpersonalized page is the actual default state the
   template text is written for, not a placeholder.
3. No secret or access-control implication: `festival` is a display-only
   value. It is never trusted for anything beyond text substitution.
4. Works for both the German and English page (they share one bundle
   folder and should share one script, not duplicate logic).

## Design

### Targeting mechanism: `data-template` attributes

Any element carrying `data-template="...{name}..."` is a candidate for
substitution. This is deliberately generic (not "the heading" and "the
greeting" as special-cased lookups) so a future personalized field is just
another attribute, no script change needed.

- `layouts/partials/title.html` (shared across the whole site) gets a
  small, purely additive change: the `<h1>` gets `id="page-title"`, and —
  **only if** the page's frontmatter sets `params.title_template` — a
  `data-template="{{ .Params.title_template }}"` attribute. Every other
  page on the site leaves `title_template` unset, so this is a no-op
  everywhere except the festival application page.
- `content/Festival-Bewerbung/index.md` frontmatter adds:
  ```yaml
  params:
    title_template: "Bewerbung für {name}"
  ```
  `index.en.md` adds:
  ```yaml
  params:
    title_template: "Application for {name}"
  ```
- The greeting line in both markdown bodies is wrapped as raw HTML (same
  pattern already used for the video-container embeds on this site):
  ```html
  <p data-template="Liebes {name}-Team,">Liebes Festival-Team,</p>
  ```
  (English: `data-template="Dear {name} Team,"` / `Dear Festival Team,`)

  The element's **existing text content is the real default copy**, not a
  placeholder — satisfying requirement 2 by construction: if the script
  never runs, the visible text is exactly what's already live today.

### `personalize.js` (new file, in the `Festival-Bewerbung` bundle)

```js
(function () {
  const festival = new URLSearchParams(window.location.search)
    .get("festival")?.trim();
  if (!festival) return;

  document.querySelectorAll("[data-template]").forEach((el) => {
    el.textContent = el.dataset.template.replace("{name}", festival);
  });
})();
```

- `URLSearchParams.get()` already URL-decodes the value; no extra parsing.
- Substitution uses `.textContent`, never `.innerHTML` — the festival name
  can never be interpreted as markup, so there's no XSS risk from
  reflecting this URL value, even though it's fully attacker-controlled.
- No param, empty param, or a browser with JS disabled → the `forEach`
  never runs (early `return`) or never executes at all → default text
  stands, unmodified. This is the same code path as "works", not a
  separate fallback branch to maintain.

### Wiring it up

Both `index.md` and `index.en.md` reference the same bundle-relative file:

```html
<script src="personalize.js" defer></script>
```

placed once near the top of each file's markdown body. Hugo duplicates
non-language-specific bundle resources into each translated page's output
directory, so the relative reference resolves correctly for both
`/festival-bewerbung/personalize.js` and
`/en/festival-application/personalize.js` — to be confirmed by inspecting
the production build output during implementation.

## Testing

- `hugo --minify --baseURL "https://erpelistics.band/"`; confirm
  `personalize.js` exists under both `public/festival-bewerbung/` and
  `public/en/festival-application/`.
- `hugo server`; manually check:
  - `/festival-bewerbung/?festival=Testival` → heading and greeting show
    "Testival".
  - `/festival-bewerbung/` (no param) and `/festival-bewerbung/?festival=`
    (empty param) → both show today's unmodified default text.
  - English equivalents behave the same way.
- Re-run the existing hidden-page checks (noindex meta, absence from
  sitemap/home/menu) to confirm this change hasn't regressed them.

## Non-goals

- No link-generator UI — links are hand-crafted (`?festival=Name`), per
  prior decision.
- No additional personalized fields (e.g. contact person, a custom
  intro sentence) — out of scope for this iteration, can be added later
  by adding more `data-template` elements without touching the script.
- No server-side rendering, access control, or analytics on which
  festival opened the link.
