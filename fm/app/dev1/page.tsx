'use client';

import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { PublicKey, Transaction, SystemProgram, TransactionInstruction, Keypair, SYSVAR_RENT_PUBKEY, ComputeBudgetProgram, SYSVAR_INSTRUCTIONS_PUBKEY } from '@solana/web3.js';
import { createInitializeMintInstruction, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, getAssociatedTokenAddress, getAssociatedTokenAddressSync, TOKEN_2022_PROGRAM_ID } from '@solana/spl-token';
import { Buffer } from 'buffer';
import { useState, useEffect, useCallback } from 'react';
import { sha256 as jsSha256 } from 'js-sha256';
import { MerkleTree } from 'merkletreejs';
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { 
  generateSigner,
  percentAmount,
  none,
  createSignerFromKeypair,
  signerIdentity,
  createSignerFromKeypair as umiCreateSignerFromKeypair, 
  publicKey as publicKeyUmi
} from '@metaplex-foundation/umi';
import { Connection, clusterApiUrl } from '@solana/web3.js';
import { Metadata, Edition } from '@metaplex-foundation/mpl-token-metadata';

import { 
  createAssociatedTokenAccountInstruction 
} from '@solana/spl-token';

const TOKEN_METADATA_PROGRAM_ID = new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s');
const PROGRAM_ID = new PublicKey("YAPtopU8xhtnHcW4W5cBKVA3eLojzDU6q5h5X5eEykt");

interface SearchResult {
  round: number;
  participated: boolean;
  won: boolean;
  date: string;
  extendedMinted?: boolean;
  mintAddress?: string;
}

interface D02Data {
  round: number;
  value: string;
  TOTAL_TICKETS: string;
  coefficient: string;
  BITCOIN_BLOCK_NUMBER?: string;
  RewardsOrDeploy?: string;
  winnersCount?: number;
}

const WalletMultiButtonDynamic = dynamic(
  () => import('@solana/wallet-adapter-react-ui').then(mod => mod.WalletMultiButton),
  { ssr: false }
);

const DevnetWalletProviderDynamic = dynamic(
  () => import('../../components/DevnetWalletProvider'),
  { ssr: false }
);

// Функция для вычисления SHA-256 хеша
function sha256(data: Buffer): Buffer {
  const hashHex = jsSha256(data);
  return Buffer.from(hashHex, 'hex');
}

// Функция для проверки меркл-доказательства
function verifyMerkleProof(proof: Buffer[], leaf: Buffer, root: Buffer): boolean {
  let computedHash = leaf;
  
  for (const proofElement of proof) {
    if (Buffer.compare(computedHash, proofElement) < 0) {
      computedHash = sha256(Buffer.concat([computedHash, proofElement]));
    } else {
      computedHash = sha256(Buffer.concat([proofElement, computedHash]));
    }
  }
  
  return computedHash.equals(root);
}

