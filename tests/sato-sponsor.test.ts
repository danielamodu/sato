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

  it("exposes the default per-user cap, window length, and a full initial allowance", () => {
    const cap = simnet.callReadOnlyFn(
      "sato-sponsor",
      "get-per-user-cap",
      [],
      deployer
    );
    expect(cap.result).toBeUint(10_000_000);

    const windowLen = simnet.callReadOnlyFn(
      "sato-sponsor",
      "get-window-length",
      [],
      deployer
    );
    expect(windowLen.result).toBeUint(144);

    const remaining = simnet.callReadOnlyFn(
      "sato-sponsor",
      "get-remaining-allowance",
      [Cl.principal(wallet1)],
      deployer
    );
    expect(remaining.result).toBeUint(10_000_000);
  });

  it("tracks window spend and remaining allowance per user", () => {
    // fund generously so the pool never limits before the cap
    simnet.callPublicFn("sato-sponsor", "top-up", [Cl.uint(100_000_000)], deployer);

    simnet.callPublicFn(
      "sato-sponsor",
      "sponsor-tx",
      [Cl.principal(wallet1), Cl.uint(4_000_000)],
      deployer
    );

    const spend = simnet.callReadOnlyFn(
      "sato-sponsor",
      "get-window-spend",
      [Cl.principal(wallet1)],
      deployer
    );
    expect(spend.result).toBeUint(4_000_000);

    const remaining = simnet.callReadOnlyFn(
      "sato-sponsor",
      "get-remaining-allowance",
      [Cl.principal(wallet1)],
      deployer
    );
    expect(remaining.result).toBeUint(6_000_000);
  });

  it("rejects sponsorship that would exceed the per-window cap with ERR_CAP_EXCEEDED (u303)", () => {
    simnet.callPublicFn("sato-sponsor", "top-up", [Cl.uint(100_000_000)], deployer);

    // consume most of the 10 STX cap
    simnet.callPublicFn(
      "sato-sponsor",
      "sponsor-tx",
      [Cl.principal(wallet1), Cl.uint(9_000_000)],
      deployer
    );

    // this 2 STX would push the window spend to 11 STX, past the 10 STX cap
    const { result } = simnet.callPublicFn(
      "sato-sponsor",
      "sponsor-tx",
      [Cl.principal(wallet1), Cl.uint(2_000_000)],
      deployer
    );
    expect(result).toBeErr(Cl.uint(303));

    // the failed sponsorship left the user's window spend untouched
    const spend = simnet.callReadOnlyFn(
      "sato-sponsor",
      "get-window-spend",
      [Cl.principal(wallet1)],
      deployer
    );
    expect(spend.result).toBeUint(9_000_000);
  });

  it("resets a user's allowance after the window rolls over", () => {
    simnet.callPublicFn("sato-sponsor", "top-up", [Cl.uint(100_000_000)], deployer);

    // spend the full cap in the current window
    simnet.callPublicFn(
      "sato-sponsor",
      "sponsor-tx",
      [Cl.principal(wallet1), Cl.uint(10_000_000)],
      deployer
    );
    const capped = simnet.callPublicFn(
      "sato-sponsor",
      "sponsor-tx",
      [Cl.principal(wallet1), Cl.uint(1)],
      deployer
    );
    expect(capped.result).toBeErr(Cl.uint(303));

    // advance past the window boundary (window-length = 144 blocks)
    simnet.mineEmptyBlocks(144);

    // allowance is full again in the new window
    const remaining = simnet.callReadOnlyFn(
      "sato-sponsor",
      "get-remaining-allowance",
      [Cl.principal(wallet1)],
      deployer
    );
    expect(remaining.result).toBeUint(10_000_000);

    // and a fresh sponsorship succeeds, starting the new window's spend from zero
    const { result } = simnet.callPublicFn(
      "sato-sponsor",
      "sponsor-tx",
      [Cl.principal(wallet1), Cl.uint(3_000_000)],
      deployer
    );
    expect(result).toBeOk(Cl.bool(true));

    const spend = simnet.callReadOnlyFn(
      "sato-sponsor",
      "get-window-spend",
      [Cl.principal(wallet1)],
      deployer
    );
    expect(spend.result).toBeUint(3_000_000);
  });

  it("lets the sponsor change the window length", () => {
    const { result, events } = simnet.callPublicFn(
      "sato-sponsor",
      "set-window-length",
      [Cl.uint(50)],
      deployer
    );
    expect(result).toBeOk(Cl.bool(true));
    const printEvent = events.find((e) => e.event === "print_event");
    expect(printEvent?.data).toMatchObject({
      topic: "print",
      value: { value: { event: { value: "sponsor-window-update" } } },
    });

    const windowLen = simnet.callReadOnlyFn(
      "sato-sponsor",
      "get-window-length",
      [],
      deployer
    );
    expect(windowLen.result).toBeUint(50);
  });

  it("rejects a zero window length with ERR_INVALID_AMOUNT (u302)", () => {
    const { result } = simnet.callPublicFn(
      "sato-sponsor",
      "set-window-length",
      [Cl.uint(0)],
      deployer
    );
    expect(result).toBeErr(Cl.uint(302));
  });

  it("rejects a window-length update from a non-sponsor with ERR_UNAUTHORIZED (u301)", () => {
    const { result } = simnet.callPublicFn(
      "sato-sponsor",
      "set-window-length",
      [Cl.uint(10)],
      wallet1
    );
    expect(result).toBeErr(Cl.uint(301));
  });

  it("enforces the cap per user independently", () => {
    simnet.callPublicFn("sato-sponsor", "top-up", [Cl.uint(100_000_000)], deployer);

    // wallet1 hits its cap
    simnet.callPublicFn(
      "sato-sponsor",
      "sponsor-tx",
      [Cl.principal(wallet1), Cl.uint(10_000_000)],
      deployer
    );
    const capped = simnet.callPublicFn(
      "sato-sponsor",
      "sponsor-tx",
      [Cl.principal(wallet1), Cl.uint(1)],
      deployer
    );
    expect(capped.result).toBeErr(Cl.uint(303));

    // wallet2 still has its full allowance
    const { result } = simnet.callPublicFn(
      "sato-sponsor",
      "sponsor-tx",
      [Cl.principal(wallet2), Cl.uint(5_000_000)],
      deployer
    );
    expect(result).toBeOk(Cl.bool(true));
  });

  it("lets the sponsor raise the cap and then sponsor more", () => {
    simnet.callPublicFn("sato-sponsor", "top-up", [Cl.uint(100_000_000)], deployer);
    simnet.callPublicFn(
      "sato-sponsor",
      "sponsor-tx",
      [Cl.principal(wallet1), Cl.uint(10_000_000)],
      deployer
    );

    // raise cap to 20 STX
    const { result, events } = simnet.callPublicFn(
      "sato-sponsor",
      "set-per-user-cap",
      [Cl.uint(20_000_000)],
      deployer
    );
    expect(result).toBeOk(Cl.bool(true));
    const printEvent = events.find((e) => e.event === "print_event");
    expect(printEvent?.data).toMatchObject({
      topic: "print",
      value: { value: { event: { value: "sponsor-cap-update" } } },
    });

    // now the previously-capped user can be sponsored again
    const retry = simnet.callPublicFn(
      "sato-sponsor",
      "sponsor-tx",
      [Cl.principal(wallet1), Cl.uint(5_000_000)],
      deployer
    );
    expect(retry.result).toBeOk(Cl.bool(true));
  });

  it("rejects a cap update from a non-sponsor with ERR_UNAUTHORIZED (u301)", () => {
    const { result } = simnet.callPublicFn(
      "sato-sponsor",
      "set-per-user-cap",
      [Cl.uint(1)],
      wallet1
    );
    expect(result).toBeErr(Cl.uint(301));
  });
});
