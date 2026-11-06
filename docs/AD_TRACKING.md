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

Attach each HTTPS feed to its matching EXISTING website action using Data Manager (multi-source conversions). Google requires its enhanced-conversion setup before continuing in this account. Owner approval is still required for that account gate and the dedicated read-only connection. The site does not send customer identifiers regardless of that switch.

Map transaction_id to Transaction ID, conversion_date_time to Conversion date and time (UTC), value to Value, currency to Currency, gclid/gbraid/wbraid to their matching click identifiers, ad_user_data and ad_personalization to their consent fields. Set the import schedule and inspect the first result. The same transaction ID deduplicates repeated feed reads within one action. Fetching a CSV is not proof Google accepted it.

Sources: [Google multi-source conversions](https://support.google.com/google-ads/answer/16542291), [HTTPS connection](https://support.google.com/google-ads-data-manager/answer/14605515), [Consent mode](https://developers.google.com/tag-platform/security/guides/consent).

## Release evidence and remaining acceptance

Automated checks cover consent, withdrawal races, untrusted input, receipt deduplication, private-data exclusion, both payment providers, webhook retries, payment survival during tracking failures, closed-browser sale export, test exclusions, actual amounts, confirmed-refund values and feed authentication.

Do not call this fully verified until: Google detects the tag; the two actions have the intended primary/secondary settings; both feeds connect and Google accepts their mappings; a genuine consented ad conversion is matched to the same saved receipt/order and GBP amount; a retry produces no additional conversion; refund reconciliation is tested. No fake production sales or invented ad clicks may be used to claim that proof. Google reporting is delayed and its account uses UAE time; the website dashboard uses UK time.
