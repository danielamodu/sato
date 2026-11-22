import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  Cl,
  getAddressFromPrivateKey,
  makeUnsignedContractCall,
  signMessageHashRsv,
  TransactionSigner,
} from "@stacks/transactions";
import {
  _resetMemoryStoresForTest,
  claimTreasuryTxid,
  hashStacksMessage,
  normalizeTxid,
  rateLimit,
  verifyPayerSignature,
} from "../../api/_lib";
import {
  payAuthMessage,
  quoteValid as payQuoteValid,
  signQuote as signPayQuote,
  type Quote as PayQuote,
} from "../../api/pay";
import offrampHandler, {
  offrampAuthMessage,
  quoteValid as offrampQuoteValid,
  signQuote as signOfframpQuote,
  type Quote as OfframpQuote,
} from "../../api/offramp";
import { validateSponsoredTx } from "../../api/sponsor";

const DEPLOYER = "ST3Y94KSPM12SVR45DF7S9V4B0TGR7HCARM8SWYWV";
const PRIV_KEY_1 =
  "753b7cc01a1a2e86221266a154af739463fce51219d97e4f856cd7200c3bd2a601";
const PRIV_KEY_2 =
  "7287ba251d44a4d3fd9276c88ce34c5c51a03599d120fd68ca31172f39f5c35101";
const ADDR_1 = getAddressFromPrivateKey(PRIV_KEY_1, "testnet");

function mockRes() {
  const res = {
    statusCode: 200,
    headers: {} as Record<string, string>,
    body: undefined as any,
    setHeader(k: string, v: string) {
      res.headers[k] = v;
    },
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    json(data: unknown) {
      res.body = data;
    },
  };
  return res;
}

const savedEnv = { ...process.env };

beforeEach(() => {
  _resetMemoryStoresForTest();
});

afterEach(() => {
  process.env = { ...savedEnv };
  _resetMemoryStoresForTest();
});

describe("api/_lib: normalizeTxid & claimTreasuryTxid", () => {
  const raw = "0x" + "AbCd".repeat(16);
  const norm = "abcd".repeat(16);

  it("normalizes optional 0x prefix and uppercase hex", () => {
    expect(normalizeTxid(raw)).toBe(norm);
    expect(normalizeTxid(`  ${norm.toUpperCase()}  `)).toBe(norm);
    expect(normalizeTxid("0x1234")).toBeNull();
    expect(normalizeTxid("zz".repeat(32))).toBeNull();
    expect(normalizeTxid(null)).toBeNull();
  });

  it("prevents replay across case/prefix variants and across pay vs offramp", async () => {
    expect(await claimTreasuryTxid(raw)).toEqual({ ok: true });
    expect(await claimTreasuryTxid(norm)).toEqual({ ok: false, reason: "duplicate" });
    expect(await claimTreasuryTxid(norm.toUpperCase())).toEqual({
      ok: false,
      reason: "duplicate",
    });
  });

  it("fails closed when requireDurable or SATO_REQUIRE_REDIS is set without Redis", async () => {
    expect(await claimTreasuryTxid(norm, { requireDurable: true })).toEqual({
      ok: false,
      reason: "store_unavailable",
    });
    process.env.SATO_REQUIRE_REDIS = "true";
    await expect(rateLimit("test", "k", 5, 60)).rejects.toThrow();
  });
});

describe("api/_lib: Stacks payer signature verification", () => {
  it("accepts a valid RSV signature from the paying address and rejects tampering", () => {
    const txid = "aa".repeat(32);
    const msg = payAuthMessage({
      txid,
      service: "airtime",
      serviceID: "mtn",
      phone: "08012345678",
      billersCode: "",
    });
    const sig = signMessageHashRsv({
      messageHash: hashStacksMessage(msg),
      privateKey: PRIV_KEY_1,
    });

    expect(
      verifyPayerSignature({
        message: msg,
        signature: sig,
        expectedAddress: ADDR_1,
        network: "testnet",
      })
    ).toBe(true);

    // Attacker swaps phone number after observing txid
    const tamperedMsg = payAuthMessage({
      txid,
      service: "airtime",
      serviceID: "mtn",
      phone: "08099999999",
      billersCode: "",
    });
    expect(
      verifyPayerSignature({
        message: tamperedMsg,
        signature: sig,
        expectedAddress: ADDR_1,
        network: "testnet",
      })
    ).toBe(false);

    // Wrong signer address
    const addr2 = getAddressFromPrivateKey(PRIV_KEY_2, "testnet");
    expect(
      verifyPayerSignature({
        message: msg,
        signature: sig,
        expectedAddress: addr2,
        network: "testnet",
      })
    ).toBe(false);

    // Malformed signature
    expect(
      verifyPayerSignature({
        message: msg,
        signature: "not-a-sig",
        expectedAddress: ADDR_1,
        network: "testnet",
      })
    ).toBe(false);
  });

  it("verifies offramp bank binding signatures", () => {
    const txid = "bb".repeat(32);
    const msg = offrampAuthMessage({
      txid,
      bankCode: "058",
      accountNumber: "0123456789",
    });
    const sig = signMessageHashRsv({
      messageHash: hashStacksMessage(msg),
      privateKey: PRIV_KEY_1,
    });
    expect(
      verifyPayerSignature({
        message: msg,
        signature: `0x${sig}`,
        expectedAddress: ADDR_1,
        network: "testnet",
      })
    ).toBe(true);
  });
});

