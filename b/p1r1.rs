use solana_client::rpc_client::RpcClient;
use solana_sdk::{
    pubkey::Pubkey,
    signature::{Keypair, Signer},
    transaction::Transaction,
};
use spl_associated_token_account::get_associated_token_address;
use spl_token::instruction::transfer_checked;
use std::{env, error::Error, str::FromStr};

fn main() -> Result<(), Box<dyn Error>> {
    // Проверяем наличие необходимых аргументов: <MINT_ADDRESS> <RECIPIENT_PUBLIC_KEY>
    let args: Vec<String> = env::args().collect();
    if args.len() < 3 {
        eprintln!("Использование: cargo run -- <MINT_ADDRESS> <RECIPIENT_PUBLIC_KEY>");
        std::process::exit(1);
    }
    let mint_address = &args[1];
    let recipient_address = &args[2];

    // Получаем секретный ключ отправителя из переменной окружения PAYER_SECRET_KEY (ожидается JSON-массив чисел)
    let secret_key_str = env::var("PAYER_SECRET_KEY")
        .expect("PAYER_SECRET_KEY не установлен");
    let secret_key_vec: Vec<u8> = serde_json::from_str(&secret_key_str)
        .expect("Не удалось распарсить PAYER_SECRET_KEY");
    let payer = Keypair::from_bytes(&secret_key_vec)
        .expect("Не удалось создать keypair из секретного ключа");

    // Преобразуем входные строки в Pubkey
    let mint_pubkey = Pubkey::from_str(mint_address)
        .expect("Неверный формат mint-адреса");
    let recipient_pubkey = Pubkey::from_str(recipient_address)
        .expect("Неверный формат адреса получателя");

    // Создаем RPC-клиент для подключения к devnet (можно заменить URL на нужный, например, с QuickNode)
    let rpc_url = "https://api.devnet.solana.com";
    let client = RpcClient::new(rpc_url.to_string());

    // Вычисляем адреса ассоциированных токен-аккаунтов
    let sender_ata = get_associated_token_address(&payer.pubkey(), &mint_pubkey);
    let recipient_ata = get_associated_token_address(&recipient_pubkey, &mint_pubkey);

    // Формируем инструкцию перевода.
    // Для NFT обычно количество = 1, число десятичных знаков = 0.
    let amount: u64 = 1;
    let decimals: u8 = 0;
    let transfer_ix = transfer_checked(
        &spl_token::id(),
        &sender_ata,
        &mint_pubkey,
        &recipient_ata,
        &payer.pubkey(),
        &[],
        amount,
        decimals,
    )?;

    // Получаем актуальный блокхэш
    let recent_blockhash = client.get_latest_blockhash()?;

    // Формируем и подписываем транзакцию
    let tx = Transaction::new_signed_with_payer(
        &[transfer_ix],
        Some(&payer.pubkey()),
        &[&payer],
        recent_blockhash,
    );

    // Отправляем и подтверждаем транзакцию
    let signature = client.send_and_confirm_transaction(&tx)?;
    println!("Транзакция перевода NFT отправлена, signature: {}", signature);

    Ok(())
} 