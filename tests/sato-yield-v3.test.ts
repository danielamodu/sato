import { Cl } from "@stacks/transactions";
import { describe, expect, it } from "vitest";

const accounts = simnet.getAccounts();
const deployer = accounts.get("deployer")!; // contract owner (sets the rates)
const wallet1 = accounts.get("wallet_1")!;
const wallet2 = accounts.get("wallet_2")!;

const C = "sato-yield-v3";

// Accrual params -- must mirror the contract constants exactly.
const BLOCKS_PER_YEAR = 52_560n;
const BASE = 2_000_000n; // base-rate-bps  (20,000% APR, liquid tier)
const BOOST = 4_000_000n; // boost-rate-bps (40,000% APR, locked tier)

// Exact integer replica of the contract's accrual math. Every divide floors,
// as Clarity uint division does, so expectations are computed, not guessed.
const accrued = (b: bigint, elapsed: bigint, rate: bigint) =>
  b > 0n && elapsed > 0n
    ? (b * rate * elapsed) / (BLOCKS_PER_YEAR * 10_000n)
    : 0n;

const call = (fn: string, args: any[], sender: string) =>
  simnet.callPublicFn(C, fn, args, sender);
const read = (fn: string, args: any[] = [], sender = deployer) =>
  simnet.callReadOnlyFn(C, fn, args, sender).result;

const deposit = (who: string, amount: number) =>
  call("deposit", [Cl.uint(amount)], who);
const send = (from: string, to: string, amount: number) =>
  call("send", [Cl.principal(to), Cl.uint(amount)], from);
const lock = (who: string, amount: number, term: number) =>
  call("lock", [Cl.uint(amount), Cl.uint(term)], who);
const claimLock = (who: string) => call("claim-lock", [], who);
const setBaseRate = (bps: number, who = deployer) =>
  call("set-base-rate", [Cl.uint(bps)], who);
const setBoostRate = (bps: number, who = deployer) =>
  call("set-boost-rate", [Cl.uint(bps)], who);

const balance = (who: string) => read("get-balance", [Cl.principal(who)]);
const bal = (who: string) => (balance(who) as { value: bigint }).value;
const lockValue = (who: string) => read("get-lock-value", [Cl.principal(who)]);

// Match a contract `print` event by its `event:` tag (settle may emit its own
// "yield-settled" print first, so match by name rather than taking the first).
const findPrint = (events: any[], name: string) =>
  events.find(
    (e) =>
      e.event === "print_event" && e.data?.value?.value?.event?.value === name
  );

describe("sato-yield-v3: setup", () => {
  it("starts empty with the testnet default rates", () => {
    expect(read("get-total-supply")).toBeUint(0);
    expect(read("get-total-yield-paid")).toBeUint(0);
    expect(read("get-base-rate")).toBeUint(Number(BASE));
    expect(read("get-boost-rate")).toBeUint(Number(BOOST));
    expect(balance(wallet1)).toBeUint(0);
    expect(lockValue(wallet1)).toBeUint(0);
  });
});

describe("sato-yield-v3: faucet + ledger", () => {
  it("deposit credits the caller and grows total supply", () => {
    const { result, events } = deposit(wallet1, 1_000_000);
    expect(result).toBeOk(Cl.bool(true));
    // Freshly settled at this tip (elapsed 0), so no yield yet.
    expect(balance(wallet1)).toBeUint(1_000_000);
    expect(read("get-total-supply")).toBeUint(1_000_000);
    expect(findPrint(events, "sbtc-mint")).toBeDefined();
  });

  it("rejects a zero-amount deposit (u501)", () => {
    expect(deposit(wallet1, 0).result).toBeErr(Cl.uint(501));
  });
});

describe("sato-yield-v3: automatic yield on the held balance (no deposit step)", () => {
  it("the liquid balance grows every block at the base rate", () => {
    deposit(wallet1, 1_000_000);
    const depH = simnet.blockHeight;
    expect(balance(wallet1)).toBeUint(1_000_000); // elapsed 0
    expect(read("pending-balance-yield", [Cl.principal(wallet1)])).toBeUint(0);

    simnet.mineEmptyBlocks(100);
    const e1 = BigInt(simnet.blockHeight - depH); // 100
    expect(read("pending-balance-yield", [Cl.principal(wallet1)])).toBeUint(
      Number(accrued(1_000_000n, e1, BASE))
    );
    expect(balance(wallet1)).toBeUint(Number(1_000_000n + accrued(1_000_000n, e1, BASE)));

    simnet.mineEmptyBlocks(150);
    const e2 = BigInt(simnet.blockHeight - depH); // 250
    expect(e2).toBeGreaterThan(e1);
    expect(balance(wallet1)).toBeUint(Number(1_000_000n + accrued(1_000_000n, e2, BASE)));
  });

  it("an account that never held anything earns nothing", () => {
    expect(balance(wallet2)).toBeUint(0);
    simnet.mineEmptyBlocks(200);
    expect(balance(wallet2)).toBeUint(0);
  });

  it("stops growing once the owner sets the base rate to zero", () => {
    setBaseRate(0);
    deposit(wallet1, 1_000_000);
    simnet.mineEmptyBlocks(100);
    expect(balance(wallet1)).toBeUint(1_000_000); // rate 0 -> no accrual
  });
});

