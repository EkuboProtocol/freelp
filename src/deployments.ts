// Canonical v3 deployments reused from EkuboProtocol/interface.
export const DEFAULT_CORE = "0x00000000000014aA86C5d3c41765bb24e11bd701";

// CREATE2 predictions for the pinned artifacts and protocol deployment salt.
export const DEFAULT_MANAGER = "0xF45a36e4FFbeaEBdCE8cc574f52039aeC6b468A1";
export const DEFAULT_POSITION_DATA_FETCHER =
  "0x753E7461313B6C9A4F0D6a2915271aBfb54fB071";
export const DEFAULT_CONTRACTS = {
  core: DEFAULT_CORE,
  manager: DEFAULT_MANAGER,
  freeLPDataFetcher: DEFAULT_POSITION_DATA_FETCHER,
} as const;
