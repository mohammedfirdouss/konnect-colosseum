use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{self, CloseAccount, Mint, Token, TokenAccount, Transfer};

declare_id!("mbLjS3jLDX74Ptza9EiiG4qcPPE9aPS7EzifCLZc5hJ");

#[program]
pub mod konnect {
    use super::*;

    pub fn init_marketplace(ctx: Context<InitMarketplace>, fee_bps: u16) -> Result<()> {
        require!(fee_bps <= 1_000, MarketplaceError::FeeTooHigh); // max 10%
        let mp = &mut ctx.accounts.marketplace;
        mp.authority = ctx.accounts.authority.key();
        mp.fee_bps = fee_bps;
        mp.bump = ctx.bumps.marketplace;
        Ok(())
    }

    pub fn update_marketplace(
        ctx: Context<UpdateMarketplace>,
        new_fee_bps: Option<u16>,
        new_authority: Option<Pubkey>,
    ) -> Result<()> {
        if let Some(bps) = new_fee_bps {
            require!(bps <= 1_000, MarketplaceError::FeeTooHigh);
            ctx.accounts.marketplace.fee_bps = bps;
        }
        if let Some(auth) = new_authority {
            ctx.accounts.marketplace.authority = auth;
        }
        Ok(())
    }

    pub fn register_merchant(ctx: Context<RegisterMerchant>) -> Result<()> {
        let m = &mut ctx.accounts.merchant;
        m.marketplace = ctx.accounts.marketplace.key();
        m.owner = ctx.accounts.owner.key();
        m.verified = false;
        m.bump = ctx.bumps.merchant;
        Ok(())
    }

    pub fn set_merchant_status(ctx: Context<SetMerchantStatus>, verified: bool) -> Result<()> {
        ctx.accounts.merchant.verified = verified;
        Ok(())
    }

    
    pub fn create_listing(
        ctx: Context<CreateListing>,
        price: u64,
        quantity: u32,
        is_service: bool,
    ) -> Result<()> {
        require!(price > 0, MarketplaceError::InvalidAmount);
        let l = &mut ctx.accounts.listing;
        l.marketplace = ctx.accounts.marketplace.key();
        l.seller = ctx.accounts.merchant.owner;
        l.mint = ctx.accounts.mint.key();
        l.price = price;
        l.quantity = quantity;
        l.is_service = is_service;
        l.active = true;
        l.bump = ctx.bumps.listing;
        Ok(())
    }

    pub fn update_listing(
        ctx: Context<UpdateListing>,
        new_price: Option<u64>,
        new_quantity: Option<u32>,
        active: Option<bool>,
    ) -> Result<()> {
        let l = &mut ctx.accounts.listing;
        if let Some(p) = new_price {
            require!(p > 0, MarketplaceError::InvalidAmount);
            l.price = p;
        }
        if let Some(q) = new_quantity {
            l.quantity = q;
        }
        if let Some(a) = active {
            l.active = a;
        }
        Ok(())
    }

