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
use mpl_token_metadata::{
    instructions,
    types::DataV2,
};

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
        Some(2) => set_mint_authority(program_id, accounts),
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
    let metadata_program = next_account_info(account_info_iter)?;
    let metadata_account = next_account_info(account_info_iter)?;

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

    // Создаем метадату
    let data = DataV2 {
        name: "NFT".to_string(),
        symbol: "NFT".to_string(),
        uri: "".to_string(),
        seller_fee_basis_points: 0,
        creators: None,
        collection: None,
        uses: None,
    };

    invoke(
        &instructions::CreateMetadataAccountV3 {
            metadata: *metadata_account.key,
            mint: *mint_account.key,
            mint_authority: *mint_authority.key,
            payer: *payer.key,
            update_authority: (*mint_authority.key, true),
            system_program: *system_program.key,
            rent: None,
        }.instruction(instructions::CreateMetadataAccountV3InstructionArgs {
            data,
            is_mutable: true,
            collection_details: None,
        }),
        &[
            metadata_account.clone(),
            mint_account.clone(),
            mint_authority.clone(),
            payer.clone(),
            metadata_program.clone(),
            rent_sysvar.clone(),
        ],
    )?;

    msg!("Metadata created successfully!");
    Ok(())
}

// Добавляем новую функцию для установки mint authority
fn set_mint_authority(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
) -> ProgramResult {
    let account_info_iter = &mut accounts.iter();
    
    // Получаем необходимые аккаунты
    let mint_account = next_account_info(account_info_iter)?;
    let current_authority = next_account_info(account_info_iter)?;
    let program_authority = next_account_info(account_info_iter)?;

    // Проверяем, что текущий authority подписал транзакцию
    if !current_authority.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }

    // Проверяем, что program_authority это правильный PDA
    let (expected_authority, _bump) = Pubkey::find_program_address(
        &[b"mint_authority"],
        program_id
    );
    if program_authority.key != &expected_authority {
        return Err(ProgramError::InvalidArgument);
    }

    // Создаем инструкцию для установки нового mint authority
    let set_authority_ix = spl_token::instruction::set_authority(
        &spl_token::id(),
        mint_account.key,
        Some(&expected_authority),
        spl_token::instruction::AuthorityType::MintTokens,
        current_authority.key,
        &[],
    )?;

    // Выполняем инструкцию
    invoke(
        &set_authority_ix,
        &[
            mint_account.clone(),
            current_authority.clone(),
            program_authority.clone(),
        ],
    )?;

    msg!("Mint authority successfully transferred to program");
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
