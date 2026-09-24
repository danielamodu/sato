import { Cl } from "@stacks/transactions";
import { describe, expect, it } from "vitest";

const accounts = simnet.getAccounts();
const deployer = accounts.get("deployer")!; // contract owner / yield source
const wallet1 = accounts.get("wallet_1")!;
const wallet2 = accounts.get("wallet_2")!;

// The pool's own principal, where deposited sBTC is custodied in sato-transfer.
const pool = `${deployer}.sato-yield-v2`;

// Accrual params -- must mirror the contract constants exactly.
const SCALE = 1_000_000_000_000n;
const BLOCKS_PER_YEAR = 52_560n;
const RATE = 2_000_000n; // default yield-rate-bps (20,000% APR, testnet demo)

// Credit a principal's sato-transfer wallet balance (the deposit source).
const fundWallet = (who: string, amount: number) =>
  simnet.callPublicFn("sato-transfer", "deposit", [Cl.uint(amount)], who);

// A principal's live sato-transfer wallet balance.
const walletBalance = (who: string) =>
  simnet.callReadOnlyFn("sato-transfer", "get-balance", [Cl.principal(who)], deployer).result;

// sBTC the pool actually holds in sato-transfer (principal + reserve).
const poolCustody = () =>
  simnet.callReadOnlyFn("sato-transfer", "get-balance", [Cl.principal(pool)], deployer).result;

const deposit = (who: string, amount: number) =>
  simnet.callPublicFn("sato-yield-v2", "deposit", [Cl.uint(amount)], who);

const withdraw = (who: string, amount: number) =>
  simnet.callPublicFn("sato-yield-v2", "withdraw", [Cl.uint(amount)], who);

const fundReserve = (who: string, amount: number) =>
  simnet.callPublicFn("sato-yield-v2", "fund-reserve", [Cl.uint(amount)], who);

const addYield = (amount: number, who = deployer) =>
  simnet.callPublicFn("sato-yield-v2", "add-yield", [Cl.uint(amount)], who);

const setRate = (bps: number, who = deployer) =>
  simnet.callPublicFn("sato-yield-v2", "set-rate", [Cl.uint(bps)], who);

const read = (fn: string, args: any[] = [], sender = deployer) =>
  simnet.callReadOnlyFn("sato-yield-v2", fn, args, sender).result;

// Exact integer replica of the contract's accrual math (every step floors,
// matching Clarity's uint division), so expectations are computed, not guessed.
const accrued = (prin: bigint, elapsed: bigint) =>
  (prin * RATE * elapsed) / (BLOCKS_PER_YEAR * 10_000n);
const indexInc = (prin: bigint, elapsed: bigint) =>
  (accrued(prin, elapsed) * SCALE) / prin;
// Yield a sole depositor (debt baseline 0) reads after `elapsed` blocks.
const soleYield = (prin: bigint, elapsed: bigint) =>
  (prin * indexInc(prin, elapsed)) / SCALE;

// Find a contract `print` event by its `event:` tag. Functions that call
// .sato-transfer emit its "sbtc-transfer" print first, so we match by name
// rather than taking the first print event.
const findPrint = (events: any[], name: string) =>
  events.find(
    (e) =>
      e.event === "print_event" &&
      e.data?.value?.value?.event?.value === name
  );

describe("sato-yield-v2: setup", () => {
  it("starts empty: no principal, no yield, index at zero", () => {
    expect(read("get-pool-principal")).toBeUint(0);
    expect(read("get-acc-yield-per-share")).toBeUint(0);
    expect(read("get-pool-total")).toBeUint(0);
    expect(read("get-yield-rate")).toBeUint(Number(RATE));
    expect(read("get-balance", [Cl.principal(wallet1)])).toBeUint(0);
    expect(read("get-yield", [Cl.principal(wallet1)])).toBeUint(0);
  });
});

