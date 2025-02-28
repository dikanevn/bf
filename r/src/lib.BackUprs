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
    state::{Mint, Account},
};
use solana_program::program_pack::Pack;
use mpl_token_metadata::{
    instructions,
    types::{DataV2, TokenStandard, PrintSupply},
    instructions::{CreateV1, CreateV1InstructionArgs},
};
use spl_associated_token_account::instruction;

// Константы для работы с токен стандартом
const TOKEN_STANDARD_INDEX: usize = 115;
const MASTER_EDITION_TOKEN_STANDARD_OFFSET: usize = 1;

// Массив всех корней Merkle дерева для каждого раунда
pub const ALL_MERKLE_ROOTS: [[u8; 32]; 21] = [
    [0x15, 0xb2, 0x60, 0x5f, 0xe2, 0x55, 0x80, 0x20, 0xe1, 0x6d, 0xe9, 0x8d, 0x1d, 0xd4, 0x4b, 0xcd, 0x0e, 0x09, 0xa2, 0xc4, 0xa0, 0xc5, 0xc3, 0xb4, 0x3c, 0x7b, 0xc8, 0x82, 0x6f, 0xe1, 0xde, 0x5c],
    [0xfb, 0xdd, 0x5b, 0x58, 0x7f, 0x8d, 0x4d, 0xdd, 0x5e, 0xe8, 0x13, 0x05, 0xfa, 0x86, 0xc5, 0xdf, 0xfc, 0x6e, 0xf5, 0xdd, 0xd1, 0xf8, 0x84, 0xaa, 0xe9, 0xc4, 0x7a, 0xa2, 0x3c, 0x26, 0x4a, 0xd0],
    [0x10, 0xfd, 0xc3, 0xd5, 0x9f, 0x28, 0xd4, 0x13, 0x4c, 0x5e, 0x00, 0x57, 0x54, 0x10, 0x88, 0x18, 0x99, 0x2e, 0x87, 0xba, 0x7c, 0x75, 0x42, 0x4f, 0xf1, 0x41, 0x62, 0xd8, 0x6f, 0x1f, 0x8f, 0xc6],
    [0xc4, 0x93, 0x52, 0x95, 0x10, 0x49, 0x6f, 0x91, 0x3a, 0x28, 0x6b, 0x23, 0xff, 0xfb, 0xda, 0x49, 0xe7, 0xce, 0x25, 0x20, 0x92, 0x40, 0xaa, 0x2e, 0x88, 0x5e, 0x6b, 0xd6, 0x5a, 0xfc, 0xe2, 0xd1],
    [0xaf, 0xa6, 0xbe, 0x4f, 0xce, 0x83, 0xc1, 0xd4, 0xb2, 0x10, 0x68, 0x2d, 0x0b, 0x42, 0x9c, 0xa7, 0xaf, 0xfb, 0x12, 0xba, 0x2b, 0xe4, 0x32, 0xe8, 0x9e, 0xbd, 0xaf, 0x60, 0x53, 0x36, 0x86, 0x51],
    [0x47, 0x28, 0xec, 0xdf, 0xac, 0x15, 0xef, 0xdd, 0xb6, 0xa7, 0x3e, 0x8b, 0xf4, 0xf9, 0x2e, 0x3b, 0x4a, 0x63, 0xf9, 0x69, 0x14, 0x9a, 0xd7, 0x0b, 0x1b, 0xee, 0xba, 0x37, 0x4f, 0xd9, 0xa6, 0x1d],
    [0xd4, 0xe3, 0x2d, 0x4c, 0x04, 0x60, 0x41, 0x3e, 0x95, 0x3d, 0xb0, 0x68, 0x5f, 0xef, 0xba, 0xb9, 0xdf, 0xe6, 0x28, 0xc4, 0x32, 0x26, 0x6a, 0x72, 0x19, 0xb1, 0x74, 0x6c, 0x34, 0xf4, 0x06, 0xc1],
    [0xdd, 0x1f, 0x72, 0x4e, 0xfa, 0x38, 0x06, 0x15, 0x96, 0xcc, 0x6c, 0x48, 0xd7, 0x77, 0xb5, 0x33, 0x3a, 0x56, 0xea, 0x54, 0xe5, 0x88, 0xcf, 0xd2, 0x93, 0x0e, 0x5c, 0x50, 0xd3, 0xc1, 0x7d, 0xc0],
    [0x1a, 0x80, 0xe5, 0x0c, 0xbe, 0xa5, 0x5b, 0xa8, 0x40, 0x43, 0xa6, 0xef, 0x37, 0x27, 0x37, 0x2f, 0xc0, 0x5a, 0x04, 0x52, 0xb5, 0x55, 0x38, 0x72, 0x31, 0x82, 0x7b, 0x2d, 0xc8, 0xcf, 0xf0, 0x67],
    [0x78, 0x95, 0x8e, 0x48, 0x93, 0x76, 0x5b, 0x52, 0xf9, 0x05, 0x14, 0x48, 0xa3, 0x31, 0x76, 0x7a, 0xcb, 0xee, 0x8e, 0x2f, 0x53, 0x7e, 0x3e, 0x38, 0xe1, 0x76, 0xdb, 0x61, 0xf4, 0xda, 0xde, 0xbf],
    [0x53, 0x8a, 0x69, 0x26, 0x2f, 0x7b, 0x4d, 0x95, 0x0c, 0xbb, 0x72, 0x9d, 0xab, 0xc1, 0xbb, 0x91, 0x92, 0xaf, 0x57, 0x7e, 0x72, 0x1b, 0xb3, 0x6f, 0xb6, 0x29, 0x67, 0x8c, 0xf9, 0x87, 0xd6, 0xe8],
    [0xa1, 0x54, 0xed, 0x05, 0xae, 0x22, 0x3e, 0xe0, 0xe5, 0x50, 0xb7, 0x52, 0xc3, 0x72, 0x19, 0x62, 0xea, 0x62, 0x7e, 0xd4, 0x6c, 0x29, 0xaa, 0x4f, 0xf6, 0x9b, 0x5c, 0xce, 0xfa, 0xc8, 0xb5, 0xb0],
    [0x4c, 0x69, 0xb4, 0x11, 0x32, 0xb7, 0x0c, 0x2d, 0xe8, 0xea, 0x67, 0xad, 0xbc, 0xdb, 0x7e, 0x56, 0x5a, 0x09, 0xc6, 0xca, 0x8f, 0x34, 0x00, 0x3e, 0x7b, 0xd5, 0x03, 0xe1, 0xf9, 0x91, 0x63, 0x3b],
    [0xb2, 0x28, 0x41, 0xb3, 0xf5, 0x1d, 0x8b, 0x7e, 0x0d, 0x8f, 0xfe, 0x9e, 0xbc, 0xf0, 0x97, 0x6d, 0x83, 0x4e, 0x2f, 0xfa, 0x7f, 0x2d, 0xa1, 0xcb, 0xdf, 0xb7, 0x60, 0x87, 0xe3, 0x3b, 0x04, 0x68],
    [0x13, 0x60, 0x35, 0x6e, 0x87, 0x9a, 0x57, 0x03, 0x31, 0x38, 0xbc, 0x0f, 0x6f, 0xfe, 0xa2, 0x54, 0x6f, 0xc7, 0xf0, 0xe3, 0x0f, 0x19, 0x08, 0x4c, 0x0d, 0x15, 0x8d, 0xdf, 0xdb, 0x62, 0xda, 0x4d],
    [0x3a, 0x11, 0xb7, 0x82, 0x04, 0x38, 0xc4, 0xf4, 0x11, 0x2d, 0xc9, 0x96, 0x15, 0x59, 0x76, 0xc6, 0x85, 0x14, 0xac, 0xb8, 0xcc, 0xad, 0xd2, 0xa4, 0xcf, 0xa6, 0xc1, 0x51, 0x59, 0x79, 0x5e, 0xbd],
    [0x71, 0xaf, 0xbf, 0x02, 0xa6, 0xc8, 0x77, 0xb5, 0x30, 0xdc, 0x4e, 0x0c, 0xa7, 0xb6, 0xfe, 0x03, 0x82, 0xd9, 0x89, 0x88, 0x2c, 0xbb, 0xcb, 0x67, 0x7c, 0x02, 0x7e, 0x3a, 0xfd, 0xb0, 0x14, 0x87],
    [0xb4, 0x6c, 0xb0, 0xb2, 0xf7, 0x26, 0xe8, 0xd3, 0xf0, 0xcd, 0x58, 0xa5, 0xa2, 0x0f, 0x26, 0xab, 0xbc, 0x26, 0x91, 0xef, 0x4c, 0xf2, 0x97, 0x6c, 0x58, 0x8b, 0x74, 0x22, 0xff, 0xf4, 0x10, 0x5f],
    [0x19, 0xb6, 0x13, 0x55, 0x25, 0x37, 0xbb, 0x05, 0x9f, 0xc4, 0x97, 0x51, 0x08, 0xa5, 0x17, 0xd8, 0x8c, 0x78, 0x62, 0xba, 0xf7, 0xc7, 0x5c, 0x5b, 0xbf, 0x62, 0x58, 0x17, 0x71, 0xdc, 0xca, 0x38],
    [0x1b, 0x49, 0x26, 0x63, 0xb7, 0x96, 0x44, 0xd8, 0xd5, 0x6e, 0x7f, 0x79, 0x3c, 0x3b, 0xfb, 0xd0, 0xd7, 0xcc, 0xe6, 0xd7, 0x06, 0xc8, 0xbc, 0x12, 0x2a, 0xf9, 0x69, 0x40, 0x5e, 0x5f, 0xc6, 0xee],
    [0x90, 0x60, 0xf8, 0xcb, 0xf8, 0xce, 0xa8, 0xa4, 0x8c, 0xb4, 0x69, 0x7c, 0x62, 0xe8, 0xaa, 0x4f, 0x10, 0x4c, 0x9a, 0x22, 0x69, 0xb4, 0x6f, 0xc6, 0x9b, 0x49, 0x74, 0x92, 0x3c, 0xff, 0x1b, 0x13]
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
        15 => {
            msg!("Deleting mint record account for specific round...");
            delete_mint_record_for_round(program_id, accounts, &instruction_data[1..])
        },
        16 => {
            msg!("Creating mint and token with Merkle proof verification and extended tracking for specific round...");
            create_mint_and_token_with_round_merkle_proof_tracked_extended(program_id, accounts, &instruction_data[1..])
        },
        17 => {
            msg!("Creating mint, token with Merkle proof verification, extended tracking, and metadata for specific round...");
            create_mint_token_with_merkle_proof_tracked_extended_and_metadata(program_id, accounts, &instruction_data[1..])
        },
        18 => {
            msg!("Creating metadata for existing mint...");
            create_metadata_for_existing_mint(program_id, accounts, &instruction_data[1..])
        },
        20 => {
            msg!("Creating master edition for existing mint...");
            create_master_edition_for_existing_mint(program_id, accounts, &instruction_data[1..])
        },
        21 => {
            msg!("Creating mint, metadata and master edition with Merkle proof verification...");
            create_mint_metadata_and_master_edition(program_id, accounts, &instruction_data[1..])
        },
        23 => {
            msg!("Creating clean NFT using CreateV1...");
            create_clean_nft_and_mint(program_id, accounts)
        },
        24 => {
            msg!("Creating clean NFT and minting token...");
            create_clean_nft_and_ata(program_id, accounts)

        },
        _ => {
            msg!("Invalid instruction: {:?}", instruction_data);
            Err(ProgramError::InvalidInstructionData)
        }
    }
}

