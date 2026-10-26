# Craven & Quill follow-up emails

The first email has no new discount and is due 24 hours after the last price view. The second is due at least 72 hours after the first accepted send, if the customer has not bought. Its unique code gives an extra 10% off the current book price and expires seven days after creation.

## Production operation

Sending is paused unless `FOLLOWUP_EMAILS_ENABLED=true` is set in the Site environment. The owner-only Site tool `run_followups` processes at most 20 recipients per step per run. Schedule it for 9 am Europe/London each day after the connected Site tool is available. `followup_status` reports enrolment and sends without exposing email addresses. A provider timeout leaves the step in `unknown` and needs manual Resend reconciliation before any retry.

Only people who check the new two-email consent box are enrolled. Older contacts who agreed to one follow-up offer remain on the separate one-off path and are excluded from this sequence. A successful preview and price view are required before the checkbox can be submitted. One sequence is allowed per email address; repeat visits do not restart it.

Each step checks unsubscribe, confirmed paid orders, and active or pending checkout before sending. A paid order permanently suppresses both steps. An active checkout holds the sequence while it remains active. A click is not treated as a purchase; click tracking is deliberately not used, avoiding private order-link tracking. The CTA goes to the public book builder.

The one-use code is bound to the recipient's email and can be claimed by one saved order. The checkout checks that the claim and expiry still hold. An expired discount is removed from an unpaid order before checkout. A customer who wants to move an unexpired claim to another saved order needs owner help; no automatic claim transfer is implemented.

## Files

- `01-first-follow-up.html` and `.txt`: first delivery template.
- `02-10-percent-off.html` and `.txt`: second delivery template.
- `preview-01.html`, `preview-02.html`, and `mobile-preview-*.png`: review samples. The sample code is not redeemable.
- `craven-quill-gold-logo.png`: the site's logo. Production email HTML uses the absolute public asset URL.

The sender replaces all placeholders, HTML-escapes values, includes a visible unsubscribe link, and sends one-click unsubscribe headers. Sending is idempotent per recipient and step. Provider acceptance is recorded separately from inbox delivery.
