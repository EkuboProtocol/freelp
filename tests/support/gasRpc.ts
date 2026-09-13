export function gasRpcReply(method: string): unknown {
  if (method === "eth_getBalance") return "0x3635c9adc5dea00000";
  if (method === "eth_maxPriorityFeePerGas" || method === "eth_gasPrice")
    return "0x3b9aca00";
  if (method === "eth_getBlockByNumber")
    return {
      number: "0x1",
      hash: `0x${"11".repeat(32)}`,
      baseFeePerGas: "0x3b9aca00",
      timestamp: "0x1",
      gasLimit: "0x1c9c380",
      gasUsed: "0x5208",
      transactions: [],
    };
  return undefined;
}
