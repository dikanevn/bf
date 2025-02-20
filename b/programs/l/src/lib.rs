extern crate mpl_token_metadata;
use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token};
use anchor_spl::associated_token::AssociatedToken;
//  Импорт CPI‑билдера для создания мастер-эдишн (mpl-token-metadata v5.1.0)
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

    pub fn initialize_token(_ctx: Context<InitializeToken>) -> Result<()> {
        msg!("Начало инициализации токена...");
        msg!("Токен успешно создан");
        Ok(())
    }

    // Добавляем простую функцию проверки
    pub fn is_initialized(_ctx: Context<IsInitialized>) -> Result<bool> {
        msg!("Проверка инициализации программы...");
        // Программа уже инициализирована, если мы можем вызвать эту функцию
        Ok(true)
    }
}

#[derive(Accounts)]
pub struct InitializeToken<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    
    #[account(
        init,
        payer = payer,
        mint::decimals = 0,
        mint::authority = authority,
        mint::freeze_authority = authority,
    )]
    pub mint: Account<'info, Mint>,

    /// CHECK: PDA как authority
    #[account(
        seeds = [b"token_authority"],
        bump,
    )]
    pub authority: AccountInfo<'info>,

    #[account(address = MY_SYSTEM_PROGRAM)]
    pub system_program: Program<'info, System>,
    
    #[account(address = MY_TOKEN_PROGRAM)]
    pub token_program: Program<'info, Token>,
    
    pub rent: Sysvar<'info, Rent>,
}

// Добавляем структуру для новой инструкции
#[derive(Accounts)]
pub struct IsInitialized {
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
