import {sqliteTable,text,integer,index} from 'drizzle-orm/sqlite-core';

// Existing colouring-book signups are intentionally separate from qualified storybook leads.
export const launchLeads=sqliteTable('launch_leads',{
  email:text('email').primaryKey(),product:text('product').notNull(),pricePence:integer('price_pence').notNull(),
  consentVersion:text('consent_version').notNull(),consentText:text('consent_text').notNull(),consentAt:text('consent_at').notNull(),
  source:text('source').notNull(),medium:text('medium').notNull(),campaign:text('campaign').notNull(),creative:text('creative').notNull(),
  visitId:text('visit_id'),previewId:text('preview_id').notNull(),country:text('country').notNull(),
  unsubscribeToken:text('unsubscribe_token').notNull().unique(),unsubscribedAt:text('unsubscribed_at'),createdAt:text('created_at').notNull(),
  purchaseIntent:integer('purchase_intent').notNull().default(0),conversionId:text('conversion_id'),
},t=>[index('launch_leads_campaign_created_idx').on(t.campaign,t.createdAt)]);

export const campaignEvents=sqliteTable('campaign_events',{
  id:text('id').primaryKey(),visitId:text('visit_id').notNull(),event:text('event').notNull(),
  source:text('source').notNull(),medium:text('medium').notNull(),campaign:text('campaign').notNull(),creative:text('creative').notNull(),
  country:text('country').notNull(),createdAt:text('created_at').notNull(),
},t=>[index('campaign_events_campaign_created_idx').on(t.campaign,t.createdAt)]);

export const previewReceipts=sqliteTable('preview_receipts',{
  id:text('id').primaryKey(),status:text('status').notNull(),createdAt:text('created_at').notNull(),email:text('email'),
});
export const previewDailyUsage=sqliteTable('preview_daily_usage',{
  day:text('day').primaryKey(),attempts:integer('attempts').notNull().default(0),
});

// Story-writing attempts have their own budget; they are never image preview receipts.
export const storyDailyUsage=sqliteTable('story_daily_usage',{
  day:text('day').primaryKey(),attempts:integer('attempts').notNull().default(0),
});

// Requested-preview contacts are not opted-in marketing leads or buying intent.
export const previewContacts=sqliteTable('preview_contacts',{
  email:text('email').primaryKey(),source:text('source').notNull(),medium:text('medium').notNull(),campaign:text('campaign').notNull(),creative:text('creative').notNull(),country:text('country').notNull(),createdAt:text('created_at').notNull(),updatedAt:text('updated_at').notNull(),
},t=>[index('preview_contacts_campaign_created_idx').on(t.campaign,t.createdAt)]);

// Paid pilot orders, separate from marketing contacts. No automatic supplier release.
export const customerOrders=sqliteTable('customer_orders',{
 id:text('id').primaryKey(),tokenHash:text('token_hash').notNull(),email:text('email').notNull(),size:text('size').notNull(),amount:integer('amount').notNull(),
 status:text('status').notNull(),paymentStatus:text('payment_status').notNull(),paymentMode:text('payment_mode'),sessionId:text('session_id'),
 revision:integer('revision').notNull().default(1),state:text('state').notNull(),createdAt:text('created_at').notNull(),updatedAt:text('updated_at').notNull(),
},t=>[index('customer_orders_status_idx').on(t.status,t.createdAt)]);
export const orderAudit=sqliteTable('order_audit',{
 id:text('id').primaryKey(),orderId:text('order_id').notNull(),kind:text('kind').notNull(),actor:text('actor').notNull(),details:text('details').notNull(),createdAt:text('created_at').notNull(),
});

// Customer-facing prices shown after a preview. This is separate from printer quotes.
// Preview-only email capture never grants offer-email permission.
export const customerQuotes=sqliteTable('customer_quotes',{
 email:text('email').primaryKey(),size:text('size').notNull(),pricePence:integer('price_pence').notNull(),catalogueVersion:text('catalogue_version').notNull(),
 firstShownAt:text('first_shown_at').notNull(),lastShownAt:text('last_shown_at').notNull(),
 offerConsentAt:text('offer_consent_at'),offerUnsubscribedAt:text('offer_unsubscribed_at'),unsubscribeToken:text('unsubscribe_token').notNull().unique(),
 discountCode:text('discount_code').unique(),discountPence:integer('discount_pence'),codeExpiresAt:text('code_expires_at'),
 emailStatus:text('email_status'),emailSentAt:text('email_sent_at'),emailProviderId:text('email_provider_id'),redeemedOrderId:text('redeemed_order_id'),
},t=>[index('customer_quotes_last_shown_idx').on(t.lastShownAt)]);