// Добавляем новую функцию для удаления аккаунта отслеживания минтинга для конкретного раунда
fn delete_mint_record_for_round(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction_data: &[u8],
) -> ProgramResult {
    msg!("Starting delete_mint_record_for_round...");
    let account_info_iter = &mut accounts.iter();
    
    // Получаем необходимые аккаунты
    let payer = next_account_info(account_info_iter)?;
    let mint_record_account = next_account_info(account_info_iter)?;
    let system_program = next_account_info(account_info_iter)?;
    
    // Проверяем подпись
    if !payer.is_signer {
        msg!("Payer must be a signer");
        return Err(ProgramError::MissingRequiredSignature);
    }
    
    // Проверяем, что данные имеют правильный формат
    // Первый байт - номер раунда
    if instruction_data.is_empty() {
        msg!("Invalid instruction data: missing round number");
        return Err(ProgramError::InvalidInstructionData);
    }
    
    // Получаем номер раунда из первого байта
    let round_number = instruction_data[0] as usize;
    msg!("Using round number: {}", round_number);
    
    // Проверяем, что номер раунда валидный
    if round_number >= ALL_MERKLE_ROOTS.len() {
        msg!("Invalid round number: {}, max is {}", round_number, ALL_MERKLE_ROOTS.len() - 1);
        return Err(ProgramError::InvalidArgument);
    }
    
    // Проверяем, что mint_record_account принадлежит программе
    if mint_record_account.owner != program_id {
        msg!("Mint record account does not belong to the program");
        return Err(ProgramError::IncorrectProgramId);
    }
    
    // Проверяем только расширенный PDA
    let (expected_extended_mint_record_address, _) = Pubkey::find_program_address(
        &[
            b"is_minted_ext",
            &[round_number as u8],
            payer.key.as_ref(),
        ],
        program_id
    );
    
    // Проверяем, что переданный mint_record_account соответствует ожидаемому адресу
    if mint_record_account.key != &expected_extended_mint_record_address {
        msg!("Invalid mint record account address");
        return Err(ProgramError::InvalidArgument);
    }
    
    msg!("Deleting extended mint record account");
    
    // Переводим все ламппорты с аккаунта на payer
    let dest_starting_lamports = payer.lamports();
    **payer.lamports.borrow_mut() = dest_starting_lamports
        .checked_add(mint_record_account.lamports())
        .ok_or(ProgramError::ArithmeticOverflow)?;
    **mint_record_account.lamports.borrow_mut() = 0;
    
    // Очищаем данные аккаунта
    let mut data = mint_record_account.try_borrow_mut_data()?;
    for byte in data.iter_mut() {
        *byte = 0;
    }
    
    msg!("Mint record account for round {} successfully deleted!", round_number);
    Ok(())
}

