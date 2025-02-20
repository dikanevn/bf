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
    <main className="min-h-screen text-gray-600">
      <ClientWalletProviderWithNoSSR>
        <div className="p-4">
          <h1 className="text-2xl font-bold text-center mb-8 text-gray-700"></h1>
          <div className="max-w-2xl mx-auto space-y-8">
            <div>
              <h2 className="text-xl font-semibold mb-4 text-gray-700"></h2>
              <MintPage />
            </div>
            
            <div>
              <h2 className="text-xl font-semibold mb-4 text-gray-700">Token Info</h2>
              <TokenInfo />
            </div>
          </div>
        </div>
      </ClientWalletProviderWithNoSSR>
    </main>
  );
} 