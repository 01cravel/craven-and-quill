# Advertising measurement, 6 November 2026

## What counts

The private dashboard remains the record of saved emails, consented interest-list signups, quotes and verified payments. These are separate measures. A Google conversion report is an attributed subset, not a census of customers. Missing attribution is unknown, never proof that there were no leads.

Google Ads account: Craven & Quill, 262-797-3472. Existing Purchase action: 7889321939. Tag: AW-18555913000. Use the existing action, never a second primary purchase goal. Purchase uses every conversion and the actual discounted GBP amount. The preview-email action has zero monetary value and must be secondary, counted once per click. Do not import the same conversions again from GA4.

## Data path

- Public pages load advertising code only after the new explicit consent choice. Old Meta-only permission does not authorize Google. No Google/Meta advertising code on private book pages.
- GCLID/GBRAID/WBRAID retain case, follow the home-to-maker link, and are stored for up to 30 days only after consent. Explicit new campaign links replace saved attribution.
- Preview email saves produce a stable secret-derived receipt; no email is sent to Google. Repeat saves reuse that receipt. This is not verified contact information or marketing permission.
- Both payment providers save the payment timestamp atomically with verified paid status. Website reporting failures cannot undo payment. Purchase reports come from the order database even if the buyer never returns from checkout.
- Protected feeds: `/api/ads/purchases.csv` and `/api/ads/leads.csv`. Username `google-ads`, password in the Site secret `GOOGLE_ADS_FEED_PASSWORD`. Never use the owner login token. Missing secrets fail closed. CSV responses cannot be cached.
- Reports contain only consented records from the last 90 days with a valid click reference. They contain receipt/order ID, UTC time, value, GBP, click references and consent flags. No names, photos, stories, addresses or email hashes. Tests, owner orders and known QA addresses are excluded.
- Confirmed full refunds stored on the order restate value to zero. Refunds reported outside the owner workflow require reconciliation; an uncertain refund is not silently treated as completed. Google restatement acceptance must be verified.
- Withdrawal clears browser identifiers and suppresses server rows linked to the current visit. Earlier visits/orders require owner-assisted suppression. Uploaded events are not erased by cookie withdrawal.

## Connect in Google Ads

Attach each HTTPS feed to its matching EXISTING website action using Data Manager (multi-source conversions). Google allows the HTTPS connection with enhanced conversions and conversion-based audience lists left off. Luke approved the dedicated read-only connections, and both were saved on 6 November 2026. The site does not send customer identifiers. Auto-tagging was verified enabled on that date.

First apply a required Data Manager filter: `record_type` equals `conversion`. Every feed includes one `schema` metadata row because Google rejects header-only CSV files during setup. This marker has no click identifiers, denied consent, zero value and a 1970 timestamp. It is not a sale or lead and must never be imported. Verify the filtered preview excludes it before finishing setup.

Map transaction_id to Transaction ID, conversion_date_time to Conversion date and time (UTC), value to Value, currency to Currency, gclid/gbraid/wbraid to their matching click identifiers, ad_user_data and ad_personalization to their consent fields. Set the import schedule and inspect the first result. The same transaction ID deduplicates repeated feed reads within one action. Fetching a CSV is not proof Google accepted it.

Sources: [Google multi-source conversions](https://support.google.com/google-ads/answer/16542291), [HTTPS connection](https://support.google.com/google-ads-data-manager/answer/14605515), [Consent mode](https://developers.google.com/tag-platform/security/guides/consent).

## Release evidence and remaining acceptance

Release 93 is live. `npm ci` and `npm run check:release` passed all 134 checks. A live browser check observed Google's tag load successfully after consent (HTTP 200) and Google's measurement requests succeed (HTTP 200/204). Advertising scripts were absent before consent and after withdrawal followed by reload. No production lead, sale or invented click was submitted for this check.

Saved connections:

- `CQ verified paid sales`, attached to Purchase action `7889321939`.
- `CQ saved preview emails`, attached to secondary action `7891561860` (`Preview email saved (not a sale)`).

Both have the required `record_type = conversion` filter and nine mapped fields. Do not map `record_type` to Event source. Both run daily between 19:00 and 20:00 Asia/Singapore, Google's fastest scheduled frequency for these feeds. Manual runs are available. Google displayed a 14-day trial period before the new source affects bidding.

The sales run started at 17:43 Singapore on 6 November completed with zero imported rows and zero errors. The first preview run at 17:50 failed with Google's generic connection system error 9003 (zero imported rows, zero row errors); its 17:57 retry completed successfully with zero imported rows and zero errors, observed at 18:11 Singapore. Both successful runs verify empty filtered batches, not attribution of a real lead or purchase. Website logs also confirmed authenticated HTTP 200 responses for both feeds. An HTTP 200 response alone does not establish import success.

At the database check, there were zero `ad_leads` receipts eligible for this new reporting path and five unpaid orders, with no paid orders. These facts must never be described as zero saved customer emails: older contacts and interest-list signups are separate records. Genuine lead/sale matching, production deduplication and Google's refund restatement acceptance remain unproven until eligible real events exist.

Automated checks cover consent, withdrawal races, untrusted input, receipt deduplication, private-data exclusion, both payment providers, webhook retries, payment survival during tracking failures, closed-browser sale export, test exclusions, actual amounts, confirmed-refund values and feed authentication.

Do not call this fully verified until: Google detects the tag; the two actions have the intended primary/secondary settings; both feeds connect and Google accepts their mappings; a genuine consented ad conversion is matched to the same saved receipt/order and GBP amount; a retry produces no additional conversion; refund reconciliation is tested. No fake production sales or invented ad clicks may be used to claim that proof. Google reporting is delayed and its account uses UAE time; the website dashboard uses UK time.

For the first genuine eligible event, retain a private reconciliation record containing the saved receipt/order ID, event time in UTC, campaign/click evidence, consent version and actual GBP amount. Confirm the feed includes that same ID exactly once, run its Google connection, and record Google's import result and eventual conversion report. Re-run the unchanged feed and confirm the attributed count does not increase. Do not infer a match solely from an aggregate count when several events are eligible. Keep customer contact details out of shared screenshots and Git.

For a genuine completed refund, confirm the payment provider and stored order agree, confirm the same feed transaction ID now has zero value, then verify Google's resulting value adjustment. Do not trigger a financial transaction just to satisfy this checklist. Until this has been observed, report refund adjustment as implemented and unit-tested, but unverified in Google production. If a feed run fails, preserve the error and timestamps, check the site's request status, then retry once before escalating a repeated Google system error. Do not loosen consent filters or insert synthetic conversion rows to obtain a green import status.
