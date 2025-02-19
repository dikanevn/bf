'use client';

import dynamic from 'next/dynamic';
import { Suspense } from 'react';

// Динамический импорт WalletProvider без SSR
const ClientWalletProviderWithNoSSR = dynamic(
  () => import('../components/WalletProvider').then(mod => mod.ClientWalletProvider),
  { ssr: false }
);

// Динамический импорт MintPage без SSR aadf
const MintPageWithNoSSR = dynamic(
  () => import('../components/MintPage').then(mod => mod.MintPage),
  { ssr: false }
);

// Динамический импорт TokenInfo без SSR
const TokenInfoWithNoSSR = dynamic(
  () => import('../components/TokenInfo').then(mod => mod.default),
  { ssr: false }
);

export default function Home() {
  return (
    <main className="min-h-screen p-1">
      <Suspense fallback={<div>Загрузка...</div>}>
        <ClientWalletProviderWithNoSSR>
          <div className="space-y-1">
            <MintPageWithNoSSR />
            <TokenInfoWithNoSSR />
          </div>
        </ClientWalletProviderWithNoSSR>
      </Suspense>
    </main>
  );
}
