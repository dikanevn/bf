'use client';

import dynamic from 'next/dynamic';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useWallet } from '@solana/wallet-adapter-react';
import { useState, useEffect } from 'react';

// Импортируем все файлы d2.json и d3.json из папок раундов
const roundsData: { 
  [key: string]: {
    d2: any[],
    d3: any[]
  }
} = {};

for (let i = 1; i <= 20; i++) {
  try {
    roundsData[i] = {
      d2: require(`../../b/rounds/${i}/d2.json`),
      d3: require(`../../b/rounds/${i}/d3.json`)
    };
  } catch (e) {
    continue;
  }
}

const ClientWalletProviderWithNoSSR = dynamic(
  () => import('../components/WalletProvider').then(mod => mod.ClientWalletProvider),
  { ssr: false }
);

interface SearchResult {
  round: number;
  participated: boolean;
  won: boolean;
  date: string;
}

function HomeContent() {
  const [address, setAddress] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const { publicKey } = useWallet();

  const searchAddress = (searchAddr: string) => {
    if (!searchAddr) return;

    const results: SearchResult[] = [];

    // Получаем даты из d02.json
    const roundDates: { [key: number]: string } = {};
    try {
      const d02Data = require('../../b/rounds/19/d02.json');
      d02Data.forEach((item: any) => {
        if (item.RewardsOrDeploy) {
          const date = new Date(item.RewardsOrDeploy);
          roundDates[item.round] = date.toLocaleDateString('ru-RU', {
            day: 'numeric',
            month: 'long'
          });
        }
      });
    } catch (e) {
      console.error('Ошибка при загрузке d02.json:', e);
    }

    // Поиск по всем раундам
    Object.entries(roundsData).forEach(([round, data]) => {
      const participated = data.d2.some(item => item.player === searchAddr);
      const winData = data.d3.find(item => item.player === searchAddr);
      const roundNumber = parseInt(round);
      
      results.push({
        round: roundNumber,
        participated,
        won: !!winData,
        date: roundDates[roundNumber] || `Раунд ${roundNumber}`
      });
    });

    // Сортируем результаты по номеру раунда
    results.sort((a, b) => a.round - b.round);
    setSearchResults(results);
  };

  useEffect(() => {
    if (publicKey) {
      setAddress(publicKey.toString());
      searchAddress(publicKey.toString());
    }
  }, [publicKey]);

  const totalParticipations = searchResults.filter(r => r.participated).length;
  const totalWins = searchResults.filter(r => r.won).length;

  return (
    <div className="fixed top-[2vh] left-0 right-0 px-[2vw]">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 w-[50%]">
          <input 
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Введите Yapster адрес"
            className="bg-[#2b2c3b] text-white px-4 outline-none flex-1 border-2 border-[#8b8fb3] min-w-[100px]"
          />
          <button 
            onClick={() => searchAddress(address)}
            className="aspect-square h-[clamp(2rem,5vh,3rem)] p-0 flex items-center justify-center"
          >
            🔍
          </button>
        </div>
        <WalletMultiButton />
      </div>

      {searchResults.length > 0 && (
        <div className="mt-8 text-white">
          <div className="mb-4">
            <div><h4 className="text-xl mb-4">Выиграл Аирдроп pNFTs: {totalWins}</h4> </div>
            <br />
            <div>Всего игр: {totalParticipations}</div>
            
          </div>
          <div className="max-h-[60vh] overflow-y-auto">
  {searchResults.map((result) => (
    <div key={result.round} className="mb-2">
            {result.participated 
        ? result.won 
          ? ' Повезло!' 
          : ' Не повезло..' 
        : ' Не участвовал'} | { }
      {result.date} | Игра {result.round} 

    </div>
  ))}
</div>

        </div>
      )}
    </div>
  );
}

export default function Home() {
  return (
    <div className="min-h-screen bg-black">
      <ClientWalletProviderWithNoSSR>
        <HomeContent />
      </ClientWalletProviderWithNoSSR>
    </div>
  );
} 