'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { MintPage } from '../components/MintPage';
import TokenInfo from '../components/TokenInfo';

// Динамический импорт WalletProvider без SSR
const ClientWalletProviderWithNoSSR = dynamic(
  () => import('../components/WalletProvider').then(mod => mod.ClientWalletProvider),
  { ssr: false }
);

export default function Home() {
  return (
    <main className="min-h-screen p-1">
      <ClientWalletProviderWithNoSSR>
        <div className="p-4">
          <h1 className="text-2xl font-bold text-center mb-8">Solana NFT Tools</h1>
          <div className="max-w-2xl mx-auto space-y-8">
            <div className="border p-6 shadow-md">
              <h2 className="text-xl font-semibold mb-4">NFT Mint & Transfer</h2>
              <MintPage />
            </div>
            
            <div className="border p-6 shadow-md">
              <h2 className="text-xl font-semibold mb-4">Token Info</h2>
              <TokenInfo />
            </div>
          </div>
        </div>
      </ClientWalletProviderWithNoSSR>
    </main>
  );
} 