// Функция для создания минта и токена с проверкой Merkle proof и расширенным отслеживанием минтинга
fn create_mint_and_token_with_round_merkle_proof_tracked_extended(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    proof_data: &[u8],
) -> ProgramResult {
    msg!("Starting create_mint_and_token_with_round_merkle_proof_tracked_extended...");
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
            b"is_minted_ext",
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
    // 2. Инициализируем минт с установкой freeze_authority равным mint_authority
    invoke(
        &spl_token::instruction::initialize_mint(
            &spl_token::id(),
            &mint_account.key,
            &program_authority.key,
            Some(&program_authority.key),
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
    // Минтим токен
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
            token_program.clone(),
        ],
        signers,
    )?;

    msg!("Creating extended mint record PDA...");
    // 5. Создаем PDA для расширенного отслеживания минтинга
    // Размер данных - 32 байта для хранения адреса минта
    let mint_record_size = 32;
    let mint_record_lamports = rent.minimum_balance(mint_record_size);
    
    // Создаем seeds для PDA
    let mint_record_signature_seeds = &[
        b"is_minted_ext".as_ref(),
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
    
    // Записываем адрес минта в аккаунт
    let mut data = mint_record_account.try_borrow_mut_data()?;
    msg!("Mint address to store: {}", mint_account.key);
    msg!("Data length: {}", data.len());
    
    // Проверяем размер данных
    if data.len() < 32 {
        msg!("Error: Data buffer too small: {}", data.len());
        return Err(ProgramError::AccountDataTooSmall);
    }
    
    // Копируем адрес минта в аккаунт
    data[0..32].copy_from_slice(&mint_account.key.to_bytes());
    
    // Проверяем, что данные записались корректно
    msg!("Data written successfully");

    msg!("All operations with round-specific Merkle proof verification and extended tracking completed successfully!");
    Ok(())
}

// Функция для создания минта, токена с проверкой Merkle proof, расширенным отслеживанием минтинга и метаданными
fn create_mint_token_with_merkle_proof_tracked_extended_and_metadata(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    proof_data: &[u8],
) -> ProgramResult {
    msg!("Starting create_mint_token_with_merkle_proof_tracked_extended_and_metadata...");
    
    // Сначала создаем минт и токен с расширенным отслеживанием
    let mint_token_accounts = &accounts[0..9]; // Первые 9 аккаунтов для создания минта и токена
    create_mint_and_token_with_round_merkle_proof_tracked_extended(program_id, mint_token_accounts, proof_data)?;
    
    // Затем создаем метаданные
    // Получаем необходимые аккаунты для создания метаданных
    let metadata_account = &accounts[9];
    let mint_account = &accounts[0]; // Тот же mint_account, что и в первой части
    let program_authority = &accounts[7]; // program_authority вместо payer
    let payer = &accounts[2]; // payer из первой части
    let metadata_program = &accounts[10];
    let rent_sysvar = &accounts[6]; // rent_sysvar из первой части
    let system_program = &accounts[3]; // system_program из первой части
    let token_program = &accounts[5]; // spl_token_program из первой части
    
    let metadata_accounts = &[
        metadata_account.clone(),
        mint_account.clone(),
        program_authority.clone(),
        payer.clone(),
        metadata_program.clone(),
        rent_sysvar.clone(),
        system_program.clone(),
        token_program.clone(),
    ];
    
    msg!("Creating metadata for the minted token...");
    
    let data = DataV2 {
        name: "NFT".to_string(),
        symbol: "NFT".to_string(),
        uri: "".to_string(),
        seller_fee_basis_points: 600,
        creators: None,
        collection: None,
        uses: None,
    };

    // Получаем bump seed для program_authority
    let (_, bump_seed) = Pubkey::find_program_address(
        &[b"mint_authority"],
        program_id
    );

    // Создаем seeds для подписи
    let authority_signature_seeds = &[
        b"mint_authority".as_ref(),
        &[bump_seed],
    ];
    let signers = &[&authority_signature_seeds[..]];

    invoke_signed(
        &instructions::CreateMetadataAccountV3 {
            metadata: *metadata_account.key,
            mint: *mint_account.key,
            mint_authority: *program_authority.key,
            payer: *payer.key,
            update_authority: (*program_authority.key, true),
            system_program: *system_program.key,
            rent: None,
        }.instruction(instructions::CreateMetadataAccountV3InstructionArgs {
            data,
            is_mutable: true,
            collection_details: None,
        }),
        metadata_accounts,
        signers,
    )?;

    msg!("Mint, token with Merkle proof verification, extended tracking, and metadata created successfully!");
    Ok(())
}

// Функция для создания метаданных для существующего минта
fn create_metadata_for_existing_mint(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    _instruction_data: &[u8],
) -> ProgramResult {
    msg!("Starting create_metadata_for_existing_mint...");
    
    // Получаем необходимые аккаунты
    let account_info_iter = &mut accounts.iter();
    
    let metadata_account = next_account_info(account_info_iter)?;
    let mint_account = next_account_info(account_info_iter)?;
    let program_authority = next_account_info(account_info_iter)?;
    let payer = next_account_info(account_info_iter)?;
    let metadata_program = next_account_info(account_info_iter)?;
    let system_program = next_account_info(account_info_iter)?;
    let rent_sysvar = next_account_info(account_info_iter)?;
    let token_program = next_account_info(account_info_iter)?;
    
    // Проверяем подпись
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
    
    // Создаем метаданные
    msg!("Creating metadata for the existing mint...");
    
    let data = DataV2 {
        name: "NFT".to_string(),
        symbol: "NFT".to_string(),
        uri: "".to_string(),
        seller_fee_basis_points: 700,
        creators: None,
        collection: None,
        uses: None,
    };

    // Создаем seeds для подписи
    let authority_signature_seeds = &[
        b"mint_authority".as_ref(),
        &[bump_seed],
    ];
    let signers = &[&authority_signature_seeds[..]];

    let metadata_accounts = &[
        metadata_account.clone(),
        mint_account.clone(),
        program_authority.clone(),
        payer.clone(),
        metadata_program.clone(),
        system_program.clone(),
        rent_sysvar.clone(),
        token_program.clone(),
    ];

    // Устанавливаем токен стандарт как ProgrammableNonFungible
    let mut metadata_data = metadata_account.try_borrow_mut_data()?;
    metadata_data[TOKEN_STANDARD_INDEX] = TokenStandard::ProgrammableNonFungible as u8;

    invoke_signed(
        &instructions::CreateMetadataAccountV3 {
            metadata: *metadata_account.key,
            mint: *mint_account.key,
            mint_authority: *program_authority.key,
            payer: *payer.key,
            update_authority: (*program_authority.key, true),
            system_program: *system_program.key,
            rent: None,
        }.instruction(instructions::CreateMetadataAccountV3InstructionArgs {
            data,
            is_mutable: true,
            collection_details: None,
        }),
        metadata_accounts,
        signers,
    )?;

    msg!("Metadata created successfully for existing mint!");
    Ok(())
}

// Функция для создания Master Edition для существующего минта
fn create_master_edition_for_existing_mint(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    _instruction_data: &[u8],
) -> ProgramResult {
    msg!("Starting create_master_edition_for_existing_mint...");
    
    // Получаем необходимые аккаунты
    let account_info_iter = &mut accounts.iter();
    
    let master_edition_account = next_account_info(account_info_iter)?;
    let metadata_account = next_account_info(account_info_iter)?;
    let mint_account = next_account_info(account_info_iter)?;
    let program_authority = next_account_info(account_info_iter)?;
    let payer = next_account_info(account_info_iter)?;
    let metadata_program = next_account_info(account_info_iter)?;
    let token_program = next_account_info(account_info_iter)?;
    let system_program = next_account_info(account_info_iter)?;
    let rent_sysvar = next_account_info(account_info_iter)?;
    let spl_token_program = next_account_info(account_info_iter)?;
    
    // Проверяем подпись
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
    
    // Создаем Master Edition
    msg!("Creating master edition for the existing mint...");

    // Создаем seeds для подписи
    let authority_signature_seeds = &[
        b"mint_authority".as_ref(),
        &[bump_seed],
    ];
    let signers = &[&authority_signature_seeds[..]];

    let master_edition_accounts = &[
        master_edition_account.clone(),
        metadata_account.clone(),
        mint_account.clone(),
        program_authority.clone(),
        payer.clone(),
        metadata_program.clone(),
        token_program.clone(),
        system_program.clone(),
        rent_sysvar.clone(),
        spl_token_program.clone(),
    ];

    // Устанавливаем токен стандарт как ProgrammableNonFungible в master edition
    let mut edition_data = master_edition_account.try_borrow_mut_data()?;
    let data_len = edition_data.len();
    edition_data[data_len - MASTER_EDITION_TOKEN_STANDARD_OFFSET] = TokenStandard::ProgrammableNonFungible as u8;

    invoke_signed(
        &instructions::CreateMasterEditionV3 {
            edition: *master_edition_account.key,
            mint: *mint_account.key,
            update_authority: *program_authority.key,
            mint_authority: *program_authority.key,
            payer: *payer.key,
            metadata: *metadata_account.key,
            token_program: *token_program.key,
            system_program: *system_program.key,
            rent: None,
        }.instruction(instructions::CreateMasterEditionV3InstructionArgs {
            max_supply: Some(0),
        }),
        master_edition_accounts,
        signers,
    )?;

    msg!("Master Edition created successfully for existing mint!");
    Ok(())
}

// Функция для создания минта, метадаты и Master Edition с проверкой Merkle proof
fn create_mint_metadata_and_master_edition(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    proof_data: &[u8],
) -> ProgramResult {
    msg!("Starting create_mint_metadata_and_master_edition...");
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
    let metadata_account = next_account_info(account_info_iter)?;
    let metadata_program = next_account_info(account_info_iter)?;
    let master_edition_account = next_account_info(account_info_iter)?;
    let spl_token_program = next_account_info(account_info_iter)?;

    // Проверяем подписи
    if !mint_account.is_signer {
        msg!("Mint account must be a signer");
        return Err(ProgramError::MissingRequiredSignature);
    }
    if !payer.is_signer {
        msg!("Payer must be a signer");
        return Err(ProgramError::MissingRequiredSignature);
    }

    // Проверяем program_authority PDA
    let (expected_authority, bump_seed) = Pubkey::find_program_address(
        &[b"mint_authority"],
        program_id
    );
    if program_authority.key != &expected_authority {
        msg!("Invalid program authority provided");
        return Err(ProgramError::InvalidArgument);
    }

    // Проверяем данные доказательства
    if proof_data.len() < 1 {
        msg!("Invalid proof data: missing round number");
        return Err(ProgramError::InvalidInstructionData);
    }
    
    // Получаем номер раунда
    let round_number = proof_data[0] as usize;
    msg!("Using round number: {}", round_number);
    
    // Проверяем валидность раунда
    if round_number >= ALL_MERKLE_ROOTS.len() {
        msg!("Invalid round number: {}, max is {}", round_number, ALL_MERKLE_ROOTS.len() - 1);
        return Err(ProgramError::InvalidArgument);
    }
    
    // Получаем корень Merkle для раунда
    let merkle_root = ALL_MERKLE_ROOTS[round_number];
    
    // Проверяем формат доказательства
    if (proof_data.len() - 1) % 32 != 0 {
        msg!("Invalid proof data length");
        return Err(ProgramError::InvalidInstructionData);
    }
    
    // Преобразуем доказательство
    let mut proof = Vec::new();
    for i in 0..((proof_data.len() - 1) / 32) {
        let mut node = [0u8; 32];
        node.copy_from_slice(&proof_data[1 + i * 32..1 + (i + 1) * 32]);
        proof.push(node);
    }
    
    // Вычисляем хеш для адреса плательщика
    let leaf = hash(payer.key.as_ref()).to_bytes();
    
    // Проверяем доказательство
    if !verify_merkle_proof(leaf, &proof, merkle_root) {
        msg!("Invalid Merkle proof for address: {} in round {}", payer.key, round_number);
        return Err(ProgramError::InvalidArgument);
    }

    // Проверяем PDA для отслеживания минтинга
    let (expected_mint_record_address, mint_record_bump) = Pubkey::find_program_address(
        &[
            b"is_minted_ext",
            &[round_number as u8],
            payer.key.as_ref(),
        ],
        program_id
    );
    
    if mint_record_account.key != &expected_mint_record_address {
        msg!("Invalid mint record account address");
        return Err(ProgramError::InvalidArgument);
    }
    
    if !mint_record_account.data_is_empty() && mint_record_account.owner == program_id {
        msg!("User has already minted in round {}", round_number);
        return Err(ProgramError::AccountAlreadyInitialized);
    }

    // 1. Создаем минт аккаунт
    msg!("Creating mint account...");
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

    // 2. Инициализируем минт
    msg!("Initializing mint...");
    invoke(
        &spl_token::instruction::initialize_mint(
            &spl_token::id(),
            &mint_account.key,
            &program_authority.key,
            Some(&program_authority.key),
            0,
        )?,
        &[
            mint_account.clone(),
            rent_sysvar.clone(),
        ],
    )?;

    // 3. Создаем ассоциированный токен аккаунт
    msg!("Creating associated token account...");
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

    // 4. Минтим токен
    msg!("Minting token...");
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
            spl_token_program.clone(),
        ],
        signers,
    )?;

    // 5. Создаем PDA для отслеживания минтинга
    msg!("Creating extended mint record PDA...");
    let mint_record_size = 32;
    let mint_record_lamports = rent.minimum_balance(mint_record_size);
    
    let mint_record_signature_seeds = &[
        b"is_minted_ext".as_ref(),
        &[round_number as u8],
        payer.key.as_ref(),
        &[mint_record_bump],
    ];
    let mint_record_signers = &[&mint_record_signature_seeds[..]];
    
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
    
    let mut data = mint_record_account.try_borrow_mut_data()?;
    data[0..32].copy_from_slice(&mint_account.key.to_bytes());

    // 6. Создаем метадату
    msg!("Creating metadata...");
    let data = DataV2 {
        name: "NFT".to_string(),
        symbol: "NFT".to_string(),
        uri: "".to_string(),
        seller_fee_basis_points: 700,
        creators: None,
        collection: None,
        uses: None,
    };

    invoke_signed(
        &instructions::CreateMetadataAccountV3 {
            metadata: *metadata_account.key,
            mint: *mint_account.key,
            mint_authority: *program_authority.key,
            payer: *payer.key,
            update_authority: (*program_authority.key, true),
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
            program_authority.clone(),
            payer.clone(),
            metadata_program.clone(),
            system_program.clone(),
            rent_sysvar.clone(),
            spl_token_program.clone(),
        ],
        signers,
    )?;

    // 7. Создаем Master Edition
    msg!("Creating master edition...");
    invoke_signed(
        &instructions::CreateMasterEditionV3 {
            edition: *master_edition_account.key,
            mint: *mint_account.key,
            update_authority: *program_authority.key,
            mint_authority: *program_authority.key,
            payer: *payer.key,
            metadata: *metadata_account.key,
            token_program: *token_program.key,
            system_program: *system_program.key,
            rent: None,
        }.instruction(instructions::CreateMasterEditionV3InstructionArgs {
            max_supply: Some(0),
        }),
        &[
            master_edition_account.clone(),
            metadata_account.clone(),
            mint_account.clone(),
            program_authority.clone(),
            payer.clone(),
            metadata_program.clone(),
            token_program.clone(),
            system_program.clone(),
            rent_sysvar.clone(),
            spl_token_program.clone(),
        ],
        signers,
    )?;

    msg!("Mint, metadata and master edition created successfully!");
    Ok(())
}


