'use client';

import dynamic from 'next/dynamic';
import { Suspense } from 'react';

const ClientWalletProvider = dynamic(
  () => import('./WalletProvider').then(mod => mod.ClientWalletProvider),
  { ssr: false }
);

interface ClientWrapperProps {
  children?: React.ReactNode;
}

export default function ClientWrapper({ children }: ClientWrapperProps) {
  return (
    <Suspense fallback={
      <div className="text-gray-400 text-center mt-8">
        Loading application...
      </div>
    }>
      <ClientWalletProvider>
        {children || <HomeContent />}
      </ClientWalletProvider>
    </Suspense>
  );
}

const HomeContent = dynamic(
  () => import('./HomeContent'),
  { 
    ssr: false,
    loading: () => (
      <div className="text-gray-400 text-center mt-8">
        Loading wallet interface...
      </div>
    )
  }
); 