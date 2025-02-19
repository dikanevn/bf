import { Connection, PublicKey, clusterApiUrl } from "@solana/web3.js";

// Функция для получения информации о mint с учётом выбранной сети
async function getMintInfo(mintAddress: string, network: 'mainnet-beta' | 'devnet') {
    const connection = new Connection(clusterApiUrl(network), "confirmed");
    const mintPubKey = new PublicKey(mintAddress);

    const accountInfo = await connection.getParsedAccountInfo(mintPubKey);
    console.log("Mint Address:", mintAddress);
    if (accountInfo.value) {
      console.log("Mint Account Data:", accountInfo.value.data);
    } else {
      console.error("Не удалось получить информацию об аккаунте");
    }
}

function main() {
    // Проверка: требуется два параметра: сеть и адрес mint
    if (process.argv.length < 4) {
        console.error("Использование: ts-node n11s.ts <network [m|d]> <mint_address>");
        process.exit(1);
    }

    // Определяем сеть по первому параметру (m или d)
    const networkParam = process.argv[2].toLowerCase();
    // Объявляем network с более строгим типом
    let network: "mainnet-beta" | "devnet";
    if (networkParam === "m") {
        network = "mainnet-beta";
    } else if (networkParam === "d") {
        network = "devnet";
    } else {
        console.error("Неверный параметр сети. Используйте 'm' для mainnet и 'd' для devnet.");
        process.exit(1);
    }

    // Читаем адрес mint из параметров
    const mintAddress = process.argv[3];
    getMintInfo(mintAddress, network);
}

main();