    // buy now flow
    pub fn buy_now(ctx: Context<BuyNow>, quantity: u32, reference: Pubkey) -> Result<()> {
        let l = &mut ctx.accounts.listing;

        require!(l.active, MarketplaceError::ListingInactive);
        require!(!l.is_service, MarketplaceError::WrongFlowForService);
        require!(quantity > 0 && quantity <= l.quantity, MarketplaceError::InvalidQuantity);

        let reference_account = ctx
            .remaining_accounts
            .get(0)
            .ok_or(MarketplaceError::MissingReference)?;
        require!(reference_account.key() == reference, MarketplaceError::WrongReference);

        require!(
            ctx.accounts.seller_ata.owner == l.seller && ctx.accounts.seller_ata.mint == l.mint,
            MarketplaceError::InvalidAccount
        );

        let total_price = l
            .price
            .checked_mul(quantity as u64)
            .ok_or(MarketplaceError::MathOverflow)?;
        let fee = total_price
            .checked_mul(l.get_fee_bps(&ctx.accounts.marketplace)? as u64)
            .ok_or(MarketplaceError::MathOverflow)?
            / 10_000;
        let seller_amount = total_price
            .checked_sub(fee)
            .ok_or(MarketplaceError::MathOverflow)?;

        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.buyer_ata.to_account_info(),
                    to: ctx.accounts.seller_ata.to_account_info(),
                    authority: ctx.accounts.buyer.to_account_info(),
                },
            ),
            seller_amount,
        )?;

        if fee > 0 {
            token::transfer(
                CpiContext::new(
                    ctx.accounts.token_program.to_account_info(),
                    Transfer {
                        from: ctx.accounts.buyer_ata.to_account_info(),
                        to: ctx.accounts.treasury_ata.to_account_info(),
                        authority: ctx.accounts.buyer.to_account_info(),
                    },
                ),
                fee,
            )?;
        }

        l.quantity = l
            .quantity
            .checked_sub(quantity)
            .ok_or(MarketplaceError::MathOverflow)?;
        if l.quantity == 0 {
            l.active = false;
        }

        emit!(OrderCompleted {
            marketplace: ctx.accounts.marketplace.key(),
            listing: l.key(),
            buyer: ctx.accounts.buyer.key(),
            seller: l.seller,
            mint: ctx.accounts.mint.key(),
            quantity,
            total_amount: total_price,
            reference,
        });

        Ok(())
    }

    // Services (escrow)
    pub fn create_service_order(ctx: Context<CreateServiceOrder>, reference: Pubkey) -> Result<()> {
        let l = &ctx.accounts.listing;
        require!(l.active, MarketplaceError::ListingInactive);
        require!(l.is_service, MarketplaceError::WrongFlowForGoods);

        // enforce reference presence in transaction metas for Solana Pay correlation
        let reference_account = ctx
            .remaining_accounts
            .get(0)
            .ok_or(MarketplaceError::MissingReference)?;
        require!(reference_account.key() == reference, MarketplaceError::WrongReference);

        let total_price = l.price;

        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.buyer_ata.to_account_info(),
                    to: ctx.accounts.vault.to_account_info(),
                    authority: ctx.accounts.buyer.to_account_info(),
                },
            ),
            total_price,
        )?;

        // Initialize escrow account state
        let e = &mut ctx.accounts.escrow;
        e.marketplace = ctx.accounts.marketplace.key();
        e.listing = l.key();
        e.seller = l.seller;
        e.buyer = ctx.accounts.buyer.key();
        e.mint = ctx.accounts.mint.key();
        e.amount = total_price;
        e.reference = reference;
        e.released = false;
        e.bump = ctx.bumps.escrow;

        // emit event so off-chain indexers immediately know escrow created
        emit!(ServiceOrderCreated {
            marketplace: ctx.accounts.marketplace.key(),
            listing: l.key(),
            buyer: e.buyer,
            seller: e.seller,
            mint: e.mint,
            amount: e.amount,
            reference,
            escrow: ctx.accounts.escrow.key(),
        });

        Ok(())
    }

    // release funds from escrow to seller (can be called by buyer or marketplace authority via ctx enforcement)
    pub fn release_service_order(ctx: Context<ReleaseServiceOrder>) -> Result<()> {
        require!(
            !ctx.accounts.escrow.released,
            MarketplaceError::AlreadyReleased
        );

        let bump = ctx.accounts.escrow.bump;
        let amount = ctx.accounts.escrow.amount;
        let listing = ctx.accounts.escrow.listing;
        let buyer_key = ctx.accounts.escrow.buyer;
        let fee_bps = ctx.accounts.escrow.get_fee_bps(&ctx.accounts.marketplace)?;

        let fee = amount
            .checked_mul(fee_bps as u64)
            .ok_or(MarketplaceError::MathOverflow)?
            / 10_000;
        let seller_amount = amount.checked_sub(fee).ok_or(MarketplaceError::MathOverflow)?;

        let seeds: &[&[u8]] = &[
            b"escrow",
            listing.as_ref(),
            buyer_key.as_ref(),
            &[bump],
        ];
        let signer = &[seeds];

        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.vault.to_account_info(),
                    to: ctx.accounts.seller_ata.to_account_info(),
                    authority: ctx.accounts.escrow.to_account_info(),
                },
                signer,
            ),
            seller_amount,
        )?;

        if fee > 0 {
            token::transfer(
                CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info(),
                    Transfer {
                        from: ctx.accounts.vault.to_account_info(),
                        to: ctx.accounts.treasury_ata.to_account_info(),
                        authority: ctx.accounts.escrow.to_account_info(),
                    },
                    signer,
                ),
                    fee,
            )?;
        }

        token::close_account(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                CloseAccount {
                    account: ctx.accounts.vault.to_account_info(),
                    destination: ctx.accounts.buyer.to_account_info(),
                    authority: ctx.accounts.escrow.to_account_info(),
                },
                signer,
            ),
        )?;

        let e = &mut ctx.accounts.escrow;
        e.released = true;

        emit!(ServiceOrderReleased {
            marketplace: ctx.accounts.marketplace.key(),
            escrow: e.key(),
            buyer: e.buyer,
            seller: e.seller,
            mint: e.mint,
            amount,
            reference: e.reference,
        });

        Ok(())
    }

    // cancel/refund escrow back to buyer (can be called by marketplace authority or buyer depending on your policy)
    pub fn cancel_service_order(ctx: Context<CancelServiceOrder>) -> Result<()> {
        require!(
            !ctx.accounts.escrow.released,
            MarketplaceError::AlreadyReleased
        );

        let bump = ctx.accounts.escrow.bump;
        let amount = ctx.accounts.escrow.amount;
        let listing = ctx.accounts.escrow.listing;
        let buyer_key = ctx.accounts.escrow.buyer;

        let seeds: &[&[u8]] = &[
            b"escrow",
            listing.as_ref(),
            buyer_key.as_ref(),
            &[bump],
        ];
        let signer = &[seeds];

        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.vault.to_account_info(),
                    to: ctx.accounts.buyer_ata.to_account_info(),
                    authority: ctx.accounts.escrow.to_account_info(),
                },
                signer,
            ),
            amount,
        )?;

        token::close_account(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                CloseAccount {
                    account: ctx.accounts.vault.to_account_info(),
                    destination: ctx.accounts.buyer.to_account_info(),
                    authority: ctx.accounts.escrow.to_account_info(),
                },
                signer,
            ),
        )?;

        let e = &mut ctx.accounts.escrow;
        e.released = true;

        emit!(ServiceOrderCancelled {
            marketplace: ctx.accounts.marketplace.key(),
            escrow: e.key(),
            buyer: e.buyer,
            amount,
            reference: e.reference,
        });

        Ok(())
    }
}