fn create_clean_nft_and_mint(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
) -> ProgramResult {
    msg!("Starting create_clean_nft...");
    let account_info_iter = &mut accounts.iter();
    
    // Получаем все необходимые аккаунты
    let metadata_account = next_account_info(account_info_iter)?;
    let master_edition_account = next_account_info(account_info_iter)?;
    let mint_account = next_account_info(account_info_iter)?;
    let program_authority = next_account_info(account_info_iter)?;
    let payer = next_account_info(account_info_iter)?;
    let update_authority = next_account_info(account_info_iter)?;
    let system_program = next_account_info(account_info_iter)?;
    let sysvar_instructions = next_account_info(account_info_iter)?;
    let spl_token_program = next_account_info(account_info_iter)?;
    let metadata_program = next_account_info(account_info_iter)?;

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

    // Создаем CreateV1 инструкцию
    let create_v1 = CreateV1 {
        metadata: *metadata_account.key,
        master_edition: Some(*master_edition_account.key),
        mint: (*mint_account.key, true),
        authority: *program_authority.key,
        payer: *payer.key,
        update_authority: (*program_authority.key, true),
        system_program: *system_program.key,
        sysvar_instructions: *sysvar_instructions.key,
        spl_token_program: Some(*spl_token_program.key),
    };

    let args = CreateV1InstructionArgs {
        name: "NFT".to_string(),
        symbol: "NFT".to_string(),
        uri: "".to_string(),
        seller_fee_basis_points: 700,
        creators: None,
        primary_sale_happened: false,
        is_mutable: true,
        token_standard: TokenStandard::ProgrammableNonFungible,
        collection: None,
        uses: None,
        collection_details: None,
        rule_set: None,
        decimals: Some(0),
        print_supply: Some(PrintSupply::Zero),
    };

    // Создаем seeds для подписи
    let authority_signature_seeds = &[
        b"mint_authority".as_ref(),
        &[bump_seed],
    ];
    let signers = &[&authority_signature_seeds[..]];

    // Вызываем CreateV1 инструкцию
    invoke_signed(
        &create_v1.instruction(args),
        &[
            metadata_account.clone(),
            master_edition_account.clone(),
            mint_account.clone(),
            program_authority.clone(),
            payer.clone(),
            program_authority.clone(), // update_authority
            system_program.clone(),
            sysvar_instructions.clone(),
            spl_token_program.clone(),
            metadata_program.clone(),
        ],
        signers,
    )?;

    msg!("Clean NFT created successfully!");
    Ok(())
}

