import { Connection, PublicKey, clusterApiUrl } from "@solana/web3.js";

async function getTokenAccountInfo(tokenAccountAddress: string) {
  // Подключение к Devnet через web3.js
  const connection = new Connection(clusterApiUrl("devnet"), "confirmed");
  const accountPubKey = new PublicKey(tokenAccountAddress);

  const accountInfo = await connection.getParsedAccountInfo(accountPubKey);
  if (!accountInfo.value) {
    console.log("Аккаунт не найден. Проверьте адрес.");
    return;
  }

  // Структура parsed должна выглядеть примерно так:
  // {
  //   parsed: {
  //     info: {
  //       mint: string,
  //       owner: string,
  //       tokenAmount: { amount: string, decimals: number, uiAmount: number, uiAmountString: string },
  //       delegate?: string,
  //       state: string,
  //       isNative?: string | null,
  //       delegatedAmount: string,
  //       closeAuthority?: string
  //     }
  //   },
  //   type: "account"
  // }
  const parsed = (accountInfo.value.data as any).parsed;
  if (!parsed || !parsed.info) {
    console.log("Невозможно разобрать данные аккаунта.");
    return;
  }

  const info = parsed.info;

  console.log("Подробная информация об токен-аккаунте:");
  console.log(tokenAccountAddress);
  console.log("Mint:", info.mint);
  console.log("Owner:", info.owner);
  console.log("Amount:", info.tokenAmount.amount);
  console.log("Delegate:", info.delegate ? info.delegate : "нет");
  console.log("State:", info.state);
  console.log("Is Native:", info.isNative !== null ? info.isNative : "нет");
  console.log("Delegated Amount:", info.delegatedAmount ? info.delegatedAmount : "0");
  console.log("Close Authority:", info.closeAuthority ? info.closeAuthority : "нет");
  console.log("------------------------------");
}

// Подставьте адрес нужного Associated Token Account
const tokenAccountAddress = "5sLQKwtt5smUxYyefXHU13nS8F176sfybbnEWEGLzo9C";
getTokenAccountInfo(tokenAccountAddress); 