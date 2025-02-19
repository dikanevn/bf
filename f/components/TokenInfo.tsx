/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
'use client';

import { useState } from 'react';
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { PublicKey } from '@solana/web3.js';

// Программа метаданных (metadata program id)
const TOKEN_METADATA_PROGRAM_ID = new PublicKey(
  "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s"
);

// Функция для вычисления PDA метаданных
function getMetadataPda(mint: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("metadata"),
      TOKEN_METADATA_PROGRAM_ID.toBuffer(),
      mint.toBuffer(),
    ],
    TOKEN_METADATA_PROGRAM_ID
  );
  return pda;
}

// Функция для вычисления PDA мастер-издания
function findMasterEditionPda(mint: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("metadata"),
      TOKEN_METADATA_PROGRAM_ID.toBuffer(),
      mint.toBuffer(),
      Buffer.from("edition"),
    ],
    TOKEN_METADATA_PROGRAM_ID
  );
  return pda;
}

// Функция для получения данных цифрового актива (сырые данные аккаунта)
async function fetchDigitalAsset(umi: any, mint: PublicKey): Promise<any> {
  try {
    const metadataPda = getMetadataPda(mint);
    const accountInfo = await umi.connection.getAccountInfo(metadataPda);
    return accountInfo;
  } catch (error) {
    return null;
  }
}

export default function TokenInfo() {
  const [mintInput, setMintInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [metadataPdaStr, setMetadataPdaStr] = useState<string | null>(null);

  const getTokenInfo = async () => {
    if (!mintInput) {
      alert("Введите адрес mint!");
      return;
    }
    try {
      setLoading(true);

      // Создаем UMI instance на devnet
      const umi = await createUmi("https://api.devnet.solana.com");

      // Преобразуем введенный mint в PublicKey
      const mintPk = new PublicKey(mintInput);

      // Вычисляем PDA метаданных
      const pda = getMetadataPda(mintPk);
      setMetadataPdaStr(pda.toString());

      // Пытаемся получить данные цифрового актива
      let asset;
      try {
        asset = await fetchDigitalAsset(umi, mintPk);
      } catch (error) {
        asset = null;
      }

      // Формируем сообщение с информацией
      let message = `Информация о токене:
Mint: ${mintInput}
Metadata PDA: ${pda.toString()}
Master Edition PDA: ${(() => {
  try {
    return findMasterEditionPda(mintPk).toString();
  } catch (e) {
    return "не найден";
  }
})()}
`;

      if (asset) {
        message += `\nДетали цифрового актива: ${JSON.stringify(asset, null, 2)}`;
      } else {
        message += `\nДанных цифрового актива не получено.`;
      }

      // Выводим информацию в консоль для отладки
      console.log("Информация о токене:");
      console.log("Mint:", mintInput);
      console.log("Metadata PDA:", pda.toString());
      if (asset) {
        console.dir(asset, { depth: null });
      } else {
        console.log("Данные цифрового актива не получены.");
      }

      // Отображаем alert с результатом
      alert(message);
    } catch (error) {
      console.error("Ошибка:", error);
      alert(`Ошибка: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-3">
      <input
        type="text"
        placeholder="Введите адрес mint"
        value={mintInput}
        onChange={(e) => setMintInput(e.target.value)}
        className="px-3 py-2 border border-gray-300 mb-4 w-full"
      />
      <button 
        onClick={getTokenInfo}
        disabled={loading}
        className="px-4 py-2 bg-green-500 text-white hover:bg-green-600 disabled:bg-gray-400"
      >
        {loading ? 'Processing...' : 'Получить информацию'}
      </button>
      {metadataPdaStr && <p className="mt-4">Metadata PDA: {metadataPdaStr}</p>}
    </div>
  );
} 