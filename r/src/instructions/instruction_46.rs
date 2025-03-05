// pNFT с проверками Merkle и фиксированной коллекцией (стандартный SPL Token)

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
use mpl_token_metadata::{
    instructions::{CreateV1, CreateV1InstructionArgs, MintV1, MintV1InstructionArgs},
    types::{TokenStandard, PrintSupply, Collection},
};
use spl_token::ID as TOKEN_PROGRAM_ID;

use crate::ALL_MERKLE_ROOTS;

// Фиксированный адрес коллекции
const COLLECTION_MINT: &str = "YAP8v1Y4aKiM6HEtpCDabXz7VgH9SXxUgTBHbWaN7hg";

pub fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction_data: &[u8],
) -> ProgramResult {
    msg!("Starting create_and_mint_pnft_with_standard_token_merkle_proof_and_fixed_collection...");
    
    // Проверяем, что данные имеют правильный формат
    if instruction_data.len() < 10 { // 8 байт для раунда + 2 байта для NFTnumber
        msg!("Invalid proof data: missing round number or NFTnumber");
        return Err(ProgramError::InvalidInstructionData);
    }
    
    // Получаем номер раунда из первого байта
    let round_number = instruction_data[0] as u64;
    msg!("Using round number: {}", round_number);
    
    // Получаем NFTnumber из следующих 2 байт (uint16)
    let nft_number = u16::from_le_bytes([instruction_data[1], instruction_data[2]]);
    msg!("Using NFTnumber: {}", nft_number);
    
    // Проверяем, что номер раунда валидный
    if (round_number as usize) >= ALL_MERKLE_ROOTS.len() {
        msg!("Invalid round number: {}, max is {}", round_number, ALL_MERKLE_ROOTS.len() - 1);
        return Err(ProgramError::InvalidArgument);
    }
    
    // Получаем корень Merkle для указанного раунда
    let merkle_root = ALL_MERKLE_ROOTS[round_number as usize];
    msg!("Using Merkle root for round {}", round_number);
    
    let accounts_iter = &mut accounts.iter();
    
    // Получаем все необходимые аккаунты
    let metadata_account = next_account_info(accounts_iter)?;
    let master_edition_account = next_account_info(accounts_iter)?;
    let mint_account = next_account_info(accounts_iter)?;
    let program_authority = next_account_info(accounts_iter)?;
    let payer = next_account_info(accounts_iter)?;
    let system_program = next_account_info(accounts_iter)?;
    let sysvar_instructions = next_account_info(accounts_iter)?;
    let token_program = next_account_info(accounts_iter)?;
    let token_owner = next_account_info(accounts_iter)?;
    let token_account = next_account_info(accounts_iter)?;
    let token_record = next_account_info(accounts_iter)?;
    let spl_ata_program = next_account_info(accounts_iter)?;
    let token_metadata_program = next_account_info(accounts_iter)?;
    let rent_sysvar = next_account_info(accounts_iter)?;
    let mint_record_account = next_account_info(accounts_iter)?;
    let collection_mint = next_account_info(accounts_iter)?;
    let collection_metadata = next_account_info(accounts_iter)?;
    let collection_master_edition = next_account_info(accounts_iter)?;
    let collection_authority_record = next_account_info(accounts_iter)?;
    
    // Проверяем подписи
    if !mint_account.is_signer {
        msg!("Mint account must be a signer");
        return Err(ProgramError::MissingRequiredSignature);
    }
    if !payer.is_signer {
        msg!("Payer must be a signer");
        return Err(ProgramError::MissingRequiredSignature);
    }

    // Проверяем, что token_program имеет правильный ID
    if token_program.key != &TOKEN_PROGRAM_ID {
        msg!("Invalid Token program ID provided");
        msg!("Expected: {}", TOKEN_PROGRAM_ID);
        msg!("Received: {}", token_program.key);
        return Err(ProgramError::InvalidArgument);
    }

    // Проверяем, что collection_mint имеет правильный адрес
    let expected_collection_mint = match Pubkey::try_from(COLLECTION_MINT) {
        Ok(pubkey) => pubkey,
        Err(_) => {
            msg!("Failed to parse collection mint address");
            return Err(ProgramError::InvalidArgument);
        }
    };
    
    if collection_mint.key != &expected_collection_mint {
        msg!("Invalid collection mint address provided");
        msg!("Expected: {}", expected_collection_mint);
        msg!("Received: {}", collection_mint.key);
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

    // Проверяем Merkle proof
    msg!("Verifying Merkle proof...");
    
    // Проверяем, что данные доказательства имеют правильный формат
    if (instruction_data.len() - 3) % 32 != 0 { // 3 байта для раунда и NFTnumber
        msg!("Invalid proof data length");
        return Err(ProgramError::InvalidInstructionData);
    }
    
    // Преобразуем данные доказательства в вектор 32-байтных массивов
    let mut proof = Vec::new();
    for i in 0..((instruction_data.len() - 3) / 32) {
        let mut node = [0u8; 32];
        node.copy_from_slice(&instruction_data[3 + i * 32..3 + (i + 1) * 32]);
        proof.push(node);
    }
    
    // Создаем буфер для NFTnumber (2 байта)
    let mut nft_number_bytes = [0u8; 2];
    nft_number_bytes.copy_from_slice(&[instruction_data[1], instruction_data[2]]);
    
    // Вычисляем хеш (лист) для адреса плательщика с учетом NFTnumber
    let mut combined_data = Vec::with_capacity(34); // 32 байта для адреса + 2 байта для NFTnumber
    combined_data.extend_from_slice(payer.key.as_ref());
    combined_data.extend_from_slice(&nft_number_bytes);
    
    let leaf = hash(&combined_data).to_bytes();
    
    // Проверяем доказательство
    if !verify_merkle_proof(leaf, &proof, merkle_root) {
        msg!("Invalid Merkle proof for address: {} with NFTnumber: {} in round {}", 
             payer.key, nft_number, round_number);
        return Err(ProgramError::InvalidArgument);
    }
    
    msg!("Merkle proof verified successfully for round {} with NFTnumber {}!", round_number, nft_number);

    // Проверяем PDA для отслеживания минтинга
    let (expected_mint_record_address, mint_record_bump) = Pubkey::find_program_address(
        &[
            b"minted",
            &round_number.to_le_bytes(),
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

    // Проверяем, что collection_metadata и collection_master_edition соответствуют collection_mint
    let (expected_collection_metadata, _) = Pubkey::find_program_address(
        &[
            b"metadata",
            token_metadata_program.key.as_ref(),
            collection_mint.key.as_ref(),
        ],
        token_metadata_program.key
    );
    
    if collection_metadata.key != &expected_collection_metadata {
        msg!("Invalid collection metadata address");
        msg!("Expected: {}", expected_collection_metadata);
        msg!("Received: {}", collection_metadata.key);
        return Err(ProgramError::InvalidArgument);
    }
    
    let (expected_collection_master_edition, _) = Pubkey::find_program_address(
        &[
            b"metadata",
            token_metadata_program.key.as_ref(),
            collection_mint.key.as_ref(),
            b"edition",
        ],
        token_metadata_program.key
    );
    
    if collection_master_edition.key != &expected_collection_master_edition {
        msg!("Invalid collection master edition address");
        msg!("Expected: {}", expected_collection_master_edition);
        msg!("Received: {}", collection_master_edition.key);
        return Err(ProgramError::InvalidArgument);
    }

    // Создаем authority seeds для подписи
    let authority_signature_seeds = &[
        b"mint_authority".as_ref(),
        &[bump_seed],
    ];
    let signers = &[&authority_signature_seeds[..]];

    // Создаем минт аккаунт с использованием стандартного SPL Token
    msg!("Creating mint account with standard SPL Token...");
    let rent = Rent::get()?;
    let mint_len = 82; // Размер аккаунта Mint в байтах
    let lamports = rent.minimum_balance(mint_len);

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

    // Инициализируем минт с использованием стандартного SPL Token
    msg!("Initializing mint with standard SPL Token...");
    let init_mint_ix = spl_token::instruction::initialize_mint(
        &TOKEN_PROGRAM_ID,
        &mint_account.key,
        &program_authority.key,
        Some(&program_authority.key),
        0,
    )?;
    
    invoke(
        &init_mint_ix,
        &[
            mint_account.clone(),
            rent_sysvar.clone(),
        ],
    )?;

    // Создаем метаданные и master edition с указанием коллекции
    msg!("Creating metadata and master edition with collection...");
    let create_v1 = CreateV1 {
        metadata: *metadata_account.key,
        master_edition: Some(*master_edition_account.key),
        mint: (*mint_account.key, true),
        authority: *program_authority.key,
        payer: *payer.key,
        update_authority: (*program_authority.key, true),
        system_program: *system_program.key,
        sysvar_instructions: *sysvar_instructions.key,
        spl_token_program: Some(*token_program.key), // Используем стандартный SPL Token
    };

    // Создаем структуру Collection для указания коллекции
    let collection = Collection {
        verified: false, // Будет верифицировано позже
        key: *collection_mint.key,
    };

    let create_args = CreateV1InstructionArgs {
        name: format!("Yapster Dimensions #{}", nft_number),
        symbol: format!("YAPI{}", nft_number),
        uri: "https://a.b/c.json".to_string(),
        seller_fee_basis_points: 1000,
        creators: Some(vec![
            mpl_token_metadata::types::Creator {
                address: *program_authority.key,
                verified: true,
                share: 100,
            }
        ]),
        primary_sale_happened: false,
        is_mutable: true,
        token_standard: TokenStandard::ProgrammableNonFungible,
        collection: Some(collection),
        uses: None,
        collection_details: None,
        rule_set: None,
        decimals: Some(0),
        print_supply: Some(PrintSupply::Zero),
    };

    invoke_signed(
        &create_v1.instruction(create_args),
        &[
            metadata_account.clone(),
            master_edition_account.clone(),
            mint_account.clone(),
            program_authority.clone(),
            payer.clone(),
            program_authority.clone(), // update_authority
            system_program.clone(),
            sysvar_instructions.clone(),
            token_program.clone(),
        ],
        signers,
    )?;

    // Создаем ассоциированный токен аккаунт с использованием стандартного SPL Token
    msg!("Creating associated token account with standard SPL Token...");
    invoke(
        &spl_associated_token_account::instruction::create_associated_token_account_idempotent(
            payer.key,
            token_owner.key,
            mint_account.key,
            &TOKEN_PROGRAM_ID,
        ),
        &[
            payer.clone(),
            token_account.clone(),
            token_owner.clone(),
            mint_account.clone(),
            system_program.clone(),
            token_program.clone(),
            spl_ata_program.clone(),
            rent_sysvar.clone(),
        ],
    )?;

    // Создаем PDA для расширенного отслеживания минтинга
    msg!("Creating extended mint record PDA for standard SPL Token...");
    let mint_record_size = 32;
    let mint_record_lamports = rent.minimum_balance(mint_record_size);
    
    let mint_record_signature_seeds = &[
        b"minted".as_ref(),
        &round_number.to_le_bytes(),
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

    // Минтим токен с использованием стандартного SPL Token
    msg!("Minting token with standard SPL Token...");
    let mint_v1 = MintV1 {
        token: *token_account.key,
        token_owner: Some(*token_owner.key),
        metadata: *metadata_account.key,
        master_edition: Some(*master_edition_account.key),
        token_record: Some(*token_record.key),
        mint: *mint_account.key,
        authority: *program_authority.key,
        payer: *payer.key,
        system_program: *system_program.key,
        sysvar_instructions: *sysvar_instructions.key,
        spl_token_program: *token_program.key, // Используем стандартный SPL Token
        spl_ata_program: *spl_ata_program.key,
        authorization_rules_program: None,
        authorization_rules: None,
        delegate_record: None,
    };

    let mint_args = MintV1InstructionArgs {
        amount: 1,
        authorization_data: None,
    };

    invoke_signed(
        &mint_v1.instruction(mint_args),
        &[
            token_account.clone(),
            token_owner.clone(),
            metadata_account.clone(),
            master_edition_account.clone(),
            token_record.clone(),
            mint_account.clone(),
            program_authority.clone(),
            payer.clone(),
            system_program.clone(),
            sysvar_instructions.clone(),
            token_program.clone(),
            spl_ata_program.clone(),
            token_metadata_program.clone(),
        ],
        signers,
    )?;

    // Верифицируем коллекцию
    msg!("Verifying collection...");
    let verify_collection_ix = mpl_token_metadata::instructions::VerifyCollectionV1 {
        metadata: *metadata_account.key,
        authority: *program_authority.key,
        collection_mint: *collection_mint.key,
        collection_metadata: Some(*collection_metadata.key),
        collection_master_edition: Some(*collection_master_edition.key),
        delegate_record: None,
        system_program: *system_program.key,
        sysvar_instructions: *sysvar_instructions.key,
    };

    invoke_signed(
        &verify_collection_ix.instruction(),
        &[
            metadata_account.clone(),
            program_authority.clone(),
            collection_mint.clone(),
            collection_metadata.clone(),
            collection_master_edition.clone(),
            system_program.clone(),
            sysvar_instructions.clone(),
        ],
        signers,
    )?;

    msg!("pNFT created, minted and added to collection successfully with standard SPL Token and Merkle proof verification!");
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