#[account]
pub struct Marketplace {
    pub authority: Pubkey,
    pub fee_bps: u16,
    pub bump: u8,
}
impl Marketplace {
    pub const SIZE: usize = 32 + 2 + 1;
}

#[account]
pub struct Merchant {
    pub marketplace: Pubkey,
    pub owner: Pubkey,
    pub verified: bool,
    pub bump: u8,
}
impl Merchant {
    pub const SIZE: usize = 32 + 32 + 1 + 1;
}

#[account]
pub struct Listing {
    pub marketplace: Pubkey,
    pub seller: Pubkey,
    pub mint: Pubkey,
    pub price: u64,
    pub quantity: u32,
    pub is_service: bool,
    pub active: bool,
    pub bump: u8,
}
impl Listing {
    pub const SIZE: usize = 32 + 32 + 32 + 8 + 4 + 1 + 1 + 1;
}

#[account]
pub struct Escrow {
    pub marketplace: Pubkey,
    pub listing: Pubkey,
    pub seller: Pubkey,
    pub buyer: Pubkey,
    pub mint: Pubkey,
    pub amount: u64,
    pub reference: Pubkey,
    pub released: bool,
    pub bump: u8,
}
impl Escrow {
    pub const SIZE: usize = 32 + 32 + 32 + 32 + 32 + 8 + 32 + 1 + 1;
}

