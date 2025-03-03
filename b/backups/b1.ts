import { Connection, Keypair, clusterApiUrl, PublicKey } from "@solana/web3.js";
import { getOrCreateAssociatedTokenAccount, burn } from "@solana/spl-token";
import * as dotenv from "dotenv";

// Загружаем переменные окружения
dotenv.config();

async function burnToken() {
  // Проверяем, переданы ли параметры: network, mint_address, [burn_amount]
  if (process.argv.length < 4) {
    console.error("Использование: ts-node b1.ts <network [m|d]> <mint_address> [burn_amount]");
    process.exit(1);
  }
  
  // Читаем параметр сети
  const networkParam = process.argv[2].toLowerCase();
  let network;
  if (networkParam === "m") {
    network = "mainnet-beta";
  } else if (networkParam === "d") {
    network = "devnet";
  } else {
    console.error("Неверный параметр сети. Используйте 'm' для mainnet и 'd' для devnet.");
    process.exit(1);
  }
  
  // Считываем mint адрес и количество токенов для сжигания.
  const mintAddressString = process.argv[3];
  const burnAmountStr = process.argv[4] || "1"; // если не указано, сжигается 1 токен

  const mintAddress = new PublicKey(mintAddressString);
  const burnAmount = Number(burnAmountStr);

  // Подключаемся к выбранной сети
  const connection = new Connection(clusterApiUrl(network), "confirmed");

  // Загружаем секретный ключ плательщика из переменных окружения
  if (!process.env.PAYER_SECRET_KEY) {
    throw new Error("PAYER_SECRET_KEY не задан в переменных окружения");
  }
  const secretKey = JSON.parse(process.env.PAYER_SECRET_KEY);
  const payerSecretKey = new Uint8Array(secretKey);
  const payer = Keypair.fromSecretKey(payerSecretKey);
  console.log("Payer публичный ключ:", payer.publicKey.toString());

  console.log("Параметры сжигания:");
  console.log("  Network:", network);
  console.log("  Mint:", mintAddress.toString());
  console.log("  Количество токенов для сжигания:", burnAmount);

  // Получаем или создаем ассоциированный токен-аккаунт для данного mint и владельца (payer)
  const tokenAccount = await getOrCreateAssociatedTokenAccount(
    connection,
    payer,             // кто оплачивает создание аккаунта
    mintAddress,       // адрес mint токена
    payer.publicKey    // владелец аккаунта
  );
  console.log("Ассоциированный токен-аккаунт:", tokenAccount.address.toString());

  // Проверка на достаточное количество токенов на аккаунте
  if (tokenAccount.amount < BigInt(burnAmount)) {
    console.error(
      `Недостаточно токенов для сжигания. Баланс: ${tokenAccount.amount.toString()}, требуется: ${burnAmount}`
    );
    process.exit(1);
  }
  
  // Вызываем функцию сжигания токенов
  const signature = await burn(
    connection,
    payer,                  // плательщик транзакции
    tokenAccount.address,   // токен-аккаунт, с которого будут сожжены токены
    mintAddress,            // адрес mint
    payer,                  // владелец аккаунта
    burnAmount              // количество токенов для сжигания
  );
  console.log("Токены сожжены. Транзакция отправлена. Подпись транзакции:", signature);
}

burnToken().catch((err) => {
  console.error("Ошибка при сжигании токена:", err);
}); 