describe("sato-yield-v3: send settles both sides, then moves realized sats", () => {
  it("transfers value and banks the sender's accrued yield", () => {
    deposit(wallet1, 1_000_000);
    const depH = simnet.blockHeight;
    simnet.mineEmptyBlocks(50);

    const { result, events } = send(wallet1, wallet2, 400_000);
    expect(result).toBeOk(Cl.bool(true));
    const e = BigInt(simnet.blockHeight - depH); // includes the send block
    const settledW1 = 1_000_000n + accrued(1_000_000n, e, BASE);

    // Sender: settled balance minus what was sent; recipient: exactly received.
    expect(balance(wallet1)).toBeUint(Number(settledW1 - 400_000n));
    expect(balance(wallet2)).toBeUint(400_000);
    expect(findPrint(events, "sbtc-transfer")).toBeDefined();

    // Both keep earning afterward, each on its own balance (no shared pool).
    const w1 = settledW1 - 400_000n;
    simnet.mineEmptyBlocks(10);
    expect(balance(wallet1)).toBeUint(Number(w1 + accrued(w1, 10n, BASE)));
    expect(balance(wallet2)).toBeUint(Number(400_000n + accrued(400_000n, 10n, BASE)));
  });

  it("rejects self-transfer (u502), zero (u501), and overspend (u500)", () => {
    deposit(wallet1, 500_000);
    expect(send(wallet1, wallet1, 100).result).toBeErr(Cl.uint(502));
    expect(send(wallet1, wallet2, 0).result).toBeErr(Cl.uint(501));
    expect(send(wallet1, wallet2, 10_000_000).result).toBeErr(Cl.uint(500));
  });
});

describe("sato-yield-v3: lock tier (optional deposit for the boost rate)", () => {
  it("moves sats out of the liquid balance into a boost-earning lock", () => {
    deposit(wallet1, 1_000_000);
    const depH = simnet.blockHeight;
    simnet.mineEmptyBlocks(10);

    const { result, events } = lock(wallet1, 500_000, 100);
    expect(result).toBeOk(Cl.bool(true));
    const eLock = BigInt(simnet.blockHeight - depH); // base accrued before locking
    const liquidAfter = 1_000_000n + accrued(1_000_000n, eLock, BASE) - 500_000n;

    expect(balance(wallet1)).toBeUint(Number(liquidAfter)); // remaining liquid
    expect(lockValue(wallet1)).toBeUint(500_000); // lock just opened
    expect(findPrint(events, "yield-lock")).toBeDefined();

    // Both tiers accrue in parallel, on disjoint sats (nothing double-earns).
    simnet.mineEmptyBlocks(20);
    expect(balance(wallet1)).toBeUint(Number(liquidAfter + accrued(liquidAfter, 20n, BASE)));
    expect(lockValue(wallet1)).toBeUint(Number(500_000n + accrued(500_000n, 20n, BOOST)));
    // Boost out-earns base on equal principal over equal time.
    expect(accrued(500_000n, 20n, BOOST)).toBeGreaterThan(accrued(500_000n, 20n, BASE));
  });

  it("guards: positive amount/term (u501), enough balance (u500), one lock (u505)", () => {
    deposit(wallet1, 1_000_000);
    expect(lock(wallet1, 0, 100).result).toBeErr(Cl.uint(501));
    expect(lock(wallet1, 100, 0).result).toBeErr(Cl.uint(501));
    expect(lock(wallet1, 5_000_000, 100).result).toBeErr(Cl.uint(500));
    expect(lock(wallet1, 300_000, 100).result).toBeOk(Cl.bool(true));
    expect(lock(wallet1, 100_000, 100).result).toBeErr(Cl.uint(505));
  });

  it("claim before maturity reverts (u504); after maturity pays principal + boost", () => {
    deposit(wallet1, 1_000_000);
    lock(wallet1, 500_000, 50);
    const lockH = simnet.blockHeight; // the lock's accrual checkpoint
    expect(claimLock(wallet1).result).toBeErr(Cl.uint(504)); // not matured

    simnet.mineEmptyBlocks(60); // pass the 50-block term
    const before = bal(wallet1);

    const { result, events } = claimLock(wallet1);
    expect(result).toBeOk(Cl.bool(true));
    const boostYield = accrued(500_000n, BigInt(simnet.blockHeight - lockH), BOOST);
    expect(findPrint(events, "yield-claim")).toBeDefined();

    // Lock cleared; principal + boost yield returned to the liquid balance.
    expect(lockValue(wallet1)).toBeUint(0);
    expect(bal(wallet1)).toBeGreaterThanOrEqual(before + 500_000n + boostYield);
    // Nothing left to claim.
    expect(claimLock(wallet1).result).toBeErr(Cl.uint(506));
  });
});

describe("sato-yield-v3: admin (only the owner sets rates)", () => {
  it("rejects a non-owner (u503) and applies owner updates", () => {
    expect(setBaseRate(500, wallet1).result).toBeErr(Cl.uint(503));
    expect(setBoostRate(500, wallet1).result).toBeErr(Cl.uint(503));

    const b = setBaseRate(1000);
    expect(b.result).toBeOk(Cl.bool(true));
    expect(read("get-base-rate")).toBeUint(1000);
    expect(findPrint(b.events, "base-rate-set")).toBeDefined();

    const o = setBoostRate(3000);
    expect(o.result).toBeOk(Cl.bool(true));
    expect(read("get-boost-rate")).toBeUint(3000);
    expect(findPrint(o.events, "boost-rate-set")).toBeDefined();
  });
});