// Events
#[event]
pub struct OrderCompleted {
    pub marketplace: Pubkey,
    pub listing: Pubkey,
    pub buyer: Pubkey,
    pub seller: Pubkey,
    pub mint: Pubkey,
    pub quantity: u32,
    pub total_amount: u64,
    pub reference: Pubkey,
}

#[event]
pub struct ServiceOrderCreated {
    pub marketplace: Pubkey,
    pub listing: Pubkey,
    pub buyer: Pubkey,
    pub seller: Pubkey,
    pub mint: Pubkey,
    pub amount: u64,
    pub reference: Pubkey,
    pub escrow: Pubkey,
}

#[event]
pub struct ServiceOrderReleased {
    pub marketplace: Pubkey,
    pub escrow: Pubkey,
    pub buyer: Pubkey,
    pub seller: Pubkey,
    pub mint: Pubkey,
    pub amount: u64,
    pub reference: Pubkey,
}

#[event]
pub struct ServiceOrderCancelled {
    pub marketplace: Pubkey,
    pub escrow: Pubkey,
    pub buyer: Pubkey,
    pub amount: u64,
    pub reference: Pubkey,
}

// Errs
#[error_code]
pub enum MarketplaceError {
    #[msg("Fee too high (max 10%)")]
    FeeTooHigh,
    #[msg("Invalid amount")]
    InvalidAmount,
    #[msg("Invalid quantity")]
    InvalidQuantity,
    #[msg("Listing is inactive")]
    ListingInactive,
    #[msg("Wrong marketplace")]
    WrongMarketplace,
    #[msg("Math overflow")]
    MathOverflow,
    #[msg("Already released")]
    AlreadyReleased,
    #[msg("Use service escrow flow")]
    WrongFlowForGoods,
    #[msg("Use goods buy-now flow")]
    WrongFlowForService,
    #[msg("Invalid Account")]
    InvalidAccount,
    #[msg("Missing Solana Pay reference in remaining_accounts")]
    MissingReference,
    #[msg("Provided reference does not match remaining_accounts entry")]
    WrongReference,
}

// Contexts
#[derive(Accounts)]
#[instruction(fee_bps: u16)]
pub struct InitMarketplace<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + Marketplace::SIZE,
        seeds = [b"marketplace", authority.key().as_ref()],
        bump
    )]
    pub marketplace: Account<'info, Marketplace>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateMarketplace<'info> {
    #[account(mut, has_one = authority)]
    pub marketplace: Account<'info, Marketplace>,
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct RegisterMerchant<'info> {
    #[account(mut)]
    pub marketplace: Account<'info, Marketplace>,
    #[account(
        init,
        payer = owner,
        space = 8 + Merchant::SIZE,
        seeds = [b"merchant", marketplace.key().as_ref(), owner.key().as_ref()],
        bump
    )]
    pub merchant: Account<'info, Merchant>,
    #[account(mut)]
    pub owner: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SetMerchantStatus<'info> {
    #[account(mut, has_one = marketplace)]
    pub merchant: Account<'info, Merchant>,
    pub marketplace: Account<'info, Marketplace>,
    #[account(address = marketplace.authority)]
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct CreateListing<'info> {
    pub marketplace: Account<'info, Marketplace>,
    #[account(mut, has_one = marketplace, has_one = owner)]
    pub merchant: Account<'info, Merchant>,
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(
        init,
        payer = owner,
        space = 8 + Listing::SIZE,
        seeds = [b"listing", marketplace.key().as_ref(), merchant.key().as_ref(), mint.key().as_ref()],
        bump
    )]
    pub listing: Account<'info, Listing>,
    pub mint: Account<'info, Mint>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateListing<'info> {
    #[account(mut, has_one = seller)]
    pub listing: Account<'info, Listing>,
    pub seller: Signer<'info>,
}

