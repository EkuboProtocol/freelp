// Canonical v3 deployments reused from EkuboProtocol/interface.
export const DEFAULT_CORE = "0x00000000000014aA86C5d3c41765bb24e11bd701";

// CREATE2 predictions for the pinned artifacts and protocol deployment salt.
export const DEFAULT_MANAGER = "0xc5cF4536449Bfb49459369fa627d278997B1dA1D";
export const DEFAULT_POSITION_DATA_FETCHER =
  "0x030502D3EAcd8EC4397C72Db3F5758C8c5c43a58";
export const DEFAULT_CONTRACTS = {
  core: DEFAULT_CORE,
  manager: DEFAULT_MANAGER,
  freeLPDataFetcher: DEFAULT_POSITION_DATA_FETCHER,
} as const;
