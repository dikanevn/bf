'use client';

import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useWallet } from '@solana/wallet-adapter-react';
import { useState, useEffect, useCallback } from 'react';
import type { D02Item } from '../types';
import Link from 'next/link';

// Определяем типы для данных раундов
interface RoundDataItem {
  player: string;
}

interface SearchResult {
  round: number;
  participated: boolean;
  won: boolean;
  date: string;
}

export default function HomeContent() {
  const [address, setAddress] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [showInfo, setShowInfo] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const { publicKey } = useWallet();
  const [totalGames, setTotalGames] = useState(0);
  const [lastRoundData, setLastRoundData] = useState<{
    round: number;
    d02: D02Item[];
    d2: RoundDataItem[];
    d3: RoundDataItem[];
  } | null>(null);

  const loadAllData = useCallback(async (searchAddr?: string) => {
    try {
      setIsLoading(true);
      
      // Находим последний раунд
      let currentRound = 1;
      let lastFoundRound = 0;
      
      while (true) {
        try {
          await import(`../../b/rounds/${currentRound}/d2.json`);
          lastFoundRound = currentRound;
          currentRound++;
        } catch {
          break;
        }
      }

      setTotalGames(lastFoundRound);
      
      // Загружаем данные для последнего раунда
      if (lastFoundRound > 0) {
        try {
          const d02 = await import(`../../b/rounds/${lastFoundRound}/d02.json`);
          const d2 = await import(`../../b/rounds/${lastFoundRound}/d2.json`);
          const d3 = await import(`../../b/rounds/${lastFoundRound}/d3.json`);
          
          const newLastRoundData = {
            round: lastFoundRound,
            d02: d02.default,
            d2: d2.default,
            d3: d3.default
          };
          
          setLastRoundData(newLastRoundData);
          
          // Получаем общее количество участников и победителей
          const totalParticipants = d2.default.length;
          const totalWinners = d3.default.length;
          
          // Получаем данные о коэффициенте
          const coefficientData = d02.default.find((item: D02Item) => item.coefficient);
          if (coefficientData) {
            // _setCoefficient(coefficientData.coefficient);
          }
          
          // Получаем данные о дате
          const dateData = d02.default.find((item: D02Item) => item.RewardsOrDeploy);
          if (dateData && dateData.RewardsOrDeploy) {
            // _setLastRoundDate(new Date(dateData.RewardsOrDeploy).toLocaleDateString('en-US', {
            //   day: 'numeric',
            //   month: 'long'
            // }));
          }

          // 5. Если есть адрес для поиска, выполняем поиск
          if (searchAddr) {
            const roundDates: { [key: number]: string } = {};
            // Используем даты только из последнего раунда
            const lastRoundDate = d02.default.find((item: D02Item) => item.RewardsOrDeploy)?.RewardsOrDeploy;
            const formattedDate = lastRoundDate ? 
              new Date(lastRoundDate).toLocaleDateString('en-US', {
                day: 'numeric',
                month: 'long'
              }) : 'Latest Round';

            const results: SearchResult[] = [];
            for (let i = 1; i <= lastFoundRound; i++) {
              try {
                const d2Data = await import(`../../b/rounds/${i}/d2.json`);
                const d3Data = await import(`../../b/rounds/${i}/d3.json`);
                
                const participated = d2Data.default.some((item: RoundDataItem) => item.player === searchAddr);
                const winData = d3Data.default.find((item: RoundDataItem) => item.player === searchAddr);
                
                results.push({
                  round: i,
                  participated,
                  won: !!winData,
                  date: i === lastFoundRound ? formattedDate : `Round ${i}`
                });
              } catch {
                continue;
              }
            }

            results.sort((a, b) => b.round - a.round);
            setSearchResults(results);
          }
        } catch (error) {
          console.error("Ошибка при загрузке данных последнего раунда:", error);
        }
      }
    } catch (err) {
      console.error('Error loading data:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAllData();
  }, [loadAllData]);

  useEffect(() => {
    const interval = setInterval(() => {
      void loadAllData();
    }, 10000);
    return () => clearInterval(interval);
  }, [loadAllData]);

  useEffect(() => {
    if (publicKey) {
      setAddress(publicKey.toString());
      void loadAllData(publicKey.toString());
    }
  }, [publicKey, loadAllData]);

  const searchAddress = async (searchAddr: string) => {
    if (!searchAddr) return;
    void loadAllData(searchAddr);
  };

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

      {isLoading ? (
        <div className="text-gray-400 text-center mt-8">
          Loading data...
        </div>
      ) : (
        <>
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
                  Total Games: {totalGames} | Won: {totalWins} | Lost: {totalLosses} | Not Participated: {totalNotParticipated}
                </div>
              </div>
              <div>
                {searchResults.map((result) => (
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
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="text-gray-400 mt-8 mb-8">
            <div className="text-xl font-bold">Global Statistics:</div>
            <div>Total pNFT: ~10000</div>
            <div>Total Games: {totalGames}</div>
            
            {lastRoundData && (
              <>
                <div className="text-xl font-bold mt-4">Latest Game:</div>
                <div>Players: {lastRoundData.d2.length}</div>
                <div>Winners: {lastRoundData.d3.length}</div>
              </>
            )}
          </div>

          <div className="mt-8 mb-8">
            <div className="flex gap-4">
              <button 
                onClick={() => setShowInfo(!showInfo)}
                className="text-gray-400 hover:text-gray-300 transition-colors"
              >
                ℹ️ Details
              </button>
              <Link 
                href="/docs"
                className="text-gray-400 hover:text-gray-300 transition-colors"
              >
                📚 Ultra-white paper
              </Link>
            </div>

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
        </>
      )}
    </div>
  );
} 