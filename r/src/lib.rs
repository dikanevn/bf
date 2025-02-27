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
    hash::hash,
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

// Массив всех корней Merkle дерева для каждого раунда
pub const ALL_MERKLE_ROOTS: [[u8; 32]; 21] = [
    [
        0x15, 0xb2, 0x60, 0x5f, 0xe2, 0x55, 0x80, 0x20, 0xe1, 0x6d, 0xe9, 0x8d, 0x1d, 0xd4, 0x4b, 0xcd,
        0x0e, 0x09, 0xa2, 0xc4, 0xa0, 0xc5, 0xc3, 0xb4, 0x3c, 0x7b, 0xc8, 0x82, 0x6f, 0xe1, 0xde, 0x5c
    ],
    [
        0xfb, 0xdd, 0x5b, 0x58, 0x7f, 0x8d, 0x4d, 0xdd, 0x5e, 0xe8, 0x13, 0x05, 0xfa, 0x86, 0xc5, 0xdf,
        0xfc, 0x6e, 0xf5, 0xdd, 0xd1, 0xf8, 0x84, 0xaa, 0xe9, 0xc4, 0x7a, 0xa2, 0x3c, 0x26, 0x4a, 0xd0
    ],
    [
        0x10, 0xfd, 0xc3, 0xd5, 0x9f, 0x28, 0xd4, 0x13, 0x4c, 0x5e, 0x00, 0x57, 0x54, 0x10, 0x88, 0x18,
        0x99, 0x2e, 0x87, 0xba, 0x7c, 0x75, 0x42, 0x4f, 0xf1, 0x41, 0x62, 0xd8, 0x6f, 0x1f, 0x8f, 0xc6
    ],
    [
        0xc4, 0x93, 0x52, 0x95, 0x10, 0x49, 0x6f, 0x91, 0x3a, 0x28, 0x6b, 0x23, 0xff, 0xfb, 0xda, 0x49,
        0xe7, 0xce, 0x25, 0x20, 0x92, 0x40, 0xaa, 0x2e, 0x88, 0x5e, 0x6b, 0xd6, 0x5a, 0xfc, 0xe2, 0xd1
    ],
    [
        0xaf, 0xa6, 0xbe, 0x4f, 0xce, 0x83, 0xc1, 0xd4, 0xb2, 0x10, 0x68, 0x2d, 0x0b, 0x42, 0x9c, 0xa7,
        0xaf, 0xfb, 0x12, 0xba, 0x2b, 0xe4, 0x32, 0xe8, 0x9e, 0xbd, 0xaf, 0x60, 0x53, 0x36, 0x86, 0x51
    ],
    [
        0x47, 0x28, 0xec, 0xdf, 0xac, 0x15, 0xef, 0xdd, 0xb6, 0xa7, 0x3e, 0x8b, 0xf4, 0xf9, 0x2e, 0x3b,
        0x4a, 0x63, 0xf9, 0x69, 0x14, 0x9a, 0xd7, 0x0b, 0x1b, 0xee, 0xba, 0x37, 0x4f, 0xd9, 0xa6, 0x1d
    ],
    [
        0xd4, 0xe3, 0x2d, 0x4c, 0x04, 0x60, 0x41, 0x3e, 0x95, 0x3d, 0xb0, 0x68, 0x5f, 0xef, 0xba, 0xb9,
        0xdf, 0xe6, 0x28, 0xc4, 0x32, 0x26, 0x6a, 0x72, 0x19, 0xb1, 0x74, 0x6c, 0x34, 0xf4, 0x06, 0xc1
    ],
    [
        0xdd, 0x1f, 0x72, 0x4e, 0xfa, 0x38, 0x06, 0x15, 0x96, 0xcc, 0x6c, 0x48, 0xd7, 0x77, 0xb5, 0x33,
        0x3a, 0x56, 0xea, 0x54, 0xe5, 0x88, 0xcf, 0xd2, 0x93, 0x0e, 0x5c, 0x50, 0xd3, 0xc1, 0x7d, 0xc0
    ],
    [
        0x1a, 0x80, 0xe5, 0x0c, 0xbe, 0xa5, 0x5b, 0xa8, 0x40, 0x43, 0xa6, 0xef, 0x37, 0x27, 0x37, 0x2f,
        0xc0, 0x5a, 0x04, 0x52, 0xb5, 0x55, 0x38, 0x72, 0x31, 0x82, 0x7b, 0x2d, 0xc8, 0xcf, 0xf0, 0x67
    ],
    [
        0x78, 0x95, 0x8e, 0x48, 0x93, 0x76, 0x5b, 0x52, 0xf9, 0x05, 0x14, 0x48, 0xa3, 0x31, 0x76, 0x7a,
        0xcb, 0xee, 0x8e, 0x2f, 0x53, 0x7e, 0x3e, 0x38, 0xe1, 0x76, 0xdb, 0x61, 0xf4, 0xda, 0xde, 0xbf
    ],
    [
        0x53, 0x8a, 0x69, 0x26, 0x2f, 0x7b, 0x4d, 0x95, 0x0c, 0xbb, 0x72, 0x9d, 0xab, 0xc1, 0xbb, 0x91,
        0x92, 0xaf, 0x57, 0x7e, 0x72, 0x1b, 0xb3, 0x6f, 0xb6, 0x29, 0x67, 0x8c, 0xf9, 0x87, 0xd6, 0xe8
    ],
    [
        0xa1, 0x54, 0xed, 0x05, 0xae, 0x22, 0x3e, 0xe0, 0xe5, 0x50, 0xb7, 0x52, 0xc3, 0x72, 0x19, 0x62,
        0xea, 0x62, 0x7e, 0xd4, 0x6c, 0x29, 0xaa, 0x4f, 0xf6, 0x9b, 0x5c, 0xce, 0xfa, 0xc8, 0xb5, 0xb0
    ],
    [
        0x4c, 0x69, 0xb4, 0x11, 0x32, 0xb7, 0x0c, 0x2d, 0xe8, 0xea, 0x67, 0xad, 0xbc, 0xdb, 0x7e, 0x56,
        0x5a, 0x09, 0xc6, 0xca, 0x8f, 0x34, 0x00, 0x3e, 0x7b, 0xd5, 0x03, 0xe1, 0xf9, 0x91, 0x63, 0x3b
    ],
    [
        0xb2, 0x28, 0x41, 0xb3, 0xf5, 0x1d, 0x8b, 0x7e, 0x0d, 0x8f, 0xfe, 0x9e, 0xbc, 0xf0, 0x97, 0x6d,
        0x83, 0x4e, 0x2f, 0xfa, 0x7f, 0x2d, 0xa1, 0xcb, 0xdf, 0xb7, 0x60, 0x87, 0xe3, 0x3b, 0x04, 0x68
    ],
    [
        0x13, 0x60, 0x35, 0x6e, 0x87, 0x9a, 0x57, 0x03, 0x31, 0x38, 0xbc, 0x0f, 0x6f, 0xfe, 0xa2, 0x54,
        0x6f, 0xc7, 0xf0, 0xe3, 0x0f, 0x19, 0x08, 0x4c, 0x0d, 0x15, 0x8d, 0xdf, 0xdb, 0x62, 0xda, 0x4d
    ],
    [
        0x3a, 0x11, 0xb7, 0x82, 0x04, 0x38, 0xc4, 0xf4, 0x11, 0x2d, 0xc9, 0x96, 0x15, 0x59, 0x76, 0xc6,
        0x85, 0x14, 0xac, 0xb8, 0xcc, 0xad, 0xd2, 0xa4, 0xcf, 0xa6, 0xc1, 0x51, 0x59, 0x79, 0x5e, 0xbd
    ],
    [
        0x71, 0xaf, 0xbf, 0x02, 0xa6, 0xc8, 0x77, 0xb5, 0x30, 0xdc, 0x4e, 0x0c, 0xa7, 0xb6, 0xfe, 0x03,
        0x82, 0xd9, 0x89, 0x88, 0x2c, 0xbb, 0xcb, 0x67, 0x7c, 0x02, 0x7e, 0x3a, 0xfd, 0xb0, 0x14, 0x87
    ],
    [
        0xb4, 0x6c, 0xb0, 0xb2, 0xf7, 0x26, 0xe8, 0xd3, 0xf0, 0xcd, 0x58, 0xa5, 0xa2, 0x0f, 0x26, 0xab,
        0xbc, 0x26, 0x91, 0xef, 0x4c, 0xf2, 0x97, 0x6c, 0x58, 0x8b, 0x74, 0x22, 0xff, 0xf4, 0x10, 0x5f
    ],
    [
        0x19, 0xb6, 0x13, 0x55, 0x25, 0x37, 0xbb, 0x05, 0x9f, 0xc4, 0x97, 0x51, 0x08, 0xa5, 0x17, 0xd8,
        0x8c, 0x78, 0x62, 0xba, 0xf7, 0xc7, 0x5c, 0x5b, 0xbf, 0x62, 0x58, 0x17, 0x71, 0xdc, 0xca, 0x38
    ],
    [
        0x1b, 0x49, 0x26, 0x63, 0xb7, 0x96, 0x44, 0xd8, 0xd5, 0x6e, 0x7f, 0x79, 0x3c, 0x3b, 0xfb, 0xd0,
        0xd7, 0xcc, 0xe6, 0xd7, 0x06, 0xc8, 0xbc, 0x12, 0x2a, 0xf9, 0x69, 0x40, 0x5e, 0x5f, 0xc6, 0xee
    ],
    [
        0x90, 0x60, 0xf8, 0xcb, 0xf8, 0xce, 0xa8, 0xa4,
        0x8c, 0xb4, 0x69, 0x7c, 0x62, 0xe8, 0xaa, 0x4f,
        0x10, 0x4c, 0x9a, 0x22, 0x69, 0xb4, 0x6f, 0xc6,
        0x9b, 0x49, 0x74, 0x92, 0x3c, 0xff, 0x1b, 0x13
    ]
];

