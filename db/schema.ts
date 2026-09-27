import {sqliteTable,text,integer,index} from 'drizzle-orm/sqlite-core';

// Existing colouring-book signups are intentionally separate from qualified storybook leads.
export const launchLeads=sqliteTable('launch_leads',{
  email:text('email').primaryKey(),product:text('product').notNull(),pricePence:integer('price_pence').notNull(),
  consentVersion:text('consent_version').notNull(),consentText:text('consent_text').notNull(),consentAt:text('consent_at').notNull(),
  source:text('source').notNull(),medium:text('medium').notNull(),campaign:text('campaign').notNull(),creative:text('creative').notNull(),
  visitId:text('visit_id'),previewId:text('preview_id').notNull(),country:text('country').notNull(),
  unsubscribeToken:text('unsubscribe_token').notNull().unique(),unsubscribedAt:text('unsubscribed_at'),createdAt:text('created_at').notNull(),
},t=>[index('launch_leads_campaign_created_idx').on(t.campaign,t.createdAt)]);

export const campaignEvents=sqliteTable('campaign_events',{
  id:text('id').primaryKey(),visitId:text('visit_id').notNull(),event:text('event').notNull(),
  source:text('source').notNull(),medium:text('medium').notNull(),campaign:text('campaign').notNull(),creative:text('creative').notNull(),
  country:text('country').notNull(),createdAt:text('created_at').notNull(),
},t=>[index('campaign_events_campaign_created_idx').on(t.campaign,t.createdAt)]);

export const previewReceipts=sqliteTable('preview_receipts',{
  id:text('id').primaryKey(),status:text('status').notNull(),createdAt:text('created_at').notNull(),
});
export const previewDailyUsage=sqliteTable('preview_daily_usage',{
  day:text('day').primaryKey(),attempts:integer('attempts').notNull().default(0),
});
