// src/app/page.tsx
'use client';

import React, { useEffect, useState, useMemo } from 'react';
import type {
  BudgetTier,
  BuyingIntentType,
  LeadRecord,
  LeadStatus,
  ServiceCategory
} from '@/lib/types';

export default function TiasLabLeadFinderDashboard() {
  const [leads, setLeads] = useState<LeadRecord[]>([]);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [isPreviewMode, setIsPreviewMode] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  // Filter states (Requirement #8)
  const [country, setCountry] = useState<string>('ALL');
  const [service, setService] = useState<string>('ALL');
  const [buyingIntent, setBuyingIntent] = useState<string>('ALL');
  const [budgetTier, setBudgetTier] = useState<string>('ALL');
  const [status, setStatus] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  async function fetchLeads() {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        country,
        service,
        buyingIntent,
        budgetTier,
        status,
        preview: String(isPreviewMode)
      });
      const res = await fetch(`/api/leads?${params.toString()}`);
      const data = (await res.json()) as { leads?: LeadRecord[] };
      const fetched = data.leads ?? [];
      setLeads(fetched);
      if (fetched.length > 0 && !selectedLeadId) {
        setSelectedLeadId(fetched[0].id);
      }
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void fetchLeads();
  }, [country, service, buyingIntent, budgetTier, status, isPreviewMode]);

  async function triggerServerSync() {
    setSyncMessage('Running server-side source connectors...');
    const res = await fetch('/api/sources/sync', { method: 'POST' });
    const data = (await res.json()) as { syncedAt?: string; results?: unknown };
    setSyncMessage(`Sync completed at ${data.syncedAt ?? 'unknown'}`);
    await fetchLeads();
  }

  const filteredLeads = useMemo(() => {
    if (!searchQuery.trim()) return leads;
    const q = searchQuery.toLowerCase();
    return leads.filter(
      (l) =>
        l.title.toLowerCase().includes(q) ||
        l.organizationName.toLowerCase().includes(q) ||
        l.evidenceSnippets.some((e) => e.toLowerCase().includes(q))
    );
  }, [leads, searchQuery]);

  const selectedLead = filteredLeads.find((l) => l.id === selectedLeadId) ?? filteredLeads[0] ?? null;

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-6">
      {/* Requirement #11: Explicit Preview vs Production D1 Mode Banner */}
      <div className="mb-6 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 flex items-center justify-between">
        <div className="text-sm">
          <span className="font-bold uppercase tracking-wider mr-2 text-amber-300">
            {isPreviewMode ? 'Development Preview Mode' : 'Live Cloudflare D1 Mode'}
          </span>
          <span>
            {isPreviewMode
              ? 'Showing clearly labelled development preview snapshot. Switch to Live Mode for real D1 storage.'
              : 'Connected to Cloudflare D1. Zero synthetic or fabricated leads are ever generated.'}
          </span>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setIsPreviewMode(!isPreviewMode)}
            className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-semibold"
          >
            Toggle {isPreviewMode ? 'Live D1 Mode' : 'Dev Preview Mode'}
          </button>
          <button
            onClick={triggerServerSync}
            className="rounded-lg bg-sky-600 hover:bg-sky-500 px-3 py-1.5 text-xs font-semibold text-white"
          >
            Sync Authorized Sources
          </button>
        </div>
      </div>

      {syncMessage && (
        <div className="mb-4 rounded-lg bg-emerald-950/60 border border-emerald-500/40 px-4 py-2 text-xs text-emerald-300">
          {syncMessage}
        </div>
      )}

      {/* Requirement #8: Filter Bar */}
      <section className="grid grid-cols-1 md:grid-cols-6 gap-3 mb-6 bg-slate-900/80 p-4 rounded-xl border border-slate-800">
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search title, org, evidence..."
          className="rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm"
        />
        <select value={country} onChange={(e) => setCountry(e.target.value)} className="rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm">
          <option value="ALL">All Countries</option>
          <option value="United States">United States</option>
          <option value="United Kingdom">United Kingdom</option>
          <option value="India">India</option>
          <option value="Canada">Canada</option>
          <option value="Global / International">Global / International</option>
        </select>
        <select value={service} onChange={(e) => setService(e.target.value)} className="rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm">
          <option value="ALL">All Service Types</option>
          <option value="Website Development">Website Development</option>
          <option value="Custom Software">Custom Software</option>
          <option value="Web Applications">Web Applications</option>
          <option value="AI Integration">AI Integration</option>
          <option value="Workflow Automation">Workflow Automation</option>
          <option value="API Integration">API Integration</option>
          <option value="Business Process Automation">Business Process Automation</option>
        </select>
        <select value={buyingIntent} onChange={(e) => setBuyingIntent(e.target.value)} className="rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm">
          <option value="ALL">All Buying Intent</option>
          <option value="EXPLICIT_BUY_REQUEST">Explicit Request to Purchase</option>
          <option value="INFERRED_POTENTIAL_NEED">Inferred Potential Need</option>
        </select>
        <select value={budgetTier} onChange={(e) => setBudgetTier(e.target.value)} className="rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm">
          <option value="ALL">All Budget Ranges</option>
          <option value="UNDER_25K">Under $25k</option>
          <option value="25K_100K">$25k – $100k</option>
          <option value="OVER_100K">$100k+</option>
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm">
          <option value="ALL">All Statuses</option>
          <option value="NEW">New</option>
          <option value="REVIEWING">Reviewing</option>
          <option value="QUALIFIED">Qualified</option>
          <option value="PROPOSAL_DRAFTING">Proposal Drafting</option>
          <option value="SUBMITTED">Submitted</option>
          <option value="ARCHIVED">Archived</option>
        </select>
      </section>

      {/* Requirement #7 & #9: Lead List + Detail View with Honest Empty State */}
      {filteredLeads.length === 0 ? (
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-12 text-center">
          <h2 className="text-lg font-bold">0 Verified Leads Returned</h2>
          <p className="text-sm text-slate-400 mt-1">
            TIAS Lab AI Lead Finder never fabricates leads when a source or filter returns no matches.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 space-y-3">
            {filteredLeads.map((lead) => (
              <div
                key={lead.id}
                onClick={() => setSelectedLeadId(lead.id)}
                className={`cursor-pointer rounded-xl border p-4 transition ${
                  selectedLead?.id === lead.id
                    ? 'border-sky-500 bg-sky-950/20'
                    : 'border-slate-800 bg-slate-900 hover:border-slate-700'
                }`}
              >
                <div className="flex justify-between items-start gap-4">
                  <div>
                    <h3 className="font-bold text-base">{lead.title}</h3>
                    <p className="text-xs text-sky-400 font-semibold">
                      {lead.organizationName} • {lead.country}
                    </p>
                  </div>
                  <div className="rounded-lg bg-emerald-500/15 border border-emerald-500/40 px-3 py-1 text-center">
                    <div className="text-lg font-extrabold text-emerald-300">{lead.leadScore}</div>
                    <div className="text-[10px] uppercase text-emerald-200">Score</div>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  <span className="rounded bg-emerald-950 px-2 py-0.5 text-emerald-300 border border-emerald-700/50">
                    {lead.buyingIntent === 'EXPLICIT_BUY_REQUEST' ? 'Explicit Buy Request' : 'Inferred Need'}
                  </span>
                  <span className="rounded bg-indigo-950 px-2 py-0.5 text-indigo-300 border border-indigo-700/50">
                    {lead.primaryService}
                  </span>
                  <span className="rounded bg-slate-800 px-2 py-0.5 text-slate-300">
                    Discovered: {lead.discoveredAt.slice(0, 10)}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {selectedLead && (
            <aside className="lg:col-span-5 rounded-xl border border-slate-800 bg-slate-900 p-5 space-y-4">
              <h2 className="text-lg font-bold">{selectedLead.title}</h2>
              <div className="text-xs space-y-1">
                <div>
                  <strong>Original Source URL:</strong>{' '}
                  <a href={selectedLead.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-sky-400 underline break-all">
                    {selectedLead.sourceUrl}
                  </a>
                </div>
                <div><strong>Canonical URL Hash:</strong> <code>{selectedLead.canonicalUrlHash}</code></div>
                <div><strong>Discovered At:</strong> {selectedLead.discoveredAt}</div>
                <div>
                  <strong>Estimated Project Value:</strong>{' '}
                  {selectedLead.estimatedBudgetMin
                    ? `$${selectedLead.estimatedBudgetMin.toLocaleString()} – $${selectedLead.estimatedBudgetMax?.toLocaleString()}`
                    : 'Unspecified'}
                </div>
              </div>
              <div className="space-y-2 border-t border-slate-800 pt-3">
                <h4 className="text-xs font-bold uppercase text-slate-400">Supporting Evidence</h4>
                {selectedLead.evidenceSnippets.map((snippet, idx) => (
                  <blockquote key={idx} className="border-l-2 border-emerald-500 pl-3 text-xs italic text-slate-200">
                    {snippet}
                  </blockquote>
                ))}
              </div>
              <div className="border-t border-slate-800 pt-3 text-xs">
                <strong>Next Action:</strong> {selectedLead.nextAction}
              </div>
            </aside>
          )}
        </div>
      )}
    </main>
  );
}