// Утилитные функции для работы с NFT
async function validateAndGetMerkleProof(
  connection: Connection,
  wallet: { publicKey: PublicKey },
  round: number,
  allRoundsMerkleRoots: Buffer[],
  allRoundsWinners: string[][],
  nftNumber?: number // Добавляем опциональный параметр NFTnumber
): Promise<{ proof: Buffer[]; isValid: boolean }> {
  try {
    if (!wallet.publicKey) {
      throw new Error("Кошелек не подключен");
    }

    // Проверяем, что раунд существует и у нас есть корень для него
    if (round <= 0 || round > allRoundsMerkleRoots.length) {
      throw new Error(`Неверный номер раунда: ${round}`);
    }

    // Получаем корень для указанного раунда
    const root = allRoundsMerkleRoots[round - 1];
    if (!root) {
      throw new Error(`Merkle root для раунда ${round} не найден`);
    }

    // Получаем список победителей для указанного раунда
    const winners = allRoundsWinners[round - 1];
    if (!winners || winners.length === 0) {
      throw new Error(`Список победителей для раунда ${round} не найден или пуст`);
    }

    // Проверяем, есть ли адрес кошелька в списке победителей
    const walletAddress = wallet.publicKey.toString();
    const isWinner = winners.includes(walletAddress);
    if (!isWinner) {
      return { proof: [], isValid: false };
    }

    // Создаем буфер из адреса публичного ключа
    const pkBytes = Buffer.from(wallet.publicKey.toBytes());
    
    // Создаем хеш для текущего кошелька
    let leafBuffer: Buffer;
    
    // Если предоставлен NFTnumber, включаем его в хеш
    if (nftNumber !== undefined) {
      // Создаем буфер для NFTnumber (2 байта, uint16)
      const nftNumberBuffer = Buffer.alloc(2);
      nftNumberBuffer.writeUInt16LE(nftNumber, 0);
      
      // Объединяем буферы: сначала адрес, затем NFTnumber
      const combinedBuffer = Buffer.concat([pkBytes, nftNumberBuffer]);
      
      // Хешируем объединенный буфер
      leafBuffer = sha256(combinedBuffer);
    } else {
      // Для обратной совместимости: если NFTnumber не предоставлен, используем только адрес
      leafBuffer = sha256(pkBytes);
    }

    // Создаем листья для всех победителей
    const leaves: Buffer[] = [];
    
    for (const winnerAddress of winners) {
      // Если это адрес текущего кошелька и у нас есть уже созданный leafBuffer
      if (winnerAddress === walletAddress) {
        leaves.push(leafBuffer);
        continue;
      }
      
      // Для других адресов
      let winnerNftNumber = 0;
      
      // Если нам нужно учитывать NFTnumber, пытаемся его найти
      if (nftNumber !== undefined) {
        try {
          // Загружаем d3.json для текущего раунда
          const d3 = await import(`../../../b/rounds/${round}/d3.json`);
          
          // Ищем данные для этого адреса
          const playerData = d3.default.find((item: { player: string, NFTnumber?: number }) => 
            item.player === winnerAddress
          );
          
          if (playerData && playerData.NFTnumber !== undefined) {
            winnerNftNumber = playerData.NFTnumber;
          }
        } catch (error) {
          console.error(`Ошибка при загрузке данных для раунда ${round}:`, error);
        }
      }
      
      const winnerPkBytes = Buffer.from(new PublicKey(winnerAddress).toBytes());
      
      // Если NFTnumber нужен, включаем его в хеш
      if (nftNumber !== undefined) {
        const winnerNftBuffer = Buffer.alloc(2);
        winnerNftBuffer.writeUInt16LE(winnerNftNumber, 0);
        leaves.push(sha256(Buffer.concat([winnerPkBytes, winnerNftBuffer])));
      } else {
        leaves.push(sha256(winnerPkBytes));
      }
    }

    // Сортируем листья для консистентности
    const sortedLeaves = [...leaves].sort(Buffer.compare);

    // Создаем меркл-дерево
    const tree = new MerkleTree(sortedLeaves, sha256, { sortPairs: true });

    // Получаем доказательство для нашего листа
    const proof = tree.getProof(leafBuffer);
    const proofBuffers = proof.map(p => p.data);

    // Проверяем доказательство
    const isValid = verifyMerkleProof(proofBuffers, leafBuffer, root);

    return {
      proof: proofBuffers,
      isValid,
    };
  } catch (error) {
    console.error("Ошибка при проверке Merkle Proof:", error);
    throw error;
  }
}

async function createMintAndTokenAccounts(
  connection: any,
  wallet: any,
  programId: PublicKey
): Promise<{
  mint: Keypair;
  associatedTokenAccount: PublicKey;
  programAuthority: PublicKey;
  bumpSeed: number;
}> {
  const mint = Keypair.generate();
  const [programAuthority, bumpSeed] = await PublicKey.findProgramAddress(
    [Buffer.from("mint_authority", "utf-8")],
    programId
  );
  
  const associatedTokenAccount = await getAssociatedTokenAddress(
    mint.publicKey,
    wallet.publicKey
  );

  return {
    mint,
    associatedTokenAccount,
    programAuthority,
    bumpSeed
  };
}

async function createMetadataAccounts(
  connection: any,
  mint: PublicKey
): Promise<{
  metadata: PublicKey;
  masterEdition: PublicKey;
}> {
  const umi = createUmi(connection.rpcEndpoint);
  const metadata = PublicKey.findProgramAddressSync(
    [
      Buffer.from("metadata"),
      new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s").toBuffer(),
      mint.toBuffer()
    ],
    new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s")
  )[0];

  const masterEdition = PublicKey.findProgramAddressSync(
    [
      Buffer.from("metadata"),
      new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s").toBuffer(),
      mint.toBuffer(),
      Buffer.from("edition"),
    ],
    new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s")
  )[0];

  return {
    metadata,
    masterEdition
  };
}