describe("api/pay & api/offramp: HMAC quote verification & fail-closed secrets", () => {
  it("validates pay quotes and rejects field tampering", () => {
    process.env.PAY_SIGNING_SECRET = "test-pay-secret";
    const q: PayQuote = {
      service: "airtime",
      serviceID: "mtn",
      variation_code: "",
      amountNgn: 500,
      sats: "1000",
      treasury: DEPLOYER,
      exp: Date.now() + 60_000,
    };
    const sig = signPayQuote(q);
    expect(payQuoteValid(q, sig)).toBe(true);
    expect(payQuoteValid({ ...q, amountNgn: 5000 }, sig)).toBe(false);
    expect(payQuoteValid({ ...q, sats: "1" }, sig)).toBe(false);
    expect(payQuoteValid({ ...q, serviceID: "glo" }, sig)).toBe(false);
  });

  it("offramp fails closed with 500 when no signing secret is configured (no dev fallback)", async () => {
    delete process.env.OFFRAMP_SIGNING_SECRET;
    delete process.env.PAY_SIGNING_SECRET;
    delete process.env.PAYOUT_SECRET_KEY;

    const res = mockRes();
    await offrampHandler(
      { method: "POST", body: { action: "quote", amountNgn: 5000 } },
      res
    );
    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({ error: "Cash out isn't configured yet." });
  });

  it("validates offramp quotes when configured and rejects tampering", () => {
    process.env.OFFRAMP_SIGNING_SECRET = "test-offramp-secret";
    const q: OfframpQuote = {
      amountNgn: 5000,
      sats: "12000",
      treasury: DEPLOYER,
      exp: Date.now() + 60_000,
    };
    const sig = signOfframpQuote(q);
    expect(offrampQuoteValid(q, sig)).toBe(true);
    expect(offrampQuoteValid({ ...q, amountNgn: 50000 }, sig)).toBe(false);
  });
});

describe("api/sponsor: validateSponsoredTx", () => {
  async function buildTx(opts: {
    contractAddress?: string;
    contractName: string;
    functionName: string;
    functionArgs?: any[];
    sponsored?: boolean;
  }) {
    const unsigned = await makeUnsignedContractCall({
      contractAddress: opts.contractAddress ?? DEPLOYER,
      contractName: opts.contractName,
      functionName: opts.functionName,
      functionArgs: opts.functionArgs ?? [],
      publicKey: "02" + "11".repeat(32),
      network: "testnet",
      sponsored: opts.sponsored ?? true,
      fee: 0,
      nonce: 0,
    });
    const signer = new TransactionSigner(unsigned);
    signer.signOrigin(PRIV_KEY_1);
    return unsigned;
  }

  it("accepts active allow-listed Sato calls", async () => {
    const sendTx = await buildTx({
      contractName: "sato-yield-v3",
      functionName: "send",
      functionArgs: [Cl.principal(ADDR_1), Cl.uint(1000)],
    });
    expect(validateSponsoredTx(sendTx)).toEqual({
      ok: true,
      contract: "sato-yield-v3",
      fn: "send",
    });

    const regTx = await buildTx({
      contractName: "sato-names",
      functionName: "register-name",
      functionArgs: [Cl.stringAscii("alice")],
    });
    expect(validateSponsoredTx(regTx)).toEqual({
      ok: true,
      contract: "sato-names",
      fn: "register-name",
    });
  });

  it("rejects legacy contracts, admin calls, foreign contracts, and non-sponsored txs", async () => {
    const legacyTransfer = await buildTx({
      contractName: "sato-transfer",
      functionName: "send",
      functionArgs: [Cl.principal(ADDR_1), Cl.uint(1000)],
    });
    expect(validateSponsoredTx(legacyTransfer).ok).toBe(false);

    const legacyYield = await buildTx({
      contractName: "sato-yield-v2",
      functionName: "deposit",
      functionArgs: [Cl.uint(1000)],
    });
    expect(validateSponsoredTx(legacyYield).ok).toBe(false);

    const adminCall = await buildTx({
      contractName: "sato-yield-v3",
      functionName: "set-base-rate",
      functionArgs: [Cl.uint(0)],
    });
    expect(validateSponsoredTx(adminCall).ok).toBe(false);

    const foreign = await buildTx({
      contractAddress: "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM",
      contractName: "sato-yield-v3",
      functionName: "send",
      functionArgs: [Cl.principal(ADDR_1), Cl.uint(1000)],
    });
    expect(validateSponsoredTx(foreign).ok).toBe(false);

    const unsponsored = await buildTx({
      contractName: "sato-yield-v3",
      functionName: "send",
      functionArgs: [Cl.principal(ADDR_1), Cl.uint(1000)],
      sponsored: false,
    });
    expect(validateSponsoredTx(unsponsored).ok).toBe(false);
  });
});
