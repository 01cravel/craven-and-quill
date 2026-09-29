# Craven & Quill UK signup test

Updated 29 September 2026. Original Traffic campaign published, then PAUSED at £0 recorded spend. Replacement Leads test is being prepared and must remain off until the gates in [validation-plan.md](validation-plan.md) pass. That protocol supersedes the original proposal below.

## What this test answers

Will UK adults create a free preview and leave an email after seeing the price? This is evidence of interest, not purchases or a proven profitable business. Checkout and physical fulfilment are not connected. Never call a signup an order or reservation.

Offer: Digital & Hardback **£49.99**, recommended first. Hardback **£35**, Digital **£19**. The user requested no “coming soon” text in ads. Ads promise only the working free preview; the final email step explicitly explains that it is not an order and takes no payment.

## Creative files

| Concept | Instagram feed/post | Instagram Story |
|---|---|---|
| Photo to character | reveal-feed.png | reveal-story.png |
| Open book | book-feed.png | book-story.png |

Built-in image generation was used. Prompts are recorded in prompts.json. All depicted people are synthetic, no customer photos were used. Book images are labelled illustrative mockups and are not photographs of printed stock.

Actual generated PNG sizes: feed 1122×1402 (approximately 4:5), Stories 941×1672 (approximately 9:16). The generator did not return the requested exact 1080×1350/1080×1920 dimensions. Use the appropriate placement version, inspect Meta's final crop and check that the account header and link button do not cover the price or CTA before launch. Do not describe these as exact standard-size exports. These are static image ads, not videos.

### Ad A

Primary text: Turn someone you love into the hero of their own story. Add one photo and see their illustrated character and first page free. Explore Digital & Hardback for £49.99. No card needed for the preview.

Headline: Their face. Their story.

Description: See their first page free.

CTA: Learn more (destination promises the free preview).

Destination: https://cravenandquill.com/?utm_source=meta&utm_medium=paid_social&utm_campaign=cq_uk_validation_2026&utm_content=reveal

### Ad B

Primary text: A familiar face at the heart of an illustrated adventure. Create a free first-page preview from one photo. Explore Digital & Hardback for £49.99. No card needed for the preview.

Headline: A story with them at the heart.

Description: Create their free preview.

CTA: Learn more.

Destination: https://cravenandquill.com/?utm_source=meta&utm_medium=paid_social&utm_campaign=cq_uk_validation_2026&utm_content=book

The two variants test overall concepts, not a single isolated wording change. Meta may allocate delivery unevenly, so this is not a statistically controlled A/B test.

## Account and campaign setup

- Created account: Craven & Quill (1788200192428375), GBP, within Luke Craven's Business (359043274851885). Payment method saved, email verified and phone verified. Europe/London was selected during preparation. No campaigns active and £0 spent at verification on 27 September 2026.
- Created Facebook Page: Craven & Quill (61595085862185), category Publisher. Select this Page in the campaign. A separate Instagram identity is not yet connected; do not use an unrelated existing brand.
- Proposed test cap: **£100 media spend over 7 days**, no automatic extension. Use a campaign lifetime budget with explicit end date. Verify taxes/payment fees before any final spending approval; £100 is not an all-cost project budget.
- Preview drawing API costs are separate. Production code limits accepted drawing requests to 50/day by default (durable DB counter), with the existing per-IP limit as an additional best-effort guard. Retries count. Confirm provider costs and set an appropriate project budget before paid traffic. A requests cap is not a monetary cap.
- UK location, adults 25–60, all genders. Parent/gift-buyer language; no narrow audience stacking in a small test.
- Placements: Facebook and Instagram feeds and Instagram Stories with the matching creative. Inspect all previews and disable unsuitable automatic crops/creative changes. No separate retargeting campaign initially.
- Consent-gated browser Pixel integration is implemented, but the Meta dataset and production receipt verification are still pending. No Conversions API or email service is connected. Keep the original Traffic campaign off; the replacement must optimise website Leads after verification. Do not claim the Meta connection is live until the public pixel ID is configured and Test Events confirms receipt.

## Measure and decide

The private /campaign-results page requires SIGNUPS_EXPORT_TOKEN in its password field. Never put that token in an ad link or commit it. Enter the actual Meta spend for the same report date range. The report does not fetch spend from Meta.

| Measure | Proposed criterion |
|---|---|
| Qualified signup | One unique active email, successful preview, chosen price, explicit buying interest and email permission |
| Signup cost | ≤£4 promising; £4–8 improve/retest; >£8 pause/rethink |
| Evidence | At least 25 qualified signups at ≤£4 for a paid-pilot decision, not proof of sales |
| Measured landing conversion | Aim ≥10%; below 5% after 100 measured visits, revisit offer/journey |
| Drawing reliability | Aim ≥95%; pause above 10% incomplete requests once there are 20 attempts |
| Early stop | £30 spent and zero qualified UK paid signups |
| Hard stop | Seven days or £100 media spend, whichever comes first |

Criteria are business hypotheses, not industry benchmarks. The dashboard only shows review prompts; it does not automatically pause Meta. Before activation, set an actual end date and lifetime cap and arrange a daily review. No monitoring automation has been created.

Count signups by exact campaign code and GB country supplied by Cloudflare. VPNs/missing country, removed tracking parameters, shared links, duplicates and consent refusal affect attribution. Reports are not Meta view-through attribution. Visit conversion uses only visitors who allow measurement and links their saved lead to that same random visit identifier. Do not divide all signups by only consented visitors. Drawing reliability is site-wide, including organic traffic and retries.

## Readiness and outstanding items

- Implemented: price-first email collection, explicit permission, server-side saved-lead source of truth, email deduplication, private CSV/report, unsubscribe endpoint and page, optional first-party visit events, generated SQL migrations, durable daily drawing limit.
- Local automated checks: 17 tests passing, including SQLite migration, server-controlled prices, duplicate email handling, expired/failed previews, failed storage, permission, origin checks, report auth, unsubscribe/reactivation and daily cap.
- Local browser QA: simulated drawing result, real local SQLite save; missing permission blocked; first save deliberately failed and showed no success; retry succeeded; report showed one UK Meta lead attributed to reveal and £3.00 at £3 simulated media spend. Phone product view at 390×844 showed £49.99 and no horizontal overflow. No real image API or production signup was used for these checks.
- Public customer/privacy contact approved: cravenluke@gmail.com. Published as Site version 19 after all 17 release checks passed. The deployment completed successfully, including the schema migration stage. Pending: notice review for the actual operating setup, Instagram identity, campaign draft/placement checks and launch. A real production drawing/signup has not been run as part of this release.
- Email addresses are saved but not verified. No confirmation email or launch email is sent automatically. Export includes an unsubscribe URL for each active subscriber; include it in any future launch email. Never send a bulk launch email without the intended message/send being authorised.
- Live orders still require production payment, complete book generation, print provider, shipping costs/times and support/refund operations. A good signup test is a reason to validate that next stage, not evidence those systems work.

Privacy references: [ICO email marketing consent](https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/guidance-on-direct-marketing-using-electronic-mail/how-do-we-comply-with-the-pecr-electronic-mail-marketing-rules/) and [ICO storage/measurement guidance](https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/guide-to-pecr/cookies-and-similar-technologies/). The notice is an implementation draft, not a legal sign-off.
