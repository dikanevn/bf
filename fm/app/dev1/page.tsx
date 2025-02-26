'use client';

import Link from 'next/link';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useWallet } from '@solana/wallet-adapter-react';
import ClientWrapper from '../../components/ClientWrapper';

function DevContent() {
  const { publicKey } = useWallet();
  
  return (
    <div className="min-h-screen bg-black overflow-auto">
      <div className="pt-[2vh] px-[2vw] text-gray-400">
        <div className="flex items-center justify-between mb-8">
          <Link href="/" className="text-blue-400 hover:text-blue-300">
            ← Главная
          </Link>
          <WalletMultiButton />
        </div>

        {publicKey && (
          <div className="mt-8 break-all">
            Подключенный адрес: {publicKey.toString()}
          </div>
        )}
      </div>
    </div>
  );
}

export default function DevPage() {
  return (
    <ClientWrapper>
      <DevContent />
    </ClientWrapper>
  );
} 