fn create_clean_nft_and_ata(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
) -> ProgramResult {
    msg!("Starting create_clean_nft...");
    let account_info_iter = &mut accounts.iter();
    
    // Получаем все необходимые аккаунты
    let metadata_account = next_account_info(account_info_iter)?;
    let master_edition_account = next_account_info(account_info_iter)?;
    let mint_account = next_account_info(account_info_iter)?;
    let program_authority = next_account_info(account_info_iter)?;
    let payer = next_account_info(account_info_iter)?;
    let update_authority = next_account_info(account_info_iter)?;
    let system_program = next_account_info(account_info_iter)?;
    let sysvar_instructions = next_account_info(account_info_iter)?;
    let spl_token_program = next_account_info(account_info_iter)?;
    let metadata_program = next_account_info(account_info_iter)?;

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

    // Создаем CreateV1 инструкцию
    let create_v1 = CreateV1 {
        metadata: *metadata_account.key,
        master_edition: Some(*master_edition_account.key),
        mint: (*mint_account.key, true),
        authority: *program_authority.key,
        payer: *payer.key,
        update_authority: (*program_authority.key, true),
        system_program: *system_program.key,
        sysvar_instructions: *sysvar_instructions.key,
        spl_token_program: Some(*spl_token_program.key),
    };

    let args = CreateV1InstructionArgs {
        name: "NFT".to_string(),
        symbol: "NFT".to_string(),
        uri: "".to_string(),
        seller_fee_basis_points: 700,
        creators: None,
        primary_sale_happened: false,
        is_mutable: true,
        token_standard: TokenStandard::ProgrammableNonFungible,
        collection: None,
        uses: None,
        collection_details: None,
        rule_set: None,
        decimals: Some(0),
        print_supply: Some(PrintSupply::Zero),
    };

    // Создаем seeds для подписи
    let authority_signature_seeds = &[
        b"mint_authority".as_ref(),
        &[bump_seed],
    ];
    let signers = &[&authority_signature_seeds[..]];

    // Вызываем CreateV1 инструкцию
    invoke_signed(
        &create_v1.instruction(args),
        &[
            metadata_account.clone(),
            master_edition_account.clone(),
            mint_account.clone(),
            program_authority.clone(),
            payer.clone(),
            program_authority.clone(), // update_authority
            system_program.clone(),
            sysvar_instructions.clone(),
            spl_token_program.clone(),
            metadata_program.clone(),
        ],
        signers,
    )?;

    msg!("Clean NFT created successfully!");
    Ok(())
}

