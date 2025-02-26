use solana_program::{
    account_info::AccountInfo,
    entrypoint,
    entrypoint::ProgramResult,
    program::invoke,
    program::invoke_signed,
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
use spl_associated_token_account::instruction;

// Объявляем точку входа для программы
entrypoint!(process_instruction);

// Основная функция обработки инструкций
pub fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction_data: &[u8],
) -> ProgramResult {
    match instruction_data.get(0) {
        Some(0) => {
            msg!("Program is initialized!");
            Ok(())
        }
        Some(4) => create_metadata(program_id, accounts),
        Some(5) => set_mint_authority(program_id, accounts),
        Some(6) => create_program_mint(program_id, accounts),
        Some(7) => create_associated_token_account(program_id, accounts),
        Some(8) => mint_token_by_program(program_id, accounts),
        _ => {
            msg!("Invalid instruction");
            Err(ProgramError::InvalidInstructionData)
        }
    }
}

fn create_metadata(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
) -> ProgramResult {
    let account_info_iter = &mut accounts.iter();
    
    // Получаем необходимые аккаунты
    let metadata_account = next_account_info(account_info_iter)?;
    let mint_account = next_account_info(account_info_iter)?;
    let mint_authority = next_account_info(account_info_iter)?;
    let payer = next_account_info(account_info_iter)?;
    let metadata_program = next_account_info(account_info_iter)?;
    let rent_sysvar = next_account_info(account_info_iter)?;
    let system_program = next_account_info(account_info_iter)?;

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
            system_program.clone(),
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

// Добавляем новую функцию
fn create_program_mint(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
) -> ProgramResult {
    let account_info_iter = &mut accounts.iter();
    
    let mint_account = next_account_info(account_info_iter)?;
    let payer = next_account_info(account_info_iter)?;
    let system_program = next_account_info(account_info_iter)?;
    let token_program = next_account_info(account_info_iter)?;
    let rent_sysvar = next_account_info(account_info_iter)?;

    // Получаем PDA программы, который будет mint authority
    let (program_authority, _bump) = Pubkey::find_program_address(
        &[b"mint_authority"],
        program_id
    );

    // Создаем минт с 0 decimals
    let init_mint_ix = token_instruction::initialize_mint(
        &spl_token::id(),
        &mint_account.key,
        &program_authority,
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

    msg!("Program mint account created successfully!");
    Ok(())
}

fn create_associated_token_account(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
) -> ProgramResult {
    let account_info_iter = &mut accounts.iter();
    
    let payer = next_account_info(account_info_iter)?;
    let associated_token_account = next_account_info(account_info_iter)?;
    let owner = next_account_info(account_info_iter)?;
    let mint = next_account_info(account_info_iter)?;
    let system_program = next_account_info(account_info_iter)?;
    let token_program = next_account_info(account_info_iter)?;
    let associated_token_program = next_account_info(account_info_iter)?;
    let rent_sysvar = next_account_info(account_info_iter)?;

    // Создаем инструкцию для создания ассоциированного токен аккаунта
    let create_ata_ix = instruction::create_associated_token_account(
        payer.key,
        owner.key,
        mint.key,
        &spl_token::id(),
    );

    // Выполняем инструкцию
    invoke(
        &create_ata_ix,
        &[
            payer.clone(),
            associated_token_account.clone(),
            owner.clone(),
            mint.clone(),
            system_program.clone(),
            token_program.clone(),
            associated_token_program.clone(),
            rent_sysvar.clone(),
        ],
    )?;

    msg!("Associated token account created successfully!");
    Ok(())
}

fn mint_token_by_program(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
) -> ProgramResult {
    let account_info_iter = &mut accounts.iter();
    
    let mint_account = next_account_info(account_info_iter)?;
    let token_account = next_account_info(account_info_iter)?;
    let program_authority = next_account_info(account_info_iter)?;
    let token_program = next_account_info(account_info_iter)?;

    // Проверяем, что program_authority это правильный PDA
    let (expected_authority, bump_seed) = Pubkey::find_program_address(
        &[b"mint_authority"],
        program_id
    );
    if program_authority.key != &expected_authority {
        return Err(ProgramError::InvalidArgument);
    }

    // Создаем инструкцию для минтинга токена
    let mint_to_ix = spl_token::instruction::mint_to(
        &spl_token::id(),
        mint_account.key,
        token_account.key,
        &expected_authority,
        &[],
        1, // минтим 1 токен
    )?;

    // Создаем signer seeds для PDA
    let authority_signature_seeds = &[
        b"mint_authority".as_ref(),
        &[bump_seed],
    ];
    let signers = &[&authority_signature_seeds[..]];

    // Выполняем инструкцию с подписью от PDA
    invoke_signed(
        &mint_to_ix,
        &[
            mint_account.clone(),
            token_account.clone(),
            program_authority.clone(),
            token_program.clone(),
        ],
        signers,
    )?;

    msg!("Token minted successfully to {}", token_account.key);
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
