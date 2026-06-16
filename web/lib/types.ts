export interface Launch {
  id: number;
  name: string;
  creator: string;
  totalSupply: bigint;
  sold: bigint;
  xlmRaised: bigint;
  targetXlm: bigint;
  migrated: boolean;
  createdAt: number;
  currentPrice: bigint;
}

export interface CreateLaunchParams {
  name: string;
  totalSupply: bigint;
  targetXlm: bigint;
  virtualXlm: bigint;
}
