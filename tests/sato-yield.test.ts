import { Cl } from "@stacks/transactions";
import { describe, expect, it } from "vitest";

const accounts = simnet.getAccounts();
const deployer = accounts.get("deployer")!; // the contract owner / yield source
const wallet1 = accounts.get("wallet_1")!;
const wallet2 = accounts.get("wallet_2")!;

// Fund a principal's internal sBTC ledger so they can deposit.
const fund = (who: string, amount: number) =>
  simnet.callPublicFn("sato-yield", "fund-sbtc", [Cl.uint(amount)], who);

const deposit = (who: string, amount: number) =>
  simnet.callPublicFn("sato-yield", "deposit", [Cl.uint(amount)], who);

const readUint = (fn: string, args: any[] = [], sender = deployer) =>
  simnet.callReadOnlyFn("sato-yield", fn, args, sender).result;

describe("sato-yield", () => {
  it("starts with an empty pool", () => {
    expect(readUint("get-pool-total")).toBeUint(0);
    expect(readUint("get-pool-principal")).toBeUint(0);
    expect(readUint("get-balance", [Cl.principal(wallet1)])).toBeUint(0);
    expect(readUint("get-yield", [Cl.principal(wallet1)])).toBeUint(0);
  });

  it("funds an internal sBTC balance and emits an event", () => {
    const { result, events } = fund(wallet1, 1_000_000);
    expect(result).toBeOk(Cl.bool(true));
    const printEvent = events.find((e) => e.event === "print_event");
    expect(printEvent?.data).toMatchObject({
      topic: "print",
      value: { value: { event: { value: "sbtc-fund" } } },
    });
    expect(readUint("get-sbtc-balance", [Cl.principal(wallet1)])).toBeUint(
      1_000_000
    );
  });

  it("rejects a zero-amount fund with ERR_INVALID_AMOUNT (u401)", () => {
    const { result } = fund(wallet1, 0);
    expect(result).toBeErr(Cl.uint(401));
  });

  it("deposits sBTC, tracks principal and pool total, and emits an event", () => {
    fund(wallet1, 1_000_000);
    const { result, events } = deposit(wallet1, 600_000);
    expect(result).toBeOk(Cl.bool(true));

    const printEvent = events.find((e) => e.event === "print_event");
    expect(printEvent?.data).toMatchObject({
      topic: "print",
      value: { value: { event: { value: "yield-deposit" } } },
    });

    // principal tracked, sBTC ledger debited, pool total reflects the deposit
    expect(readUint("get-balance", [Cl.principal(wallet1)])).toBeUint(600_000);
    expect(readUint("get-sbtc-balance", [Cl.principal(wallet1)])).toBeUint(
      400_000
    );
    expect(readUint("get-pool-total")).toBeUint(600_000);
    // no yield added yet
    expect(readUint("get-yield", [Cl.principal(wallet1)])).toBeUint(0);
  });

  it("records the deposit height as a timestamp", () => {
    fund(wallet1, 1_000_000);
    deposit(wallet1, 500_000);
    // the deposit executes at the tip block, so the recorded height is the
    // current chain tip (read-only calls do not advance it)
    const recorded = readUint("get-deposit-height", [Cl.principal(wallet1)]);
    expect(recorded).toBeUint(simnet.blockHeight);
  });

  it("advances the recorded deposit height on a later deposit", () => {
    fund(wallet1, 1_000_000);
    deposit(wallet1, 300_000);
    const first = simnet.blockHeight;
    simnet.mineEmptyBlocks(10);
    deposit(wallet1, 300_000);
    const later = readUint("get-deposit-height", [Cl.principal(wallet1)]);
    // the second deposit is timestamped strictly later than the first
    expect(later).toBeUint(first + 11);
  });

  it("rejects a zero-amount deposit with ERR_INVALID_AMOUNT (u401)", () => {
    fund(wallet1, 1_000_000);
    const { result } = deposit(wallet1, 0);
    expect(result).toBeErr(Cl.uint(401));
  });

  it("rejects a deposit larger than the sBTC balance with ERR_INSUFFICIENT_BALANCE (u400)", () => {
    fund(wallet1, 100);
    const { result } = deposit(wallet1, 500);
    expect(result).toBeErr(Cl.uint(400));
  });

  it("distributes added yield pro-rata to a single depositor", () => {
    fund(wallet1, 1_000_000);
    deposit(wallet1, 1_000_000);

    // owner funds and adds 200k of yield
    fund(deployer, 200_000);
    const { result, events } = simnet.callPublicFn(
      "sato-yield",
      "add-yield",
      [Cl.uint(200_000)],
      deployer
    );
    expect(result).toBeOk(Cl.bool(true));
    const printEvent = events.find((e) => e.event === "print_event");
    expect(printEvent?.data).toMatchObject({
      topic: "print",
      value: { value: { event: { value: "yield-added" } } },
    });

    // sole depositor earns all of it
    expect(readUint("get-yield", [Cl.principal(wallet1)])).toBeUint(200_000);
    // principal unchanged, pool total grew by the yield
    expect(readUint("get-balance", [Cl.principal(wallet1)])).toBeUint(
      1_000_000
    );
    expect(readUint("get-pool-total")).toBeUint(1_200_000);
  });

  it("splits yield pro-rata across depositors by principal", () => {
    // wallet1 deposits 3, wallet2 deposits 1 -> 3:1 split
    fund(wallet1, 3_000_000);
    deposit(wallet1, 3_000_000);
    fund(wallet2, 1_000_000);
    deposit(wallet2, 1_000_000);

    fund(deployer, 400_000);
    simnet.callPublicFn("sato-yield", "add-yield", [Cl.uint(400_000)], deployer);

    // 4M principal, 400k yield -> wallet1 gets 300k, wallet2 gets 100k
    expect(readUint("get-yield", [Cl.principal(wallet1)])).toBeUint(300_000);
    expect(readUint("get-yield", [Cl.principal(wallet2)])).toBeUint(100_000);
  });

  it("only distributes to depositors present when yield was added", () => {
    fund(wallet1, 1_000_000);
    deposit(wallet1, 1_000_000);

    fund(deployer, 100_000);
    simnet.callPublicFn("sato-yield", "add-yield", [Cl.uint(100_000)], deployer);

    // wallet2 deposits AFTER the yield event -> earns nothing from it
    fund(wallet2, 1_000_000);
    deposit(wallet2, 1_000_000);

    expect(readUint("get-yield", [Cl.principal(wallet1)])).toBeUint(100_000);
    expect(readUint("get-yield", [Cl.principal(wallet2)])).toBeUint(0);
  });

  it("keeps earned yield when a depositor adds more principal", () => {
    fund(wallet1, 2_000_000);
    deposit(wallet1, 1_000_000);

    fund(deployer, 100_000);
    simnet.callPublicFn("sato-yield", "add-yield", [Cl.uint(100_000)], deployer);
    expect(readUint("get-yield", [Cl.principal(wallet1)])).toBeUint(100_000);

    // topping up harvests-and-holds the pending yield, principal grows
    deposit(wallet1, 1_000_000);
    expect(readUint("get-balance", [Cl.principal(wallet1)])).toBeUint(
      2_000_000
    );
    expect(readUint("get-yield", [Cl.principal(wallet1)])).toBeUint(100_000);
  });

  it("withdraws principal plus all earned yield and credits the sBTC ledger", () => {
    fund(wallet1, 1_000_000);
    deposit(wallet1, 1_000_000);
    fund(deployer, 250_000);
    simnet.callPublicFn("sato-yield", "add-yield", [Cl.uint(250_000)], deployer);

    const { result, events } = simnet.callPublicFn(
      "sato-yield",
      "withdraw",
      [Cl.uint(1_000_000)],
      wallet1
    );
    expect(result).toBeOk(Cl.bool(true));
    const printEvent = events.find((e) => e.event === "print_event");
    expect(printEvent?.data).toMatchObject({
      topic: "print",
      value: { value: { event: { value: "yield-withdraw" } } },
    });

    // ledger credited with principal + yield = 1.25M
    expect(readUint("get-sbtc-balance", [Cl.principal(wallet1)])).toBeUint(
      1_250_000
    );
    // position fully cleared
    expect(readUint("get-balance", [Cl.principal(wallet1)])).toBeUint(0);
    expect(readUint("get-yield", [Cl.principal(wallet1)])).toBeUint(0);
  });

  it("harvests all yield on a partial principal withdrawal", () => {
    fund(wallet1, 1_000_000);
    deposit(wallet1, 1_000_000);
    fund(deployer, 100_000);
    simnet.callPublicFn("sato-yield", "add-yield", [Cl.uint(100_000)], deployer);

    // withdraw only 400k of principal; all 100k yield comes out too
    simnet.callPublicFn(
      "sato-yield",
      "withdraw",
      [Cl.uint(400_000)],
      wallet1
    );
    expect(readUint("get-sbtc-balance", [Cl.principal(wallet1)])).toBeUint(
      500_000
    );
    expect(readUint("get-balance", [Cl.principal(wallet1)])).toBeUint(600_000);
    expect(readUint("get-yield", [Cl.principal(wallet1)])).toBeUint(0);
  });

  it("rejects a withdrawal larger than the deposited principal with ERR_INSUFFICIENT_BALANCE (u400)", () => {
    fund(wallet1, 1_000_000);
    deposit(wallet1, 1_000_000);
    const { result } = simnet.callPublicFn(
      "sato-yield",
      "withdraw",
      [Cl.uint(2_000_000)],
      wallet1
    );
    expect(result).toBeErr(Cl.uint(400));
  });

  it("rejects a zero-amount withdrawal with ERR_INVALID_AMOUNT (u401)", () => {
    fund(wallet1, 1_000_000);
    deposit(wallet1, 1_000_000);
    const { result } = simnet.callPublicFn(
      "sato-yield",
      "withdraw",
      [Cl.uint(0)],
      wallet1
    );
    expect(result).toBeErr(Cl.uint(401));
  });

  it("rejects add-yield from a non-owner with ERR_UNAUTHORIZED (u402)", () => {
    fund(wallet1, 1_000_000);
    deposit(wallet1, 1_000_000);
    fund(wallet1, 100_000);
    const { result } = simnet.callPublicFn(
      "sato-yield",
      "add-yield",
      [Cl.uint(100_000)],
      wallet1
    );
    expect(result).toBeErr(Cl.uint(402));
  });

  it("rejects add-yield into an empty pool with ERR_EMPTY_POOL (u403)", () => {
    fund(deployer, 100_000);
    const { result } = simnet.callPublicFn(
      "sato-yield",
      "add-yield",
      [Cl.uint(100_000)],
      deployer
    );
    expect(result).toBeErr(Cl.uint(403));
  });

  it("rejects a zero-amount add-yield with ERR_INVALID_AMOUNT (u401)", () => {
    fund(wallet1, 1_000_000);
    deposit(wallet1, 1_000_000);
    const { result } = simnet.callPublicFn(
      "sato-yield",
      "add-yield",
      [Cl.uint(0)],
      deployer
    );
    expect(result).toBeErr(Cl.uint(401));
  });

  it("rejects add-yield the owner cannot fund with ERR_INSUFFICIENT_BALANCE (u400)", () => {
    fund(wallet1, 1_000_000);
    deposit(wallet1, 1_000_000);
    // owner has no sBTC funded
    const { result } = simnet.callPublicFn(
      "sato-yield",
      "add-yield",
      [Cl.uint(100_000)],
      deployer
    );
    expect(result).toBeErr(Cl.uint(400));
  });

  it("handles a full lifecycle across two depositors", () => {
    fund(wallet1, 1_000_000);
    fund(wallet2, 1_000_000);
    deposit(wallet1, 1_000_000);
    deposit(wallet2, 1_000_000);

    // add 200k yield, split 100k / 100k
    fund(deployer, 200_000);
    simnet.callPublicFn("sato-yield", "add-yield", [Cl.uint(200_000)], deployer);
    expect(readUint("get-pool-total")).toBeUint(2_200_000);

    // wallet1 exits fully: 1M principal + 100k yield
    simnet.callPublicFn("sato-yield", "withdraw", [Cl.uint(1_000_000)], wallet1);
    expect(readUint("get-sbtc-balance", [Cl.principal(wallet1)])).toBeUint(
      1_100_000
    );

    // add another 100k yield; only wallet2 remains, earns all of it
    fund(deployer, 100_000);
    simnet.callPublicFn("sato-yield", "add-yield", [Cl.uint(100_000)], deployer);
    expect(readUint("get-yield", [Cl.principal(wallet2)])).toBeUint(200_000);

    // wallet2 exits: 1M + 200k
    simnet.callPublicFn("sato-yield", "withdraw", [Cl.uint(1_000_000)], wallet2);
    expect(readUint("get-sbtc-balance", [Cl.principal(wallet2)])).toBeUint(
      1_200_000
    );

    // pool principal fully drained
    expect(readUint("get-pool-principal")).toBeUint(0);
  });
});
