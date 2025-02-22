import { PublicKey } from "@solana/web3.js";

/**
 * Вычисляет PDA пула (amm pool) для пары токенов без сортировки.
 * 
 * @param tokenA - адрес первого токена
 * @param tokenB - адрес второго токена
 * @returns Объект с адресом пула и bump-параметром.
 */
export function findAmmPoolAddress(
  tokenA: PublicKey,
  tokenB: PublicKey
): { ammPoolAddress: PublicKey; bump: number } {
  // Целевой адрес пула, который должен быть найден.
  const targetPoolAddress = "EPSRjzgevLHLm1xp5PNa816LYhmn2VUb9FTpXNsbvFHP";
  // Адрес программы AMM (тот же, что используется в инструкции)
  const ammProgramId = new PublicKey("HWy1jotHpo6UqeQxx49dpYYdQB8wj9Qk9MdxwjLvDHB8");
  // Адрес конфигурации AMM – используется как seed
  const ammConfig = new PublicKey("G95xxie3XbkCqtE39GgQ9Ggc7xBC8Uceve7HFDEFApkc");

  // Вариант AB: использование токена A, затем токена B
  const seedsAB = [
    Buffer.from("amm_pool"),       // константная строка
    tokenA.toBuffer(),             // адрес токена A
    tokenB.toBuffer(),             // адрес токена B
    ammConfig.toBuffer(),          // адрес конфигурации AMM
  ];

  const [ammPoolAddressAB, bumpAB] = PublicKey.findProgramAddressSync(
    seedsAB,
    ammProgramId
  );

  // Если вариант AB соответствует целевому адресу, возвращаем результат.
  if (ammPoolAddressAB.toBase58() === targetPoolAddress) {
    return { ammPoolAddress: ammPoolAddressAB, bump: bumpAB };
  }

  // Вариант BA: использование токена B, затем токена A
  const seedsBA = [
    Buffer.from("amm_pool"),
    tokenB.toBuffer(),
    tokenA.toBuffer(),
    ammConfig.toBuffer(),
  ];

  const [ammPoolAddressBA, bumpBA] = PublicKey.findProgramAddressSync(
    seedsBA,
    ammProgramId
  );

  if (ammPoolAddressBA.toBase58() === targetPoolAddress) {
    return { ammPoolAddress: ammPoolAddressBA, bump: bumpBA };
  }

  // Если ни один вариант не соответствует целевой паре, выбрасываем ошибку.
  throw new Error(
    `Ни один из вариантов не соответствует целевой паре с адресом ${targetPoolAddress}`
  );
}

// Пример использования функции:
function main() {
  // Пример адресов токенов:
  const tokenA = new PublicKey("So11111111111111111111111111111111111111112");
  const tokenB = new PublicKey("9aGQqWqHSeyVtQXNkPuTUZ3aW288fjeRLQcMmjniivEf");

  const { ammPoolAddress, bump } = findAmmPoolAddress(tokenA, tokenB);
  console.log("Amm Pool Address:", ammPoolAddress.toBase58());
  console.log("Bump:", bump);
}

main();