describe("sato-yield-v2: deposit pulls from the wallet", () => {
  it("debits the caller's wallet and credits pool custody", () => {
    fundWallet(wallet1, 1_000_000);
    expect(walletBalance(wallet1)).toBeUint(1_000_000);

    const { result, events } = deposit(wallet1, 400_000);
    expect(result).toBeOk(Cl.bool(true));
    // sBTC really moved: wallet down, pool custody up, principal tracked.
    expect(walletBalance(wallet1)).toBeUint(600_000);
    expect(poolCustody()).toBeUint(400_000);
    expect(read("get-balance", [Cl.principal(wallet1)])).toBeUint(400_000);
    // Fresh deposit has earned nothing yet (settled at this very block).
    expect(read("get-yield", [Cl.principal(wallet1)])).toBeUint(0);
    // Emits the deposit event with the new principal.
    expect(findPrint(events, "yield-deposit")).toBeDefined();
  });

  it("rejects a zero-amount deposit (u401)", () => {
    expect(deposit(wallet1, 0).result).toBeErr(Cl.uint(401));
  });

  it("rejects a deposit with no wallet funds (sato-transfer u100)", () => {
    // wallet2 was never funded, so sato-transfer.send reverts on shortfall.
    expect(deposit(wallet2, 100_000).result).toBeErr(Cl.uint(100));
  });
});
describe("sato-yield-v2: continuous rate-based accrual", () => {
  it("grows a sole depositor's yield every block by the rate", () => {
    fundWallet(wallet1, 1_000_000);
    deposit(wallet1, 1_000_000);
    const depH = simnet.blockHeight;
    // No blocks elapsed since the deposit settled: zero yield.
    expect(read("get-yield", [Cl.principal(wallet1)])).toBeUint(0);

    simnet.mineEmptyBlocks(100);
    const e1 = BigInt(simnet.blockHeight - depH); // 100
    expect(read("get-yield", [Cl.principal(wallet1)])).toBeUint(
      Number(soleYield(1_000_000n, e1))
    );

    // More blocks -> strictly more yield, still matching the exact formula.
    simnet.mineEmptyBlocks(150);
    const e2 = BigInt(simnet.blockHeight - depH); // 250
    expect(e2).toBeGreaterThan(e1);
    expect(read("get-yield", [Cl.principal(wallet1)])).toBeUint(
      Number(soleYield(1_000_000n, e2))
    );
    // get-pool-total tracks principal + live pending accrual.
    expect(read("get-pool-total")).toBeUint(
      Number(1_000_000n + accrued(1_000_000n, e2))
    );
  });

  it("accrues nothing while the pool is empty", () => {
    // No deposits at all: the clock advances but no yield is minted.
    simnet.mineEmptyBlocks(500);
    expect(read("get-pool-principal")).toBeUint(0);
    expect(read("get-pool-total")).toBeUint(0);
  });

  it("stops accruing once the owner sets the rate to zero", () => {
    setRate(0);
    fundWallet(wallet1, 1_000_000);
    deposit(wallet1, 1_000_000);
    simnet.mineEmptyBlocks(100);
    // Rate 0 -> the accrual term is zero regardless of elapsed blocks.
    expect(read("get-yield", [Cl.principal(wallet1)])).toBeUint(0);
  });

  it("rate changes are not retroactive (old rate settles first)", () => {
    fundWallet(wallet1, 1_000_000);
    deposit(wallet1, 1_000_000);
    const depH = simnet.blockHeight;
    simnet.mineEmptyBlocks(100);
    setRate(0); // settles accrual at the old rate up to this block
    const locked = soleYield(1_000_000n, BigInt(simnet.blockHeight - depH));
    simnet.mineEmptyBlocks(200); // rate 0 now: nothing new accrues
    expect(read("get-yield", [Cl.principal(wallet1)])).toBeUint(Number(locked));
  });
});
describe("sato-yield-v2: full wallet round-trip", () => {
  it("withdraw returns principal + earned yield to the wallet", () => {
    // Owner seeds a reserve so accrued yield is actually payable.
    fundWallet(deployer, 1_000_000);
    fundReserve(deployer, 1_000_000);
    expect(poolCustody()).toBeUint(1_000_000);

    fundWallet(wallet1, 1_000_000);
    deposit(wallet1, 1_000_000);
    const depH = simnet.blockHeight;
    expect(walletBalance(wallet1)).toBeUint(0); // all of it is now in the pool
    expect(poolCustody()).toBeUint(2_000_000); // reserve + principal

    simnet.mineEmptyBlocks(50);
    const { result } = withdraw(wallet1, 1_000_000);
    expect(result).toBeOk(Cl.bool(true));

    // elapsed includes the withdraw block itself (settle runs inside it).
    const yieldPaid = soleYield(1_000_000n, BigInt(simnet.blockHeight - depH));
    // Wallet gets principal + all earned yield back.
    expect(walletBalance(wallet1)).toBeUint(Number(1_000_000n + yieldPaid));
    // Position fully cleared; pool principal drained.
    expect(read("get-balance", [Cl.principal(wallet1)])).toBeUint(0);
    expect(read("get-yield", [Cl.principal(wallet1)])).toBeUint(0);
    expect(read("get-pool-principal")).toBeUint(0);
    // Custody = what was left after paying principal + yield out of 2,000,000.
    expect(poolCustody()).toBeUint(Number(2_000_000n - (1_000_000n + yieldPaid)));
  });

  it("partial withdraw keeps earning on the remaining principal", () => {
    fundWallet(deployer, 1_000_000);
    fundReserve(deployer, 1_000_000);
    fundWallet(wallet1, 1_000_000);
    deposit(wallet1, 1_000_000);
    simnet.mineEmptyBlocks(20);
    // A withdrawal always harvests; taking half leaves half still deposited.
    expect(withdraw(wallet1, 400_000).result).toBeOk(Cl.bool(true));
    expect(read("get-balance", [Cl.principal(wallet1)])).toBeUint(600_000);
    // Harvest zeroed accrued yield at the withdraw block.
    expect(read("get-yield", [Cl.principal(wallet1)])).toBeUint(0);
    // The remaining stake resumes accruing on the next blocks.
    simnet.mineEmptyBlocks(30);
    const y = read("get-yield", [Cl.principal(wallet1)]) as { value: bigint };
    expect(y.value).toBeGreaterThan(0n);
  });

  it("reverts a withdrawal the pool cannot cover (unfunded yield, u100)", () => {
    // No reserve: the pool holds only principal, so it cannot pay yield.
    fundWallet(wallet1, 1_000_000);
    deposit(wallet1, 1_000_000);
    simnet.mineEmptyBlocks(100); // accrue a yield claim with no backing
    // payout = principal + yield > custody, so sato-transfer.send reverts.
    expect(withdraw(wallet1, 1_000_000).result).toBeErr(Cl.uint(100));
  });

  it("rejects zero-amount and over-balance withdrawals", () => {
    fundWallet(wallet1, 500_000);
    deposit(wallet1, 500_000);
    expect(withdraw(wallet1, 0).result).toBeErr(Cl.uint(401)); // u401
    expect(withdraw(wallet1, 500_001).result).toBeErr(Cl.uint(400)); // u400
  });
});
describe("sato-yield-v2: reserve and discrete yield", () => {
  it("fund-reserve tops up custody without moving the index (permissionless)", () => {
    fundWallet(wallet1, 500_000);
    const { result, events } = fundReserve(wallet1, 500_000); // not the owner
    expect(result).toBeOk(Cl.bool(true));
    expect(poolCustody()).toBeUint(500_000); // real sBTC now backs the pool
    expect(read("get-acc-yield-per-share")).toBeUint(0); // index untouched
    expect(findPrint(events, "reserve-fund")).toBeDefined();
  });

  it("add-yield distributes pro-rata by principal (rate isolated to 0)", () => {
    setRate(0); // isolate the discrete distribution from time-based accrual
    fundWallet(wallet1, 3_000_000);
    fundWallet(wallet2, 1_000_000);
    deposit(wallet1, 3_000_000);
    deposit(wallet2, 1_000_000);

    fundWallet(deployer, 400_000);
    const { result, events } = addYield(400_000);
    expect(result).toBeOk(Cl.bool(true));
    expect(findPrint(events, "yield-added")).toBeDefined();
    // 4M principal, 400k yield -> 3:1 split.
    expect(read("get-yield", [Cl.principal(wallet1)])).toBeUint(300_000);
    expect(read("get-yield", [Cl.principal(wallet2)])).toBeUint(100_000);
  });
});
describe("sato-yield-v2: authorization and guards", () => {
  it("rejects add-yield from a non-owner (u402)", () => {
    expect(addYield(100_000, wallet1).result).toBeErr(Cl.uint(402));
  });

  it("rejects add-yield into an empty pool (u403)", () => {
    fundWallet(deployer, 100_000);
    expect(addYield(100_000).result).toBeErr(Cl.uint(403));
  });

  it("rejects a zero-amount add-yield (u401)", () => {
    expect(addYield(0).result).toBeErr(Cl.uint(401));
  });

  it("lets only the owner set the rate", () => {
    expect(setRate(500, wallet1).result).toBeErr(Cl.uint(402)); // non-owner
    const { result, events } = setRate(500); // owner
    expect(result).toBeOk(Cl.bool(true));
    expect(read("get-yield-rate")).toBeUint(500);
    expect(findPrint(events, "yield-rate-set")).toBeDefined();
  });
});
