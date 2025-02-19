use anchor_lang::prelude::*;
use anchor_spl::token::{self, MintTo, Token};
use anchor_spl::associated_token::AssociatedToken;
use anchor_lang::solana_program::pubkey::Pubkey;

declare_id!("2BESDrxqXxBWYwhiuzC4SgsoCmqoMiiEGwZ1en6gT4Se");

// Константный адрес коллекции
pub const COLLECTION_ADDRESS: Pubkey = pubkey!("BUCGjsHibc1ZXYao4KVdjrTW5r3rDFCGCbeZTk3ttiu2");

#[program]
pub mod l {
    use super::*;
    
    /// Инструкция для чеканки NFT, привязанного к фиксированной коллекции.
    pub fn mint_nft_to_collection(ctx: Context<MintNftToCollection>) -> Result<()> {
        msg!("Начало инструкции mint_nft_to_collection");

        // Чеканим 1 NFT (mint токен)
        let cpi_accounts = MintTo {
            mint: ctx.accounts.mint.to_account_info(),
            to: ctx.accounts.token_account.to_account_info(),
            authority: ctx.accounts.mint_authority.to_account_info(),
        };

        // Получаем bump PDA "mint_authority"
        let authority_bump = *ctx.bumps.get("mint_authority").unwrap();
        let authority_seeds: &[&[u8]] = &[b"mint_authority", &[authority_bump]];
        let signer = &[authority_seeds];

        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            cpi_accounts,
            signer,
        );
        token::mint_to(cpi_ctx, 1)?;
        msg!("Чеканка NFT выполнена успешно");

        // Здесь можно вызвать CPI к программе Token Metadata для создания метаданных NFT,
        // где необходимо задать uri, имя, символ, роялти и привязать NFT к коллекции COLLECTION_ADDRESS.
        msg!("Создание метаданных NFT с коллекцией: {}", COLLECTION_ADDRESS);
        // TODO: Реализовать CPI вызов (например, create_metadata_accounts_v3) в mpl-token-metadata

        Ok(())
    }
}

#[derive(Accounts)]
pub struct MintNftToCollection<'info> {
    /// Владелец (плательщик) транзакции.
    #[account(mut, signer)]
    pub authority: AccountInfo<'info>,

    /// Новый mint NFT, который создаётся в рамках инструкции.
    #[account(
        init,
        payer = authority,
        mint::decimals = 0,
        mint::authority = mint_authority,
        mint::freeze_authority = mint_authority
    )]
    pub mint: Account<'info, anchor_spl::token::Mint>,

    /// Ассоциированный токен-аккаунт владельца, вычисляемый автоматически.
    #[account(
        init_if_needed,
        payer = authority,
        associated_token::mint = mint,
        associated_token::authority = authority
    )]
    pub token_account: Box<Account<'info, anchor_spl::token::TokenAccount>>,

    /// PDA mint_authority, используемая для подписи при чеканке.
    #[account(
        seeds = [b"mint_authority"],
        bump,
    )]
    /// CHECK: Этот аккаунт является PDA для подписи
    pub mint_authority: AccountInfo<'info>,

    /// Программа SPL Token.
    pub token_program: Program<'info, Token>,

    /// Программа для ассоциированных токен-аккаунтов.
    pub associated_token_program: Program<'info, AssociatedToken>,

    /// Системная программа.
    pub system_program: Program<'info, System>,

    /// Sysvar rent.
    pub rent: Sysvar<'info, Rent>,

    // Дополнительные аккаунты для работы с CPI к Token Metadata
    /// CHECK: Аккаунт метаданных NFT (PDA, вычисленный вне программы)
    #[account(mut)]
    pub metadata: AccountInfo<'info>,

    /// CHECK: Программа Token Metadata.
    pub token_metadata_program: AccountInfo<'info>,
}
