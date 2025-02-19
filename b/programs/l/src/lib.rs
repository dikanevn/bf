extern crate mpl_token_metadata;
use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount, MintTo};
use anchor_spl::associated_token::AssociatedToken;
// Импорт CPI‑билдера для создания мастер-эдишн (mpl-token-metadata v5.1.0)
// use mpl_token_metadata::instructions::create_master_edition_v3;

// Определяем константы с жёстко заданными адресами.
pub const MY_SYSTEM_PROGRAM: Pubkey = pubkey!("11111111111111111111111111111111");
pub const MY_TOKEN_PROGRAM: Pubkey = pubkey!("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");

// Жёстко заданный адрес Metaplex Token Metadata программы
pub const METADATA_PROGRAM_ID: Pubkey = pubkey!("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s");

// Объявляем идентификатор программы
declare_id!("DZwg4GQrbhX6HjM1LkCePZC3TeoeCtqyWxtpwgQpBtxj");

#[program]
pub mod l {
    use super::*;

    // Инструкция для создания нового SPL токена
    pub fn create_token(ctx: Context<CreateToken>) -> Result<()> {
        msg!("SPL токен с decimals 0 создан, выполняется mint_to...");

        // Чеканим 1 токен в ATA
        let cpi_accounts = MintTo {
            mint: ctx.accounts.mint.to_account_info(),
            to: ctx.accounts.ata.to_account_info(),
            authority: ctx.accounts.authority.to_account_info(),
        };
        let cpi_ctx = CpiContext::new(ctx.accounts.token_program.to_account_info(), cpi_accounts);
        anchor_spl::token::mint_to(cpi_ctx, 1)?;

        msg!("Проверяем PDA для Metadata и MasterEdition...");
        // Сохраняем ключ mint в переменную, чтобы он жил достаточно долго
        let mint_key = ctx.accounts.mint.key();
        
        // Вычисляем PDA для metadata: seeds = [ "metadata", METADATA_PROGRAM_ID, mint ]
        let metadata_seeds = &[
            b"metadata",
            METADATA_PROGRAM_ID.as_ref(),
            mint_key.as_ref(),
        ];
        let (expected_metadata, _meta_bump) =
            Pubkey::find_program_address(metadata_seeds, &METADATA_PROGRAM_ID);
        if ctx.accounts.metadata.key() != expected_metadata {
            return Err(ErrorCode::InvalidMetadata.into());
        }

        // Вычисляем PDA для master edition: seeds = [ "metadata", METADATA_PROGRAM_ID, mint, "edition" ]
        let edition_seeds = &[
            b"metadata",
            METADATA_PROGRAM_ID.as_ref(),
            mint_key.as_ref(),
            b"edition",
        ];
        let (expected_master_edition, _edition_bump) =
            Pubkey::find_program_address(edition_seeds, &METADATA_PROGRAM_ID);
        if ctx.accounts.master_edition.key() != expected_master_edition {
            return Err(ErrorCode::InvalidMasterEdition.into());
        }

        msg!("Выполняем CPI вызов CreateMasterEditionV3...");
        // Создаем инструкцию для create_master_edition_v3 вручную
        let mut data = vec![17]; // 17 - это ID инструкции create_master_edition_v3
        data.extend_from_slice(&0u64.to_le_bytes()); // max_supply = 0 для NFT

        let ix = anchor_lang::solana_program::instruction::Instruction {
            program_id: METADATA_PROGRAM_ID,
            accounts: vec![
                AccountMeta::new(ctx.accounts.master_edition.key(), false),
                AccountMeta::new(ctx.accounts.mint.key(), false),
                AccountMeta::new_readonly(ctx.accounts.authority.key(), true), // update authority
                AccountMeta::new_readonly(ctx.accounts.authority.key(), true), // mint authority
                AccountMeta::new(ctx.accounts.metadata.key(), false),
                AccountMeta::new(ctx.accounts.authority.key(), true), // payer
                AccountMeta::new_readonly(ctx.accounts.system_program.key(), false),
                AccountMeta::new_readonly(ctx.accounts.token_program.key(), false),
                AccountMeta::new_readonly(ctx.accounts.rent.key(), false),
            ],
            data,
        };

        // Собираем список аккаунтов для вызова CPI
        let account_infos: Vec<anchor_lang::solana_program::account_info::AccountInfo> = vec![
            ctx.accounts.master_edition.to_account_info(),
            ctx.accounts.mint.to_account_info(),
            ctx.accounts.authority.to_account_info(), // update authority
            ctx.accounts.authority.to_account_info(), // mint authority
            ctx.accounts.metadata.to_account_info(),
            ctx.accounts.authority.to_account_info(), // payer
            ctx.accounts.system_program.to_account_info(),
            ctx.accounts.token_program.to_account_info(),
            ctx.accounts.rent.to_account_info(),
        ];

        // Выполняем CPI вызов без дополнительных seeds (в данном случае master edition создаётся через CPI)
        anchor_lang::solana_program::program::invoke(&ix, account_infos.as_slice())
            .map_err(|e| anchor_lang::error::Error::from(e))?;

        msg!("MasterEdition успешно создан. Mint и Freeze authority перенесены.");
        Ok(())
    }
}

