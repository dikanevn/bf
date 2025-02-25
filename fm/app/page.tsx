'use client';

import dynamic from 'next/dynamic';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useWallet } from '@solana/wallet-adapter-react';
import { useState, useEffect } from 'react';
import type { D02Item } from '../types';

// Динамический импорт WalletProvider с отключенным SSR
const ClientWalletProvider = dynamic(
  () => import('../components/WalletProvider').then(mod => mod.ClientWalletProvider),
  { ssr: false }
);

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
  BITCOIN_BLOCK_NUMBER?: string;
  RewardsOrDeploy?: string;
}

// Заменим топ-уровневый await на загрузку в useEffect
const roundsData: RoundFiles = {};

function HomeContent() {
  const [address, setAddress] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [showInfo, setShowInfo] = useState(false);
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

    // Меняем сортировку на обратный порядок
    results.sort((a, b) => b.round - a.round);
    setSearchResults(results);
  };

  useEffect(() => {
    if (publicKey) {
      setAddress(publicKey.toString());
      void searchAddress(publicKey.toString());
    }
  }, [publicKey]);

  useEffect(() => {
    const loadRoundsData = async () => {
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
    };
    void loadRoundsData();
  }, []);

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
    <div className="pt-[2vh] px-[2vw]">
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

      <h1 className="text-gray-400 mb-4 mt-6">
        Yapster DAO pNFT airdrop checker
      </h1>

      {searchResults.length > 0 && (
        <div className="mt-8 text-white">
          {address && (
            <div className="text-gray-400 mb-4 break-all">
              Address: {address}
            </div>
          )}
          <div className="mb-4">
            <div><h4 className="text-xl mb-4 font-bold text-blue-400">Won pNFTs Airdrop: {totalWins}</h4></div>
            <br />
            <div className="mb-6 text-gray-400">
              Total Games: 19 | Won: {totalWins} | Lost: {totalLosses} | Not Participated: {totalNotParticipated}
            </div>
          </div>
          <div>
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
                    <> | Players {roundStats.TOTAL_TICKETS} | 
                    pNFT(est.) {parseFloat(roundStats.value).toFixed(0)} | 
                    
                    Block #{roundStats.BITCOIN_BLOCK_NUMBER} |
                    Chance - {chance}% |
                    
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="mt-8 mb-8">
        <button 
          onClick={() => setShowInfo(!showInfo)}
          className="text-gray-400 hover:text-gray-300 transition-colors"
        >
          ℹ️ Details
        </button>

        {showInfo && (
          <div className="mt-4 text-gray-400 space-y-4">
            <p>
              Hi, my name is Nik. This is my vision for the $YAPSTER DAO NFT concept.
            </p>

            <p>
              The total supply is approximately 10,000, assuming full minting, though the actual number will likely be lower.
            </p>

            <p>
              5% of trading fees will be used to burn the Yapster token.
            </p>

            <p>
              Distribution begins with the first game, featuring 183 participants and 183 pNFTs. With each game, the number of pNFTs decreases by 1.83%, ensuring that the maximum supply remains around 10,000.
            </p>

            <p>
              Each round&apos;s pNFTs are distributed using a provably fair random algorithm. The source of entropy is the Bitcoin block hash, captured no sooner than 30 minutes after the game begins. The formula used:
            </p>

            <p className="font-mono">
              SHA-256(SHA-256(BTC_HASH + Solana_pubkey[1:-4]))
            </p>

            <p>
            You can check any game by inserting the Bitcoin block hash and your address into this code:
            <br />
            <br />
              <a href="https://chatgpt.com/canvas/shared/67ba8b1051cc81918fafada7dcd8d842" className="text-blue-400 hover:text-blue-300" target="_blank" rel="noopener noreferrer">
              https://chatgpt.com/canvas/shared/67ba8b1051cc81918fafada7dcd8d842
              </a>
            <br />
            <br />
            
             If the generated number is lower than the chance in this game – you are lucky.
            </p>

            <p>
              It makes me really sad to see meme coins dying, the limitless potential of NFTs reduced to just art, and everyone forgetting about metaverses and GameFi.
            </p>

            <p>
              Yapster DAO will bring it all together and build something new.
            </p>

            <p>
              The general concept is described here:
              <br />
              <a href="https://x.com/dikanevn/status/1888421145369571811" className="text-blue-400 hover:text-blue-300" target="_blank" rel="noopener noreferrer">
                https://x.com/dikanevn/status/1888421145369571811
              </a>
            </p>

            <p>
              Release date of pNFT: time is subjective.
            </p>
            <p>
              I&apos;d be happy to discuss ideas in the Yapster chat: <a href="https://t.me/yapsterissick" className="text-blue-400 hover:text-blue-300" target="_blank" rel="noopener noreferrer">https://t.me/yapsterissick</a>. Just tag me @dikanevn
            </p>
            <p>
              My contacts: <a href="https://linktr.ee/dikanevn" className="text-blue-400 hover:text-blue-300" target="_blank" rel="noopener noreferrer">https://linktr.ee/dikanevn</a>
            </p>
            <p>
              Yapster.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <div className="min-h-screen bg-black overflow-auto">
      <ClientWalletProvider>
        <HomeContent />
      </ClientWalletProvider>
    </div>
  );
} 