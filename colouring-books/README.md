# Colouring books site

The colouring-book demand-test site, published at **cravenandquill.com/colouring-books/**.
Plain HTML/CSS/JS — no build step, no framework.

- Published files live in `dist/client/colouring-books/` (that folder is what the
  site serves, same as the storybook pages next to it).
- This folder holds the notes and the image-regeneration tool. Nothing here is published.

## Preview locally

From the repo root:

```bash
cd dist/client && python3 -m http.server 8123
```

Then open http://localhost:8123/colouring-books/ (the storybook site is at http://localhost:8123/).

## Inside `dist/client/colouring-books/`

- `index.html`, `shop.html`, `about.html`, `faq.html`, `shipping-returns.html` — pages.
- `books/` — one product page per title.
- `assets/css/style.css` — the whole design system.
- `assets/js/main.js` — nav, gallery, FAQ, signup form, and the three config values (below).
- `assets/img/` — optimized images. Regenerate from the original artwork with
  `CQ_ART_REPO=/path/to/craven-and-quill-colouring-books python3 colouring-books/scripts/build_assets.py`
  (needs Pillow: `pip3 install pillow`). The artwork lives in the colouring-books repo, not this one.
- `sitemap.xml` — lists the colouring-book pages with full live URLs.

## Current phase: demand test

Not a live store yet. Every page funnels to one action: leave your email, get told
when it's live. That's deliberate.

All three switches are at the top of `assets/js/main.js`:

1. **`NEWSLETTER_ENDPOINT`** — where signups go. **Until this is set, no emails are
   captured anywhere**; the success message is real UI but the address goes nowhere.
   Plan: Formspree (free, no card). Sign up, create a form, paste its endpoint here:
   ```js
   const NEWSLETTER_ENDPOINT = "https://formspree.io/f/xxxxxxxx";
   ```
   Every form on every page starts posting there. Nothing else to edit.
2. **`LAUNCH_DATE`** — drives every "Launching in 2 weeks / X days" string. Move it
   as the real date moves.
3. **`BOOKS`** — paste each title's Amazon URL once it has an ASIN. Every buy button
   and badge flips to "Buy on Amazon" / "Available on Amazon" automatically.

## Still to do

- **Contact address.** None yet (the Shipping & Returns page says so). Add a business
  inbox when there is one — never a personal address.
- **Folder URL check after first deploy.** Live pages are served by the small
  Cloudflare worker in `dist/server/index.js`. `/colouring-books/` should resolve to
  `index.html` the same way `/` does; if it ever 404s while
  `/colouring-books/index.html` works, the fix is one line in that worker to serve
  `index.html` for folder paths.

## Content decisions

- **US English** ("color", "coloring") to match the book covers and the Amazon.com market.
- Ghost characters are described generically — their internal names aren't cleared for public use.
- No reviews, ratings, testimonials or social links — none exist yet, nothing is invented.
- Modest paper claims only (no "marker-proof", no "premium paper").
- Every "coming soon" touchpoint funnels to the email form and nowhere else, so the
  test measures one thing: will someone hand over their email for this.