#[derive(Accounts)]
pub struct BuyNow<'info> {
    #[account(mut, has_one = marketplace, has_one = mint)]
    pub listing: Account<'info, Listing>,
    #[account(mut)]
    pub marketplace: Account<'info, Marketplace>,
    #[account(mut)]
    pub buyer: Signer<'info>,
    #[account(mut, token::mint = mint, token::authority = buyer)]
    pub buyer_ata: Account<'info, TokenAccount>,
    #[account(mut)]
    pub seller_ata: Account<'info, TokenAccount>,
    #[account(mut, token::mint = mint, token::authority = marketplace.authority)]
    pub treasury_ata: Account<'info, TokenAccount>,
    pub mint: Account<'info, Mint>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct CreateServiceOrder<'info> {
    pub marketplace: Account<'info, Marketplace>,
    #[account(mut, has_one = marketplace)]
    pub listing: Account<'info, Listing>,
    #[account(mut)]
    pub buyer: Signer<'info>,
    #[account(mut, token::mint = mint, token::authority = buyer)]
    pub buyer_ata: Account<'info, TokenAccount>,
    #[account(
        init,
        payer = buyer,
        space = 8 + Escrow::SIZE,
        seeds = [b"escrow", listing.key().as_ref(), buyer.key().as_ref()],
        bump
    )]
    pub escrow: Account<'info, Escrow>,
    #[account(
        init,
        payer = buyer,
        associated_token::mint = mint,
        associated_token::authority = escrow
    )]
    pub vault: Account<'info, TokenAccount>,
    pub mint: Account<'info, Mint>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ReleaseServiceOrder<'info> {
    #[account(mut, has_one = marketplace)]
    pub escrow: Account<'info, Escrow>,
    pub marketplace: Account<'info, Marketplace>,
    pub listing: Account<'info, Listing>,
    #[account(constraint = payer.key() == escrow.buyer || payer.key() == marketplace.authority)]
    pub payer: Signer<'info>,
    /// CHECK: destination for vault rent, verified via constraint
    #[account(mut, constraint = buyer.key() == escrow.buyer @ MarketplaceError::InvalidAccount)]
    pub buyer: UncheckedAccount<'info>,
    #[account(mut)]
    pub seller_ata: Account<'info, TokenAccount>,
    #[account(mut, token::mint = escrow.mint, token::authority = marketplace.authority)]
    pub treasury_ata: Account<'info, TokenAccount>,
    #[account(mut, token::authority = escrow, close = buyer)]
    pub vault: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

//Backend can cancel, rent refunded
#[derive(Accounts)]
pub struct CancelServiceOrder<'info> {
    #[account(mut)]
    pub escrow: Account<'info, Escrow>,
    pub marketplace: Account<'info, Marketplace>,
    #[account(constraint = payer.key() == escrow.buyer || payer.key() == marketplace.authority)]
    pub payer: Signer<'info>,
    /// CHECK: destination for vault rent, verified via constraint
    #[account(mut, constraint = buyer.key() == escrow.buyer @ MarketplaceError::InvalidAccount)]
    pub buyer: UncheckedAccount<'info>,
    #[account(mut, token::mint = escrow.mint, token::authority = escrow.buyer)]
    pub buyer_ata: Account<'info, TokenAccount>,
    #[account(mut, token::authority = escrow, close = buyer)]
    pub vault: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}


impl Listing {
    pub fn get_fee_bps(&self, mp: &Account<Marketplace>) -> Result<u16> {
        require!(self.marketplace == mp.key(), MarketplaceError::WrongMarketplace);
        Ok(mp.fee_bps)
    }
}

impl Escrow {
    pub fn get_fee_bps(&self, mp: &Account<Marketplace>) -> Result<u16> {
        require!(self.marketplace == mp.key(), MarketplaceError::WrongMarketplace);
        Ok(mp.fee_bps)
    }
}