'use client';

import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { PhantomWalletAdapter } from '@solana/wallet-adapter-wallets';
import { clusterApiUrl } from '@solana/web3.js';
import { useMemo } from 'react';

import '@solana/wallet-adapter-react-ui/styles.css';
import '../styles/walletAdapterOverrides.css';

export function ClientWalletProvider({ children }: { children: React.ReactNode }) {
  // Можно изменить на Mainnet, Testnet или оставить Devnet по умолчанию
  const network = WalletAdapterNetwork.Mainnet; // или передайте как пропс
  const endpoint = useMemo(() => clusterApiUrl(network), [network]);
  const wallets = useMemo(() => [new PhantomWalletAdapter()], []);

  if (typeof window === 'undefined') {
    return <>{children}</>;
  }

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          {children}
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}