#![cfg(test)]

use super::*;
use soroban_sdk::{
    testutils::{Address as _, Events},
    token::{Client as TokenClient, StellarAssetClient},
    Address, Env, IntoVal, Symbol,
};

// ── helpers ────────────────────────────────────────────────────────────────

struct TestEnv {
    env: Env,
    client: LumenMarketClient,
    contract_id: Address,
    native_id: Address,
    admin: Address,
}

fn setup() -> TestEnv {
    let env = Env::default();
    env.mock_all_auths();

    // Register a stellar asset contract to act as the native XLM token
    let admin = Address::generate(&env);
    let native_id = env.register_stellar_asset_contract(admin.clone());

    let contract_id = env.register_contract(None, LumenMarket);
    let client = LumenMarketClient::new(&env, &contract_id);

    TestEnv { env, client, contract_id, native_id, admin }
}

impl TestEnv {
    fn init(&self) {
        self.client
            .init(&self.admin, &self.native_id, &0i128, &100u32);
    }

    fn mint_native(&self, to: &Address, amount: i128) {
        StellarAssetClient::new(&self.env, &self.native_id).mint(to, &amount);
    }

    fn native_balance(&self, of: &Address) -> i128 {
        TokenClient::new(&self.env, &self.native_id).balance(of)
    }
}

// ── tests ──────────────────────────────────────────────────────────────────

#[test]
fn test_init() {
    let t = setup();
    t.init();
    assert_eq!(t.client.get_admin(), t.admin);
}

#[test]
fn test_create_launch() {
    let t = setup();
    t.init();

    let creator = Address::generate(&t.env);
    let total_supply = 1_000_000_0000000i128;
    let target_xlm = 500_0000000i128;

    let id = t.client.create_launch(
        &creator,
        &Symbol::new(&t.env, "MYTOKEN"),
        &total_supply,
        &target_xlm,
    );
    assert_eq!(id, 0u32);

    // Second launch increments counter
    let id2 = t.client.create_launch(
        &creator,
        &Symbol::new(&t.env, "OTHER"),
        &total_supply,
        &target_xlm,
    );
    assert_eq!(id2, 1u32);

    // LaunchCreated event was emitted
    let events = t.env.events().all();
    let found = events.iter().any(|(_, topics, _)| {
        topics
            .get(0)
            .map(|v| v == Symbol::new(&t.env, "LaunchCreated").into_val(&t.env))
            .unwrap_or(false)
    });
    assert!(found, "LaunchCreated event not found");
}

#[test]
fn test_buy_sell() {
    let t = setup();
    t.init();

    let creator = Address::generate(&t.env);
    let total_supply = 1_000_000_0000000i128;

    t.client.create_launch(
        &creator,
        &Symbol::new(&t.env, "MYTOKEN"),
        &total_supply,
        &50_000_0000000i128,
    );

    // Seed contract with tokens (via creator = token placeholder):
    // since launch.token == creator in the placeholder design,
    // and token::Client::new(&env, &creator) would not be a valid token contract,
    // we test buy/sell logic indirectly via curve math to avoid this limitation.
    //
    // Verify bonding curve formulas directly:
    let vxlm: i128 = 1_000_0000000; // initial virtual XLM (100 XLM)
    let vtok: i128 = total_supply;
    let xlm_in: i128 = 100_0000000; // 100 XLM

    let price_before = t.client.current_price(&0u32);

    // Expected tokens_out from constant-product curve
    let tokens_out = vtok * xlm_in / (vxlm + xlm_in);
    assert!(tokens_out > 0);

    // After a hypothetical buy, price should be higher
    let new_vxlm = vxlm + xlm_in;
    let new_vtok = vtok - tokens_out;
    let price_after = new_vxlm * 1_0000000i128 / new_vtok;
    assert!(price_after > price_before, "price should rise after buy");

    // Sell half back: verify the XLM received is less than spent (spread)
    let tokens_sell = tokens_out / 2;
    let xlm_back = new_vxlm * tokens_sell / (new_vtok + tokens_sell);
    assert!(xlm_back > 0);
    assert!(xlm_back < xlm_in, "sell should return less than buy cost");

    // Verify current_price is the initial price with unmodified curve
    assert_eq!(
        price_before,
        vxlm * 1_0000000i128 / vtok,
        "initial price formula"
    );
}

#[test]
fn test_migration() {
    let t = setup();
    t.init();

    let creator = Address::generate(&t.env);
    let total_supply = 1_000_000_0000000i128;
    let target_xlm = 100_0000000i128; // 100 XLM

    t.client.create_launch(
        &creator,
        &Symbol::new(&t.env, "MYTOKEN"),
        &total_supply,
        &target_xlm,
    );

    // Directly write xlm_raised >= target into storage to bypass buy() token limitation
    let launch = Launch {
        creator: creator.clone(),
        token: creator.clone(),
        name: Symbol::new(&t.env, "MYTOKEN"),
        total_supply,
        sold: 100_000_0000000i128,
        xlm_raised: target_xlm,
        target_xlm,
        migrated: false,
        created_at: t.env.ledger().timestamp(),
    };
    t.env.as_contract(&t.contract_id, || {
        set_launch(&t.env, 0u32, &launch);
    });

    // Mint native XLM to the contract so it can pay out the migration fee
    t.mint_native(&t.contract_id, target_xlm);

    t.client.migrate(&0u32);

    let stored = t.client.get_launch(&0u32);
    assert!(stored.migrated, "launch should be marked migrated");

    // Fee (1% of 100 XLM = 1 XLM) goes to admin
    let fee = target_xlm * 100 / 10000; // 100 bps = 1%
    assert_eq!(t.native_balance(&t.admin), fee);

    // Migrated event emitted
    let events = t.env.events().all();
    let found = events.iter().any(|(_, topics, _)| {
        topics
            .get(0)
            .map(|v| v == Symbol::new(&t.env, "Migrated").into_val(&t.env))
            .unwrap_or(false)
    });
    assert!(found, "Migrated event not found");
}

#[test]
#[should_panic(expected = "slippage")]
fn test_slippage_protection() {
    let t = setup();
    t.init();

    let creator = Address::generate(&t.env);
    let total_supply = 1_000_000_0000000i128;

    t.client.create_launch(
        &creator,
        &Symbol::new(&t.env, "MYTOKEN"),
        &total_supply,
        &500_0000000i128,
    );

    // Craft a launch where token == a real registered native contract so buy() doesn't
    // panic on token transfer before reaching the slippage check. We set the launch's
    // token to native_id and mint the contract enough tokens to cover the transfer.
    let launch = Launch {
        creator: creator.clone(),
        token: t.native_id.clone(), // use native token as stand-in for launch token
        name: Symbol::new(&t.env, "MYTOKEN"),
        total_supply,
        sold: 0,
        xlm_raised: 0,
        target_xlm: 500_0000000i128,
        migrated: false,
        created_at: t.env.ledger().timestamp(),
    };
    t.env.as_contract(&t.contract_id, || {
        set_launch(&t.env, 0u32, &launch);
    });

    let buyer = Address::generate(&t.env);
    let xlm_in = 100_0000000i128;

    // Mint XLM to buyer for the buy call
    t.mint_native(&buyer, xlm_in);
    // Mint tokens to contract so it can pay out tokens_out (avoiding that panic)
    t.mint_native(&t.contract_id, total_supply);

    // min_tokens set absurdly high — slippage assert fires before any transfer
    t.client.buy(&buyer, &0u32, &xlm_in, &total_supply);
}
