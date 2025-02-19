use anchor_lang::prelude::*;
use anchor_spl::token::{self, MintTo, Token};
use anchor_spl::associated_token::AssociatedToken;
use anchor_lang::solana_program::hash::hash;

declare_id!("2BESDrxqXxBWYwhiuzC4SgsoCmqoMiiEGwZ1en6gT4Se");

//Computed PDA TOKEN_PROGRAM_ID: "8farn8gh39nC9oRJvB3qcTEZN1krydmrJFn3LBBMWb5S"


// Фиксированный адрес mint токена
pub const FIXED_MINT: Pubkey = pubkey!("91aT1KmqDzdBD6ZvJVFx79wdLv7WsgYQLkqXYv2Gxqpk");

// Корневой хеш меркл-дерева (полученный офф-чейн)
pub const MERKLE_ROOT: [u8; 32] = [
    0xc5, 0xef, 0x3d, 0x34, 0xd4, 0x8c, 0x98, 0x70,
    0x21, 0xb2, 0x87, 0x98, 0xdf, 0xca, 0x2e, 0x98,
    0x8e, 0x77, 0x4f, 0x47, 0x06, 0xcf, 0x35, 0xc0,
    0x0f, 0x5d, 0x3d, 0xce, 0x3b, 0xc2, 0x71, 0x6d,
];




#[program]
pub mod l {
    use super::*;
    
    // Функция mint_one вызывает mint_to через CPI и чеканит 1 токен
    // с использованием зашитых адресов для mint и ассоциированного токен-аккаунта.
    pub fn mint_one(ctx: Context<MintOne>, merkle_proof: Vec<[u8;32]>) -> Result<()> {
        msg!("Запуск инструкции mint_one");
        
        // Вычисляем хеш (листь) для вызывающего аккаунта (authority)
        let leaf = hash(ctx.accounts.authority.key.as_ref()).to_bytes();
        
        // Проверяем, что меркл доказательство корректно (восстанавливает корневой хеш)
        if !verify_merkle_proof(leaf, &merkle_proof, MERKLE_ROOT) {
            return Err(ErrorCode::InvalidMerkleProof.into());
        }

        msg!("Mint аккаунт: {:?}", ctx.accounts.mint.key());
        msg!("Token аккаунт: {:?}", ctx.accounts.token_account.key());
        msg!("PDA mint_authority: {:?}", ctx.accounts.mint_authority.key());
        
        // Используем PDA минт-авторитета вместо аккаунта вызывающего для подписания CPI.
        let cpi_accounts = MintTo {
            mint: ctx.accounts.mint.to_account_info(),
            to: ctx.accounts.token_account.to_account_info(),
            authority: ctx.accounts.mint_authority.to_account_info(),
        };

        let cpi_program = ctx.accounts.token_program.to_account_info();
        // Приводим фиксированный массив с bump к срезу типа &[&[u8]]
        let authority_bump = ctx.bumps.mint_authority;
        let authority_seeds: &[&[u8]] = &[b"mint_authority", &[authority_bump][..]];
        let signer: &[&[&[u8]]] = &[authority_seeds];
        let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer);
        msg!("Перед вызовом token::mint_to");

        // Чеканим 1 токен
        msg!("Перед вызовом mint_to");
        token::mint_to(cpi_ctx, 1)?;
        msg!("Чеканка 1 токена выполнена успешно");

        Ok(())
    }
}

#[derive(Accounts)]
pub struct MintOne<'info> {
    /// Плательщик за создание ассоциированного токен-аккаунта (и владелец).
    #[account(mut, signer)]
    pub authority: Signer<'info>,

    /// Аккаунт mint, фиксированный константой.
    #[account(mut, address = FIXED_MINT)]
    pub mint: Account<'info, anchor_spl::token::Mint>,

    /// Ассоциированный токен-аккаунт владельца, вычисляемый автоматически.
    #[account(
        init_if_needed,
        payer = authority,
        associated_token::mint = mint,
        associated_token::authority = authority
    )]
    pub token_account: Box<Account<'info, anchor_spl::token::TokenAccount>>,

    // Токен-программа.
    pub token_program: Program<'info, Token>,
    // Программа для ассоциированных токен-аккаунтов.
    pub associated_token_program: Program<'info, anchor_spl::associated_token::AssociatedToken>,
    // Системная программа.
    pub system_program: Program<'info, System>,
    // Системная переменная rent.
    pub rent: Sysvar<'info, Rent>,

    // mint_authority (PDA), используемый для чеканки токенов.
    #[account(
        seeds = [b"mint_authority"],
        bump,
    )]
    /// CHECK: Этот аккаунт является PDA mint authority.
    pub mint_authority: AccountInfo<'info>,
}

#[error_code]
pub enum ErrorCode {
    #[msg("Неверный ассоциированный токен-аккаунт для данного владельца")]
    InvalidTokenAccount,
    #[msg("Неверное меркл доказательство")]
    InvalidMerkleProof,
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