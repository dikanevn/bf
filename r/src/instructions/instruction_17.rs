// с нуля обычный NFT с проверками НЕ 2022

use solana_program::{
    account_info::{next_account_info, AccountInfo},
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
    state::{Account, Mint},
    instruction::{initialize_mint, mint_to},
    ID as TOKEN_PROGRAM_ID,
    state::Account as TokenAccount,
};
use mpl_token_metadata::{
    instructions::{CreateV1, CreateV1InstructionArgs},
    types::{TokenStandard, PrintSupply},
};

use crate::ALL_MERKLE_ROOTS;

pub fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction_data: &[u8],
) -> ProgramResult {
    msg!("Starting create_mint_token_with_merkle_proof_tracked_extended_and_metadata...");
    
    // Сначала создаем минт и токен с расширенным отслеживанием
    let mint_token_accounts = &accounts[0..9]; // Первые 9 аккаунтов для создания минта и токена
    create_mint_and_token_with_round_merkle_proof_tracked_extended(program_id, mint_token_accounts, instruction_data)?;
    
    // Затем создаем метаданные и Master Edition
    // Получаем необходимые аккаунты
    let metadata_account = &accounts[9];
    let master_edition_account = &accounts[10];
    let mint_account = &accounts[0]; // Тот же mint_account, что и в первой части
    let program_authority = &accounts[7]; // program_authority вместо payer
    let payer = &accounts[2]; // payer из первой части
    let system_program = &accounts[3]; // system_program из первой части
    let sysvar_instructions = &accounts[12];
    let spl_token_program = &accounts[4]; // spl_token_program из первой части
    let metadata_program = &accounts[11];

    msg!("Creating metadata and master edition for the minted token...");

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

    msg!("Mint, token with Merkle proof verification, extended tracking, metadata and master edition created successfully!");
    Ok(())
}

// Вспомогательная функция для создания минта и токена
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

    msg!("Creating mint account...");
    // 1. Создаем минт аккаунт
    let rent = Rent::get()?;
    let mint_len = 82; // Размер аккаунта Mint в байтах
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
            token_program.clone(),
        ],
        signers,
    )?;

    msg!("Creating extended mint record PDA...");
    // 5. Создаем PDA для расширенного отслеживания минтинга
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

    msg!("All operations completed successfully!");
    Ok(())
}

// Вспомогательная функция для проверки меркл доказательства
fn verify_merkle_proof(leaf: [u8;32], proof: &Vec<[u8;32]>, root: [u8;32]) -> bool {
    let mut computed = leaf;
    for node in proof.iter() {
        let (min, max) = if computed <= *node { (computed, *node) } else { (*node, computed) };
        let mut bytes = [0u8;64];
        bytes[..32].copy_from_slice(&min);
        bytes[32..].copy_from_slice(&max);
        computed = hash(&bytes).to_bytes();
    }
    computed == root
} 