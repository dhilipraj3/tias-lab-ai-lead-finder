PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS data_sources (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  protocol TEXT NOT NULL,
  endpoint_url TEXT NOT NULL,
  country_scope TEXT NOT NULL DEFAULT 'Global / International',
  requires_env_secret TEXT,
  query_config_json TEXT NOT NULL DEFAULT '{}',
  is_enabled INTEGER NOT NULL DEFAULT 1,
  last_synced_at TEXT,
  last_sync_status TEXT,
  created_at TEXT NOT NULL
) STRICT;

CREATE TABLE IF NOT EXISTS leads (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL,
  external_item_id TEXT,
  title TEXT NOT NULL,
  organization_name TEXT NOT NULL,
  country TEXT NOT NULL,
  india_region TEXT,
  deal_segment TEXT NOT NULL DEFAULT 'ENTERPRISE_OR_TENDER',
  source_url TEXT NOT NULL,
  canonical_url TEXT NOT NULL,
  canonical_url_hash TEXT NOT NULL UNIQUE,
  org_title_fingerprint TEXT NOT NULL,
  alternate_source_urls_json TEXT NOT NULL DEFAULT '[]',
  discovered_at TEXT NOT NULL,
  published_at TEXT,
  deadline_at TEXT,
  buying_intent TEXT NOT NULL,
  primary_service TEXT NOT NULL,
  secondary_services_json TEXT NOT NULL DEFAULT '[]',
  estimated_budget_min INTEGER,
  estimated_budget_max INTEGER,
  budget_currency TEXT NOT NULL DEFAULT 'USD',
  budget_tier TEXT NOT NULL DEFAULT 'UNSPECIFIED',
  budget_is_disclosed INTEGER NOT NULL DEFAULT 0,
  lead_score INTEGER NOT NULL,
  score_breakdown_json TEXT NOT NULL,
  evidence_json TEXT NOT NULL,
  contact_channel TEXT,
  next_action TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'NEW',
  is_mock_preview INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (source_id) REFERENCES data_sources(id)
) STRICT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_source_ext
  ON leads(source_id, external_item_id)
  WHERE external_item_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_leads_org_title_fp
  ON leads(org_title_fingerprint);

CREATE INDEX IF NOT EXISTS idx_leads_pipeline_filter
  ON leads(is_mock_preview, status, buying_intent, primary_service, country, budget_tier, lead_score DESC);

CREATE TABLE IF NOT EXISTS sync_runs (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL,
  started_at TEXT NOT NULL,
  completed_at TEXT,
  http_status INTEGER,
  items_scanned INTEGER NOT NULL DEFAULT 0,
  buyer_leads_inserted INTEGER NOT NULL DEFAULT 0,
  duplicates_skipped INTEGER NOT NULL DEFAULT 0,
  seller_noise_quarantined INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL,
  error_message TEXT,
  FOREIGN KEY (source_id) REFERENCES data_sources(id)
) STRICT;

INSERT OR IGNORE INTO data_sources (id, name, protocol, endpoint_url, country_scope, requires_env_secret, created_at) VALUES
  ('reddit_buyer_json', 'Reddit Public Buyer JSON API', 'PUBLIC_JSON_API', 'https://www.reddit.com/search.json', 'Global / International', NULL, '2026-10-15T00:00:00Z'),
  ('hn_algolia_freelance', 'Hacker News Algolia Search API', 'PUBLIC_JSON_API', 'https://hn.algolia.com/api/v1/search_by_date', 'Global / International', NULL, '2026-10-15T00:00:00Z'),
  ('google_cse_india', 'Google Custom Search JSON API', 'GOOGLE_CSE_REST_API', 'https://customsearch.googleapis.com/customsearch/v1', 'Global / International', 'GOOGLE_CSE_API_KEY', '2026-10-15T00:00:00Z'),
  ('google_pagespeed_seo_auditor', 'Google PageSpeed Insights API v5', 'GOOGLE_LIGHTHOUSE_API', 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed', 'Global / International', NULL, '2026-10-15T00:00:00Z'),
  ('sam_gov_opportunities', 'U.S. SAM.gov Opportunities API v2', 'SERVER_KEYED_REST_API', 'https://api.sam.gov/opportunities/v2/search', 'United States', 'SAM_GOV_API_KEY', '2026-10-15T00:00:00Z');
