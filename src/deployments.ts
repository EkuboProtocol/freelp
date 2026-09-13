// Canonical v3 deployments reused from EkuboProtocol/interface.
export const DEFAULT_CORE = "0x00000000000014aA86C5d3c41765bb24e11bd701";

// CREATE2 predictions for the pinned artifacts and protocol deployment salt.
export const DEFAULT_MANAGER = "0x0b1605F6ab7CC5A51846cbaCc2A73730C7770c4C";
export const DEFAULT_POOL_KEY_INDEX =
  "0x827A68AC37AA3715c865F2E0704a63118496986f";
export const DEFAULT_METADATA_RENDERER =
  "0x3E3142aA2143bC05BA92986a9D4867C1409FB8E2";
export const DEFAULT_POSITION_DATA_FETCHER =
  "0xf4653c16A87828D3901E376eB3578fA50c5bbdD5";
export const DEFAULT_CONTRACTS = {
  core: DEFAULT_CORE,
  manager: DEFAULT_MANAGER,
  freeLPDataFetcher: DEFAULT_POSITION_DATA_FETCHER,
  poolKeyIndex: DEFAULT_POOL_KEY_INDEX,
} as const;
