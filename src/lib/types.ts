// src/lib/types.ts
export type BuyingIntentType = 'EXPLICIT_BUY_REQUEST' | 'INFERRED_POTENTIAL_NEED';

export type ServiceCategory =
  | 'Website Development'
  | 'Custom Software'
  | 'Web Applications'
  | 'AI Integration'
  | 'Workflow Automation'
  | 'API Integration'
  | 'Business Process Automation';

export type BudgetTier = 'UNDER_25K' | '25K_100K' | 'OVER_100K' | 'UNSPECIFIED';

export type LeadStatus =
  | 'NEW'
  | 'REVIEWING'
  | 'QUALIFIED'
  | 'PROPOSAL_DRAFTING'
  | 'SUBMITTED'
  | 'ARCHIVED';

export interface ScoreBreakdown {
  buyingIntentPts: number;       // 0 - 35
  buyingIntentMax: 35;
  buyingIntentReason: string;
  evidenceQualityPts: number;    // 0 - 25
  evidenceQualityMax: 25;
  evidenceQualityReason: string;
  projectFitPts: number;         // 0 - 25
  projectFitMax: 25;
  projectFitReason: string;
  estimatedBudgetPts: number;    // 0 - 15
  estimatedBudgetMax: 15;
  estimatedBudgetReason: string;
  classificationMethod: 'AI_ASSISTED_WITH_RULE_AUDIT' | 'DETERMINISTIC_RULE_ENGINE';
}

export interface LeadRecord {
  id: string;
  sourceId: string;
  sourceName?: string;
  externalItemId: string | null;
  title: string;
  organizationName: string;
  country: string;
  sourceUrl: string;
  canonicalUrl: string;
  canonicalUrlHash: string;
  orgTitleFingerprint: string;
  alternateSourceUrls: string[];
  discoveredAt: string;
  publishedAt: string | null;
  deadlineAt: string | null;
  buyingIntent: BuyingIntentType;
  primaryService: ServiceCategory;
  secondaryServices: ServiceCategory[];
  estimatedBudgetMin: number | null;
  estimatedBudgetMax: number | null;
  budgetCurrency: string;
  budgetTier: BudgetTier;
  budgetIsDisclosed: boolean;
  leadScore: number;
  scoreBreakdown: ScoreBreakdown;
  evidenceSnippets: string[];
  contactChannel: string | null;
  nextAction: string;
  status: LeadStatus;
  isMockPreview: boolean;
}
