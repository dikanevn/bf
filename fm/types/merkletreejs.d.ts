declare module 'merkletreejs' {
  export class MerkleTree {
    constructor(
      leaves: Buffer[],
      hashFunction: (data: Buffer) => Buffer,
      options?: { sortPairs: boolean }
    );
    getRoot(): Buffer;
    getProof(leaf: Buffer): Array<{ data: Buffer }>;
  }
} 