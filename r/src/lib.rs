use solana_program::{
    account_info::AccountInfo,
    entrypoint,
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
    instruction as token_instruction,
    state::{Mint, Account},
};
use solana_program::program_pack::Pack;

// Объявляем точку входа для программы
entrypoint!(process_instruction);

// Основная функция обработки инструкций
pub fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction_data: &[u8],
) -> ProgramResult {
    // Проверяем индекс инструкции
    match instruction_data.get(0) {
        Some(0) => {
            msg!("Program is initialized!");
            Ok(())
        }
        Some(1) => create_and_mint_token(program_id, accounts),
        _ => {
            msg!("Invalid instruction");
            Ok(())
        }
    }
}

fn create_and_mint_token(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
) -> ProgramResult {
    let account_info_iter = &mut accounts.iter();
    
    // Получаем необходимые аккаунты
    let mint_account = next_account_info(account_info_iter)?;
    let mint_authority = next_account_info(account_info_iter)?;
    let payer = next_account_info(account_info_iter)?;
    let system_program = next_account_info(account_info_iter)?;
    let token_program = next_account_info(account_info_iter)?;
    let rent_sysvar = next_account_info(account_info_iter)?;
    let token_account = next_account_info(account_info_iter)?;

    // Создаем минт с 0 decimals
    let init_mint_ix = token_instruction::initialize_mint(
        &spl_token::id(),
        &mint_account.key,
        &mint_authority.key,
        None,
        0, 
    )?;

    // Создаем минт аккаунт
    let rent = Rent::get()?;
    let mint_len = Mint::LEN;
    let lamports = rent.minimum_balance(mint_len);

    invoke(
        &system_instruction::create_account(
            &payer.key,
            &mint_account.key,
            lamports,
            mint_len as u64,
            &spl_token::id(),
        ),
        &[
            payer.clone(),
            mint_account.clone(),
            system_program.clone(),
        ],
    )?;

    // Инициализируем минт
    invoke(
        &init_mint_ix,
        &[
            mint_account.clone(),
            rent_sysvar.clone(),
            token_program.clone(),
        ],
    )?;

    // Создаем токен аккаунт для PDA
    let token_account_len = Account::LEN;
    let token_account_lamports = rent.minimum_balance(token_account_len);

    invoke(
        &system_instruction::create_account(
            &payer.key,
            &token_account.key,
            token_account_lamports,
            token_account_len as u64,
            &spl_token::id(),
        ),
        &[
            payer.clone(),
            token_account.clone(),
            system_program.clone(),
        ],
    )?;

    // Инициализируем токен аккаунт
    invoke(
        &token_instruction::initialize_account(
            &spl_token::id(),
            &token_account.key,
            &mint_account.key,
            &mint_authority.key,
        )?,
        &[
            token_account.clone(),
            mint_account.clone(),
            mint_authority.clone(),
            rent_sysvar.clone(),
            token_program.clone(),
        ],
    )?;

    
    invoke(
        &token_instruction::mint_to(
            &spl_token::id(),
            &mint_account.key,
            &token_account.key,
            &mint_authority.key,
            &[],
            1,
        )?,
        &[
            mint_account.clone(),
            token_account.clone(),
            mint_authority.clone(),
            token_program.clone(),
        ],
    )?;

    msg!("Token mint and account created successfully! Minted 1 token");
    Ok(())
}

// Вспомогательная функция для получения следующего аккаунта
fn next_account_info<'a, 'b>(
    iter: &mut std::slice::Iter<'a, AccountInfo<'b>>,
) -> Result<&'a AccountInfo<'b>, ProgramError> {
    iter.next().ok_or(ProgramError::NotEnoughAccountKeys)
}

#[cfg(test)]
mod test {
    use super::*;

    #[test]
    fn test_initialize() {
        // Базовый тест
        let program_id = Pubkey::default();
        let accounts = [];
        let instruction_data = [];
        
        let result = process_instruction(&program_id, &accounts, &instruction_data);
        assert_eq!(result, Ok(()));
    }
}
