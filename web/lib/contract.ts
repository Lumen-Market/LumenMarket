// TODO: Replace mock data with real Soroban contract calls using @stellar/stellar-sdk
import type { Launch, CreateLaunchParams } from './types';

const MOCK_LAUNCHES: Launch[] = [
  {
    id: 1,
    name: 'SolarToken',
    creator: 'GABC...XYZ1',
    totalSupply: 1_000_000n,
    sold: 320_000n,
    xlmRaised: 4800n,
    targetXlm: 15000n,
    migrated: false,
    createdAt: 1_718_000_000,
    currentPrice: 15n,
  },
  {
    id: 2,
    name: 'LunaFi',
    creator: 'GDEF...ABC2',
    totalSupply: 500_000n,
    sold: 500_000n,
    xlmRaised: 20000n,
    targetXlm: 20000n,
    migrated: true,
    createdAt: 1_717_000_000,
    currentPrice: 40n,
  },
  {
    id: 3,
    name: 'NebulaCoin',
    creator: 'GHIJ...DEF3',
    totalSupply: 2_000_000n,
    sold: 100_000n,
    xlmRaised: 500n,
    targetXlm: 30000n,
    migrated: false,
    createdAt: 1_718_500_000,
    currentPrice: 5n,
  },
];

// TODO: Initialize Soroban RPC server and contract client
// const server = new StellarSdk.SorobanRpc.Server(RPC_URL);
// const contract = new StellarSdk.Contract(CONTRACT_ID);

export async function getLaunches(): Promise<Launch[]> {
  // TODO: contract.call('get_launches')
  return MOCK_LAUNCHES;
}

export async function getLaunch(id: number): Promise<Launch | undefined> {
  // TODO: contract.call('get_launch', xdr.ScVal.scvU32(id))
  return MOCK_LAUNCHES.find((l) => l.id === id);
}

export async function buyTokens(
  launchId: number,
  xlmIn: bigint,
  minTokens: bigint
): Promise<{ tokensBought: bigint; newPrice: bigint }> {
  // TODO: invoke buy_tokens on Soroban contract with xlmIn and minTokens
  console.log('buyTokens', { launchId, xlmIn, minTokens });
  const tokensOut = xlmIn * 60n;
  return { tokensBought: tokensOut, newPrice: xlmIn + 1n };
}

export async function sellTokens(
  launchId: number,
  tokensIn: bigint,
  minXlm: bigint
): Promise<{ xlmReceived: bigint; newPrice: bigint }> {
  // TODO: invoke sell_tokens on Soroban contract with tokensIn and minXlm
  console.log('sellTokens', { launchId, tokensIn, minXlm });
  return { xlmReceived: tokensIn / 60n, newPrice: minXlm };
}

export async function createLaunch(
  params: CreateLaunchParams
): Promise<{ id: number }> {
  // TODO: invoke create_launch on Soroban contract with params
  console.log('createLaunch', params);
  return { id: Math.floor(Math.random() * 10000) };
}
