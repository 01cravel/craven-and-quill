# Printed book rules (from the first real order, 19 Nov 2026)

Read before changing the print layout (src/print-book.js) or releasing an order.

## Layout (owner decisions)
- No "Written for age X" tag on the front cover or the site preview.
- The cover's dark fade is one see-through image. Never stacked strips: they showed hairline stripes in PDF viewers and can show in print.
- One vertically centred opening page: title, "A story just for", name, "Given with love by …", dedication. No separate dedication or "Let the story begin" pages.
- Craven & Quill logo (white and gold, assets/logo-on-dark.png) at the foot of the front cover, under the title.
- Words pages carry the book title at the top and a page number at the foot (opening page counts as 1, so the first words page is 3). The site preview uses the same numbers.
- Back cover: brand green, a framed portrait of the child holding a keepsake from the story (the 12th picture, art.back), "Made especially for …", "With love from …", logo and cravenandquill.com. No story summary.
- 24 pages: front cover, opening page, 10 picture/words spreads, The End, back cover. No filler pages ("One story. Entirely theirs." and "Made especially for …" were removed).
- Pictures on the left, words on the right. PDF page 2 prints on a right-hand page.

## Prodigi (BOOK-FE-A4/A5-P-HARD-G)
- Exact trim size, no bleed (Prodigi adds it). Keep text 10mm+ from every edge.
- Page 1 is the front cover, the last page is the back cover. Total must be even and at least 24.
- 300dpi recommended. Our 2304x3264 art is about 278dpi at A4.
- Prodigi offers no photo or video of printed items. Order a sample to see one (50% off the first, via support@prodigi.com).

## Known gaps
- Paid orders are not drawn automatically: nothing calls the `run_artwork_jobs` site tool. Until fixed, draw from the order desk (all 11 images, then make the proof).
- The first customer's receipt email was rejected by the email provider.
- The story writer can invent details (pets, family). Since 19 Nov 2026 the customer's typed wishes are saved on the order and shown at the top of the order desk's book review, so check the book against them.