// Функция для создания NFT с проверкой Merkle proof и чистыми метаданными
fn create_nft_with_merkle_proof_and_clean_metadata(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    proof_data: &[u8],
) -> ProgramResult {
    msg!("Starting create_nft_with_merkle_proof_and_clean_metadata...");
    
    // Получаем все необходимые аккаунты
    let account_info_iter = &mut accounts.iter();
    let metadata_account = next_account_info(account_info_iter)?;
    let master_edition_account = next_account_info(account_info_iter)?;
    let mint_account = next_account_info(account_info_iter)?;
    let mint_authority = next_account_info(account_info_iter)?;
    let payer = next_account_info(account_info_iter)?;
    let update_authority = next_account_info(account_info_iter)?;
    let system_program = next_account_info(account_info_iter)?;
    let sysvar_instructions = next_account_info(account_info_iter)?;
    let spl_token_program = next_account_info(account_info_iter)?;
    let metadata_program = next_account_info(account_info_iter)?;
    let associated_token_account = next_account_info(account_info_iter)?;
    let associated_token_program = next_account_info(account_info_iter)?;
    let rent_sysvar = next_account_info(account_info_iter)?;
    let mint_record_account = next_account_info(account_info_iter)?;

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
    if mint_authority.key != &expected_authority {
        msg!("Invalid program authority provided");
        return Err(ProgramError::InvalidArgument);
    }

    // Проверяем данные доказательства
    if proof_data.is_empty() {
        msg!("Invalid proof data: missing round number");
        return Err(ProgramError::InvalidInstructionData);
    }

    // Получаем номер раунда и проверяем его
    let round_number = proof_data[0] as usize;
    let merkle_root = validate_round_and_get_root(round_number)?;

    // Проверяем Merkle proof
    let mut proof = Vec::new();
    for i in 0..((proof_data.len() - 1) / 32) {
        let mut node = [0u8; 32];
        node.copy_from_slice(&proof_data[1 + i * 32..1 + (i + 1) * 32]);
        proof.push(node);
    }
    
    let leaf = hash(payer.key.as_ref()).to_bytes();
    if !verify_merkle_proof(leaf, &proof, merkle_root) {
        msg!("Invalid Merkle proof for address: {} in round {}", payer.key, round_number);
        return Err(ProgramError::InvalidArgument);
    }

    // Проверяем и получаем PDA для отслеживания минтинга
    let (_, mint_record_bump) = Pubkey::find_program_address(
        &[
            b"is_minted_ext",
            &[round_number as u8],
            payer.key.as_ref(),
        ],
        program_id
    );

    // Создаем и инициализируем mint аккаунт
    create_and_init_mint_account(
        payer,
        mint_account,
        mint_authority,
        system_program,
        rent_sysvar
    )?;

    // Создаем ассоциированный токен аккаунт
    create_associated_token_account(
        payer,
        associated_token_account,
        mint_account,
        system_program,
        spl_token_program,
        associated_token_program,
        rent_sysvar
    )?;

    // Минтим токен
    mint_token(
        mint_account,
        associated_token_account,
        mint_authority,
        bump_seed
    )?;

    // Создаем PDA для отслеживания минтинга
    msg!("Creating extended mint record PDA...");
    let mint_record_size = 32;
    let mint_record_lamports = Rent::get()?.minimum_balance(mint_record_size);
    
    let mint_record_signature_seeds = &[
        b"is_minted_ext".as_ref(),
        &[round_number as u8],
        payer.key.as_ref(),
        &[mint_record_bump],
    ];
    let mint_record_signers = &[&mint_record_signature_seeds[..]];
    
    invoke_signed(
        &system_instruction::create_account(
            &payer.key,
            mint_record_account.key,
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
    
    let mut data = mint_record_account.try_borrow_mut_data()?;
    data[0..32].copy_from_slice(&mint_account.key.to_bytes());

    // Создаем CreateV1 инструкцию для метаданных
    let create_v1 = CreateV1 {
        metadata: *metadata_account.key,
        master_edition: Some(*master_edition_account.key),
        mint: (*mint_account.key, true),
        authority: *mint_authority.key,
        payer: *payer.key,
        update_authority: (*update_authority.key, true),
        system_program: *system_program.key,
        sysvar_instructions: *sysvar_instructions.key,
        spl_token_program: Some(*spl_token_program.key),
    };

    let args = CreateV1InstructionArgs {
        name: "NFT".to_string(),
        symbol: "NFT".to_string(),
        uri: "".to_string(),
        seller_fee_basis_points: 700,
        creators: None,
        primary_sale_happened: false,
        is_mutable: true,
        token_standard: TokenStandard::ProgrammableNonFungible,
        collection: None,
        uses: None,
        collection_details: None,
        rule_set: None,
        decimals: Some(0),
        print_supply: Some(PrintSupply::Zero),
    };

    // Создаем seeds для подписи
    let authority_signature_seeds = &[
        b"mint_authority".as_ref(),
        &[bump_seed],
    ];
    let signers = &[&authority_signature_seeds[..]];

    // Вызываем CreateV1 инструкцию
    invoke_signed(
        &create_v1.instruction(args),
        &[
            metadata_account.clone(),
            master_edition_account.clone(),
            mint_account.clone(),
            mint_authority.clone(),
            payer.clone(),
            update_authority.clone(),
            system_program.clone(),
            sysvar_instructions.clone(),
            spl_token_program.clone(),
            metadata_program.clone(),
        ],
        signers,
    )?;

    msg!("NFT with Merkle proof verification and clean metadata created successfully!");
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

// Вспомогательная функция для проверки номера раунда и получения корня Merkle дерева
fn validate_round_and_get_root(round_number: usize) -> Result<[u8; 32], ProgramError> {
    msg!("Validating round number: {}", round_number);
    
    if round_number >= ALL_MERKLE_ROOTS.len() {
        msg!("Invalid round number: {}, max is {}", round_number, ALL_MERKLE_ROOTS.len() - 1);
        return Err(ProgramError::InvalidArgument);
    }
    
    Ok(ALL_MERKLE_ROOTS[round_number])
}

// Вспомогательная функция для создания и инициализации mint аккаунта
fn create_and_init_mint_account<'a>(
    payer: &AccountInfo<'a>,
    mint_account: &AccountInfo<'a>,
    program_authority: &AccountInfo<'a>,
    system_program: &AccountInfo<'a>,
    rent_sysvar: &AccountInfo<'a>,
) -> ProgramResult {
    msg!("Creating and initializing mint account...");
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

    invoke(
        &spl_token::instruction::initialize_mint(
            &spl_token::id(),
            &mint_account.key,
            &program_authority.key,
            Some(&program_authority.key),
            0,
        )?,
        &[
            mint_account.clone(),
            rent_sysvar.clone(),
        ],
    )?;

    Ok(())
}

// Вспомогательная функция для создания ассоциированного токен аккаунта
fn create_associated_token_account<'a>(
    payer: &AccountInfo<'a>,
    associated_token_account: &AccountInfo<'a>,
    mint_account: &AccountInfo<'a>,
    system_program: &AccountInfo<'a>,
    token_program: &AccountInfo<'a>,
    associated_token_program: &AccountInfo<'a>,
    rent_sysvar: &AccountInfo<'a>,
) -> ProgramResult {
    msg!("Creating associated token account...");
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
    )
}

// Вспомогательная функция для минтинга токена
fn mint_token<'a>(
    mint_account: &AccountInfo<'a>,
    associated_token_account: &AccountInfo<'a>,
    program_authority: &AccountInfo<'a>,
    authority_bump: u8,
) -> ProgramResult {
    msg!("Minting token...");
    let authority_signature_seeds = &[
        b"mint_authority".as_ref(),
        &[authority_bump],
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
    )
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
