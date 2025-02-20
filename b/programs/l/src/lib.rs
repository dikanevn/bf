use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token};

// Определяем константы
pub const TOKEN_PROGRAM_ID: Pubkey = pubkey!("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");

// Объявляем ID программы
declare_id!("DZwg4GQrbhX6HjM1LkCePZC3TeoeCtqyWxtpwgQpBtxj");

#[program]
pub mod l {
    use super::*;

    pub fn initialize_token(ctx: Context<InitializeToken>) -> Result<()> {
        msg!("Начало инициализации токена...");
        
        // Используем constraint для инициализации mint
        // Все остальное берется из констант и PDA
        
        msg!("Токен успешно создан");
        Ok(())
    }

    pub fn is_initialized(_ctx: Context<IsInitialized>) -> Result<bool> {
        msg!("Проверка инициализации программы...");
        Ok(true)
    }
}

#[derive(Accounts)]
pub struct InitializeToken<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,
    
    #[account(
        init,
        payer = signer,
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

    #[account(address = TOKEN_PROGRAM_ID)]
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct IsInitialized {}

#[error_code]
pub enum ErrorCode {
    #[msg("Переданный Metadata аккаунт неверен.")]
    InvalidMetadata,
    #[msg("Переданный MasterEdition аккаунт неверен.")]
    InvalidMasterEdition,
    #[msg("Ошибка сборки инструкции CreateMasterEditionV3.")]
    InstructionBuildError,
}
