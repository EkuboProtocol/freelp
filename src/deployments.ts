// Canonical v3 deployments reused from EkuboProtocol/interface.
export const DEFAULT_CORE = "0x00000000000014aA86C5d3c41765bb24e11bd701";

// CREATE2 predictions for the pinned artifacts and protocol deployment salt.
export const DEFAULT_MANAGER = "0x573af249A268ed80c358dA77986D2e637978A611";
export const DEFAULT_POSITION_DATA_FETCHER =
  "0xE6965adE98F992e197554eDbF05c6E781e5127db";
export const DEFAULT_CONTRACTS = {
  core: DEFAULT_CORE,
  manager: DEFAULT_MANAGER,
  freeLPDataFetcher: DEFAULT_POSITION_DATA_FETCHER,
} as const;
