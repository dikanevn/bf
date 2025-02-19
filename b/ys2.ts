import { Connection, clusterApiUrl, PublicKey } from "@solana/web3.js";

// Если других переменных окружения не требуется, можно удалить dotenv

async function main() {
  // Подключаемся к Mainnet Beta
  const connection = new Connection(clusterApiUrl("mainnet-beta"), "confirmed");

  // Указываем адрес токена напрямую (замените на интересующий вас адрес)
  const tokenAddress = new PublicKey("9aGQqWqHSeyVtQXNkPuTUZ3aW288fjeRLQcMmjniivEf");

  // Адрес WSOL (обёрнутый SOL) на Solana
  const WSOL_ADDRESS = new PublicKey("So11111111111111111111111111111111111111112");

  // Убираем сортировку: используем токены в порядке их определения
  const token0 = WSOL_ADDRESS; // WSOL
  const token1 = tokenAddress; // COPIUM

  // Подготовка вариантов сидов для PDA (без сортировки)
  const allPossibleSeeds = [
    [
      Buffer.from("cpmm"),
      token0.toBuffer(),
      token1.toBuffer(),
      new PublicKey("G95xxie3XbkCqtE39GgQ9Ggc7xBC8Uceve7HFDEFApkc").toBuffer(),
    ],
    [
      Buffer.from("cpmm"),
      token1.toBuffer(),
      token0.toBuffer(),
      new PublicKey("G95xxie3XbkCqtE39GgQ9Ggc7xBC8Uceve7HFDEFApkc").toBuffer(),
    ],
  ];

  // Целевой адрес пула, который надо найти
  const targetPoolAddress = "EPSRjzgevLHLm1xp5PNa816LYhmn2VUb9FTpXNsbvFHP";

  // Оставляем только одну Raydium программу - CPMM (CP-Swap, New)
  const raydiumPrograms = [
    { description: "Standard AMM (CP-Swap, New)", address: "CPMMoo8L3F4NbTegBCKVNunggL7H1ZpdTHKxQB5qKP1C" },
  ];

  let found = false;
  for (const program of raydiumPrograms) {
    try {
      const programId = new PublicKey(program.address);
      // Перебираем варианты сидов (без сортировки)
      for (let i = 0; i < allPossibleSeeds.length; i++) {
        const [poolAddress, bump] = await PublicKey.findProgramAddress(allPossibleSeeds[i], programId);
        console.log(`Вариант ${i + 1} (${allPossibleSeeds[i][0].toString()}): ${poolAddress.toString()} (bump: ${bump})`);

        if (poolAddress.toString() === targetPoolAddress) {
          console.log(`>>> Найден пул с адресом ${targetPoolAddress} для программы "${program.description}" (cpmm)!`);
          const poolAccountInfo = await connection.getAccountInfo(poolAddress);
          if (poolAccountInfo) {
            console.log("Pool account data (raw, в hex):", poolAccountInfo.data.toString("hex"));
          }
          found = true;
          break;
        }
      }
      if (found) break;
    } catch (error) {
      console.error(`Ошибка при обработке программы ${program.description}:`, error);
    }
  }

  if (!found) {
    console.log("Целевой пул не найден среди вариантов CPMM.");
  }

  console.log("Target Pool Address:", targetPoolAddress);
  console.log("Token A:", token0.toString());
  console.log("Token B:", token1.toString());
  console.log("AMM Config:", "G95xxie3XbkCqtE39GgQ9Ggc7xBC8Uceve7HFDEFApkc");
}

main().catch((err) => {
  console.error("Ошибка:", err);
}); 