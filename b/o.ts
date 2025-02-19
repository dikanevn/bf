import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { mplTokenMetadata, findMetadataPda } from '@metaplex-foundation/mpl-token-metadata';
import { Connection, clusterApiUrl, PublicKey } from '@solana/web3.js';
import { getAccount } from '@solana/spl-token';
import { publicKey } from '@metaplex-foundation/umi';

(async () => {
  try {
    // Создаем экземпляр UMI для работы с Metaplex
    const umi = createUmi('https://api.devnet.solana.com').use(mplTokenMetadata());
    // Создаем соединение с Solana devnet
    const connection = new Connection(clusterApiUrl('devnet'), 'confirmed');

    // Адрес ассоциированного токен аккаунта, для которого хотим проверить метаданные
    const tokenAccountAddress = new PublicKey("3HCjtmpDEbuaMRSy7sAWkKJtMgev9UeUHQN19zM8Cqua");

    // Получаем информацию о токен аккаунте (из которого извлекаем mint адрес)
    const tokenAccountInfo = await getAccount(connection, tokenAccountAddress);
    console.log("Адрес Mint токена:", tokenAccountInfo.mint.toString());

    // Преобразуем web3.js PublicKey в UMI PublicKey
    const mintUmi = publicKey(tokenAccountInfo.mint.toBase58());
    // Вычисляем PDA (Program Derived Address) для аккаунта метаданных на основе mint
    const metadataPda = findMetadataPda(umi, { mint: mintUmi });
    console.log("Адрес аккаунта метаданных:", metadataPda.toString());
    
  } catch (error) {
    console.error("Ошибка:", error);
  }
})(); 