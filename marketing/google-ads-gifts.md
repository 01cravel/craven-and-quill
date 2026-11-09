# Google search ads: gift shoppers (UK)

Catch people at the moment they search for a present. Built 4 Nov 2026 in the Craven & Quill Google Ads account (262-797-3472, billed in GBP), campaign id 24430097219. Paused until Luke switches it on. Ads were under Google review at build time.

4 Nov, later: three ads (christmas, adult, grandchild) were disapproved for "Destination not working" because Google had doubled the landing link (`https://cravenandquill.com/https://cravenandquill.com/?...`). Fixed each ad's final URL to `https://cravenandquill.com/?utm_content=<ad code>` and appealed; birthday ad was already eligible.

Bidding is Maximise clicks with a cap because Google has no purchase history to learn from yet; switch to purchase bidding after 15 to 30 recorded purchases. Needs cookie-free purchase reporting to Google first.

## Campaign
- Name: CQ | Google | Gift search | £10/day | UK
- Type: Search only (no display network, no search partners)
- Location: United Kingdom, people in it (not "interested in")
- Language: English
- Budget: £10/day
- Bidding: Maximise clicks, max cost per click £1.20
- Ends: 15 Dec 2026
- Judge it in our own analytics: "Everyone who visited", ad codes g_birthday, g_christmas, g_grandchild, g_adult

## Landing link
Home page, so they see examples and price before the book maker:
`https://cravenandquill.com/?utm_source=google&utm_medium=cpc&utm_campaign=cq_gifts&utm_content=<ad code>`

## Ad groups and keywords (phrase match)

**g_birthday: child birthday**
- "personalised birthday book"
- "personalised book for child"
- "personalised story book"
- "personalised children's book"
- "book with child's name in it"
- "unique birthday present for child"

**g_christmas: Christmas**
- "personalised christmas book"
- "personalised christmas story"
- "personalised christmas present for child"
- "christmas book with child's name"

**g_grandchild: grandparents, aunts, godparents**
- "personalised gift for grandson"
- "personalised gift for granddaughter"
- "personalised book for grandchild"
- "personalised gift for niece"
- "personalised gift for nephew"

**g_adult: leaving, retirement, birthdays for adults**
- "personalised leaving gift"
- "funny personalised gift"
- "personalised retirement gift"
- "personalised book for adults"

## Blocked words (whole campaign)
free, printable, template, pdf, diy, how to, make your own, wholesale, jobs, kdp, colouring, coloring, second hand, used, photo album, photobook, notebook, journal, mug, cushion, blanket, jigsaw

## Ad text (one responsive ad per group)

Headlines (30 characters max):
1. Personalised Storybook Gift
2. They Star In Their Own Book
3. One Photo, A Whole Story
4. See A Free Preview First
5. £10 Off: Hardbacks From £24.99 (pinned position 2)
6. UK Delivery Included
7. Order By 1 Dec For Christmas
8. Ten Illustrated Pages
9. Ages 3 To Adult
10. Add Your Own Gift Message

Group-specific headline:
- g_birthday: A Birthday Gift They'll Keep
- g_christmas: Their Own Christmas Story
- g_grandchild: A Gift From Grandma Or Grandad
- g_adult: A Leaving Gift With A Laugh

Descriptions (90 characters max):
1. Add one photo and we draw them as the hero of a 10-page illustrated hardback story.
2. Preview their character free, no card needed. Hardbacks from £24.99 with UK delivery.
3. Pick a funny, gentle or adventure story, or give us your own idea for their book.
4. Includes a gift page with your message. For Christmas, order by 1 December.

## 6 November 2026: cheaper clicks and a stop line

- Maximum cost per click bid limit lowered from £1.20 to £0.80 (campaign 24430097219, Maximise clicks, £10/day unchanged). At £0.80 a click, a £5 profit on a full-price A4 book needs roughly a 2.5% purchase rate instead of 3.5%.
- Automated rule "Stop line: pause gift search after £100 more": every day at 23:00 Gulf time, pause any campaign whose all-time cost is over £125 (£25 spent before 6 November plus £100). Emails cravenluke@gmail.com when it fires. If a sale lands first, raise the threshold rather than deleting the rule.
- The same £100 line is shown on the site dashboard under "Profit after everything", counted from ad spend entered after the last live sale.
