use solana_program::{
    account_info::{next_account_info, AccountInfo},
    entrypoint::ProgramResult,
    program::invoke,
    program_error::ProgramError,
    pubkey::Pubkey,
    msg,
    system_instruction,
    sysvar::rent::Rent,
    sysvar::Sysvar,
};
use spl_token::{
    instruction::{initialize_mint, mint_to},
    ID as TOKEN_PROGRAM_ID,
};
use spl_associated_token_account::instruction::create_associated_token_account;

pub fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    _instruction_data: &[u8],
) -> ProgramResult {
    msg!("Starting create and mint token...");
    
    let account_info_iter = &mut accounts.iter();
    
    // Получаем все необходимые аккаунты
    let mint_account = next_account_info(account_info_iter)?;
    let payer = next_account_info(account_info_iter)?;
    let system_program = next_account_info(account_info_iter)?;
    let token_program = next_account_info(account_info_iter)?;
    let rent_sysvar = next_account_info(account_info_iter)?;
    let token_account = next_account_info(account_info_iter)?;
    let associated_token_program = next_account_info(account_info_iter)?;

    // Проверяем все необходимые аккаунты
    if !mint_account.is_signer {
        msg!("Mint account must be a signer");
        return Err(ProgramError::MissingRequiredSignature);
    }
    if !payer.is_signer {
        msg!("Payer must be a signer");
        return Err(ProgramError::MissingRequiredSignature);
    }
    if *token_program.key != TOKEN_PROGRAM_ID {
        msg!("Token program does not match");
        return Err(ProgramError::IncorrectProgramId);
    }
    if *system_program.key != solana_program::system_program::id() {
        msg!("System program does not match");
        return Err(ProgramError::IncorrectProgramId);
    }
    if *associated_token_program.key != spl_associated_token_account::id() {
        msg!("Associated token program does not match");
        return Err(ProgramError::IncorrectProgramId);
    }

    // 1. Создаем минт аккаунт
    msg!("Creating mint account...");
    let rent = Rent::get()?;
    let mint_len = 82;
    let lamports = rent.minimum_balance(mint_len);

    msg!("Creating account with {} lamports", lamports);
    invoke(
        &system_instruction::create_account(
            &payer.key,
            &mint_account.key,
            lamports,
            mint_len as u64,
            &TOKEN_PROGRAM_ID,
        ),
        &[
            payer.clone(),
            mint_account.clone(),
            system_program.clone(),
        ],
    )?;

    // 2. Инициализируем минт
    msg!("Initializing mint...");
    invoke(
        &initialize_mint(
            &TOKEN_PROGRAM_ID,
            &mint_account.key,
            &payer.key,
            Some(&payer.key),
            0,
        )?,
        &[
            mint_account.clone(),
            rent_sysvar.clone(),
            token_program.clone(),
        ],
    )?;

    // 3. Создаем ассоциированный токен аккаунт
    msg!("Creating associated token account...");
    msg!("Payer: {}", payer.key);
    msg!("Token account: {}", token_account.key);
    msg!("Mint account: {}", mint_account.key);
    invoke(
        &create_associated_token_account(
            &payer.key,
            &payer.key,
            &mint_account.key,
            &TOKEN_PROGRAM_ID,
        ),
        &[
            payer.clone(),
            token_account.clone(),
            payer.clone(),
            mint_account.clone(),
            system_program.clone(),
            token_program.clone(),
            rent_sysvar.clone(),
            associated_token_program.clone(),
        ],
    )?;

    // 4. Минтим токен
    msg!("Minting token...");
    msg!("Mint account: {}", mint_account.key);
    msg!("Token account: {}", token_account.key);
    msg!("Authority: {}", payer.key);
    invoke(
        &mint_to(
            &TOKEN_PROGRAM_ID,
            &mint_account.key,
            &token_account.key,
            &payer.key,
            &[&payer.key],
            1,
        )?,
        &[
            mint_account.clone(),
            token_account.clone(),
            payer.clone(),
            token_program.clone(),
        ],
    )?;

    msg!("Token created and minted successfully!");
    Ok(())
} 