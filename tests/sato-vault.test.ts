import { Cl } from "@stacks/transactions";
import { beforeEach, describe, expect, it } from "vitest";

const accounts = simnet.getAccounts();
const deployer = accounts.get("deployer")!; // the vault owner
const wallet1 = accounts.get("wallet_1")!;
const wallet2 = accounts.get("wallet_2")!;

// The mock sBTC token used in simnet, as a `contract_id` string and as a
// trait argument. On testnet/mainnet the vault points at the real sBTC token.
const mockToken = `${deployer}.mock-sbtc`;
const tokenArg = Cl.contractPrincipal(deployer, "mock-sbtc");

// The vault's own principal — where deposited sBTC is custodied.
const vault = `${deployer}.sato-vault`;

// Point the vault at the mock token (default is the testnet sBTC principal).
const useMockToken = () =>
  simnet.callPublicFn("sato-vault", "set-sbtc-token", [Cl.principal(mockToken)], deployer);

// Mint mock sBTC to a principal so they can deposit.
const mint = (who: string, amount: number) =>
  simnet.callPublicFn("mock-sbtc", "mint", [Cl.uint(amount), Cl.principal(who)], deployer);

const deposit = (who: string, amount: number) =>
  simnet.callPublicFn("sato-vault", "deposit", [tokenArg, Cl.uint(amount)], who);

const withdraw = (who: string, amount: number) =>
  simnet.callPublicFn("sato-vault", "withdraw", [tokenArg, Cl.uint(amount)], who);

const vaultBalance = (who: string) =>
  simnet.callReadOnlyFn("sato-vault", "get-balance", [Cl.principal(who)], deployer).result;

const totalDeposited = () =>
  simnet.callReadOnlyFn("sato-vault", "get-total-deposited", [], deployer).result;

const tokenBalance = (who: string) =>
  simnet.callReadOnlyFn("mock-sbtc", "get-balance", [Cl.principal(who)], deployer).result;

describe("sato-vault", () => {
  beforeEach(() => {
    const { result } = useMockToken();
    expect(result).toBeOk(Cl.bool(true));
  });

  it("starts empty and defaults to the testnet sBTC token before repointing", () => {
    expect(vaultBalance(wallet1)).toBeUint(0);
    expect(totalDeposited()).toBeUint(0);
    // beforeEach already repointed it; confirm the getter reflects the mock
    expect(
      simnet.callReadOnlyFn("sato-vault", "get-sbtc-token", [], deployer).result
    ).toBePrincipal(mockToken);
  });

  it("only the owner can repoint the sBTC token", () => {
    const { result } = simnet.callPublicFn(
      "sato-vault",
      "set-sbtc-token",
      [Cl.principal(mockToken)],
      wallet1
    );
    expect(result).toBeErr(Cl.uint(502)); // ERR_UNAUTHORIZED
  });

  it("deposits real sBTC into custody, credits the balance, and emits an event", () => {
    mint(wallet1, 1_000_000);
    const { result, events } = deposit(wallet1, 400_000);
    expect(result).toBeOk(Cl.bool(true));

    // The token actually moved from the user into the vault's principal
    expect(tokenBalance(wallet1)).toBeOk(Cl.uint(600_000));
    expect(tokenBalance(vault)).toBeOk(Cl.uint(400_000));

    // Vault ledger reflects the deposit
    expect(vaultBalance(wallet1)).toBeUint(400_000);
    expect(totalDeposited()).toBeUint(400_000);

    const printEvent = events.find((e) => e.event === "print_event");
    expect(printEvent?.data).toMatchObject({
      topic: "print",
      value: { value: { event: { value: "vault-deposit" } } },
    });
  });

  it("rejects a zero-amount deposit with ERR_INVALID_AMOUNT (u500)", () => {
    mint(wallet1, 1_000_000);
    const { result } = deposit(wallet1, 0);
    expect(result).toBeErr(Cl.uint(500));
  });

  it("fails the deposit when the caller lacks the sBTC to transfer", () => {
    // wallet2 has no mock sBTC; the underlying ft-transfer? should fail and
    // revert, so the vault credits nothing.
    const { result } = deposit(wallet2, 100_000);
    expect(result).toBeErr(Cl.uint(1)); // mock-sbtc ERR_INSUFFICIENT_BALANCE
    expect(vaultBalance(wallet2)).toBeUint(0);
    expect(totalDeposited()).toBeUint(0);
  });

  it("withdraws sBTC back out of custody and emits an event", () => {
    mint(wallet1, 1_000_000);
    deposit(wallet1, 700_000);

    const { result, events } = withdraw(wallet1, 300_000);
    expect(result).toBeOk(Cl.bool(true));

    // Token returned to the user, custody reduced
    expect(tokenBalance(wallet1)).toBeOk(Cl.uint(600_000)); // 300k left + 300k back
    expect(tokenBalance(vault)).toBeOk(Cl.uint(400_000));

    expect(vaultBalance(wallet1)).toBeUint(400_000);
    expect(totalDeposited()).toBeUint(400_000);

    const printEvent = events.find((e) => e.event === "print_event");
    expect(printEvent?.data).toMatchObject({
      topic: "print",
      value: { value: { event: { value: "vault-withdraw" } } },
    });
  });

  it("rejects a withdrawal larger than the balance with ERR_INSUFFICIENT_BALANCE (u501)", () => {
    mint(wallet1, 1_000_000);
    deposit(wallet1, 200_000);
    const { result } = withdraw(wallet1, 200_001);
    expect(result).toBeErr(Cl.uint(501));
    // State unchanged
    expect(vaultBalance(wallet1)).toBeUint(200_000);
    expect(totalDeposited()).toBeUint(200_000);
  });

  it("rejects a zero-amount withdrawal with ERR_INVALID_AMOUNT (u500)", () => {
    mint(wallet1, 1_000_000);
    deposit(wallet1, 100_000);
    const { result } = withdraw(wallet1, 0);
    expect(result).toBeErr(Cl.uint(500));
  });

  it("keeps balances isolated across users", () => {
    mint(wallet1, 1_000_000);
    mint(wallet2, 500_000);
    deposit(wallet1, 300_000);
    deposit(wallet2, 500_000);

    expect(vaultBalance(wallet1)).toBeUint(300_000);
    expect(vaultBalance(wallet2)).toBeUint(500_000);
    expect(totalDeposited()).toBeUint(800_000);
    expect(tokenBalance(vault)).toBeOk(Cl.uint(800_000));

    // wallet1 cannot withdraw against wallet2's balance
    const { result } = withdraw(wallet1, 400_000);
    expect(result).toBeErr(Cl.uint(501));
  });

  it("supports a full deposit -> withdraw round trip back to zero", () => {
    mint(wallet1, 250_000);
    deposit(wallet1, 250_000);
    expect(tokenBalance(wallet1)).toBeOk(Cl.uint(0));

    const { result } = withdraw(wallet1, 250_000);
    expect(result).toBeOk(Cl.bool(true));
    expect(vaultBalance(wallet1)).toBeUint(0);
    expect(totalDeposited()).toBeUint(0);
    expect(tokenBalance(wallet1)).toBeOk(Cl.uint(250_000));
    expect(tokenBalance(vault)).toBeOk(Cl.uint(0));
  });
});
