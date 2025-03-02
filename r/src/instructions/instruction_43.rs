// Инструкция 43: Универсальное обновление метаданных NFT

use solana_program::{
    account_info::{next_account_info, AccountInfo},
    entrypoint::ProgramResult,
    program::invoke_signed,
    program_error::ProgramError,
    pubkey::Pubkey,
    msg,
};
use mpl_token_metadata::{
    instructions::{UpdateV1, UpdateV1InstructionArgs},
    types::{Creator, Data, CollectionToggle, RuleSetToggle, CollectionDetailsToggle, UsesToggle},
};

pub fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction_data: &[u8],
) -> ProgramResult {
    msg!("Starting universal_update_nft_metadata (instruction 43)...");
    
    // Парсим данные инструкции
    if instruction_data.len() < 32 {
        msg!("Error: Instruction data must contain at least the mint address (32 bytes)");
        return Err(ProgramError::InvalidInstructionData);
    }
    
    // Первые 32 байта - адрес минта
    let mint_address = Pubkey::new_from_array(
        instruction_data[0..32].try_into().map_err(|_| {
            msg!("Error: Failed to parse mint address from instruction data");
            ProgramError::InvalidInstructionData
        })?
    );
    
    msg!("Target mint address: {}", mint_address);
    
    // Проверяем, есть ли данные о creator
    let has_creator = instruction_data.len() > 32 && instruction_data[32] == 1;
    let creator_address = if has_creator && instruction_data.len() >= 65 {
        Some(Pubkey::new_from_array(
            instruction_data[33..65].try_into().map_err(|_| {
                msg!("Error: Failed to parse creator address from instruction data");
                ProgramError::InvalidInstructionData
            })?
        ))
    } else {
        None
    };
    
    if let Some(creator) = &creator_address {
        msg!("Creator address to set: {}", creator);
    }
    
    // Проверяем, есть ли данные о name, symbol, uri и sellerFeeBasisPoints
    let has_metadata = instruction_data.len() > 65 && instruction_data[65] == 1;
    
    // Получаем name, symbol, uri и sellerFeeBasisPoints из instruction_data
    let name = if has_metadata && instruction_data.len() > 66 {
        let name_len = instruction_data[66] as usize;
        if instruction_data.len() >= 67 + name_len {
            let name_bytes = &instruction_data[67..67 + name_len];
            match std::str::from_utf8(name_bytes) {
                Ok(name_str) => {
                    msg!("Name to set: {}", name_str);
                    Some(name_str.to_string())
                },
                Err(_) => {
                    msg!("Error: Failed to parse name from instruction data");
                    None
                }
            }
        } else {
            None
        }
    } else {
        None
    };
    
    // Получаем symbol
    let symbol_offset = if let Some(name_str) = &name {
        67 + name_str.len()
    } else {
        67
    };
    
    let symbol = if has_metadata && instruction_data.len() > symbol_offset {
        let symbol_len = instruction_data[symbol_offset] as usize;
        if instruction_data.len() >= symbol_offset + 1 + symbol_len {
            let symbol_bytes = &instruction_data[symbol_offset + 1..symbol_offset + 1 + symbol_len];
            match std::str::from_utf8(symbol_bytes) {
                Ok(symbol_str) => {
                    msg!("Symbol to set: {}", symbol_str);
                    Some(symbol_str.to_string())
                },
                Err(_) => {
                    msg!("Error: Failed to parse symbol from instruction data");
                    None
                }
            }
        } else {
            None
        }
    } else {
        None
    };
    
    // Получаем uri
    let uri_offset = if let Some(symbol_str) = &symbol {
        symbol_offset + 1 + symbol_str.len()
    } else {
        symbol_offset
    };
    
    let uri = if has_metadata && instruction_data.len() > uri_offset {
        let uri_len = instruction_data[uri_offset] as usize;
        if instruction_data.len() >= uri_offset + 1 + uri_len {
            let uri_bytes = &instruction_data[uri_offset + 1..uri_offset + 1 + uri_len];
            match std::str::from_utf8(uri_bytes) {
                Ok(uri_str) => {
                    msg!("URI to set: {}", uri_str);
                    Some(uri_str.to_string())
                },
                Err(_) => {
                    msg!("Error: Failed to parse uri from instruction data");
                    None
                }
            }
        } else {
            None
        }
    } else {
        None
    };
    
    // Получаем sellerFeeBasisPoints
    let fee_offset = if let Some(uri_str) = &uri {
        uri_offset + 1 + uri_str.len()
    } else {
        uri_offset
    };
    
    let seller_fee_basis_points = if has_metadata && instruction_data.len() >= fee_offset + 2 {
        let fee = ((instruction_data[fee_offset] as u16) << 8) | (instruction_data[fee_offset + 1] as u16);
        msg!("Seller fee basis points to set: {}", fee);
        Some(fee)
    } else {
        None
    };
    
    let accounts_iter = &mut accounts.iter();
    
    // Получаем все необходимые аккаунты
    let metadata_account = next_account_info(accounts_iter)?;
    let mint_account = next_account_info(accounts_iter)?;
    let program_authority = next_account_info(accounts_iter)?;
    let payer = next_account_info(accounts_iter)?;
    let system_program = next_account_info(accounts_iter)?;
    let sysvar_instructions = next_account_info(accounts_iter)?;
    let token_metadata_program = next_account_info(accounts_iter)?;
    
    // Проверяем подписи
    if !payer.is_signer {
        msg!("Payer must be a signer");
        return Err(ProgramError::MissingRequiredSignature);
    }

    // Проверяем, что mint_account соответствует переданному в инструкции
    if mint_account.key != &mint_address {
        msg!("Invalid mint address provided");
        msg!("Expected: {}", mint_address);
        msg!("Received: {}", mint_account.key);
        return Err(ProgramError::InvalidArgument);
    }

    // Проверяем, что program_authority это правильный PDA
    let (expected_authority, bump_seed) = Pubkey::find_program_address(
        &[b"mint_authority"],
        program_id
    );
    if program_authority.key != &expected_authority {
        msg!("Invalid program authority provided");
        return Err(ProgramError::InvalidArgument);
    }

    // Создаем authority seeds для подписи
    let authority_signature_seeds = &[
        b"mint_authority".as_ref(),
        &[bump_seed],
    ];
    let signers = &[&authority_signature_seeds[..]];

    // Создаем структуру для обновления метаданных
    let update_v1 = UpdateV1 {
        authority: *program_authority.key,
        mint: *mint_account.key,
        metadata: *metadata_account.key,
        payer: *payer.key,
        system_program: *system_program.key,
        sysvar_instructions: *sysvar_instructions.key,
        authorization_rules_program: None,
        authorization_rules: None,
        token: None,
        delegate_record: None,
        edition: None,
    };

    // Создаем аргументы для обновления
    let mut update_args = UpdateV1InstructionArgs {
        data: None,
        is_mutable: Some(true),
        primary_sale_happened: None,
        new_update_authority: None,
        collection_details: CollectionDetailsToggle::None,
        uses: UsesToggle::None,
        collection: CollectionToggle::None,
        rule_set: RuleSetToggle::None,
        authorization_data: None,
    };

    // Создаем данные для обновления
    let mut creators_vec = Vec::new();
    if let Some(creator_pubkey) = creator_address {
        let creator = Creator {
            address: creator_pubkey,
            verified: false,
            share: 100,
        };
        creators_vec.push(creator);
    }

    let data = Data {
        name: name.unwrap_or_else(|| "".to_string()),
        symbol: symbol.unwrap_or_else(|| "".to_string()),
        uri: uri.unwrap_or_else(|| "".to_string()),
        seller_fee_basis_points: seller_fee_basis_points.unwrap_or(0),
        creators: if creators_vec.is_empty() { None } else { Some(creators_vec) },
    };

    update_args.data = Some(data);

    msg!("Invoking UpdateV1 instruction...");
    invoke_signed(
        &update_v1.instruction(update_args),
        &[
            metadata_account.clone(),
            mint_account.clone(),
            program_authority.clone(),
            payer.clone(),
            system_program.clone(),
            sysvar_instructions.clone(),
        ],
        signers,
    )?;

    msg!("NFT metadata updated successfully!");
    Ok(())
} 