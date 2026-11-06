# Can paid ads sell Craven & Quill books at £5+ profit each? Evidence pack

Written 6 November 2026 for a second opinion. Everything below is either our own measured data (marked **Ours**), a published benchmark (**Benchmark**, with link), or a judgement (**Judgement**). Please challenge the judgements hardest.

## 1. The question

Each book must clear at least £5 profit after print, card fees, drawing costs and the advertising that produced the sale. Can Google search ads or Meta ads do that, and which is the better bet?

## 2. Unit economics (Ours, plus two estimates)

| | A5 hardback | A4 hardback |
|---|---|---|
| Current price (20% launch discount on) | £39.99 | £47.99 |
| Full price (discount off) | £49.99 | £59.99 |
| Print and delivery, Luke's figure | £16.00 | £18.00 |
| Card fee, Stripe UK standard 1.5% + 20p (estimate) | £0.80 | £0.92 |
| Drawing and story costs per book, estimate (1 character, 10 illustrated pages, cover, some retries at OpenAI image pricing) | £1.50 | £1.50 |
| **Margin before ads, current price** | **£21.69** | **£27.57** |
| **Margin before ads, full price** | **£31.69** | **£37.57** |
| **Most we can pay in ads per sale and keep £5, current price** | **£16.69** | **£22.57** |
| **Most we can pay in ads per sale and keep £5, full price** | **£26.69** | **£32.57** |

The drawing cost is a rough figure; if Luke has the real OpenAI bill per book, swap it in. Everything else follows arithmetically.

Turned into "how many clicks per sale can we afford":

| Channel, price | Cost per click | Clicks per sale allowed (A5 / A4) | Needed conversion rate (A5 / A4) |
|---|---|---|---|
| Google, current price | £1.12 (ours, 4–5 Nov) | 15 / 20 | 6.7% / 5.0% |
| Google, full price | £1.12 | 24 / 29 | 4.2% / 3.4% |
| Meta, current price | £0.25 (ours, Oct–Nov Traffic campaign) | 67 / 90 | 1.5% / 1.1% |
| Meta, full price | £0.25 | 107 / 130 | 0.9% / 0.8% |

Caveat on the Meta row: 25p was for a Traffic campaign (Meta chose people likely to click). Purchase-optimised Meta clicks cost more, typically 2 to 4 times as much, because Meta aims at people likely to buy. A realistic planning figure is 50p to £1.00 a click.

## 3. What we have measured so far (Ours)

