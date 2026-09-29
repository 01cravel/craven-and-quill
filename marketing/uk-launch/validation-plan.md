# UK paid-intent validation protocol

Decision owner: Luke Craven. Prepared 29 September 2026, before test spend.

## Current state

Original Traffic campaign 120248541867000557 is OFF. Meta showed £0 spent on 29 September at pause. It must stay off. The replacement is not authorised to spend until the checks below pass. Total authorised media budget remains £100, not £100 per creative. Taxes and preview API costs are separate and must be included when assessing economics.

## What this £100 test can decide

Can the current offer acquire price-aware UK prospects cheaply enough to justify a paid pilot? It cannot prove purchases, margins, repeat demand, or automated fulfilment. No payment or reservation is implied by joining the list. Avoid a binary “business validated” verdict from a handful of emails.

Primary outcome: unique, still-subscribed UK email with a successful preview, chosen format/price, affirmative buying interest and email permission. The website database is the source of truth. Meta receives a Lead only after successful saving and separate advertising consent. Email addresses are not verified; count quality as provisional. Organic, QA, old campaigns, non-UK and unsubscribed rows are excluded. Budget allocation between creatives is not a controlled A/B test.

## Campaign

- New Leads campaign, website destination, conversion goal (not landing-page views), dedicated Craven & Quill dataset, Lead event.
- One UK ad set, adults 25–60, all genders, broad audience. Existing gift/portrait creative does the initial filtering. This tests that audience only, not every possible segment.
- Reuse two reviewed concepts, Facebook Feed, Instagram Feed and Instagram Stories, correct placement assets. Do not let automatic creative tools alter price/text. Use the brand Page identity.
- Lifetime £100 shared by the two ads. Start only after gates pass, end seven days later. Old campaign remains off. No other paid campaigns, retargeting, or automatic budget expansion.
- Highest volume bidding. Small budget may not produce enough conversions for stable optimisation; do not switch back to clicks merely to increase event count.
- Destination campaign code: cq_uk_validation_2026, source meta, medium paid_social; creative reveal or book. Price is £49.99 for Digital & Hardback, £35 hardback, £19 digital. Analyse format choice separately; digital signups do not validate a £49.99 hardback bundle.
- Track website signups independently of Meta consent. Do not infer that unmeasured visits failed to convert. Avoid dividing all leads by only consented visitor counts.

## Readiness gates (all required before restart)

1. New dataset created after Luke accepts Meta Business Tools Terms. Automatic event capture/advanced matching disabled; no photo, name, reading age, email or story content in tracking events.
2. Real production preview succeeds from an explicitly approved synthetic photo; one labelled QA signup is saved and its price/consent verified. QA uses cq_qa_2026 and source qa, never a paid campaign code.
3. Meta Test Events receives PageView and one Lead after advertising consent. Decline/site-only choices produce no Meta request. Repeat-save controls do not inflate the website count. A failed save produces no Lead.
4. Updated privacy/measurement choices deployed. A previous site-only consent does not authorise Meta. Withdrawal stops future events.
5. New campaign editor visibly shows website Lead optimisation, correct dataset, UK, placement previews, £100 total lifetime and end date. Both reviewed ads have correct price/destination.
6. Check private results access and attribution in production. Compare test receipt to database and keep test traffic out of the report.
7. Set a daily review owner/reminder before restart. Dashboard decisions do not automatically control ad spend. Daily review heartbeat review-craven-quill-uk-test is active at 13:00 Asia/Dubai. It requires the desktop and relevant account access to run; the campaign lifetime budget/end date remain the hard spend controls.

## Precommitted decision rules

These are provisional business hypotheses, not industry averages or statistical proof. Keep the offer stable through the test unless something breaks; log any changes.

- Technical stop: broken signup, unavailable preview, or >10% incomplete drawing requests after 20 attempts. Fix first; do not call this lack of demand. Target at least 95% successful requests. Preview API costs are separate, with an existing 50-attempt/day ceiling, not a currency ceiling.
- Early spend review: £30 and zero qualified UK signups. Pause and inspect the funnel. Do not spend the remainder blindly.
- Hard stop: £100 or seven days, whichever first. No automatic extension.
- Promising interest: at least 25 qualified signups at media cost ≤£4 each, then verify quality and fulfilment economics before a paid pilot.
- Revise: 10–24 signups at the full £100, or inconsistent quality/format demand. Investigate biggest drop-off; one specific change per follow-up test.
- Stop this offer/channel for now: fewer than 10 qualified signups after £100, provided the funnel worked. This is not evidence every version of the idea is invalid.
- Under-spent/time-ended or technically invalid test: inconclusive, state sample size and actual spend. Do not manufacture a pass/fail.
- Below 5% conversion after 100 consented landing visits is a diagnostic prompt, not an independent business verdict.

