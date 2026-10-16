// src/lib/sources/connectors/reddit-buyers.ts
import { LeadSourceConnector, SourceSyncOutcome } from '../types';
import { RawCandidateInput } from '../../scoring';

const SUBREDDIT_BUYER_QUERIES = [
  'https://www.reddit.com/r/smallbusiness/search.json?q=%22build+me+a+website%22+OR+%22looking+for+a+developer%22&restrict_sr=1&sort=new&limit=15',
  'https://www.reddit.com/r/AppDevelopers/search.json?q=%22looking+for+a+developer%22&restrict_sr=1&sort=new&limit=15',
  'https://www.reddit.com/search.json?q=%22%5BHiring%5D%22+AND+(%22Next.js%22+OR+%22AI+automation%22+OR+%22n8n%22+OR+%22web+app%22)&sort=new&limit=20'
];

export class RedditStartupFastWinConnector implements LeadSourceConnector {
  readonly id = 'reddit_buyer_json';
  readonly name = 'Reddit Public Buyer JSON API (Founder & SMB Fast-Wins)';

  async fetchCandidates(): Promise<SourceSyncOutcome> {
    const candidates: RawCandidateInput[] = [];
    let totalScanned = 0;

    for (const url of SUBREDDIT_BUYER_QUERIES) {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'TIAS-Lab-Lead-Finder/2.0' }
      });
      if (!res.ok) continue;

      const payload = (await res.json()) as {
        data?: {
          children?: Array<{
            data: {
              id: string;
              title: string;
              selftext: string;
              author: string;
              subreddit_name_prefixed: string;
              permalink: string;
              created_utc: number;
            };
          }>;
        };
      };

      const posts = payload.data?.children ?? [];
      totalScanned += posts.length;

      for (const post of posts) {
        const d = post.data;
        if (/\[for hire\]|\bseeking work\b/i.test(d.title)) continue;

        candidates.push({
          sourceId: this.id,
          externalItemId: `reddit_${d.id}`,
          title: d.title,
          organizationName: `${d.subreddit_name_prefixed} Buyer (@${d.author})`,
          country: 'Global / International',
          sourceUrl: `https://www.reddit.com${d.permalink}`,
          publishedAt: new Date(d.created_utc * 1000).toISOString().slice(0, 10),
          rawText: `${d.title}. ${d.selftext.slice(0, 600)}`,
          dealSegment: 'STARTUP_FAST_WIN'
        });
      }
    }

    return {
      sourceId: this.id,
      wasSearched: true,
      httpStatus: 200,
      itemsScanned: totalScanned,
      candidates,
      status: candidates.length > 0 ? 'SUCCESS' : 'ZERO_RESULTS'
    };
  }
}
