import Web3 from 'web3';
import { rpcManager } from './rpcManager';

export class Web3Client {
  private web3Instances: Map<string, Web3> = new Map();

  constructor() {
    rpcManager.endpoints.forEach(endpoint => {
      this.web3Instances.set(endpoint, new Web3(endpoint));
    });
  }

  async getBalance(address: string): Promise<string> {
    const endpoint = rpcManager.getNextEndpoint();
    const web3 = this.web3Instances.get(endpoint);
    
    if (!web3) {
      throw new Error('No Web3 instance available');
    }

    try {
      const balance = await web3.eth.getBalance(address);
      return web3.utils.fromWei(balance, 'ether');
    } catch (error) {
      rpcManager.markEndpointFailed(endpoint);
      throw error;
    }
  }

  validateAddress(address: string): boolean {
    return Web3.utils.isAddress(address);
  }
}

export const web3Client = new Web3Client();
