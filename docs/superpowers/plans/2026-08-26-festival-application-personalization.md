# Festival Application Personalization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `/festival-bewerbung/` (and its English translation) greet a festival by name when the link includes `?festival=<name>`, while looking and reading correctly with no parameter at all.

**Architecture:** Hugo is a static site generator with no per-request rendering, so personalization happens client-side. A shared `title.html` partial gets a generic, opt-in `data-template` hook; the festival page's own markdown wraps its greeting line the same way; a small vanilla-JS file reads `?festival=` and does a plain text substitution wherever it finds `[data-template]`. Both language pages reference this one script via an absolute path into the German bundle's published output directory — the one place Hugo actually publishes it (see Task 2 note: Hugo shares/inherits a non-language-suffixed bundle resource rather than duplicating it into every translated page's own directory).

**Tech Stack:** Hugo 0.124.1 extended, Go templates, vanilla JavaScript (no build step, no framework — this repo has no `package.json`/JS test runner). Verification is via `hugo --minify` build output inspection and a real browser against `hugo server`, matching how the rest of this static site is validated (there is no unit test suite to extend).

**Spec:** `docs/superpowers/specs/2026-08-26-festival-application-personalization-design.md`

## Global Constraints

- Personalization is entirely client-side — no server-side rendering exists or is added (spec: Context).
- Text substitution must use `.textContent`, never `.innerHTML` — the `festival` URL value is fully attacker-controlled and must never be interpreted as markup (spec: `personalize.js`).
- **Hard requirement:** with the `festival` parameter missing or empty, the page must render exactly today's already-approved default copy — this is the real default state, not a placeholder to special-case (spec: Requirements #2).
- The `title.html` change must be a no-op (byte-for-byte, same output) for every page that does not set `params.title_template` (spec: Targeting mechanism).
- Must not regress the existing hidden-page behavior already shipped in commit `5ac8b1b`: `noindex, nofollow` meta tag, and absence from `sitemap.xml`, the home page grid, and the main nav menu.

---

### Task 1: Add the `page-title` / `data-template` hook to the shared title partial

**Files:**
- Modify: `layouts/partials/title.html`

**Interfaces:**
- Produces: on any page, the rendered `<h1>` now has `id="page-title"`. If that page's frontmatter sets `params.title_template` to a non-empty string, the `<h1>` also gets `data-template="<that string>"`. Pages that don't set `title_template` get only the `id` — output is otherwise unchanged. Task 3 relies on `id="page-title"` and this conditional `data-template` attribute existing.

- [ ] **Step 1: Write the failing check**

Confirm the attribute doesn't exist yet anywhere on the site:

```bash
cd "/home/constantin/Documents/Persönlich/Erpelistics/ErpelisticsWebsite"
hugo --minify --baseURL "https://erpelistics.band/" > /dev/null
grep -o "page-title" public/die-band/index.html | wc -l
```

Expected: `0`

- [ ] **Step 2: Read the current file**

```bash
cat layouts/partials/title.html
```

Current content:

```html
{{ if .Title }}
  <hgroup>
    <h1>{{ .Title }}</h1>
    {{ with .Params.Description }}
      <p>{{ . | markdownify }}</p>
    {{ end }}
  </hgroup>
{{ end }}
```

- [ ] **Step 3: Edit the `<h1>` line**

Replace:

```html
    <h1>{{ .Title }}</h1>
```

with:

```html
    <h1 id="page-title"{{ with .Params.title_template }} data-template="{{ . }}"{{ end }}>{{ .Title }}</h1>
```

The full file should now read:

```html
{{ if .Title }}
  <hgroup>
    <h1 id="page-title"{{ with .Params.title_template }} data-template="{{ . }}"{{ end }}>{{ .Title }}</h1>
    {{ with .Params.Description }}
      <p>{{ . | markdownify }}</p>
    {{ end }}
  </hgroup>
{{ end }}
```

- [ ] **Step 4: Run the check again — verify it passes on an unrelated page**

```bash
hugo --minify --baseURL "https://erpelistics.band/" > /dev/null
grep -o "page-title" public/die-band/index.html | wc -l
grep -o "data-template" public/die-band/index.html | wc -l
```

Expected: first command prints `1` (the `id` was added); second prints `0` (Die Band has no `title_template`, so the attribute is absent there — proving the change is a no-op for pages that don't opt in).

- [ ] **Step 5: Commit**

```bash
git add layouts/partials/title.html
git commit -m "$(cat <<'EOF'
feat(festival-application): Add opt-in data-template hook to page title

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Create `personalize.js` and wire it into both language pages

> **Correction (ruling recorded during implementation):** this task originally specified a bundle-relative `<script src="personalize.js">` on both pages, on the premise that Hugo duplicates shared page-bundle resources into every translated page's own output directory. That premise is false — Hugo shares/inherits such a resource and publishes it exactly once, under the lowest-`weight`-language bundle (German, `weight = 1`), confirmed via a clean build, the pre-existing identical pattern in `content/Konzerte/`, and Hugo's multilingual-bundles docs. The steps below use the corrected absolute path `/festival-bewerbung/personalize.js` on **both** pages and a corrected Step 5 verification. See `docs/superpowers/specs/2026-08-26-festival-application-personalization-design.md` § Wiring it up for the full explanation.

**Files:**
- Create: `content/Festival-Bewerbung/personalize.js`
- Modify: `content/Festival-Bewerbung/index.md`
- Modify: `content/Festival-Bewerbung/index.en.md`

**Interfaces:**
- Consumes: `id="page-title"` / conditional `data-template` attribute on `<h1>`, produced by Task 1.
- Produces: `personalize.js` is a self-executing script with no exports. Task 3 verifies its effect by loading the page in a real browser — there's nothing later tasks call directly.

- [ ] **Step 1: Write the failing check**

The script doesn't exist yet, so it can't have been copied into the build output for either language:

```bash
cd "/home/constantin/Documents/Persönlich/Erpelistics/ErpelisticsWebsite"
hugo --minify --baseURL "https://erpelistics.band/" > /dev/null
ls public/festival-bewerbung/personalize.js
```

Expected: `ls` fails with "No such file or directory".

(Note: `personalize.js` will only ever be published under `public/festival-bewerbung/` — see the correction note above. Do not check for it under `public/en/festival-application/`; it will never exist there by design.)

- [ ] **Step 2: Create `content/Festival-Bewerbung/personalize.js`**

```js
(function () {
  const festival = new URLSearchParams(window.location.search)
    .get("festival")
    ?.trim();
  if (!festival) return;

  document.querySelectorAll("[data-template]").forEach((el) => {
    el.textContent = el.dataset.template.replace("{name}", festival);
  });
})();
```

- [ ] **Step 3: Wire up `content/Festival-Bewerbung/index.md`**

In the frontmatter, change:

```yaml
params:
  private: true
  hide_gallery: false
```

to:

```yaml
params:
  private: true
  hide_gallery: false
  title_template: "Bewerbung für {name}"
```

Immediately after the closing `---` of the frontmatter, change:

```markdown
Liebes Festival-Team,
```

to:

```markdown
<script src="/festival-bewerbung/personalize.js" defer></script>

<p data-template="Liebes {name}-Team,">Liebes Festival-Team,</p>
```

(The line `vielen Dank für euer Interesse...` that already follows stays exactly as it is, as its own separate paragraph. Note the absolute path — see the correction note at the top of this task.)

- [ ] **Step 4: Wire up `content/Festival-Bewerbung/index.en.md`**

In the frontmatter, change:

```yaml
params:
  private: true
  hide_gallery: false
```

to:

```yaml
params:
  private: true
  hide_gallery: false
  title_template: "Application for {name}"
```

Immediately after the closing `---` of the frontmatter, change:

```markdown
Dear Festival Team,
```

to:

```markdown
<script src="/festival-bewerbung/personalize.js" defer></script>

<p data-template="Dear {name} Team,">Dear Festival Team,</p>
```

(The line `thank you for your interest...` stays exactly as it is, as its own separate paragraph. Note the absolute path pointing at the German bundle's output directory — see the correction note at the top of this task; this is intentional and correct for the English page too, since that's the only place Hugo publishes the file.)

- [ ] **Step 5: Run the check again — verify the script is duplicated into both language outputs and the markup is correct**

```bash
hugo --minify --baseURL "https://erpelistics.band/" > /dev/null

# Script file exists at its one real published location
ls public/festival-bewerbung/personalize.js

# Both pages' script tag points at that same absolute URL
grep -o '/festival-bewerbung/personalize.js' public/festival-bewerbung/index.html | wc -l
grep -o '/festival-bewerbung/personalize.js' public/en/festival-application/index.html | wc -l

# data-template present on both the heading and the greeting, on both pages
grep -o 'data-template="[^"]*"' public/festival-bewerbung/index.html
grep -o 'data-template="[^"]*"' public/en/festival-application/index.html
```

Expected:
- `ls` succeeds — the file exists.
- Both `grep -o '/festival-bewerbung/personalize.js' | wc -l` calls print `1` or higher (each page's `<script src>` references that one absolute URL).
- The German `data-template` grep prints two lines: `data-template="Bewerbung für {name}"` and `data-template="Liebes {name}-Team,"`.
- The English `data-template` grep prints two lines: `data-template="Application for {name}"` and `data-template="Dear {name} Team,"`.

- [ ] **Step 6: Commit**

```bash
git add content/Festival-Bewerbung/personalize.js content/Festival-Bewerbung/index.md content/Festival-Bewerbung/index.en.md
git commit -m "$(cat <<'EOF'
feat(festival-application): Personalize heading and greeting via ?festival=

Reads the festival name from the URL client-side (Hugo has no
per-request rendering) and substitutes it into the heading and
greeting via data-template attributes. Falls back to the existing
default copy untouched when the parameter is missing or empty.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Verify personalization end-to-end in a real browser, and confirm no regression to the hidden-page behavior

**Files:** none (verification only)

**Interfaces:**
- Consumes: the full feature built in Tasks 1–2.

- [ ] **Step 1: Start the dev server**

```bash
cd "/home/constantin/Documents/Persönlich/Erpelistics/ErpelisticsWebsite"
hugo server
```

Leave it running (default: `http://localhost:1313/`).

- [ ] **Step 2: Check the personalized German page in a browser**

Load the following skill first if it is not already loaded: `claude-in-chrome`. Then navigate to:

```
http://localhost:1313/festival-bewerbung/?festival=Testival
```

Read the rendered `<h1>` and the first line of body text.

Expected:
- Heading reads exactly: `Bewerbung für Testival`
- Greeting line reads exactly: `Liebes Testival-Team,`

- [ ] **Step 3: Check the German default (no parameter) still reads naturally**

Navigate to:

```
http://localhost:1313/festival-bewerbung/
```

Expected:
- Heading reads exactly: `Festival-Bewerbung`
- Greeting line reads exactly: `Liebes Festival-Team,`
- No visible error, broken text, or literal `{name}` anywhere on the page.

- [ ] **Step 4: Check the personalized English page**

Navigate to:

```
http://localhost:1313/en/festival-application/?festival=Testival
```

Expected:
- Heading reads exactly: `Application for Testival`
- Greeting line reads exactly: `Dear Testival Team,`

- [ ] **Step 5: Check the English default (no parameter)**

Navigate to:

```
http://localhost:1313/en/festival-application/
```

Expected:
- Heading reads exactly: `Festival Application`
- Greeting line reads exactly: `Dear Festival Team,`
- No literal `{name}` or broken text anywhere on the page.

- [ ] **Step 6: Confirm the empty-parameter edge case also falls back cleanly**

Navigate to:

```
http://localhost:1313/festival-bewerbung/?festival=
```

Expected: identical to Step 3 (heading `Festival-Bewerbung`, greeting `Liebes Festival-Team,`) — an empty value must not produce `Bewerbung für -Team,` or any other malformed text.

- [ ] **Step 7: Regression-check the existing hidden-page properties**

Stop the dev server (`Ctrl+C`) and run a production build:

```bash
hugo --minify --baseURL "https://erpelistics.band/" > /dev/null

grep -o 'noindex, nofollow' public/festival-bewerbung/index.html | wc -l
grep -o 'festival' public/sitemap.xml | wc -l
grep -o 'festival' public/index.html | wc -l
grep -o 'festival' public/en/sitemap.xml | wc -l
```

Expected: first command prints `1` or more; the remaining three all print `0` — the page is still noindexed and still absent from both sitemaps and the home page grid.

- [ ] **Step 8: No commit needed**

This task makes no file changes — it only verifies Tasks 1–2. If any expectation above was not met, fix the relevant file from Task 1 or 2, re-run that task's checks, and re-run this task from Step 1.
