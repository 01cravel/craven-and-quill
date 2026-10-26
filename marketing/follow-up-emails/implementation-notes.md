# Craven & Quill follow-up sequence

## Review these previews

- [First email](preview-01.html): send 24 hours after the last price view, with no new discount. Subject: **Their story is still yours to make**.
- [Second email](preview-02.html): send 72 hours after the first email was accepted, if there is still no purchase. Subject: **A little extra for their story: 10% off**.
- Matching `.html` and `.txt` files are delivery templates. The `preview-` files use a sample code and date. No email was sent.

## Before using the sequence

The current checkbox says, “Email me one follow-up offer if I do not buy.” That does not clearly authorize two emails. Change it to: **“Email me up to two follow-up emails about my book if I do not buy. The second may include an offer. I can unsubscribe at any time.”** Store the wording and version with the consent time. For people who accepted the old wording, send at most the existing one-off offer unless they give fresh permission for this sequence.

The live code currently has one owner-triggered, plain-text offer email after 24 hours. It has no first reminder, three-day scheduler, HTML body, per-step send history, or click state. It already excludes paid orders, active checkout, and unsubscribed contacts when the owner triggers that offer. Its unique `CQ` code is bound to the recipient's email, expires after seven days, and can be claimed by one saved order. No part of this sequence has been deployed.

## Delivery rules

1. Normalize email addresses and start from a successful preview, a shown price, explicit sequence consent, and no unsubscribe. Use the latest price-view time, not the first. Cap at one sequence per recipient per book-shopping episode, with a cooldown if the same person returns later.
2. Before **each** send, check the current purchase state for that email, including payment-provider reconciliation where a payment is pending. A confirmed live payment suppresses all future follow-ups. An active checkout pauses the sequence; resume only after it expires and payment remains unconfirmed. Never infer a purchase from a click alone.
3. If the first CTA is clicked, record only a minimal first-party engagement event and postpone the second email until at least 24 hours after the last click, while still requiring at least 72 hours after email one. Do not put a private order key inside a tracking redirect or provider click wrapper. Click tracking is optional; the safe minimum is purchase and checkout suppression.
4. Claim each send atomically using one idempotency key per person and step. Save provider ID and accepted, failed, or uncertain status. Reconcile uncertain sends in Resend before retrying, so a timeout cannot create a duplicate. Stop after step two, a purchase, or an unsubscribe.
5. Generate a unique per-recipient code for **10% off the then-current price**, rounded once in pence. It is extra to the site price already shown. Bind it to that email and one book order; verify the price and margin floor. Set expiry to seven days after the second email is accepted. Render an exact UK date and time in both versions. Recheck expiry, identity, payment state, and one-use claim at checkout as well as when applying the code. Release a claim only through a controlled path if an unpaid order is abandoned; never make an already-paid code reusable.
6. Keep the visible unsubscribe link and add standard email unsubscribe headers. Record a confirmed unsubscribe before another scheduled send. Use the same suppression state for both steps.

## Template bindings

- Replace `{{continue_url}}` with `https://cravenandquill.com/create.html` for a quote-only recipient, or the valid private saved-order link for someone with a saved book. The latter needs special care because its key is sensitive.
- Replace `{{unsubscribe_url}}` with that recipient's `https://cravenandquill.com/offer-unsubscribe.html?token=...` link.
- In email two, replace `{{discount_code}}`, `{{expiry_date}}`, and `{{expiry_time}}`. The sample preview code is illustrative and cannot be redeemed.
- Host `craven-quill-gold-logo.png` at the site's public asset URL and change the HTML `<img src>` to the absolute HTTPS URL when sending. Relative image paths work only for the local previews. The supplied logo is 1.4 MB, so prepare a smaller web copy for delivery while keeping the same artwork.
- HTML-escape all inserted text and attribute values. Send the matching `.txt` file as the plain-text part. Set the subject from each file's first line.

## Discount gaps to fix before launch

The existing discount is a fixed pence amount derived from the quote and is claimed when applied to an unpaid saved order. A later price change can make “10% off” inaccurate, and an abandoned order can strand the code. The current expiry check happens when the code is applied, not again at checkout. Address those points before sending the second email.
