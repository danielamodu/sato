import { DEPLOYER_ADDRESS } from "./contracts";

export async function queryTestnetContract(
  contractName: string,
  functionName: string,
  argsHex: string[] = []
): Promise<{ success: boolean; result?: string; raw?: any; error?: string }> {
  const url = `https://api.testnet.hiro.so/v2/contracts/call-read/${DEPLOYER_ADDRESS}/${contractName}/${functionName}`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sender: DEPLOYER_ADDRESS,
        arguments: argsHex,
      }),
    });

    if (!res.ok) {
      throw new Error(`Hiro API returned HTTP ${res.status}: ${res.statusText}`);
    }

    const json = await res.json();
    return {
      success: json.okay ?? true,
      result: json.result,
      raw: json,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || "Failed to reach Stacks testnet node",
    };
  }
}
