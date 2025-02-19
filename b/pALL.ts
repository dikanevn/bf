import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { getAssociatedTokenAddress } from '@solana/spl-token';
import { PublicKey, Connection, clusterApiUrl } from "@solana/web3.js";
import { findMetadataPda, findMasterEditionPda, fetchDigitalAsset } from '@metaplex-foundation/mpl-token-metadata';
import { publicKey } from '@metaplex-foundation/umi';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

dotenv.config();

const logBuffer: string[] = [];

const originalConsoleLog = console.log;

const formatArg = (arg: any) => {
  return typeof arg === 'object' ? JSON.stringify(arg, null, 2) : arg;
};

console.log = (...args: any[]) => {
  const message = args.map(formatArg).join(" ");
  logBuffer.push(message);
  originalConsoleLog.apply(console, args);
};

const originalConsoleError = console.error;
console.error = (...args: any[]) => {
  const message = args.map(formatArg).join(" ");
  logBuffer.push(message);
  originalConsoleError.apply(console, args);
};

process.on('exit', () => {
  fs.writeFileSync('pALL.txt', logBuffer.join('\n'), 'utf8');
});

async function main() {
  // Проверка обязательных аргументов: параметр сети, адрес владельца и mint-адрес токена
  if (process.argv.length < 5) {
    console.error("Пожалуйста, укажите <d|m> <адрес владельца> <mint-адрес токена>");
    process.exit(1);
  }

  // Новый блок: выбор сети по первому параметру
  const networkArg = process.argv[2];
  let network: "devnet" | "mainnet-beta";
  if (networkArg === "d") {
    network = "devnet";
  } else if (networkArg === "m") {
    network = "mainnet-beta";
  } else {
    throw new Error("Неверный параметр сети. Используйте 'd' для devnet или 'm' для mainnet");
  }

  // Сдвигаем индексы: второй параметр - адрес владельца, третий - mint-адрес токена
  const ownerAddress = process.argv[3];
  const mintAddress = process.argv[4];

  console.log("Параметры запуска:");
  console.log("  Адрес владельца:", ownerAddress);
  console.log("  Mint-адрес токена:", mintAddress);

  // Создаем UMI instance для вычислений, связанных с Metaplex, используя выбранную сеть
  const umi = await createUmi(clusterApiUrl(network));

  // Преобразуем адреса в PublicKey (используя @solana/web3.js)
  const ownerPk = new PublicKey(ownerAddress);
  const mintPk = new PublicKey(mintAddress);

  // 1. Вычисляем Associated Token Address (ATA) для владельца и токена (как в pATA.ts)
  const ata = await getAssociatedTokenAddress(mintPk, ownerPk as unknown as PublicKey);
  console.log("\n=== Ассоциированный токен-аккаунт (ATA) ===");
  console.log("ATA:", ata.toString());

  // 2. Получаем информацию об аккаунте mint (как в n11s.ts)
  const connection = new Connection(clusterApiUrl(network), "confirmed");
  const mintAccountInfo = await connection.getParsedAccountInfo(mintPk);
  console.log("\n=== Информация об аккаунте mint ===");
  if (mintAccountInfo.value) {
    console.log("Mint Account Data:", mintAccountInfo.value.data);
  } else {
    console.log("Информация о mint аккаунте не найдена.");
  }

  // 3. Получаем информацию о токен-аккаунте (ATA) (как в n12s.ts)
  const tokenAccountInfo = await connection.getParsedAccountInfo(ata);
  console.log("\n=== Информация о токен-аккаунте (ATA) ===");
  if (tokenAccountInfo.value) {
    const parsedTokenData = (tokenAccountInfo.value.data as any).parsed;
    if (parsedTokenData && parsedTokenData.info) {
      const info = parsedTokenData.info;
      console.log("Mint:", info.mint);
      console.log("Owner:", info.owner);
      console.log("Amount:", info.tokenAmount.amount);
      console.log("Delegate:", info.delegate ? info.delegate : "нет");
      console.log("State:", info.state);
      console.log("Is Native:", info.isNative !== null ? info.isNative : "нет");
      console.log("Delegated Amount:", info.delegatedAmount ? info.delegatedAmount : "0");
      console.log("Close Authority:", info.closeAuthority ? info.closeAuthority : "нет");
    } else {
      console.log("Невозможно разобрать данные аккаунта.");
    }
  } else {
    console.log("Токен-аккаунт не найден.");
  }

  // 4. Вычисляем PDA для метаданных и master edition, а также пытаемся получить данные цифрового актива (как в p11s.ts)
  // Используем функцию publicKey из UMI для преобразования mint адреса
  const mintPkForMetadata = publicKey(mintAddress);
  const metadataPda = findMetadataPda(umi, { mint: mintPkForMetadata });
  let masterEditionPda;
  try {
    masterEditionPda = findMasterEditionPda(umi, { mint: mintPkForMetadata });
  } catch (error) {
    masterEditionPda = null;
  }
  console.log("\n=== Метаданные цифрового актива ===");
  console.log("Metadata PDA:", metadataPda.toString());
  if (masterEditionPda) {
    console.log("Master Edition PDA:", masterEditionPda.toString());
  } else {
    console.log("Master Edition PDA: не найден");
  }

  let asset;
  try {
    asset = await fetchDigitalAsset(umi, mintPkForMetadata);
  } catch (error) {
    asset = null;
  }
  console.log("\n=== Детали цифрового актива ===");
  if (asset) {
    console.dir(asset, { depth: null, colors: true });
  } else {
    console.log("Данные цифрового актива не получены.");
  }

  console.log("\nВсё вычислено. Готово.");
}

main()
  .then(() => { console.log("Завершено успешно."); })
  .catch((error) => {
    console.error("Ошибка:", error);
    process.exit(1);
  }); 