#[derive(Accounts)]
pub struct CreateToken<'info> {
    /// CHECK: Этот аккаунт является плательщиком транзакции и должен подписывать её.
    #[account(mut, signer)]
    pub authority: AccountInfo<'info>,

    // Новый mint токена, который будет создан
    #[account(
        init, 
        payer = authority, 
        mint::decimals = 0, 
        mint::authority = authority, 
        mint::freeze_authority = authority
    )]
    pub mint: Account<'info, Mint>,

    // Ассоциированный токен-аккаунт для mint и authority.
    #[account(
        init_if_needed,
        payer = authority,
        associated_token::mint = mint,
        associated_token::authority = authority,
    )]
    pub ata: Box<Account<'info, TokenAccount>>,

    // Системная программа: здесь добавлено ограничение, что переданный аккаунт должен совпадать с MY_SYSTEM_PROGRAM.
    #[account(address = MY_SYSTEM_PROGRAM)]
    pub system_program: Program<'info, System>,
    
    // Программа SPL Token: будет проверено, что адрес совпадает с MY_TOKEN_PROGRAM.
    #[account(address = MY_TOKEN_PROGRAM)]
    pub token_program: Program<'info, Token>,

    // Associated Token Program: проверяем, что это именно официальный адрес.
    #[account(address = AssociatedToken::id())]
    pub associated_token_program: Program<'info, AssociatedToken>,

    // Sysvar rent
    pub rent: Sysvar<'info, Rent>,

    /// CHECK: Это PDA для metadata, который мы проверяем в инструкции:
    /// seeds = [ "metadata", METADATA_PROGRAM_ID, mint ]
    #[account(mut)]
    pub metadata: AccountInfo<'info>,

    /// CHECK: Это PDA для master edition, который мы проверяем в инструкции:
    /// seeds = [ "metadata", METADATA_PROGRAM_ID, mint, "edition" ]
    #[account(mut)]
    pub master_edition: AccountInfo<'info>,

    /// CHECK: Проверяем, что передана правильная Token Metadata программа через address constraint
    #[account(address = METADATA_PROGRAM_ID)]
    pub token_metadata_program: AccountInfo<'info>,
}

#[error_code]
pub enum ErrorCode {
    #[msg("Переданный Metadata аккаунт неверен.")]
    InvalidMetadata,
    #[msg("Переданный MasterEdition аккаунт неверен.")]
    InvalidMasterEdition,
    #[msg("Ошибка сборки инструкции CreateMasterEditionV3.")]
    InstructionBuildError,
}
