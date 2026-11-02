# Book sold alerts in Aya's Dot

Deploy this commit through the Sites workflow before enabling the monitor. The connected Craven & Quill Books Site exposes an owner-only `book_sold_alerts` tool. It returns up to 20 new live paid sales per call, with the exact message to show Luke. Test payments return nothing. Each sale is claimed before it is returned, so a later check or retried payment webhook cannot send it twice. A Dot run that stops after claiming may lose that alert; the claim is not proof that Luke saw it.

In Aya's Dot conversation, save this recurring task in the Asia/Dubai time zone:

> Every 15 minutes, call Craven & Quill Books `book_sold_alerts`. Send Luke each returned message exactly as written in this Dot conversation. If there are no alerts, stay quiet. If the tool fails, report the failure once and check again next run. Never change or retry a payment.

The Site connection authenticates the owner, so no new environment secret or webhook URL is needed. Confirm that Aya can see the new tool after deployment and that the recurring task is enabled.
