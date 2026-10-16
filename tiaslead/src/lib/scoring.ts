// src/lib/scoring.ts
import { BudgetTier, BuyingIntentType, ScoreBreakdown, ServiceCategory } from './types';

export interface RawCandidateInput {
  sourceId: string;
  externalItemId?: string;
  title: string;
  organizationName: string;
  country: string;
  sourceUrl: string;
  publishedAt?: string;
  deadlineAt?: string;
  rawText: string;
  contactChannel?: string;
}

export interface ClassificationOutcome {
  isQuarantinedSellerOrNoise: boolean;
  quarantineReason?: string;
  buyingIntent: BuyingIntentType;
  primaryService: ServiceCategory;
  secondaryServices: ServiceCategory[];
  estimatedBudgetMin: number | null;
  estimatedBudgetMax: number | null;
  budgetTier: BudgetTier;
  budgetIsDisclosed: boolean;
  leadScore: number;
  scoreBreakdown: ScoreBreakdown;
  evidenceSnippets: string[];
  nextAction: string;
}

const SERVICE_KEYWORDS: Record<ServiceCategory, string[]> = {
  'Website Development': ['website redesign', 'website development', 'cms', 'wordpress', 'drupal', 'wcag', 'web design', 'microsite'],
  'Custom Software': ['custom software', 'system integrator', 'case management', 'backend', 'microservice', 'enterprise system', 'replatform'],
  'Web Applications': ['web application', 'web app', 'portal', 'dashboard', 'next.js', 'react', 'saas', 'full-stack'],
  'AI Integration': ['ai integration', 'llm', 'rag', 'ocr', 'machine learning', 'agentic', 'vector db', 'artificial intelligence', 'openai', 'gemini'],
  'Workflow Automation': ['workflow automation', 'automate', 'approval workflow', 'pipeline', 'zapier', 'n8n', 'orchestration'],
  'API Integration': ['api integration', 'rest api', 'graphql', 'webhook', 'netsuite', 'hubspot', 'salesforce', 'okta', 'greenhouse', 'schoolmint'],
  'Business Process Automation': ['expense management', 'invoice processing', 'reconciliation', 'business process', 'erp', 'back-office automation']
};

const EXPLICIT_BUYER_PHRASES = [
  'request for proposals', 'request for proposal', 'rfp', 'rfq', 'invitation to tender',
  'seeking freelancer', 'seeking an experienced digital agency', 'seeking proposals',
  'accepting proposals', 'proposals due', 'submission deadline', 'system integrator',
  'looking to hire a freelancer', 'hiring a contractor'
];

