import { Cl } from "@stacks/transactions";
import { describe, expect, it } from "vitest";

const accounts = simnet.getAccounts();
const deployer = accounts.get("deployer")!;
const wallet1 = accounts.get("wallet_1")!;
const wallet2 = accounts.get("wallet_2")!;
const wallet3 = accounts.get("wallet_3")!;

describe("sato-transfer", () => {
  it("mints sBTC and reports balances", () => {
    const { result } = simnet.callPublicFn(
      "sato-transfer",
      "mint",
      [Cl.principal(wallet1), Cl.uint(1000)],
      deployer
    );
    expect(result).toBeOk(Cl.bool(true));

    const balance = simnet.callReadOnlyFn(
      "sato-transfer",
      "get-balance",
      [Cl.principal(wallet1)],
      deployer
    );
    expect(balance.result).toBeUint(1000);
  });

  it("sends sBTC between principals and emits a transfer event", () => {
    simnet.callPublicFn(
      "sato-transfer",
      "mint",
      [Cl.principal(wallet1), Cl.uint(1000)],
      deployer
    );

    const { result, events } = simnet.callPublicFn(
      "sato-transfer",
      "send",
      [Cl.principal(wallet2), Cl.uint(400)],
      wallet1
    );
    expect(result).toBeOk(Cl.bool(true));

    //exactly one print event
    expect(events).toHaveLength(1);
    expect(events[0].event).toBe("print_event");
    expect(events[0].data).toMatchObject({
      topic: "print",
      value: { value: { event: { value: "sbtc-transfer" } } },
    });

    const senderBal = simnet.callReadOnlyFn(
      "sato-transfer",
      "get-balance",
      [Cl.principal(wallet1)],
      deployer
    );
    const recipientBal = simnet.callReadOnlyFn(
      "sato-transfer",
      "get-balance",
      [Cl.principal(wallet2)],
      deployer
    );
    expect(senderBal.result).toBeUint(600);
    expect(recipientBal.result).toBeUint(400);
  });

  it("rejects zero-amount sends with ERR_INVALID_AMOUNT (u101)", () => {
    const { result } = simnet.callPublicFn(
      "sato-transfer",
      "send",
      [Cl.principal(wallet2), Cl.uint(0)],
      wallet1
    );
    expect(result).toBeErr(Cl.uint(101));
  });

  it("rejects self-transfers with ERR_SELF_TRANSFER (u102)", () => {
    simnet.callPublicFn(
      "sato-transfer",
      "mint",
      [Cl.principal(wallet1), Cl.uint(100)],
      deployer
    );
    const { result } = simnet.callPublicFn(
      "sato-transfer",
      "send",
      [Cl.principal(wallet1), Cl.uint(10)],
      wallet1
    );
    expect(result).toBeErr(Cl.uint(102));
  });

  it("rejects sends exceeding balance with ERR_INSUFFICIENT_BALANCE (u100)", () => {
    // wallet3 starts with 0 balance
    const { result } = simnet.callPublicFn(
      "sato-transfer",
      "send",
      [Cl.principal(wallet2), Cl.uint(50)],
      wallet3
    );
    expect(result).toBeErr(Cl.uint(100));
  });

  it("deposit credits the caller", () => {
    const { result } = simnet.callPublicFn(
      "sato-transfer",
      "deposit",
      [Cl.uint(250)],
      wallet2
    );
    expect(result).toBeOk(Cl.bool(true));

    const balance = simnet.callReadOnlyFn(
      "sato-transfer",
      "get-balance",
      [Cl.principal(wallet2)],
      deployer
    );
    expect(balance.result).toBeUint(250);
  });
});
