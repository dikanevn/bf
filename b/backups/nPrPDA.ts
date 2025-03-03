import { PublicKey } from "@solana/web3.js";

async function main() {
  // Идентификатор вашей программы
  const programId = new PublicKey("2BESDrxqXxBWYwhiuzC4SgsoCmqoMiiEGwZ1en6gT4Se");

  // Seed для вычисления PDA
  const seed = Buffer.from("mint_authority");

  // Вычисляем PDA и bump (смещение)
  const [pda, bump] = await PublicKey.findProgramAddress([seed], programId);

  console.log("Computed PDA:", pda.toBase58());
  console.log("Bump:", bump);
}

main().catch(err => {
  console.error(err);
}); 