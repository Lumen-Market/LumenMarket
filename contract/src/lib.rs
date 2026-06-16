#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, token, Address, Env, Symbol};

#[contracttype]
pub struct Launch {
    pub creator: Address,
    pub token: Address,
    pub name: Symbol,
    pub total_supply: i128,
    pub sold: i128,
    pub xlm_raised: i128,
    pub target_xlm: i128,
    pub migrated: bool,
    pub created_at: u64,
}

#[contracttype]
pub struct BondingCurve {
    pub virtual_xlm: i128,
    pub virtual_tokens: i128,
}

#[contracttype]
enum DataKey {
    Counter,
    Admin,
    NativeToken,
    CreationFee,
    MigrationFeeBps,
    Launch(u32),
    Curve(u32),
}

fn get_launch(env: &Env, id: u32) -> Launch {
    env.storage().persistent().get(&DataKey::Launch(id)).unwrap()
}

fn set_launch(env: &Env, id: u32, launch: &Launch) {
    env.storage().persistent().set(&DataKey::Launch(id), launch);
}

fn get_curve(env: &Env, id: u32) -> BondingCurve {
    env.storage().persistent().get(&DataKey::Curve(id)).unwrap()
}

fn set_curve(env: &Env, id: u32, curve: &BondingCurve) {
    env.storage().persistent().set(&DataKey::Curve(id), curve);
}

fn xlm_client(env: &Env) -> token::Client {
    let addr: Address = env.storage().persistent().get(&DataKey::NativeToken).unwrap();
    token::Client::new(env, &addr)
}

#[contract]
pub struct LumenMarket;

#[contractimpl]
impl LumenMarket {
    /// One-time initialisation.
    pub fn init(
        env: Env,
        admin: Address,
        native_token: Address,
        creation_fee: i128,
        migration_fee_bps: u32,
    ) {
        assert!(!env.storage().persistent().has(&DataKey::Admin), "already initialized");
        admin.require_auth();
        env.storage().persistent().set(&DataKey::Admin, &admin);
        env.storage().persistent().set(&DataKey::NativeToken, &native_token);
        env.storage().persistent().set(&DataKey::CreationFee, &creation_fee);
        env.storage().persistent().set(&DataKey::MigrationFeeBps, &migration_fee_bps);
        env.storage().persistent().set(&DataKey::Counter, &0u32);
    }

    /// Create a new token launch. Returns the launch ID.
    pub fn create_launch(
        env: Env,
        creator: Address,
        name: Symbol,
        total_supply: i128,
        target_xlm: i128,
    ) -> u32 {
        creator.require_auth();

        let creation_fee: i128 = env.storage().persistent().get(&DataKey::CreationFee).unwrap();
        let contract_addr = env.current_contract_address();

        if creation_fee > 0 {
            xlm_client(&env).transfer(&creator, &contract_addr, &creation_fee);
        }

        let id: u32 = env.storage().persistent().get(&DataKey::Counter).unwrap();

        let launch = Launch {
            creator: creator.clone(),
            // Placeholder: real impl would deploy a SEP-41 token; store creator as stand-in
            token: creator.clone(),
            name: name.clone(),
            total_supply,
            sold: 0,
            xlm_raised: 0,
            target_xlm,
            migrated: false,
            created_at: env.ledger().timestamp(),
        };
        let curve = BondingCurve {
            virtual_xlm: 1_000_0000000i128, // 100 XLM virtual reserve
            virtual_tokens: total_supply,
        };

        set_launch(&env, id, &launch);
        set_curve(&env, id, &curve);
        env.storage().persistent().set(&DataKey::Counter, &(id + 1));

        env.events().publish(
            (Symbol::new(&env, "LaunchCreated"), id),
            (creator, name, total_supply, target_xlm),
        );

        id
    }

