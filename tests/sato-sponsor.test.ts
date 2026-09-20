import { Cl } from "@stacks/transactions";
import { describe, expect, it } from "vitest";

const accounts = simnet.getAccounts();
const deployer = accounts.get("deployer")!; // the designated sponsor
const wallet1 = accounts.get("wallet_1")!;
const wallet2 = accounts.get("wallet_2")!;

describe("sato-sponsor", () => {
  it("reports the deployer as the sponsor and starts with a zero balance", () => {
    const sponsor = simnet.callReadOnlyFn(
      "sato-sponsor",
      "get-sponsor",
      [],
      deployer
    );
    expect(sponsor.result).toBePrincipal(deployer);

    const balance = simnet.callReadOnlyFn(
      "sato-sponsor",
      "get-sponsor-balance",
      [],
      deployer
    );
    expect(balance.result).toBeUint(0);
  });

  it("tops up the pool, credits the balance, and emits an event", () => {
    const { result, events } = simnet.callPublicFn(
      "sato-sponsor",
      "top-up",
      [Cl.uint(1_000_000)],
      deployer
    );
    expect(result).toBeOk(Cl.bool(true));

    // one print event + the STX transfer event
    const printEvent = events.find((e) => e.event === "print_event");
    expect(printEvent?.data).toMatchObject({
      topic: "print",
      value: { value: { event: { value: "sponsor-top-up" } } },
    });

    const balance = simnet.callReadOnlyFn(
      "sato-sponsor",
      "get-sponsor-balance",
      [],
      deployer
    );
    expect(balance.result).toBeUint(1_000_000);
  });

  it("allows anyone to top up the pool", () => {
    simnet.callPublicFn("sato-sponsor", "top-up", [Cl.uint(500)], wallet1);
    const { result } = simnet.callPublicFn(
      "sato-sponsor",
      "top-up",
      [Cl.uint(500)],
      wallet2
    );
    expect(result).toBeOk(Cl.bool(true));

    const balance = simnet.callReadOnlyFn(
      "sato-sponsor",
      "get-sponsor-balance",
      [],
      deployer
    );
    expect(balance.result).toBeUint(1000);
  });

  it("rejects a zero-amount top-up with ERR_INVALID_AMOUNT (u302)", () => {
    const { result } = simnet.callPublicFn(
      "sato-sponsor",
      "top-up",
      [Cl.uint(0)],
      deployer
    );
    expect(result).toBeErr(Cl.uint(302));
  });

  it("sponsors a tx, debits the pool, tracks the count, and emits an event", () => {
    simnet.callPublicFn("sato-sponsor", "top-up", [Cl.uint(1_000_000)], deployer);

    const { result, events } = simnet.callPublicFn(
      "sato-sponsor",
      "sponsor-tx",
      [Cl.principal(wallet1), Cl.uint(400_000)],
      deployer
    );
    expect(result).toBeOk(Cl.bool(true));

    const printEvent = events.find((e) => e.event === "print_event");
    expect(printEvent?.data).toMatchObject({
      topic: "print",
      value: { value: { event: { value: "sponsor-tx" } } },
    });

    // pool debited
    const balance = simnet.callReadOnlyFn(
      "sato-sponsor",
      "get-sponsor-balance",
      [],
      deployer
    );
    expect(balance.result).toBeUint(600_000);

    // per-user count incremented
    const count = simnet.callReadOnlyFn(
      "sato-sponsor",
      "get-sponsored-count",
      [Cl.principal(wallet1)],
      deployer
    );
    expect(count.result).toBeUint(1);
  });

  it("increments the sponsored count across multiple sponsorships", () => {
    simnet.callPublicFn("sato-sponsor", "top-up", [Cl.uint(1_000_000)], deployer);
    simnet.callPublicFn(
      "sato-sponsor",
      "sponsor-tx",
      [Cl.principal(wallet1), Cl.uint(100)],
      deployer
    );
    simnet.callPublicFn(
      "sato-sponsor",
      "sponsor-tx",
      [Cl.principal(wallet1), Cl.uint(100)],
      deployer
    );

    const count = simnet.callReadOnlyFn(
      "sato-sponsor",
      "get-sponsored-count",
      [Cl.principal(wallet1)],
      deployer
    );
    expect(count.result).toBeUint(2);
  });

  it("rejects sponsorship from a non-sponsor with ERR_UNAUTHORIZED (u301)", () => {
    simnet.callPublicFn("sato-sponsor", "top-up", [Cl.uint(1_000_000)], deployer);

    // wallet1 is not the sponsor
    const { result } = simnet.callPublicFn(
      "sato-sponsor",
      "sponsor-tx",
      [Cl.principal(wallet2), Cl.uint(100)],
      wallet1
    );
    expect(result).toBeErr(Cl.uint(301));
  });

  it("rejects sponsorship exceeding the pool with ERR_INSUFFICIENT_SPONSOR_BALANCE (u300)", () => {
    simnet.callPublicFn("sato-sponsor", "top-up", [Cl.uint(100)], deployer);

    const { result } = simnet.callPublicFn(
      "sato-sponsor",
      "sponsor-tx",
      [Cl.principal(wallet1), Cl.uint(500)],
      deployer
    );
    expect(result).toBeErr(Cl.uint(300));
  });

  it("rejects a zero-fee sponsorship with ERR_INVALID_AMOUNT (u302)", () => {
    simnet.callPublicFn("sato-sponsor", "top-up", [Cl.uint(1_000_000)], deployer);

    const { result } = simnet.callPublicFn(
      "sato-sponsor",
      "sponsor-tx",
      [Cl.principal(wallet1), Cl.uint(0)],
      deployer
    );
    expect(result).toBeErr(Cl.uint(302));
  });
});