// Объявляем точку входа для программы
entrypoint!(process_instruction);

// Основная функция обработки инструкций
pub fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction_data: &[u8],
) -> ProgramResult {
    msg!("Processing instruction: {:?}", instruction_data);
    msg!("Number of accounts: {}", accounts.len());
    
    if instruction_data.is_empty() {
        return Err(ProgramError::InvalidInstructionData);
    }

    let instruction = instruction_data[0];
    match instruction {
        0 => {
            msg!("Program is initialized!");
            Ok(())
        }
        4 => create_metadata(program_id, accounts),
        5 => set_mint_authority(program_id, accounts),
        6 => {
            msg!("Creating program mint...");
            create_program_mint(program_id, accounts)
        },
        7 => {
            msg!("Creating associated token account...");
            create_associated_token_account(program_id, accounts)
        },
        8 => {
            msg!("Minting token by program...");
            mint_token_by_program(program_id, accounts)
        },
        9 => {
            msg!("Creating mint and token (all in one)...");
            create_mint_and_token(program_id, accounts)
        },
        13 => {
            msg!("Creating mint and token with Merkle proof verification for specific round...");
            create_mint_and_token_with_round_merkle_proof(program_id, accounts, &instruction_data[1..])
        },
        14 => {
            msg!("Creating mint and token with Merkle proof verification and tracking for specific round...");
            create_mint_and_token_with_round_merkle_proof_tracked(program_id, accounts, &instruction_data[1..])
        },
        _ => {
            msg!("Invalid instruction: {:?}", instruction_data);
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

// Добавляем новую функцию
fn create_mint_and_token(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
) -> ProgramResult {
    msg!("Starting create_mint_and_token...");
    let account_info_iter = &mut accounts.iter();
    
    // Получаем все необходимые аккаунты
    let mint_account = next_account_info(account_info_iter)?;
    let associated_token_account = next_account_info(account_info_iter)?;
    let payer = next_account_info(account_info_iter)?;
    let system_program = next_account_info(account_info_iter)?;
    let token_program = next_account_info(account_info_iter)?;
    let associated_token_program = next_account_info(account_info_iter)?;
    let rent_sysvar = next_account_info(account_info_iter)?;
    let program_authority = next_account_info(account_info_iter)?;

    msg!("Checking signatures...");
    // Проверяем подписи
    if !mint_account.is_signer {
        msg!("Mint account must be a signer");
        return Err(ProgramError::MissingRequiredSignature);
    }
    if !payer.is_signer {
        msg!("Payer must be a signer");
        return Err(ProgramError::MissingRequiredSignature);
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

    msg!("Creating mint account...");
    // 1. Создаем минт аккаунт
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

    msg!("Initializing mint...");
    // 2. Инициализируем минт
    invoke(
        &spl_token::instruction::initialize_mint(
            &spl_token::id(),
            &mint_account.key,
            &program_authority.key,
            None,
            0,
        )?,
        &[
            mint_account.clone(),
            rent_sysvar.clone(),
        ],
    )?;

    msg!("Creating associated token account...");
    // 3. Создаем ассоциированный токен аккаунт
    invoke(
        &spl_associated_token_account::instruction::create_associated_token_account(
            payer.key,
            payer.key,
            mint_account.key,
            &spl_token::id(),
        ),
        &[
            payer.clone(),
            associated_token_account.clone(),
            payer.clone(),
            mint_account.clone(),
            system_program.clone(),
            token_program.clone(),
            associated_token_program.clone(),
            rent_sysvar.clone(),
        ],
    )?;

    msg!("Minting token...");
    // 4. Минтим токен
    let authority_signature_seeds = &[
        b"mint_authority".as_ref(),
        &[bump_seed],
    ];
    let signers = &[&authority_signature_seeds[..]];

    invoke_signed(
        &spl_token::instruction::mint_to(
            &spl_token::id(),
            mint_account.key,
            associated_token_account.key,
            &program_authority.key,
            &[],
            1,
        )?,
        &[
            mint_account.clone(),
            associated_token_account.clone(),
            program_authority.clone(),
        ],
        signers,
    )?;

    msg!("All operations completed successfully!");
    Ok(())
}

// Добавляем новую функцию для создания минта и токена с проверкой Merkle proof для конкретного раунда
fn create_mint_and_token_with_round_merkle_proof(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    proof_data: &[u8],
) -> ProgramResult {
    msg!("Starting create_mint_and_token_with_round_merkle_proof...");
    let account_info_iter = &mut accounts.iter();
    
    // Получаем все необходимые аккаунты
    let mint_account = next_account_info(account_info_iter)?;
    let associated_token_account = next_account_info(account_info_iter)?;
    let payer = next_account_info(account_info_iter)?;
    let system_program = next_account_info(account_info_iter)?;
    let token_program = next_account_info(account_info_iter)?;
    let associated_token_program = next_account_info(account_info_iter)?;
    let rent_sysvar = next_account_info(account_info_iter)?;
    let program_authority = next_account_info(account_info_iter)?;

    msg!("Checking signatures...");
    // Проверяем подписи
    if !mint_account.is_signer {
        msg!("Mint account must be a signer");
        return Err(ProgramError::MissingRequiredSignature);
    }
    if !payer.is_signer {
        msg!("Payer must be a signer");
        return Err(ProgramError::MissingRequiredSignature);
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

    // Проверяем, что данные имеют правильный формат
    // Первый байт - номер раунда, остальные - данные доказательства
    if proof_data.len() < 1 {
        msg!("Invalid proof data: missing round number");
        return Err(ProgramError::InvalidInstructionData);
    }
    
    // Получаем номер раунда из первого байта
    let round_number = proof_data[0] as usize;
    msg!("Using round number: {}", round_number);
    
    // Проверяем, что номер раунда валидный
    if round_number >= ALL_MERKLE_ROOTS.len() {
        msg!("Invalid round number: {}, max is {}", round_number, ALL_MERKLE_ROOTS.len() - 1);
        return Err(ProgramError::InvalidArgument);
    }
    
    // Получаем корень Merkle для указанного раунда
    let merkle_root = ALL_MERKLE_ROOTS[round_number];
    msg!("Using Merkle root for round {}", round_number);
    
    // Проверяем Merkle proof
    msg!("Verifying Merkle proof...");
    
    // Проверяем, что данные доказательства имеют правильный формат
    if (proof_data.len() - 1) % 32 != 0 {
        msg!("Invalid proof data length");
        return Err(ProgramError::InvalidInstructionData);
    }
    
    // Преобразуем данные доказательства в вектор 32-байтных массивов
    let mut proof = Vec::new();
    for i in 0..((proof_data.len() - 1) / 32) {
        let mut node = [0u8; 32];
        node.copy_from_slice(&proof_data[1 + i * 32..1 + (i + 1) * 32]);
        proof.push(node);
    }
    
    // Вычисляем хеш (лист) для адреса плательщика
    let leaf = hash(payer.key.as_ref()).to_bytes();
    
    // Проверяем доказательство
    if !verify_merkle_proof(leaf, &proof, merkle_root) {
        msg!("Invalid Merkle proof for address: {} in round {}", payer.key, round_number);
        return Err(ProgramError::InvalidArgument);
    }
    
    msg!("Merkle proof verified successfully for round {}!", round_number);

    msg!("Creating mint account...");
    // 1. Создаем минт аккаунт
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

    msg!("Initializing mint...");
    // 2. Инициализируем минт
    invoke(
        &spl_token::instruction::initialize_mint(
            &spl_token::id(),
            &mint_account.key,
            &program_authority.key,
            None,
            0,
        )?,
        &[
            mint_account.clone(),
            rent_sysvar.clone(),
        ],
    )?;

    msg!("Creating associated token account...");
    // 3. Создаем ассоциированный токен аккаунт
    invoke(
        &spl_associated_token_account::instruction::create_associated_token_account(
            payer.key,
            payer.key,
            mint_account.key,
            &spl_token::id(),
        ),
        &[
            payer.clone(),
            associated_token_account.clone(),
            payer.clone(),
            mint_account.clone(),
            system_program.clone(),
            token_program.clone(),
            associated_token_program.clone(),
            rent_sysvar.clone(),
        ],
    )?;

    msg!("Minting token...");
    // 4. Минтим токен
    let authority_signature_seeds = &[
        b"mint_authority".as_ref(),
        &[bump_seed],
    ];
    let signers = &[&authority_signature_seeds[..]];

    invoke_signed(
        &spl_token::instruction::mint_to(
            &spl_token::id(),
            mint_account.key,
            associated_token_account.key,
            &program_authority.key,
            &[],
            1,
        )?,
        &[
            mint_account.clone(),
            associated_token_account.clone(),
            program_authority.clone(),
        ],
        signers,
    )?;

    msg!("All operations with round-specific Merkle proof verification completed successfully!");
    Ok(())
}

// Добавляем новую функцию для создания минта и токена с проверкой Merkle proof и отслеживанием минтинга
fn create_mint_and_token_with_round_merkle_proof_tracked(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    proof_data: &[u8],
) -> ProgramResult {
    msg!("Starting create_mint_and_token_with_round_merkle_proof_tracked...");
    let account_info_iter = &mut accounts.iter();
    
    // Получаем все необходимые аккаунты
    let mint_account = next_account_info(account_info_iter)?;
    let associated_token_account = next_account_info(account_info_iter)?;
    let payer = next_account_info(account_info_iter)?;
    let system_program = next_account_info(account_info_iter)?;
    let token_program = next_account_info(account_info_iter)?;
    let associated_token_program = next_account_info(account_info_iter)?;
    let rent_sysvar = next_account_info(account_info_iter)?;
    let program_authority = next_account_info(account_info_iter)?;
    let mint_record_account = next_account_info(account_info_iter)?;

    msg!("Checking signatures...");
    // Проверяем подписи
    if !mint_account.is_signer {
        msg!("Mint account must be a signer");
        return Err(ProgramError::MissingRequiredSignature);
    }
    if !payer.is_signer {
        msg!("Payer must be a signer");
        return Err(ProgramError::MissingRequiredSignature);
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

    // Проверяем, что данные имеют правильный формат
    // Первый байт - номер раунда, остальные - данные доказательства
    if proof_data.len() < 1 {
        msg!("Invalid proof data: missing round number");
        return Err(ProgramError::InvalidInstructionData);
    }
    
    // Получаем номер раунда из первого байта
    let round_number = proof_data[0] as usize;
    msg!("Using round number: {}", round_number);
    
    // Проверяем, что номер раунда валидный
    if round_number >= ALL_MERKLE_ROOTS.len() {
        msg!("Invalid round number: {}, max is {}", round_number, ALL_MERKLE_ROOTS.len() - 1);
        return Err(ProgramError::InvalidArgument);
    }
    
    // Получаем корень Merkle для указанного раунда
    let merkle_root = ALL_MERKLE_ROOTS[round_number];
    msg!("Using Merkle root for round {}", round_number);
    
    // Проверяем Merkle proof
    msg!("Verifying Merkle proof...");
    
    // Проверяем, что данные доказательства имеют правильный формат
    if (proof_data.len() - 1) % 32 != 0 {
        msg!("Invalid proof data length");
        return Err(ProgramError::InvalidInstructionData);
    }
    
    // Преобразуем данные доказательства в вектор 32-байтных массивов
    let mut proof = Vec::new();
    for i in 0..((proof_data.len() - 1) / 32) {
        let mut node = [0u8; 32];
        node.copy_from_slice(&proof_data[1 + i * 32..1 + (i + 1) * 32]);
        proof.push(node);
    }
    
    // Вычисляем хеш (лист) для адреса плательщика
    let leaf = hash(payer.key.as_ref()).to_bytes();
    
    // Проверяем доказательство
    if !verify_merkle_proof(leaf, &proof, merkle_root) {
        msg!("Invalid Merkle proof for address: {} in round {}", payer.key, round_number);
        return Err(ProgramError::InvalidArgument);
    }
    
    msg!("Merkle proof verified successfully for round {}!", round_number);

    // Проверяем, что пользователь ещё не минтил в этом раунде
    // Генерируем адрес PDA для отслеживания минтинга
    let (expected_mint_record_address, mint_record_bump) = Pubkey::find_program_address(
        &[
            b"is_minted",
            &[round_number as u8],
            payer.key.as_ref(),
        ],
        program_id
    );
    
    // Проверяем, что переданный mint_record_account соответствует ожидаемому адресу
    if mint_record_account.key != &expected_mint_record_address {
        msg!("Invalid mint record account address");
        return Err(ProgramError::InvalidArgument);
    }
    
    // Проверяем, существует ли уже аккаунт для отслеживания минтинга
    if !mint_record_account.data_is_empty() && mint_record_account.owner == program_id {
        msg!("User has already minted in round {}", round_number);
        return Err(ProgramError::AccountAlreadyInitialized);
    }

    msg!("Creating mint account...");
    // 1. Создаем минт аккаунт
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

    msg!("Initializing mint...");
    // 2. Инициализируем минт
    invoke(
        &spl_token::instruction::initialize_mint(
            &spl_token::id(),
            &mint_account.key,
            &program_authority.key,
            None,
            0,
        )?,
        &[
            mint_account.clone(),
            rent_sysvar.clone(),
        ],
    )?;

    msg!("Creating associated token account...");
    // 3. Создаем ассоциированный токен аккаунт
    invoke(
        &spl_associated_token_account::instruction::create_associated_token_account(
            payer.key,
            payer.key,
            mint_account.key,
            &spl_token::id(),
        ),
        &[
            payer.clone(),
            associated_token_account.clone(),
            payer.clone(),
            mint_account.clone(),
            system_program.clone(),
            token_program.clone(),
            associated_token_program.clone(),
            rent_sysvar.clone(),
        ],
    )?;

    msg!("Minting token...");
    // 4. Минтим токен
    let authority_signature_seeds = &[
        b"mint_authority".as_ref(),
        &[bump_seed],
    ];
    let signers = &[&authority_signature_seeds[..]];

    invoke_signed(
        &spl_token::instruction::mint_to(
            &spl_token::id(),
            mint_account.key,
            associated_token_account.key,
            &program_authority.key,
            &[],
            1,
        )?,
        &[
            mint_account.clone(),
            associated_token_account.clone(),
            program_authority.clone(),
        ],
        signers,
    )?;

    msg!("Creating mint record PDA...");
    // 5. Создаем PDA для отслеживания минтинга
    // Размер данных - 1 байт для хранения bool значения
    let mint_record_size = 1;
    let mint_record_lamports = rent.minimum_balance(mint_record_size);
    
    // Создаем seeds для PDA
    let mint_record_signature_seeds = &[
        b"is_minted".as_ref(),
        &[round_number as u8],
        payer.key.as_ref(),
        &[mint_record_bump],
    ];
    let mint_record_signers = &[&mint_record_signature_seeds[..]];
    
    // Создаем аккаунт для отслеживания минтинга
    invoke_signed(
        &system_instruction::create_account(
            &payer.key,
            &expected_mint_record_address,
            mint_record_lamports,
            mint_record_size as u64,
            program_id,
        ),
        &[
            payer.clone(),
            mint_record_account.clone(),
            system_program.clone(),
        ],
        mint_record_signers,
    )?;
    
    // Устанавливаем значение в аккаунте (1 - минтил)
    mint_record_account.try_borrow_mut_data()?[0] = 1;

    msg!("All operations with round-specific Merkle proof verification and tracking completed successfully!");
    Ok(())
}

// Вспомогательная функция для получения следующего аккаунта
fn next_account_info<'a, 'b>(
    iter: &mut std::slice::Iter<'a, AccountInfo<'b>>,
) -> Result<&'a AccountInfo<'b>, ProgramError> {
    iter.next().ok_or(ProgramError::NotEnoughAccountKeys)
}

// Вспомогательная функция для проверки меркл доказательства
fn verify_merkle_proof(leaf: [u8;32], proof: &Vec<[u8;32]>, root: [u8;32]) -> bool {
    let mut computed = leaf;
    for node in proof.iter() {
        // Для консистентности сортируем пару хешей перед объединением
        let (min, max) = if computed <= *node { (computed, *node) } else { (*node, computed) };
        let mut bytes = [0u8;64];
        bytes[..32].copy_from_slice(&min);
        bytes[32..].copy_from_slice(&max);
        computed = hash(&bytes).to_bytes();
    }
    computed == root
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
