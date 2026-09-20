import { Cl } from "@stacks/transactions";
import { describe, expect, it } from "vitest";

const accounts = simnet.getAccounts();
const deployer = accounts.get("deployer")!;
const wallet1 = accounts.get("wallet_1")!;
const wallet2 = accounts.get("wallet_2")!;

describe("sato-names", () => {
  it("registers a username and emits a register event", () => {
    const { result, events } = simnet.callPublicFn(
      "sato-names",
      "register-name",
      [Cl.stringAscii("alice")],
      wallet1
    );
    expect(result).toBeOk(Cl.bool(true));

    // exactly one print event
    expect(events).toHaveLength(1);
    expect(events[0].event).toBe("print_event");
    expect(events[0].data).toMatchObject({
      topic: "print",
      value: { value: { event: { value: "name-register" } } },
    });
  });

  it("resolves a username to its principal", () => {
    simnet.callPublicFn(
      "sato-names",
      "register-name",
      [Cl.stringAscii("alice")],
      wallet1
    );

    const resolved = simnet.callReadOnlyFn(
      "sato-names",
      "resolve-name",
      [Cl.stringAscii("alice")],
      deployer
    );
    expect(resolved.result).toBeSome(Cl.principal(wallet1));
  });

  it("looks up the username a principal registered", () => {
    simnet.callPublicFn(
      "sato-names",
      "register-name",
      [Cl.stringAscii("alice")],
      wallet1
    );

    const name = simnet.callReadOnlyFn(
      "sato-names",
      "get-name",
      [Cl.principal(wallet1)],
      deployer
    );
    expect(name.result).toBeSome(Cl.stringAscii("alice"));
  });

  it("reports availability of a username", () => {
    const before = simnet.callReadOnlyFn(
      "sato-names",
      "is-name-available",
      [Cl.stringAscii("alice")],
      deployer
    );
    expect(before.result).toBeBool(true);

    simnet.callPublicFn(
      "sato-names",
      "register-name",
      [Cl.stringAscii("alice")],
      wallet1
    );

    const after = simnet.callReadOnlyFn(
      "sato-names",
      "is-name-available",
      [Cl.stringAscii("alice")],
      deployer
    );
    expect(after.result).toBeBool(false);
  });

  it("rejects duplicate username registration with ERR_ALREADY_REGISTERED (u200)", () => {
    simnet.callPublicFn(
      "sato-names",
      "register-name",
      [Cl.stringAscii("alice")],
      wallet1
    );

    // wallet2 tries to claim the same name
    const { result } = simnet.callPublicFn(
      "sato-names",
      "register-name",
      [Cl.stringAscii("alice")],
      wallet2
    );
    expect(result).toBeErr(Cl.uint(200));
  });

  it("rejects a principal registering a second username with ERR_ALREADY_REGISTERED (u200)", () => {
    simnet.callPublicFn(
      "sato-names",
      "register-name",
      [Cl.stringAscii("alice")],
      wallet1
    );

    const { result } = simnet.callPublicFn(
      "sato-names",
      "register-name",
      [Cl.stringAscii("alice2")],
      wallet1
    );
    expect(result).toBeErr(Cl.uint(200));
  });

  it("rejects an empty username with ERR_INVALID_NAME (u203)", () => {
    const { result } = simnet.callPublicFn(
      "sato-names",
      "register-name",
      [Cl.stringAscii("")],
      wallet1
    );
    expect(result).toBeErr(Cl.uint(203));
  });

  it("returns none when resolving an unregistered username", () => {
    const resolved = simnet.callReadOnlyFn(
      "sato-names",
      "resolve-name",
      [Cl.stringAscii("nobody")],
      deployer
    );
    expect(resolved.result).toBeNone();
  });

  it("transfers a name to a new owner, updating both maps and emitting an event", () => {
    simnet.callPublicFn(
      "sato-names",
      "register-name",
      [Cl.stringAscii("alice")],
      wallet1
    );

    const { result, events } = simnet.callPublicFn(
      "sato-names",
      "transfer-name",
      [Cl.stringAscii("alice"), Cl.principal(wallet2)],
      wallet1
    );
    expect(result).toBeOk(Cl.bool(true));

    // exactly one print event with the transfer topic
    expect(events).toHaveLength(1);
    expect(events[0].event).toBe("print_event");
    expect(events[0].data).toMatchObject({
      topic: "print",
      value: { value: { event: { value: "name-transfer" } } },
    });

    // name now resolves to the new owner
    const resolved = simnet.callReadOnlyFn(
      "sato-names",
      "resolve-name",
      [Cl.stringAscii("alice")],
      deployer
    );
    expect(resolved.result).toBeSome(Cl.principal(wallet2));

    // reverse lookup points to the new owner
    const newName = simnet.callReadOnlyFn(
      "sato-names",
      "get-name",
      [Cl.principal(wallet2)],
      deployer
    );
    expect(newName.result).toBeSome(Cl.stringAscii("alice"));

    // old owner's reverse entry is cleared
    const oldName = simnet.callReadOnlyFn(
      "sato-names",
      "get-name",
      [Cl.principal(wallet1)],
      deployer
    );
    expect(oldName.result).toBeNone();
  });

  it("rejects a transfer from a non-owner with ERR_UNAUTHORIZED (u202)", () => {
    simnet.callPublicFn(
      "sato-names",
      "register-name",
      [Cl.stringAscii("alice")],
      wallet1
    );

    // wallet2 does not own "alice"
    const { result } = simnet.callPublicFn(
      "sato-names",
      "transfer-name",
      [Cl.stringAscii("alice"), Cl.principal(wallet2)],
      wallet2
    );
    expect(result).toBeErr(Cl.uint(202));
  });

  it("rejects transferring a non-existent name with ERR_NOT_FOUND (u201)", () => {
    const { result } = simnet.callPublicFn(
      "sato-names",
      "transfer-name",
      [Cl.stringAscii("ghost"), Cl.principal(wallet2)],
      wallet1
    );
    expect(result).toBeErr(Cl.uint(201));
  });

  it("rejects transferring to a principal that already holds a name with ERR_ALREADY_REGISTERED (u200)", () => {
    simnet.callPublicFn(
      "sato-names",
      "register-name",
      [Cl.stringAscii("alice")],
      wallet1
    );
    simnet.callPublicFn(
      "sato-names",
      "register-name",
      [Cl.stringAscii("bob")],
      wallet2
    );

    const { result } = simnet.callPublicFn(
      "sato-names",
      "transfer-name",
      [Cl.stringAscii("alice"), Cl.principal(wallet2)],
      wallet1
    );
    expect(result).toBeErr(Cl.uint(200));
  });

  it("rejects a self-transfer with ERR_UNAUTHORIZED (u202)", () => {
    simnet.callPublicFn(
      "sato-names",
      "register-name",
      [Cl.stringAscii("alice")],
      wallet1
    );

    const { result } = simnet.callPublicFn(
      "sato-names",
      "transfer-name",
      [Cl.stringAscii("alice"), Cl.principal(wallet1)],
      wallet1
    );
    expect(result).toBeErr(Cl.uint(202));
  });
});
