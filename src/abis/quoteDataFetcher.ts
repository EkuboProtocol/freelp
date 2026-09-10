export const EVM_QUOTE_DATE_FETCHER_V3_ABI = [
  {
    inputs: [
      {
        components: [
          {
            internalType: "address",
            name: "token0",
            type: "address",
          },
          {
            internalType: "address",
            name: "token1",
            type: "address",
          },
          {
            internalType: "PoolConfig",
            name: "config",
            type: "bytes32",
          },
        ],
        internalType: "struct PoolKey[]",
        name: "poolKeys",
        type: "tuple[]",
      },
      {
        internalType: "uint32",
        name: "minBitmapsSearched",
        type: "uint32",
      },
    ],
    name: "getQuoteData",
    outputs: [
      {
        components: [
          {
            internalType: "int32",
            name: "tick",
            type: "int32",
          },
          {
            internalType: "SqrtRatio",
            name: "sqrtRatio",
            type: "uint96",
          },
          {
            internalType: "uint128",
            name: "liquidity",
            type: "uint128",
          },
          {
            internalType: "int32",
            name: "minTick",
            type: "int32",
          },
          {
            internalType: "int32",
            name: "maxTick",
            type: "int32",
          },
          {
            components: [
              {
                internalType: "int32",
                name: "number",
                type: "int32",
              },
              {
                internalType: "int128",
                name: "liquidityDelta",
                type: "int128",
              },
            ],
            internalType: "struct TickDelta[]",
            name: "ticks",
            type: "tuple[]",
          },
        ],
        internalType: "struct QuoteData[]",
        name: "results",
        type: "tuple[]",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
] as const;