## Economics and next validation stage

Contribution per order = selling price minus applicable tax, printing, delivery, payment fees, full-book image/text generation, and expected refunds/reprints/support. Obtain a real print/shipping quote and a physical proof before promising delivery or collecting a paid order.

Observed acquisition cost per prospect = (media + free-preview generation costs) / qualified signups.
Required signup-to-order conversion to break even on acquisition = acquisition cost per prospect / contribution per order. Example only: £4 acquisition and £20 contribution require 20% of signups to buy just to cover acquisition, before fixed overhead. These figures are assumptions, not actual costs.

A positive interest result earns a small paid pilot, not scale-up. Offer a real book with clear shipping/timing, take actual orders only with a working payment/refund/fulfilment path, deliver them, then measure paid acquisition cost, contribution and problems. Do not take non-refundable orders for an unbuilt supply chain. Proof of a sustainable business requires repeatable paid demand beyond the pilot.

## Daily review

Use matching date ranges (Meta Europe/London, report UTC), actual spend, qualified unique signups by format and creative, preview reliability, cost per qualified signup, and consented funnel drop-off. Record observations without changing targeting daily. Stop for the technical/early-spend gates. Keep a written decision at the end: observed evidence, sample limits, costs still unknown, and proceed/revise/stop recommendation.

## Setup record, 29 September 2026

- Site version 20 successfully deployed from commit 07cff505588152eed3937f2b1326620093286b8b. Production META_PIXEL_ID is now 4063290887140211. The same saved version was successfully redeployed on 29 September at 09:21 UTC (environment revision 3, deployment appgdep_6abb83016ac88191835d6f4dae4c3cfd).
- Replacement draft campaign 120248565983730557; ad set 120248565983720557; ads A 120248565983740557 and B 120248565983750557. Campaign, ad set and both ads are off. Draft dates are 30 September 09:00 BST to 7 October 09:00 BST; reset these to seven days after readiness if launch is delayed.
- Copying the original placement-customised ads into Leads was rejected by Meta. Both creatives were rebuilt in the Leads editor, using existing account Feed images and separately assigned Story images. Final publish validation remains pending; a successful preview is not proof Meta will accept delivery.
- Local browser QA used an in-memory database, a mock drawing result and test@example.com. It confirmed required buying interest, clear failed-save recovery and successful saving. 24 automated release checks passed. A real production synthetic-photo preview and signup completed successfully on 29 September. The live database contains one QA row with bundle, 4999 pence, purchase_intent=1, source qa, medium test, campaign cq_qa_2026, country AE and consent version storybook-validation-2026-09-29. The private report shows one QA signup, one successful drawing, and zero paid UK signups, so test activity is excluded correctly.
- Meta dataset creation was already completed when this session resumed. Automatic detailed page/product collection was turned off, with automatic events and advanced matching also off. The authorised production QA used the synthetic site portrait and AI test mailbox.
- The ad set now visibly selects Craven & Quill | Website signups and Lead, with all edits saved. Campaign remains a paused draft.
- Chrome Network showed a real PageView request to Meta for this pixel returning HTTP 200. This does not establish successful Lead ingestion: Meta Test Events has not displayed either event, and Overview warns of up to 30 minutes of delay. No Lead receipt has been verified. Production Site only and No thanks choices were tested in a fresh tab and after reload: campaign.js was present and no Meta scripts were loaded. The daily review heartbeat is now active. Final review confirms UK 25–60, Facebook Feed, Instagram Feed/Stories, website conversion goal, two correct tracked destinations, and £100 campaign lifetime budget. Multi-advertiser placement was disabled on both creatives to avoid extra cropping. Meta receipt and final publish validation remain outstanding. Luke completed the Business Tools acknowledgement, verified on 29 September. Event statuses shows no required actions or blocked events. The installation wizard was completed with advanced matching off. Integrations subsequently showed Meta pixel Active, while Overview still showed 0% setup/no activity and the open Ads Manager editor retained an inactive-pixel warning. Active integration alone does not verify a received Lead. A fresh consented QA visit around 10:00 UTC loaded the correct pixel configuration without pixel console errors; no receipt appeared in Test Events. More than 30 minutes have elapsed since the initial test. Next diagnostic requested from Luke: a consented phone visit and saved signup, attributed to cq_qa_2026, to separate browser-specific trouble from dataset ingestion. Do not recreate the dataset or declare tracking verified from an HTTP 200 alone. Do not restart spending until the remaining gates pass.
