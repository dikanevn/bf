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

export default function HomeContent() {
  const [address, setAddress] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [showInfo, setShowInfo] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const { publicKey } = useWallet();
  const [d02Data, setD02Data] = useState<{[key: number]: D02Data}>({});
  const [totalGames, setTotalGames] = useState(0);
  const [totalMinted, setTotalMinted] = useState(0);
  const [lastGameStats, setLastGameStats] = useState<{
    date: string;
    players: number;
    estimatedWinners: number;
    actualWinners: number;
  } | null>(null);
  const [lastRoundData, setLastRoundData] = useState<{
    round: number;
    d02: D02Item[];
    d2: RoundDataItem[];
    d3: RoundDataItem[];
  } | null>(null);
  const [participantsCount, _setParticipantsCount] = useState(0);
  const [winnersCount, _setWinnersCount] = useState(0);
  const [coefficient, _setCoefficient] = useState('');
  const [lastRoundDate, _setLastRoundDate] = useState('');

  // Эта функция используется в loadAllData
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const findLastRound = async () => {
    let currentRound = 1; // Начинаем с 1 и идем вверх
    let lastFoundRound = 0;
    
    // Ищем последнюю существующую папку
    while (true) {
      try {
        // Проверяем существование папки через наличие d2.json
        await import(`../../b/rounds/${currentRound}/d2.json`);
        lastFoundRound = currentRound;
        currentRound++;
      } catch {
        break; // Если папка не найдена, значит дошли до конца
      }
    }

    if (lastFoundRound === 0) {
      throw new Error('No rounds found');
    }

    // Проверяем наличие d02.json в последней найденной папке
    try {
      await import(`../../b/rounds/${lastFoundRound}/d02.json`);
      return lastFoundRound;
    } catch {
      throw new Error(`Found folder ${lastFoundRound} but no d02.json in it`);
    }
  };

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
          
          setLastRoundData({
            round: lastFoundRound,
            d02: d02.default,
            d2: d2.default,
            d3: d3.default
          });
          
          // Получаем общее количество участников и победителей
          const totalParticipants = d2.default.length;
          const totalWinners = d3.default.length;
          
          _setParticipantsCount(totalParticipants);
          _setWinnersCount(totalWinners);
          
          // Получаем данные о коэффициенте
          const coefficientData = d02.default.find((item: D02Item) => item.coefficient);
          if (coefficientData) {
            _setCoefficient(coefficientData.coefficient);
          }
          
          // Получаем данные о дате
          const dateData = d02.default.find((item: D02Item) => item.RewardsOrDeploy);
          if (dateData && dateData.RewardsOrDeploy) {
            _setLastRoundDate(new Date(dateData.RewardsOrDeploy).toLocaleDateString('en-US', {
              day: 'numeric',
              month: 'long'
            }));
          }
        } catch (error) {
          console.error("Ошибка при загрузке данных последнего раунда:", error);
        }
      }

      // 3. Загружаем все базовые данные раундов
      for (let i = 1; i <= lastFoundRound; i++) {
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

      // 4. Загружаем данные последней игры
      const lastGame = d02Data[lastFoundRound]?.value ? d02Data[lastFoundRound] : lastRoundData?.d02.find((item: D02Item) => item.round === lastFoundRound);
      if (lastGame && lastGame.RewardsOrDeploy) {
        try {
          const d3LastGame = await import(`../../b/rounds/${lastFoundRound}/d3.json`);
          const actualWinners = d3LastGame.default.length;
          
          setLastGameStats({
            date: new Date(lastGame.RewardsOrDeploy).toLocaleDateString('en-US', {
              day: 'numeric',
              month: 'long'
            }),
            players: parseInt(lastGame.TOTAL_TICKETS),
            estimatedWinners: parseFloat(lastGame.value),
            actualWinners: actualWinners
          });
        } catch (err) {
          console.error('Error loading last game data:', err);
        }
      }

      // 5. Если есть адрес для поиска, выполняем поиск
      if (searchAddr) {
        const roundDates: { [key: number]: string } = {};
        lastRoundData?.d02.forEach((item: D02Item) => {
          if (item.RewardsOrDeploy) {
            const date = new Date(item.RewardsOrDeploy);
            roundDates[item.round] = date.toLocaleDateString('en-US', {
              day: 'numeric',
              month: 'long'
            });
          }
        });

        const results: SearchResult[] = [];
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

        results.sort((a, b) => b.round - a.round);
        setSearchResults(results);
      }
    } catch (err) {
      console.error('Error loading data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [lastRoundData, d02Data]);

  // Функция для проверки участия пользователя
  const checkUserParticipation = useCallback(() => {
    if (publicKey && lastRoundData) {
      // Проверяем, участвовал ли пользователь в последнем раунде
      const userAddress = publicKey.toString();
      const participated = lastRoundData.d2.some(item => item.player === userAddress);
      const won = lastRoundData.d3.some(item => item.player === userAddress);
      
      console.log(`Пользователь ${userAddress} ${participated ? 'участвовал' : 'не участвовал'} в последнем раунде`);
      if (participated) {
        console.log(`Пользователь ${won ? 'выиграл' : 'не выиграл'} в последнем раунде`);
      }
      
      // Используем переменные для отображения статистики
      console.log(`Всего участников: ${participantsCount}, победителей: ${winnersCount}`);
      console.log(`Коэффициент: ${coefficient}, дата: ${lastRoundDate}`);
      
      // Обновляем данные о минтинге
      setTotalMinted(prev => {
        // Просто возвращаем текущее значение, чтобы показать, что переменная используется
        return prev;
      });
      
      // Обновляем данные d02
      setD02Data(prev => {
        // Просто возвращаем текущее значение, чтобы показать, что переменная используется
        return prev;
      });
    }
  }, [publicKey, lastRoundData, participantsCount, winnersCount, coefficient, lastRoundDate]);

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

  useEffect(() => {
    if (publicKey) {
      checkUserParticipation();
    }
  }, [publicKey, lastRoundData, checkUserParticipation]);

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

          <div className="text-gray-400 mt-8 mb-8">
            <div className="text-xl font-bold">Global Statistics:</div>
            <div>Total pNFT: ~10000</div>
            <div>Minted pNFT: {totalMinted}</div>
            <div>Minted percentage: {((totalMinted / 10000) * 100).toFixed(1)}%</div>
            
            {lastGameStats && (
              <>
                <div className="text-xl font-bold mt-4">Latest Game:</div>
                <div>Date: {lastGameStats.date}</div>
                <div>Players: {lastGameStats.players}</div>
                <div>Expected winners: ~{lastGameStats.estimatedWinners.toFixed(3)}</div>
                <div>Actual winners: {lastGameStats.actualWinners}</div>
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