async function createMintRecordPDA(
  connection: any,
  wallet: any,
  programId: PublicKey,
  round: number
): Promise<{
  mintRecord: PublicKey;
  mintRecordBump: number;
}> {
  const roundBytes = Buffer.alloc(8);
  roundBytes.writeBigUInt64LE(BigInt(round));
  
  const [mintRecord, mintRecordBump] = await PublicKey.findProgramAddress(
    [
      Buffer.from("minted", "utf-8"),
      roundBytes,
      wallet.publicKey.toBuffer(),
    ],
    programId
  );

  return {
    mintRecord,
    mintRecordBump
  };
}

async function buildNftTransaction(
  connection: any,
  wallet: any,
  programId: PublicKey,
  accounts: {
    mint: Keypair;
    associatedTokenAccount: PublicKey;
    programAuthority: PublicKey;
    metadata: PublicKey;
    masterEdition: PublicKey;
    mintRecord: PublicKey;
  },
  proof: Buffer[],
  round: number
): Promise<Transaction> {
  const transaction = new Transaction();

  // Добавляем лимиты
  transaction.add(
    ComputeBudgetProgram.setComputeUnitLimit({
      units: 1000000
    })
  );
  transaction.add(
    ComputeBudgetProgram.setComputeUnitPrice({
      microLamports: 1000
    })
  );

  // Создаем буфер для данных инструкции
  // 1 байт для номера инструкции (24)
  // 1 байт для номера раунда
  // 32 байта * количество элементов в proof для самого proof
  const dataLength = 1 + 1 + (proof.length * 32);
  const dataBuffer = Buffer.alloc(dataLength);

  // Записываем номер инструкции и раунда
  dataBuffer.writeUInt8(24, 0);
  dataBuffer.writeUInt8(round, 1);

  // Записываем proof
  let offset = 2;
  for (const proofElement of proof) {
    proofElement.copy(dataBuffer, offset);
    offset += 32;
  }

  const createNftInstruction = new TransactionInstruction({
    programId,
    keys: [
      { pubkey: accounts.metadata, isSigner: false, isWritable: true },
      { pubkey: accounts.masterEdition, isSigner: false, isWritable: true },
      { pubkey: accounts.mint.publicKey, isSigner: true, isWritable: true },
      { pubkey: accounts.programAuthority, isSigner: false, isWritable: false },
      { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
      { pubkey: accounts.programAuthority, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: SYSVAR_INSTRUCTIONS_PUBKEY, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s'), isSigner: false, isWritable: false },
      { pubkey: accounts.associatedTokenAccount, isSigner: false, isWritable: true },
      { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
      { pubkey: accounts.mintRecord, isSigner: false, isWritable: true },
    ],
    data: dataBuffer
  });

  transaction.add(createNftInstruction);
  return transaction;
}

function DevContent() {
  const { publicKey, signTransaction, sendTransaction, wallet } = useWallet();
  const { connection } = useConnection();
  const [loading, setLoading] = useState(false);
  const [mintKeypair, setMintKeypair] = useState<Keypair | null>(null);
  const [metadataAddress, setMetadataAddress] = useState<PublicKey | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [ataAddress, setAtaAddress] = useState<PublicKey | null>(null);
  const [winningRounds, setWinningRounds] = useState<SearchResult[]>([]);
  const [totalGames, setTotalGames] = useState(0);
  const [totalWins, setTotalWins] = useState(0);
  const [totalLosses, setTotalLosses] = useState(0);
  const [manualRoundNumber, setManualRoundNumber] = useState<string>("1");
  const [mintAddress, setMintAddress] = useState<string | null>(null);
  const [txSignature, setTxSignature] = useState<string | null>(null);
  interface NftInfo {
    mintAccount: unknown;
    tokenAccount: unknown;
    metadata: string;
    masterEdition: string;
    metadataData: string | null;
  }
  const [nftInfo, setNftInfo] = useState<NftInfo | null>(null);
  const [isLoadingNftInfo, setIsLoadingNftInfo] = useState(false);
  const [isLoading24, setIsLoading24] = useState(false);
  const [isLoading32, setIsLoading32] = useState(false);
  const [isLoading33, setIsLoading33] = useState(false);
  const [isLoading15, setIsLoading15] = useState(false);




  const checkIfMintedInRoundExtended = useCallback(async (roundNumber: number): Promise<string | null> => {
    if (!publicKey) return null;
    
    try {
      // Получаем адрес PDA для расширенного отслеживания минтинга
      const roundBytes = Buffer.alloc(8);
      roundBytes.writeBigUInt64LE(BigInt(roundNumber - 1));
      const [mintRecordPDA] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("minted"),
          roundBytes,
          publicKey.toBuffer(),
        ],
        PROGRAM_ID
      );
      
      // Проверяем существование аккаунта
      const accountInfo = await connection.getAccountInfo(mintRecordPDA);
      
      // Если аккаунт существует и принадлежит программе
      if (accountInfo !== null && accountInfo.owner.equals(PROGRAM_ID)) {
        // Проверяем размер данных
        if (accountInfo.data.length < 32) {
          console.error(`Недостаточный размер данных: ${accountInfo.data.length} байт`);
          return "Ошибка: недостаточный размер данных";
        }
        
        // Извлекаем адрес минта из данных аккаунта
        try {
          const mintAddress = new PublicKey(accountInfo.data.slice(0, 32));
          return mintAddress.toString();
        } catch (err) {
          console.error("Ошибка при чтении адреса минта:", err);
          return "Ошибка чтения адреса";
        }
      }
      
      return null;
    } catch (err) {
      console.error(`Ошибка при проверке расширенного минтинга для раунда ${roundNumber}:`, err);
      return null;
    }
  }, [publicKey, connection]);

  const loadWinningRounds = useCallback(async (address: string) => {
    try {
      const results: SearchResult[] = [];
      
      // Находим последний раунд
      let currentRound = 1;
      let lastFoundRound = 0;
      
      while (true) {
        try {
          await import(`../../../b/rounds/${currentRound}/d2.json`);
          lastFoundRound = currentRound;
          currentRound++;
        } catch {
          break;
        }
      }

      setTotalGames(lastFoundRound);

      // Загружаем d02.json только последнего раунда для получения актуальных дат
      let lastRoundDate: string | undefined;
      try {
        const d02 = await import(`../../../b/rounds/${lastFoundRound}/d02.json`);
        lastRoundDate = d02.default.find((item: D02Data) => item.RewardsOrDeploy)?.RewardsOrDeploy;
      } catch (err) {
        console.error(`Ошибка при загрузке d02.json для последнего раунда:`, err);
      }

      // Загружаем данные для каждого раунда
      for (let i = 1; i <= lastFoundRound; i++) {
        try {
          // Загружаем d2.json
          let d2Data;
          try {
            d2Data = await import(`../../../b/rounds/${i}/d2.json`);
          } catch (err) {
            console.error(`Ошибка при загрузке d2.json для раунда ${i}:`, err);
            continue; // Пропускаем этот раунд, если d2.json не найден
          }

          // Загружаем d3.json
          let d3Data;
          let won = false;
          try {
            d3Data = await import(`../../../b/rounds/${i}/d3.json`);
            won = d3Data.default.some((item: { player: string }) => item.player === address);
          } catch (err) {
            console.error(`Ошибка при загрузке d3.json для раунда ${i}:`, err);
            // Продолжаем выполнение даже если d3.json не найден
            // won остается false
          }

          const participated = d2Data.default.some((item: { player: string }) => item.player === address);
          
          if (participated || won) {
            const date = i === lastFoundRound && lastRoundDate ? 
              new Date(lastRoundDate).toLocaleDateString('en-US', {
                day: 'numeric',
                month: 'long'
              }) : `Round ${i}`;

            results.push({
              round: i,
              participated,
              won,
              date
            });
          }
        } catch (err) {
          console.error(`Ошибка при обработке данных для раунда ${i}:`, err);
          continue;
        }
      }

      // Проверяем минтинг для каждого раунда, если кошелек подключен
      if (publicKey) {
        // Создаем копию результатов для асинхронного обновления
        const updatedResults = [...results];
        
        // Проверяем каждый раунд на минтинг
        for (let i = 0; i < updatedResults.length; i++) {
          const result = updatedResults[i];
          if (result && typeof result.round === 'number') {
            try {
              // Проверяем только расширенное отслеживание минтинга
              const mintAddress = await checkIfMintedInRoundExtended(result.round);
              if (mintAddress) {
                result.extendedMinted = true;
                result.mintAddress = mintAddress;
              } else {
                result.extendedMinted = false;
              }
            } catch (err) {
              console.error(`Ошибка при проверке минтинга для раунда ${result.round}:`, err);
              // Продолжаем выполнение даже при ошибке проверки минтинга
            }
          }
        }
        
        // Обновляем результаты с информацией о минтинге
        results.length = 0;
        results.push(...updatedResults);
      }

      const wins = results.filter(r => r.won).length;
      const losses = results.filter(r => r.participated && !r.won).length;
      
      setTotalWins(wins);
      setTotalLosses(losses);
      setWinningRounds(results.filter(r => r.won).sort((a, b) => b.round - a.round));
    } catch (err) {
      console.error("Ошибка при загрузке выигрышных раундов:", err);
      setWinningRounds([]);
    }
  }, [publicKey, checkIfMintedInRoundExtended]);

  const calculateLastRoundMerkleRoot = async () => {
    try {
      setLoading(true);
      
      // Находим последний раунд
      let currentRound = 1;
      let lastFoundRound = 0;
      
      while (true) {
        try {
          await import(`../../../b/rounds/${currentRound}/d3.json`);
          lastFoundRound = currentRound;
          currentRound++;
        } catch {
          break;
        }
      }

      if (lastFoundRound === 0) {
        alert('Раунды не найдены');
        return;
      }

      // Загружаем d3.json последнего раунда
      const d3 = await import(`../../../b/rounds/${lastFoundRound}/d3.json`);
      
      // Получаем все адреса из d3
      const addresses = d3.default.map((item: { player: string }) => item.player);
      
      // Создаем листья для меркл-дерева
      const leaves = addresses.map((addr: string) => {
        const pkBytes = Buffer.from(new PublicKey(addr).toBytes());
        return sha256(pkBytes);
      });
      
      // Сортируем листья для консистентности
      const sortedLeaves = leaves.slice().sort(Buffer.compare);
      
      // Создаем меркл-дерево
      const tree = new MerkleTree(sortedLeaves, sha256, { sortPairs: true });
      
      // Получаем корень в виде байтов
      const root = tree.getRoot();
      
      // Преобразуем байты в hex строку с форматом 0xXX
      const rootHexBytes = Array.from(root).map(b => `0x${b.toString(16).padStart(2, '0')}`);
      const formattedRoot = `[\n    ${rootHexBytes.join(', ')}\n]`;
      
      console.log("Merkle Root в байтах:", formattedRoot);
      alert(`Merkle Root последнего раунда (${lastFoundRound}):\n${formattedRoot}`);
    } catch (error) {
      console.error("Ошибка при вычислении Merkle Root:", error);
      alert(`Ошибка: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setLoading(false);
    }
  };

  const calculateAllRoundsMerkleRoots = async () => {
    try {
      setLoading(true);
      
      // Находим последний раунд
      let currentRound = 1;
      let lastFoundRound = 0;
      
      while (true) {
        try {
          await import(`../../../b/rounds/${currentRound}/d3.json`);
          lastFoundRound = currentRound;
          currentRound++;
        } catch {
          break;
        }
      }

      if (lastFoundRound === 0) {
        alert('Раунды не найдены');
        return;
      }

      const allRootsInfo = [];

      // Обрабатываем каждый раунд
      for (let round = 1; round <= lastFoundRound; round++) {
        try {
          // Загружаем d3.json текущего раунда
          const d3 = await import(`../../../b/rounds/${round}/d3.json`);
          
          // Получаем все адреса и NFTnumber из d3
          const playersData = d3.default.map((item: { player: string, NFTnumber?: number }) => ({
            player: item.player,
            NFTnumber: item.NFTnumber || 0 // Используем 0, если NFTnumber не определен
          }));
          
          // Создаем листья для меркл-дерева, включая NFTnumber
          const leaves = playersData.map(({ player, NFTnumber }: { player: string, NFTnumber: number }) => {
            // Создаем буфер из адреса публичного ключа
            const pkBytes = Buffer.from(new PublicKey(player).toBytes());
            
            // Создаем буфер для NFTnumber (2 байта, uint16)
            const nftNumberBuffer = Buffer.alloc(2);
            nftNumberBuffer.writeUInt16LE(NFTnumber, 0);
            
            // Объединяем буферы: сначала адрес, затем NFTnumber
            const combinedBuffer = Buffer.concat([pkBytes, nftNumberBuffer]);
            
            // Хешируем объединенный буфер
            return sha256(combinedBuffer);
          });
          
          // Сортируем листья для консистентности
          const sortedLeaves = leaves.slice().sort(Buffer.compare);
          
          // Создаем меркл-дерево
          const tree = new MerkleTree(sortedLeaves, sha256, { sortPairs: true });
          
          // Получаем корень в виде байтов
          const root = tree.getRoot();
          
          // Преобразуем байты в hex строку с форматом 0xXX
          const rootHexBytes = Array.from(root).map(b => `0x${b.toString(16).padStart(2, '0')}`);
          const formattedRoot = `[\n    ${rootHexBytes.join(', ')}\n]`;
          
          allRootsInfo.push(`Раунд ${round}:\n${formattedRoot}`);
        } catch (error) {
          console.error(`Ошибка при обработке раунда ${round}:`, error);
          allRootsInfo.push(`Раунд ${round}: Ошибка обработки`);
        }
      }

      // Выводим все корни
      const fullMessage = `Merkle Roots для всех раундов:\n\n${allRootsInfo.join('\n\n')}`;
      console.log(fullMessage);
      alert(fullMessage);
    } catch (error) {
      console.error("Ошибка при вычислении Merkle Roots:", error);
      alert(`Ошибка: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setLoading(false);
    }
  };

  const getNftInfo = async (mintAddress: string) => {
    setIsLoadingNftInfo(true);
    try {
      // Преобразуем адрес в PublicKey
      const mintPk = new PublicKey(mintAddress);
      
      // Получаем ATA для владельца и токена
      if (publicKey) {
        const ata = await getAssociatedTokenAddress(mintPk, publicKey);
        
        // Получаем информацию о mint аккаунте
        const mintAccountInfo = await connection.getParsedAccountInfo(mintPk);
        
        // Получаем информацию о токен-аккаунте (ATA)
        const tokenAccountInfo = await connection.getParsedAccountInfo(ata);
        
        // Получаем PDA для метаданных
        const [metadataPda] = PublicKey.findProgramAddressSync(
          [
            Buffer.from('metadata'),
            TOKEN_METADATA_PROGRAM_ID.toBuffer(),
            mintPk.toBuffer(),
          ],
          TOKEN_METADATA_PROGRAM_ID
        );
        
        // Получаем PDA для master edition
        const [masterEditionPda] = PublicKey.findProgramAddressSync(
          [
            Buffer.from('metadata'),
            TOKEN_METADATA_PROGRAM_ID.toBuffer(),
            mintPk.toBuffer(),
            Buffer.from('edition'),
          ],
          TOKEN_METADATA_PROGRAM_ID
        );
        
        // Получаем данные метаданных
        let metadata = null;
        try {
          const metadataAccount = await connection.getAccountInfo(metadataPda);
          if (metadataAccount) {
            metadata = metadataAccount.data;
          }
        } catch (error) {
          console.error("Ошибка при получении метаданных:", error);
        }
        
        return {
          mintAccount: mintAccountInfo.value,
          tokenAccount: tokenAccountInfo.value,
          metadata: metadataPda.toString(),
          masterEdition: masterEditionPda.toString(),
          metadataData: metadata ? Buffer.from(metadata).toString('base64') : null
        };
      }
    } catch (error) {
      console.error("Ошибка при получении информации об NFT:", error);
      alert(`Ошибка при получении информации об NFT: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsLoadingNftInfo(false);
    }
  };


  const onDeleteMintRecordPDA = async () => {
    if (!publicKey || !sendTransaction) {
      alert("Пожалуйста, подключите кошелек");
      return;
    }

    setIsLoading15(true);

    try {
      // Проверяем, что номер раунда валидный
      const roundNumber = parseInt(manualRoundNumber);
      if (isNaN(roundNumber) || roundNumber < 1 || roundNumber > 21) {
        alert("Пожалуйста, введите корректный номер раунда (1-21)");
        setIsLoading15(false);
        return;
      }

      // Получаем адрес PDA для расширенного отслеживания минтинга
      const roundBytes = Buffer.alloc(8);
      roundBytes.writeBigUInt64LE(BigInt(roundNumber - 1));
      const [mintRecordPDA] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("minted"),
          roundBytes,
          publicKey.toBuffer(),
        ],
        PROGRAM_ID
      );
      console.log("Mint Record PDA для удаления:", mintRecordPDA.toBase58());

      // Создаем буфер данных для инструкции
      const dataBuffer = Buffer.alloc(2);
      dataBuffer[0] = 15; // Инструкция 15
      dataBuffer[1] = roundNumber - 1; // Номер раунда (0-based в контракте)

      // Создаем инструкцию
      const deleteMintRecordIx = new TransactionInstruction({
        programId: PROGRAM_ID,
        keys: [
          { pubkey: publicKey, isSigner: true, isWritable: true },
          { pubkey: mintRecordPDA, isSigner: false, isWritable: true },
        ],
        data: dataBuffer
      });

      // Создаем транзакцию
      const transaction = new Transaction();
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
      
      transaction.add(deleteMintRecordIx);
      transaction.feePayer = publicKey;
      transaction.recentBlockhash = blockhash;

      try {
        const signature = await sendTransaction(transaction, connection);
        
        console.log("Transaction sent:", signature);
        await connection.confirmTransaction({
          blockhash,
          lastValidBlockHeight,
          signature
        });
        
        console.log("Transaction confirmed");
        alert(`PDA для отслеживания минтинга раунда ${roundNumber} успешно удален!`);
        
        // Обновляем список выигрышных раундов
        if (publicKey) {
          await loadWinningRounds(publicKey.toString());
        }
      } catch (error) {
        console.error("Error sending transaction:", error);
        alert(`Ошибка при отправке транзакции: ${error instanceof Error ? error.message : String(error)}`);
      }
    } catch (error) {
      console.error("Error:", error);
      alert(`Ошибка: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsLoading15(false);
    }
  };

  useEffect(() => {
    if (publicKey) {
      void loadWinningRounds(publicKey.toString());
    }
  }, [publicKey, loadWinningRounds]);

  return (
    <div className="min-h-screen bg-black">
      <div className="pt-[2vh] px-[2vw] text-gray-400">
        <div className="flex items-center justify-between mb-8">
          <Link href="/" className="text-blue-400 hover:text-blue-300">
            ← Главная
          </Link>
          <WalletMultiButtonDynamic />
        </div>

        {publicKey && (
          <div className="mt-8 break-all">
            <div>Подключенный адрес: {publicKey.toString()}</div>
            {mintKeypair && <div className="mt-2">Mint Address: {mintKeypair.publicKey.toString()}</div>}
            {ataAddress && <div className="mt-2">Associated Token Account: {ataAddress.toString()}</div>}
            {metadataAddress && <div className="mt-2">Metadata Address: {metadataAddress.toString()}</div>}
            
            <div className="mt-4 text-gray-400">
              <div>Всего игр: {totalGames}</div>
              <div>Выиграно: {totalWins}</div>
              <div>Проиграно: {totalLosses}</div>
            </div>

            {winningRounds.length > 0 && (
              <div className="mt-4">
                <h3 className="text-gray-400 mb-2">Выигрышные раунды:</h3>
                {winningRounds.map((result) => (
                  <div key={result.round} className="text-green-400">
                    Раунд {result.round} | {result.date} | Выигрыш подтвержден! ✅
                    {result.extendedMinted !== undefined && (
                      <>
                        <span className={result.extendedMinted ? "text-purple-400 ml-2" : "text-gray-400 ml-2"}>
                          {result.extendedMinted ? "Расширенный минт выполнен ✓" : "Расширенный минт не выполнен ✗"}
                        </span>
                        <span className="text-xs text-gray-500 ml-2">
                          (PDA: {(() => {
                            const roundBytes = Buffer.alloc(8);
                            roundBytes.writeBigUInt64LE(BigInt(result.round - 1));
                            return PublicKey.findProgramAddressSync(
                              [
                                Buffer.from("is_minted_ext"),
                                roundBytes,
                                publicKey!.toBuffer(),
                              ],
                              PROGRAM_ID
                            )[0].toBase58();
                          })()})
                        </span>
                      </>
                    )}
                    {result.mintAddress && (
                      <div className="text-xs text-gray-400 ml-4 mt-1">
                        Минт: {result.mintAddress}
                        <button
                          onClick={() => getNftInfo(result.mintAddress!)}
                          className="ml-2 bg-blue-600 hover:bg-blue-700 text-white px-2 py-0.5 text-xs"
                          disabled={isLoadingNftInfo}
                        >
                          {isLoadingNftInfo ? 'Загрузка...' : 'Инфо'}
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="flex flex-col gap-2 mt-8">





              <div className="flex items-center gap-2 mt-2">
                <input
                  type="number"
                  min="1"
                  max="21"
                  value={manualRoundNumber}
                  onChange={(e) => setManualRoundNumber(e.target.value)}
                  className="bg-gray-800 text-white px-3 py-1.5 text-xs border border-gray-700 w-16"
                  placeholder="Раунд"
                  disabled={isLoading15}
                />
                <button 
                  onClick={onDeleteMintRecordPDA}
                  disabled={!publicKey || isLoading15}
                  className="bg-red-800 hover:bg-red-900 text-white px-3 py-1.5 text-xs disabled:opacity-50 flex-1"
                >
                  {isLoading15 ? 'Processing...' : '15. Удалить PDA для отслеживания минтинга'}
                </button>
              </div>

              <div className="flex flex-col space-y-2 mt-4">
                <div>
                  <button
                    disabled={!publicKey || isLoading}
                    onClick={() => {
                      const mintAddressInput = prompt("Введите адрес минта:");
                      if (mintAddressInput) {
                        getNftInfo(mintAddressInput);
                      }
                    }}
                    className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded w-full"
                  >
                    {isLoading ? "Загрузка..." : "19. Получить информацию о минте"}
                  </button>
                </div>
              </div>

              <button 
                onClick={calculateAllRoundsMerkleRoots}
                disabled={loading}
                className="bg-yellow-800 hover:bg-yellow-900 text-white px-3 py-1.5 text-xs disabled:opacity-50"
              >
                {loading ? 'Вычисление...' : '8. Посчитать Merkle Root всех раундов'}
              </button>

              <button 
                onClick={calculateLastRoundMerkleRoot}
                disabled={loading}
                className="bg-yellow-600 hover:bg-yellow-700 text-white px-3 py-1.5 text-xs disabled:opacity-50"
              >
                {loading ? 'Вычисление...' : '7. Посчитать Merkle Root последнего раунда'}
              </button>

            </div>

            {nftInfo && (
              <div className="mt-8 text-gray-400">
                <h3 className="text-xl font-bold mb-4">Информация об NFT:</h3>
                <div className="space-y-4">
                  <div>
                    <span className="font-semibold">Mint аккаунт:</span>
                    <pre className="text-xs mt-1 bg-gray-900 p-2 rounded overflow-x-auto">
                      {JSON.stringify(nftInfo.mintAccount, null, 2)}
                    </pre>
                  </div>

                  <div>
                    <span className="font-semibold">Токен аккаунт:</span>
                    <pre className="text-xs mt-1 bg-gray-900 p-2 rounded overflow-x-auto">
                      {JSON.stringify(nftInfo.tokenAccount, null, 2)}
                    </pre>
                  </div>

                  <div>
                    <span className="font-semibold">Адрес метаданных:</span>
                    <div className="text-xs mt-1 break-all">{nftInfo.metadata}</div>
                  </div>

                  <div>
                    <span className="font-semibold">Master Edition:</span>
                    <div className="text-xs mt-1 break-all">{nftInfo.masterEdition}</div>
                  </div>

                  {nftInfo.metadataData && (
                    <div>
                      <span className="font-semibold">Данные метаданных (base64):</span>
                      <div className="text-xs mt-1 break-all bg-gray-900 p-2 rounded">
                        {nftInfo.metadataData}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function DevPage() {
  return (
    <DevnetWalletProviderDynamic>
      <DevContent />
    </DevnetWalletProviderDynamic>
  );
} 