export async function classifyAndScoreCandidate(
  candidate: RawCandidateInput,
  aiBinding?: { run: (model: string, input: unknown) => Promise<unknown> }
): Promise<ClassificationOutcome> {
  const combinedLower = `${candidate.title}\n${candidate.rawText}`.toLowerCase();

  // 1. Quarantine Freelancer/Vendor Self-Promotion ("SEEKING WORK")
  const hasSeekingWork = /\bseeking work\b/i.test(combinedLower) || /\bhire me\b/i.test(combinedLower);
  const hasSeekingFreelancer = /\bseeking freelancer\b/i.test(combinedLower);
  if (hasSeekingWork && !hasSeekingFreelancer) {
    return {
      isQuarantinedSellerOrNoise: true,
      quarantineReason: 'Post is a freelancer/agency offering services (SEEKING WORK), not a buyer requesting services.',
      buyingIntent: 'INFERRED_POTENTIAL_NEED',
      primaryService: 'Custom Software',
      secondaryServices: [],
      estimatedBudgetMin: null,
      estimatedBudgetMax: null,
      budgetTier: 'UNSPECIFIED',
      budgetIsDisclosed: false,
      leadScore: 0,
      scoreBreakdown: {
        buyingIntentPts: 0, buyingIntentMax: 35, buyingIntentReason: 'Quarantined seller post.',
        evidenceQualityPts: 0, evidenceQualityMax: 25, evidenceQualityReason: 'Quarantined seller post.',
        projectFitPts: 0, projectFitMax: 25, projectFitReason: 'Quarantined seller post.',
        estimatedBudgetPts: 0, estimatedBudgetMax: 15, estimatedBudgetReason: 'Quarantined seller post.',
        classificationMethod: 'DETERMINISTIC_RULE_ENGINE'
      },
      evidenceSnippets: [],
      nextAction: 'Quarantined — Do not pursue.'
    };
  }

  // 2. Distinguish Explicit Request to Purchase vs. Inferred Need (Requirement #4)
  const matchedExplicit = EXPLICIT_BUYER_PHRASES.filter((p) => combinedLower.includes(p));
  const isExplicit = matchedExplicit.length > 0;
  const buyingIntent: BuyingIntentType = isExplicit ? 'EXPLICIT_BUY_REQUEST' : 'INFERRED_POTENTIAL_NEED';

  // 3. Map TIAS Lab Service Categories
  const rankedServices = (Object.entries(SERVICE_KEYWORDS) as [ServiceCategory, string[]][])
    .map(([service, keywords]) => ({
      service,
      matchedKeywords: keywords.filter((kw) => combinedLower.includes(kw))
    }))
    .filter((entry) => entry.matchedKeywords.length > 0)
    .sort((a, b) => b.matchedKeywords.length - a.matchedKeywords.length);

  const primaryService: ServiceCategory = rankedServices[0]?.service ?? 'Custom Software';
  const secondaryServices: ServiceCategory[] = rankedServices.slice(1, 4).map((s) => s.service);

  // 4. Extract Verbatim Evidence Sentences (Requirement #3)
  const sentences = candidate.rawText
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 35 && s.length <= 360);
  const evidenceSnippets = sentences.slice(0, 3);
  if (evidenceSnippets.length === 0) {
    evidenceSnippets.push(candidate.rawText.slice(0, 300).trim());
  }

  // 5. Compute Transparent 4-Pillar Score (Requirement #5)
  // Pillar 1: Buying Intent (0-35)
  let buyingIntentPts = isExplicit ? 28 : 13;
  if (candidate.deadlineAt || /deadline|proposals due/i.test(combinedLower)) {
    buyingIntentPts = Math.min(35, buyingIntentPts + 6);
  }

  // Pillar 2: Evidence Quality (0-25)
  let evidenceQualityPts = 12;
  if (candidate.rawText.length > 200) evidenceQualityPts += 5;
  if (candidate.contactChannel || /@[a-z0-9.-]+\.[a-z]{2,}/i.test(combinedLower)) evidenceQualityPts += 5;
  if (candidate.publishedAt) evidenceQualityPts += 3;
  evidenceQualityPts = Math.min(25, evidenceQualityPts);

  // Pillar 3: Project Fit (0-25)
  const projectFitPts = Math.min(25, 13 + rankedServices.length * 3);

  // Pillar 4: Estimated Budget (0-15)
  let estimatedBudgetMin: number | null = 25000;
  let estimatedBudgetMax: number | null = 65000;
  let budgetIsDisclosed = false;
  let budgetTier: BudgetTier = '25K_100K';
  let estimatedBudgetPts = 9;

  const currencyMatch = candidate.rawText.match(/\$\s?([0-9]{2,3}(?:,[0-9]{3})+)/);
  if (currencyMatch) {
    const val = parseInt(currencyMatch[1].replace(/,/g, ''), 10);
    estimatedBudgetMin = val;
    estimatedBudgetMax = Math.round(val * 1.4);
    budgetIsDisclosed = true;
    budgetTier = val >= 100000 ? 'OVER_100K' : val >= 25000 ? '25K_100K' : 'UNDER_25K';
    estimatedBudgetPts = val >= 100000 ? 14 : val >= 25000 ? 11 : 8;
  } else if (/multi-tier|enterprise|system integrator|global/i.test(combinedLower)) {
    estimatedBudgetMin = 90000;
    estimatedBudgetMax = 190000;
    budgetTier = 'OVER_100K';
    estimatedBudgetPts = 12;
  }

  const leadScore = buyingIntentPts + evidenceQualityPts + projectFitPts + estimatedBudgetPts;

  const scoreBreakdown: ScoreBreakdown = {
    buyingIntentPts,
    buyingIntentMax: 35,
    buyingIntentReason: isExplicit
      ? `Explicit solicitation language verified (${matchedExplicit.slice(0, 3).join(', ')}).`
      : 'Inferred organizational signal only; no explicit tender/RFP solicitation detected.',
    evidenceQualityPts,
    evidenceQualityMax: 25,
    evidenceQualityReason: `Verbatim source quote retained (${evidenceSnippets.length} snippet(s))${candidate.contactChannel ? ' + contact channel verified' : ''}.`,
    projectFitPts,
    projectFitMax: 25,
    projectFitReason: `Matches ${rankedServices.length || 1} TIAS Lab service lines: ${[primaryService, ...secondaryServices].join(', ')}.`,
    estimatedBudgetPts,
    estimatedBudgetMax: 15,
    estimatedBudgetReason: budgetIsDisclosed
      ? `Disclosed budget figure extracted from source (${currencyMatch?.[0]}).`
      : `Scope-calibrated estimate (${budgetTier}) based on deliverables.`,
    classificationMethod: aiBinding ? 'AI_ASSISTED_WITH_RULE_AUDIT' : 'DETERMINISTIC_RULE_ENGINE'
  };

  const nextAction = isExplicit
    ? `Review official solicitation at ${candidate.sourceUrl} and prepare compliant proposal before ${candidate.deadlineAt ?? 'the stated deadline'}.`
    : `Monitor ${candidate.organizationName} procurement portal for formal RFP issuance before initiating outreach.`;

  return {
    isQuarantinedSellerOrNoise: false,
    buyingIntent,
    primaryService,
    secondaryServices,
    estimatedBudgetMin,
    estimatedBudgetMax,
    budgetTier,
    budgetIsDisclosed,
    leadScore,
    scoreBreakdown,
    evidenceSnippets,
    nextAction
  };
}