    /// Buy tokens with XLM. Returns tokens received.
    pub fn buy(env: Env, buyer: Address, launch_id: u32, xlm_in: i128, min_tokens: i128) -> i128 {
        buyer.require_auth();

        let mut launch = get_launch(&env, launch_id);
        assert!(!launch.migrated, "already migrated");

        let mut curve = get_curve(&env, launch_id);

        let tokens_out = curve.virtual_tokens * xlm_in / (curve.virtual_xlm + xlm_in);
        assert!(tokens_out >= min_tokens, "slippage");

        curve.virtual_xlm += xlm_in;
        curve.virtual_tokens -= tokens_out;
        launch.sold += tokens_out;
        launch.xlm_raised += xlm_in;

        set_curve(&env, launch_id, &curve);
        set_launch(&env, launch_id, &launch);

        let contract_addr = env.current_contract_address();
        xlm_client(&env).transfer(&buyer, &contract_addr, &xlm_in);
        token::Client::new(&env, &launch.token).transfer(&contract_addr, &buyer, &tokens_out);

        env.events().publish(
            (Symbol::new(&env, "TokenBought"), launch_id),
            (buyer, xlm_in, tokens_out),
        );

        tokens_out
    }

    /// Sell tokens back for XLM. Returns XLM received.
    pub fn sell(
        env: Env,
        seller: Address,
        launch_id: u32,
        tokens_in: i128,
        min_xlm: i128,
    ) -> i128 {
        seller.require_auth();

        let mut launch = get_launch(&env, launch_id);
        assert!(!launch.migrated, "already migrated");

        let mut curve = get_curve(&env, launch_id);

        let xlm_out = curve.virtual_xlm * tokens_in / (curve.virtual_tokens + tokens_in);
        assert!(xlm_out >= min_xlm, "slippage");

        curve.virtual_xlm -= xlm_out;
        curve.virtual_tokens += tokens_in;
        launch.sold -= tokens_in;
        launch.xlm_raised -= xlm_out;

        set_curve(&env, launch_id, &curve);
        set_launch(&env, launch_id, &launch);

        let contract_addr = env.current_contract_address();
        token::Client::new(&env, &launch.token).transfer(&seller, &contract_addr, &tokens_in);
        xlm_client(&env).transfer(&contract_addr, &seller, &xlm_out);

        env.events().publish(
            (Symbol::new(&env, "TokenSold"), launch_id),
            (seller, tokens_in, xlm_out),
        );

        xlm_out
    }

    /// Migrate liquidity to DEX once target is reached.
    pub fn migrate(env: Env, launch_id: u32) {
        let mut launch = get_launch(&env, launch_id);
        assert!(!launch.migrated, "already migrated");
        assert!(launch.xlm_raised >= launch.target_xlm, "target not reached");

        let admin: Address = env.storage().persistent().get(&DataKey::Admin).unwrap();
        let fee_bps: u32 = env.storage().persistent().get(&DataKey::MigrationFeeBps).unwrap();

        let fee = launch.xlm_raised * fee_bps as i128 / 10000;
        let remaining_xlm = launch.xlm_raised - fee;
        let unsold = launch.total_supply - launch.sold;

        let contract_addr = env.current_contract_address();
        if fee > 0 {
            xlm_client(&env).transfer(&contract_addr, &admin, &fee);
        }

        launch.migrated = true;
        set_launch(&env, launch_id, &launch);

        env.events().publish(
            (Symbol::new(&env, "Migrated"), launch_id),
            (remaining_xlm, unsold),
        );
    }

    /// Spot price: virtual_xlm / virtual_tokens, scaled by 1e7 (stroops per token).
    pub fn current_price(env: Env, launch_id: u32) -> i128 {
        let curve = get_curve(&env, launch_id);
        curve.virtual_xlm * 1_0000000i128 / curve.virtual_tokens
    }

    /// Read a launch record.
    pub fn get_launch(env: Env, launch_id: u32) -> Launch {
        get_launch(&env, launch_id)
    }

    /// Read the admin address.
    pub fn get_admin(env: Env) -> Address {
        env.storage().persistent().get(&DataKey::Admin).unwrap()
    }
}

#[cfg(test)]
mod test;
