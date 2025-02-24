'use client';

import dynamic from 'next/dynamic';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useState } from 'react';

const ClientWalletProviderWithNoSSR = dynamic(
  () => import('../components/WalletProvider').then(mod => mod.ClientWalletProvider),
  { ssr: false }
);

export default function Home() {
  const [address, setAddress] = useState('');

  return (
    <div className="min-h-screen bg-black">
      <ClientWalletProviderWithNoSSR>
        <div className="fixed top-[2vh] left-0 right-0 px-[2vw]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 w-[50%]">
              <input 
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Введите адрес"
                className="bg-[#2b2c3b] text-white px-4 outline-none flex-1 border-2 border-[#8b8fb3] min-w-[100px]"
              />
              <button 
                onClick={() => console.log('Address:', address)}
                className="aspect-square h-[clamp(2rem,5vh,3rem)] p-0 flex items-center justify-center"
              >
                🔍
              </button>
            </div>
            <WalletMultiButton />
          </div>
        </div>
      </ClientWalletProviderWithNoSSR>
    </div>
  );
} 