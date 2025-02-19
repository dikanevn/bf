import { Connection, clusterApiUrl, PublicKey } from "@solana/web3.js";

// Если других переменных окружения не требуется, можно удалить dotenv

async function main() {
  // Подключаемся к Mainnet Beta
  const connection = new Connection(clusterApiUrl("mainnet-beta"), "confirmed");

  // Указываем адрес токена напрямую (замените на интересующий вас адрес)
  const tokenAddress = new PublicKey("9aGQqWqHSeyVtQXNkPuTUZ3aW288fjeRLQcMmjniivEf");

  // Адрес WSOL (обёрнутый SOL) на Solana
  const WSOL_ADDRESS = new PublicKey("So11111111111111111111111111111111111111112");

  function comparePublicKeys(a: PublicKey, b: PublicKey): number {
    return a.toBuffer().compare(b.toBuffer());
  }

  // Получаем адреса токенов
  const token0 = new PublicKey("So11111111111111111111111111111111111111112"); // WSOL
  const token1 = new PublicKey("9aGQqWqHSeyVtQXNkPuTUZ3aW288fjeRLQcMmjniivEf"); // COPIUM

  // Сортируем токены
  const [tokenA, tokenB] = [token0, token1].sort(comparePublicKeys);

  // Создаем массив всех возможных вариантов сидов
  const allPossibleSeeds = [
    // Варианты с префиксом "initialize"
    [
        new PublicKey("CPMMoo8L3F4NbTegBCKVNunggL7H1ZpdTHKxQB5qKP1C").toBuffer(),
        tokenA.toBuffer(),
        tokenB.toBuffer(),
        new PublicKey("G95xxie3XbkCqtE39GgQ9Ggc7xBC8Uceve7HFDEFApkc").toBuffer(),
    ],
    [
      new PublicKey("CPMMoo8L3F4NbTegBCKVNunggL7H1ZpdTHKxQB5qKP1C").toBuffer(),
      tokenB.toBuffer(),
      tokenA.toBuffer(),
      new PublicKey("G95xxie3XbkCqtE39GgQ9Ggc7xBC8Uceve7HFDEFApkc").toBuffer(),
    ],
    // Варианты с префиксом "cpmm"
    [
      Buffer.from("cpmm"),
      tokenA.toBuffer(),
      tokenB.toBuffer(),
      new PublicKey("G95xxie3XbkCqtE39GgQ9Ggc7xBC8Uceve7HFDEFApkc").toBuffer(),
    ],
    [
      Buffer.from("cpmm"),
      tokenB.toBuffer(),
      tokenA.toBuffer(),
      new PublicKey("G95xxie3XbkCqtE39GgQ9Ggc7xBC8Uceve7HFDEFApkc").toBuffer(),
    ],
    // Варианты с префиксом "amm"
    [
      Buffer.from("amm"),
      tokenA.toBuffer(),
      tokenB.toBuffer(),
      new PublicKey("G95xxie3XbkCqtE39GgQ9Ggc7xBC8Uceve7HFDEFApkc").toBuffer(),
    ],
    [
      Buffer.from("amm"),
      tokenB.toBuffer(),
      tokenA.toBuffer(),
      new PublicKey("G95xxie3XbkCqtE39GgQ9Ggc7xBC8Uceve7HFDEFApkc").toBuffer(),
    ],
    // Варианты с префиксом "pool"
    [
      Buffer.from("pool"),
      tokenA.toBuffer(),
      tokenB.toBuffer(),
      new PublicKey("G95xxie3XbkCqtE39GgQ9Ggc7xBC8Uceve7HFDEFApkc").toBuffer(),
    ],
    [
      Buffer.from("pool"),
      tokenB.toBuffer(),
      tokenA.toBuffer(),
      new PublicKey("G95xxie3XbkCqtE39GgQ9Ggc7xBC8Uceve7HFDEFApkc").toBuffer(),
    ],
    // Добавленные варианты с префиксом "amm_pool"
    [
      Buffer.from("amm_pool"),
      tokenA.toBuffer(),
      tokenB.toBuffer(),
      new PublicKey("G95xxie3XbkCqtE39GgQ9Ggc7xBC8Uceve7HFDEFApkc").toBuffer(),
    ],
    [
      Buffer.from("amm_pool"),
      tokenB.toBuffer(),
      tokenA.toBuffer(),
      new PublicKey("G95xxie3XbkCqtE39GgQ9Ggc7xBC8Uceve7HFDEFApkc").toBuffer(),
    ],
    // Варианты без AMM Config (с префиксом "pool" или "amm")
    [
      Buffer.from("pool"),
      tokenA.toBuffer(),
      tokenB.toBuffer(),
    ],
    [
      Buffer.from("pool"),
      tokenB.toBuffer(),
      tokenA.toBuffer(),
    ],
    [
      Buffer.from("amm"),
      tokenA.toBuffer(),
      tokenB.toBuffer(),
    ],
    [
      Buffer.from("amm"),
      tokenB.toBuffer(),
      tokenA.toBuffer(),
    ],
    // Новые варианты - только три ключа (используем только конфиг)
    // Варианты с конфигом в начале: [config, tokenA, tokenB] и [config, tokenB, tokenA]
    [
      new PublicKey("G95xxie3XbkCqtE39GgQ9Ggc7xBC8Uceve7HFDEFApkc").toBuffer(), // config
      tokenA.toBuffer(),
      tokenB.toBuffer(),
    ],
    [
      new PublicKey("G95xxie3XbkCqtE39GgQ9Ggc7xBC8Uceve7HFDEFApkc").toBuffer(), // config
      tokenB.toBuffer(),
      tokenA.toBuffer(),
    ],
    // Варианты с конфигом в конце: [tokenA, tokenB, config] и [tokenB, tokenA, config]
    [
      tokenA.toBuffer(),
      tokenB.toBuffer(),
      new PublicKey("G95xxie3XbkCqtE39GgQ9Ggc7xBC8Uceve7HFDEFApkc").toBuffer(), // config
    ],
    [
      tokenB.toBuffer(),
      tokenA.toBuffer(),
      new PublicKey("G95xxie3XbkCqtE39GgQ9Ggc7xBC8Uceve7HFDEFApkc").toBuffer(), // config
    ],
  ];

  // Целевой адрес пула, который надо найти
  const targetPoolAddress = "EPSRjzgevLHLm1xp5PNa816LYhmn2VUb9FTpXNsbvFHP";

  // Массив всех потенциальных Raydium Program ID с описаниями
  const raydiumPrograms = [
    { description: "Standard AMM (CP-Swap, New)", address: "CPMMoo8L3F4NbTegBCKVNunggL7H1ZpdTHKxQB5qKP1C" },
    { description: "Legacy AMM v4 (OpenBook)", address: "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8" },
    { description: "Stable Swap AMM", address: "5quBtoiQqxF9Jv6KYKctB59NT3gtJD2Y65kdnB1Uev3h" },
    { description: "Concentrated Liquidity (CLMM)", address: "CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK" },
    { description: "Burn & Earn (LP Locker)", address: "LockrWmn6K5twhz3y9w1dQERbmgSaRkfnTeTKbpofwE" },
    { description: "AMM Routing", address: "routeUGWgWzqBWFcrCfv8tritsqukccJPu3q5GPP3xS" },
    { description: "Staking", address: "EhhTKczWMGQt46ynNeRX1WfeagwwJd7ufHvCDjRxjo5Q" },
    { description: "Farm Staking", address: "9KEPoZmtHUrBbhWN1v1KWLMkkvwY6WLtAVUCPRtRjP4z" },
    { description: "Ecosystem Farms", address: "FarmqiPv5eAj3j1GMdMCMUGXqPUvmquZtMy86QH6rzhG" },
    { description: "AcceleRaytor", address: "9HzJyW1qZsEiSfMUf6L2jo3CcTKAyBmSyKdwQeYisHrC" },
  ];

  let found = false;
  for (const program of raydiumPrograms) {
    try {
      const programId = new PublicKey(program.address);
      // Перебираем все варианты сидов
      for (let i = 0; i < allPossibleSeeds.length; i++) {
        const [poolAddress, bump] = PublicKey.findProgramAddressSync(allPossibleSeeds[i], programId);
        console.log(`Вариант ${i + 1} (${allPossibleSeeds[i][0].toString()}): ${poolAddress.toString()} (bump: ${bump})`);
        
        if (poolAddress.toString() === targetPoolAddress) {
          console.log(`>>> Найден пул с адресом ${targetPoolAddress} для программы "${program.description}"!`);
          console.log(`>>> Использованные сиды: префикс="${allPossibleSeeds[i][0]}", порядок токенов: ${i % 2 === 0 ? "прямой" : "обратный"}`);
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
    console.log("Целевой пул не найден среди указанных Program ID.");
  }

  // Также добавим логирование для отладки
  console.log("Target Pool Address:", targetPoolAddress);
  console.log("Token A:", tokenA.toString());
  console.log("Token B:", tokenB.toString());
  console.log("AMM Config:", "G95xxie3XbkCqtE39GgQ9Ggc7xBC8Uceve7HFDEFApkc");
}

main().catch((err) => {
  console.error("Ошибка:", err);
}); 