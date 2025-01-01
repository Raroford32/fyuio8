export class RPCManager {
  private currentIndex = 0;
  private failedEndpoints: Set<string> = new Set();

  readonly endpoints = [
    'https://rpc.ankr.com/eth',
    'https://1rpc.io/eth',
    'https://eth.llamarpc.com',
    'https://eth.public-rpc.com',
    'https://ethereum.publicnode.com',
    'https://eth-mainnet.public.blastapi.io',
    'https://ethereum.blockpi.network/v1/rpc/public',
    'https://eth.drpc.org',
    'https://eth.merkle.io',
    'https://eth.api.onfinality.io/public',
    'https://api.securerpc.com/v1'
  ];

  getNextEndpoint(): string {
    let attempts = 0;
    while (attempts < this.endpoints.length) {
      const endpoint = this.endpoints[this.currentIndex];
      this.currentIndex = (this.currentIndex + 1) % this.endpoints.length;
      
      if (!this.failedEndpoints.has(endpoint)) {
        return endpoint;
      }
      attempts++;
    }
    
    // Reset failed endpoints if all are failed
    this.failedEndpoints.clear();
    return this.endpoints[0];
  }

  markEndpointFailed(endpoint: string) {
    this.failedEndpoints.add(endpoint);
  }
}

export const rpcManager = new RPCManager();
