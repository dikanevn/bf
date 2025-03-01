import { Keypair } from "@solana/web3.js";
import * as fs from "fs";

function generateBeautifulAddress(prefix: string): Keypair {
  while (true) {
    const keypair = Keypair.generate();
    const address = keypair.publicKey.toString();
    
    // Проверяем, начинается ли адрес с нужного префикса (с учетом регистра)
    if (address.startsWith(prefix)) {
      return keypair;
    }
  }
}

async function main() {
  console.log("Начинаем поиск красивого адреса...");
  
  // Здесь можно изменить префикс, который вы хотите найти
  const desiredPrefix = "inf";
  const keypair = generateBeautifulAddress(desiredPrefix);
  
  const publicKey = keypair.publicKey.toString();
  console.log(`Найден адрес: ${publicKey}`);
  
  // Сохраняем секретный ключ в файл
  const secretKeyArray = Array.from(keypair.secretKey);
  const filename = `.env_key-${publicKey.slice(0, 8)}.json`;
  
  fs.writeFileSync(filename, JSON.stringify(secretKeyArray));
  console.log(`Секретный ключ сохранен в файл: ${filename}`);
}

main().catch(console.error); 