# Personalised book fulfilment

A5 GBP39.99 and A4 GBP47.99 launch offer (20% off GBP49.99/59.99). UK standard shipping and digital PDF included.

Ziina handles live checkout. Payment does not print a book. Customers approve the exact PDF proof; the owner then approves it and separately releases one print order to Prodigi with a cost ceiling. Test payments cannot trigger printing. Refunds hold the book.

Runtime credentials stay in Sites environment variables, never this repository. ORDERS_ENABLED controls checkout availability. ZIINA_MODE selects live or sandbox. ORDER_TAX_CONFIRMED is informational, not an assertion made by enabling checkout.

Validation: 72 checks pass, including both size journeys with simulated providers and manual release enforcement. Separate live GBP1 payment/refund was verified completed; this is not a complete real customer book order.

Run npm ci and npm run check:release. Deploy the built Sites artifact with the Sites workflow. This GitHub repository stores source; a push alone does not deploy production.
