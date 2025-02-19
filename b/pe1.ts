import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { findMasterEditionPda, fetchMasterEdition } from '@metaplex-foundation/mpl-token-metadata';
import { publicKey } from '@metaplex-foundation/umi';
import * as dotenv from 'dotenv';

dotenv.config();

async function main() {
  if (process.argv.length < 3) {
    console.error("Пожалуйста, укажите адрес mint как аргумент.");
    process.exit(1);
  }

  const mintAddress = process.argv[2];
  
  // Создаем UMI instance на devnet
  const umi = await createUmi("https://api.devnet.solana.com");
  
  // Преобразуем mint адрес в PublicKey
  const mintPk = publicKey(mintAddress);
  
  // Вычисляем PDA для master edition
  let masterEditionPda;
  try {
    masterEditionPda = findMasterEditionPda(umi, { mint: mintPk });
  } catch (error) {
    console.error("Не удалось вычислить Master Edition PDA:", error);
    process.exit(1);
  }

  // Пытаемся получить данные мастер-издания
  let masterEditionAccount;
  try {
    masterEditionAccount = await fetchMasterEdition(umi, masterEditionPda);
  } catch (error) {
    console.error("Не удалось получить данные Master Edition аккаунта:", error);
    process.exit(1);
  }
  
  console.log("Информация о Master Edition аккаунте:");
  console.log("Master Edition PDA:", masterEditionPda.toString());
  console.dir(masterEditionAccount, { depth: null, colors: true });
}

main()
  .then(() => { console.log("Готово."); })
  .catch((error) => {
    console.error("Ошибка:", error);
    process.exit(1);
  }); 