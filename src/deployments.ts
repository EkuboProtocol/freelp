// Canonical v3 deployments reused from EkuboProtocol/interface.
export const DEFAULT_CORE = "0x00000000000014aA86C5d3c41765bb24e11bd701";

// CREATE2 predictions for the pinned artifacts and protocol deployment salt.
export const DEFAULT_MANAGER = "0xE7483a2F17A0F77480BDAc3bdb27CB002088BaA1";
export const DEFAULT_POOL_KEY_INDEX =
  "0x898956fc2Aed01D5F81F556FF5dcB10534285718";
export const DEFAULT_POSITION_DATA_FETCHER =
  "0x53f94Bf2f022F4E31Be9B336C80555020f6009cD";
export const DEFAULT_CONTRACTS = {
  core: DEFAULT_CORE,
  manager: DEFAULT_MANAGER,
  freeLPDataFetcher: DEFAULT_POSITION_DATA_FETCHER,
  poolKeyIndex: DEFAULT_POOL_KEY_INDEX,
} as const;
