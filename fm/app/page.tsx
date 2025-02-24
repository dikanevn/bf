'use client';

import dynamic from 'next/dynamic';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useWallet } from '@solana/wallet-adapter-react';
import { useState, useEffect } from 'react';
import type { D02Item } from '../types';

// Определяем типы для данных раундов
interface RoundDataItem {
  player: string;
}

interface RoundFiles {
  [key: string]: {
    d2: RoundDataItem[];
    d3: RoundDataItem[];
  }
}

// Импортируем данные как модули
const roundsData: RoundFiles = {};

// Динамический импорт данных
if (typeof window !== 'undefined') {
  for (let i = 1; i <= 20; i++) {
    try {
      const d2 = await import(`../../b/rounds/${i}/d2.json`);
      const d3 = await import(`../../b/rounds/${i}/d3.json`);
      roundsData[i] = {
        d2: d2.default,
        d3: d3.default
      };
    } catch {
      continue;
    }
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

interface D02Data {
  round: number;
  value: string;
  TOTAL_TICKETS: string;
  coefficient: string;
}

function HomeContent() {
  const [address, setAddress] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const { publicKey } = useWallet();
  const [d02Data, setD02Data] = useState<{[key: number]: D02Data}>({});

  const searchAddress = async (searchAddr: string) => {
    if (!searchAddr) return;

    const results: SearchResult[] = [];

    // Загружаем даты из d02.json
    const roundDates: { [key: number]: string } = {};
    try {
      const d02Module = await import('../../b/rounds/19/d02.json');
      const d02Data = d02Module.default;
      d02Data.forEach((item: D02Item) => {
        if (item.RewardsOrDeploy) {
          const date = new Date(item.RewardsOrDeploy);
          roundDates[item.round] = date.toLocaleDateString('en-US', {
            day: 'numeric',
            month: 'long'
          });
        }
      });
    } catch (err) {
      console.error('Error loading d02.json:', err);
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
        date: roundDates[roundNumber] || `Round ${roundNumber}`
      });
    });

    // Сортировка результатов по номеру раунда
    results.sort((a, b) => a.round - b.round);
    setSearchResults(results);
  };

  useEffect(() => {
    if (publicKey) {
      setAddress(publicKey.toString());
      void searchAddress(publicKey.toString());
    }
  }, [publicKey]);

  useEffect(() => {
    const loadD02Data = async () => {
      try {
        const d02Module = await import('../../b/rounds/19/d02.json');
        const d02RawData = d02Module.default;
        const d02Processed = d02RawData.reduce((acc: {[key: number]: D02Item}, item: D02Item) => {
          acc[item.round] = item;
          return acc;
        }, {});
        setD02Data(d02Processed);
      } catch (err) {
        console.error('Error loading d02.json:', err);
      }
    };
    void loadD02Data();
  }, []);

  const totalWins = searchResults.filter(r => r.won).length;
  const totalLosses = searchResults.filter(r => r.participated && !r.won).length;
  const totalNotParticipated = searchResults.filter(r => !r.participated).length;

  return (
    <div className="fixed top-[2vh] left-0 right-0 px-[2vw]">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 w-[50%]">
          <input 
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Enter Yapster address"
            className="bg-[#2b2c3b] text-white px-4 outline-none flex-1 border-2 border-[#8b8fb3] min-w-[100px]"
          />
          <button 
            onClick={() => void searchAddress(address)}
            className="aspect-square h-[clamp(2rem,5vh,3rem)] p-0 flex items-center justify-center"
          >
            🔍
          </button>
        </div>
        <WalletMultiButton />
      </div>

      {searchResults.length > 0 && (
        <div className="mt-8 text-white">
          {address && (
            <div className="text-gray-400 mb-4 break-all">
              Адрес: {address}
            </div>
          )}
          <div className="mb-4">
            <div><h4 className="text-xl mb-4 font-bold text-blue-400">Won pNFTs Airdrop: {totalWins}</h4></div>
            <br />
            <div className="mb-6 text-gray-400">
              Total Games: 19 | Won: {totalWins} | Lost: {totalLosses} | Not Participated: {totalNotParticipated}
            </div>
          </div>
          <div className="pb-[40vh]">
            {searchResults.map((result) => {
              const roundStats = d02Data[result.round];
              const chance = roundStats 
                ? ((parseFloat(roundStats.value) / parseInt(roundStats.TOTAL_TICKETS)) * 100).toFixed(1)
                : '?';
              
              return (
                <div 
                  key={result.round} 
                  className={`mb-2 ${
                    result.won 
                      ? 'text-green-400' 
                      : result.participated 
                        ? 'text-green-700' 
                        : 'text-gray-500'
                  }`}
                >
                  {result.participated 
                    ? result.won 
                      ? ' Won!' 
                      : ' Lost..' 
                    : ' Did not participate'} | { }
                  {result.date} | Game {result.round}
                  {roundStats && (
                    <> | Players - {roundStats.TOTAL_TICKETS} | 
                    pNFT ~{parseFloat(roundStats.value).toFixed(3)} | 
                    Chance - {chance}%</>
                  )}
                </div>
              );
            })}
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