### Google search, campaign "CQ | Google | Gift search | £10/day | UK", live since 4 Nov afternoon
- 4 Nov: 10 clicks, 175 impressions, £11.17, £1.12 per click, all clicks from the UK (Google's own location report).
- 5 Nov: about 16 clicks, about £16 (Google may spend up to double the daily budget on one day).
- 6 Nov to 11:00 UAE: 5 clicks, 55 impressions, £4.19, £0.84 per click.
- Running total roughly 31 clicks, £31, 0 sales. Google's promo page shows £25.02 counted so far (it lags and removes invalid clicks).
- Click-through rate 5 to 9%, which is high for search and says the ads match what people typed.
- Search terms that triggered clicks: "personalised children books", "personalised children's books", "personalised stories for kids", "personalised childrens christmas book", "personalised barbie book", "personalised wheres wally book". The last two are brand searches we should block.
- Site side, 4 Nov (cookie-free page totals): 20 arrivals carrying Google ad codes (includes reloads and Google's link checker), 2 opened the book maker, 1 added a photo, passed the check, entered a name and got their character drawn, 0 saw prices, 0 bought. 14 of 16 birthday-ad arrivals left the home page without starting.
- Site side, 5–6 Nov: not yet read (the owner dashboard needs a fresh sign-in). From 5 Nov every visitor's journey is recorded without cookies, so this will be the first clean read.

### Meta, campaign "CQ | D Drop a photo | Traffic | £10/day | UK", 27 Oct to 4 Nov, now off
- About 25p per click, placements mostly Reels and Instagram feed.
- 4 Nov: 22 ad visitors reached the photo page, 0 tapped "add photo". Across the campaign, no previews and no sales that we could attribute.
- Judgement: the Traffic objective bought people who tap things, not people who want a book. This is the known failure mode of Traffic campaigns and not evidence that Meta cannot work.

### Cookie problem, now fixed
Until 5 Nov the dashboard only recorded journeys for visitors who accepted the cookie banner, and almost nobody did, so the site looked empty while Google was reporting UK clicks. From 5 Nov every visit is measured without cookies (random visit reference carried in the page link; country, device, shortened IP and town recorded).

## 4. Google promo credit (Ours, read from the account on 6 Nov)
"Get £323.08 credit for spending £323.07 on Google Ads." Spent so far £25.02. Offer expires 3 January 2027.

How it works: it is not £323 free up front. We pay the first £323.07 ourselves, then Google adds £323.08 of credit for later spend. Over the first £646 of spend the effective cost is half price, so a £1.12 click is effectively 56p across that window. At £10/day we reach the threshold around 5 December, right before the Christmas order deadline (1 December for guaranteed delivery), which is bad timing: the credit would land after the gift season. If we want the credit to pay for Christmas traffic, spend needs to reach £323 by mid-November, meaning roughly £25 to £30 a day from now.

## 5. Published benchmarks (Benchmark)

### Google search, gifts category
- Shopping, Collectibles & Gifts: cost per click $4.14, conversion rate 4.01%, click-through 8.28%, cost per acquisition $49.40. Source: [Megadigital, Google Ads benchmarks 2026](https://megadigital.ai/en/blog/google-ads-benchmarks/) (same table reproduced at [Almcorp](https://almcorp.com/blog/google-ads-benchmarks-2026/)).
- Same category, 3.83% conversion, $47.94 per conversion. Source: [SourceLoop](https://sourceloop.ai/blog/conversion-rate-benchmarks-by-industry/).
- E-commerce search campaigns overall: 2.81% conversion, $45.27 cost per acquisition; Shopping campaigns 1.91% and $38.87. Source: [JetFuel, citing Store Growers](https://jetfuel.agency/ecommerce-google-ads-benchmarks-2026-roas-cpc-ctr-and-cpa-by-industry/).
- Caveat from JetFuel: all-industry conversion figures above about 8% blend lead-gen form fills with purchases; purchase-only rates for gifts run lower.
- Our click cost (£1.12, about $1.45) is far below the category's $4.14, so at a 4% conversion rate our cost per sale would be about £28, not £38. That is below the full-price ceiling (£26.69 A5 is borderline, £32.57 A4 clears it) and above the current-price ceiling.

### Meta, e-commerce
- Median purchase conversion rate about 1.6% (range 1.2% to 2.0% by industry). Sources: [Superscale, citing Triple Whale](https://superscale.ai/learn/meta-ads-benchmarks-by-industry/), [ContentStudio](https://contentstudio.io/blog/meta-ads-benchmarks).
- Median cost per purchase about $38 to $39 (£30). Sources: [Single Grain, citing Triple Whale](https://www.singlegrain.com/?p=81379), [Influee](https://influee.co/blog/how-much-do-facebook-ads-cost). A European guide gives €28 to €46. Source: [Trackbee](https://www.trackbee.io/blog/facebook-ads-cost).
- Median CPM about $15; traffic clicks about $0.60 to $0.78. Source: [Trackbee](https://www.trackbee.io/blog/facebook-ads-cost).
- Purchase ROAS benchmark about 1.88 for e-commerce overall. Source: [Coupler](https://blog.coupler.io/facebook-ads-statistics/). For us a 1.88 ROAS at £49.99 means £26.59 per sale, right at the A5 full-price ceiling.
- Caveat: no source breaks out the UK or personalised gifts. Figures are pooled across many shops and objectives.

### What the category leader does
- Wonderbly (personalised children's books, UK, millions of copies sold) says Facebook is its primary growth channel; paid Facebook ads are conversion-focused and mostly promote a single product; creative leans on the book illustrations, customer testimonials and carousels showing the personalisation. It also uses TV, outdoor and search, and models profit per channel each year to decide spend. Source: [Creative Review, how Wonderbly uses Facebook](https://www.creativereview.co.uk/insights-how-wonderbly-uses-facebook-to-drive-sales-of-its-personalised-childrens-books/).
- An agency case study reports Wonderbly scaling from £100k to £250k a day at the Q4 peak using lookalike audiences and retargeting. Source: [Cubatica case study](https://cubatica-site.pages.dev/case-study/wonderbly). Treat as agency marketing.
- No published acquisition-cost data exists for Wonderbly, Hooray Heroes or In The Book (private companies). A hypothetical financial model for the category assumes a $30 cost per customer against a $38 sale, which is a plan, not a measurement. Source: [Financial Models Lab](https://financialmodelslab.com/blogs/profitability/personalized-childrens-book-creation).

## 6. Reading the evidence (Judgement)

1. **At the current 20%-off prices, neither channel clears £5 a book at benchmark performance.** Google needs 1 sale per 15 clicks (A5); the gifts benchmark is 1 per 25. Meta needs about 1.5% at 25p clicks, which only holds if purchase-optimised clicks stay cheap, which they usually do not.
2. **At full price, both become plausible.** Google at benchmark conversion and our click cost gives about £28 per sale against ceilings of £26.69 / £32.57: A4 clears, A5 is marginal. Meta at the e-commerce median (£30 per sale, 1.88 ROAS) sits right on the A5 ceiling and under the A4 one.
3. **The price lever is bigger than the channel lever.** Removing the discount adds £10 of margin per book, which is more than the gap between a good and a bad ad channel. The discount can survive as a code for the email list and retargeting.
4. **Meta is where this category is won, but only with purchase-optimised ads and purchase reporting.** Wonderbly's stated model is conversion ads on Facebook with illustration-led creative. Our Meta attempt failed because it was a Traffic campaign with no purchase signal back to Meta. To do it properly we must send sales to Meta from our server (Conversions API, hashed buyer email), which works without the cookie banner, and run the Purchase objective. Expect a learning period of 2 to 3 weeks and roughly £300 to £500 before Meta finds buyers reliably; that is the real cost of entry.
5. **Google is the cheaper, faster test of whether the page converts at all.** The clicks are high-intent (search terms are exactly our product), CTR is strong, and the promo credit halves the effective cost of the first £646. If people who typed "personalised children's book" do not buy at full price, the problem is the page or the offer, and Meta will not fix that.
6. **The current bottleneck is the home page, not the ads.** 14 of 16 birthday-ad visitors left without opening the book maker. Search visitors want to see the product and price immediately; the page should open on a finished example and a "make yours in 2 minutes" start, with the price visible. Fixing that is cheaper than any ad change and improves both channels.
7. **A4 is the better book to push.** It carries £6 more margin and only costs £2 more to print; the ads can nudge towards it (default selection, "most popular").

## 7. Recommendation (Judgement)

1. Today: put prices back to £49.99 / £59.99; keep 20% as a code for the email list. Default the size picker to A4.
2. Today: fix the home page for search visitors (example book, price and start button in the first screen). Measure with the new funnel.
3. Keep Google at £10/day as the intent test. Add negatives for Barbie, Where's Wally and other brands. Review after 100 clicks (about 10 days): if conversion is under 2%, pause and fix the page before any Meta spend. If 3%+, raise to £25/day to reach the promo threshold before Christmas.
4. In parallel, build the Meta purchase campaign: server-side purchase reporting, Purchase objective, character-reveal video plus illustration carousel, UK parents and grandparents. Start it only when the page converts Google visitors at 2%+, with a £300 cap for the learning period.
5. Kill line for both channels: if £100 of spend on a channel produces no sale after the page fix, stop that channel.
6. Add profit per book to the dashboard (price minus print, fee, drawing and ad spend per sale) so this is judged on live numbers, not benchmarks.

## 8. Questions to sense-check

- Is £1.50 per book for drawing and story about right? If it is £5, every ceiling above drops by £3.50.
- Is 1.5% + 20p the real card fee (Stripe UK standard), or is the account on a different rate?
- Does the print price include delivery to the customer and a proof copy, or is that extra?
- Is 2% the right line for "the page works" on Google search traffic? The category benchmark is 4%, our clicks are cheaper than the category average, so 2% may be too lenient.
- Is full price (£49.99 / £59.99) still competitive? Wonderbly hardbacks sit around £25 to £35; our pitch is a longer, photo-based, custom-drawn book, but the price gap needs the page to make that obvious.
- Will the promo-credit timing matter? Reaching £323 by mid-November needs £25 to £30 a day, which only makes sense if the page converts.

## 9. Confidence

- Unit economics: high, apart from the drawing cost estimate.
- Our Google and Meta figures: high for Google (read from the account), medium for Meta (campaign is off; figures from memory of the dashboard on 4 Nov).
- Benchmarks: medium. They are pooled, mostly US, and not specific to personalised gifts.
- Wonderbly channel claim: medium-high (the company's own words in an interview), but no cost data.
- Judgements 1 to 7: these are my reading of the above and should be argued with.
