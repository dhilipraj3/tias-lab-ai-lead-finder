// src/app/layout.tsx
import React from 'react';

export const metadata = {
  title: 'TIAS Lab — Enterprise Lead & RFP Intelligence Platform',
  description: 'Next.js + TypeScript + Cloudflare D1 Opportunity & Small-Lead Intelligence Platform'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: 'Inter, system-ui, sans-serif', background: '#090d16', color: '#f8fafc' }}>
        {children}
      </body>
    </html>
  );
}
