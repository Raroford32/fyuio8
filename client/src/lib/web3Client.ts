import Web3 from 'web3';
import { rpcManager } from './rpcManager';

export class Web3Client {
  private web3Instances: Map<string, Web3> = new Map();

  constructor() {
    rpcManager.endpoints.forEach(endpoint => {
      this.web3Instances.set(endpoint, new Web3(endpoint));
    });
  }

  deriveAddress(privateKey: string): string | null {
    try {
      // Remove '0x' prefix if present
      const cleanKey = privateKey.toLowerCase().replace('0x', '');

      // Validate private key format
      if (!/^[0-9a-f]{64}$/.test(cleanKey)) {
        return null;
      }

      // Get any Web3 instance to derive address
      const web3 = this.web3Instances.get(rpcManager.getNextEndpoint());
      if (!web3) throw new Error('No Web3 instance available');

      // Create account from private key and get address
      const account = web3.eth.accounts.privateKeyToAccount('0x' + cleanKey);
      return account.address;
    } catch (error) {
      console.error('Error deriving address:', error);
      return null;
    }
  }

  async getBalance(address: string): Promise<string> {
    const endpoint = rpcManager.getNextEndpoint();
    const web3 = this.web3Instances.get(endpoint);

    if (!web3) {
      throw new Error('No Web3 instance available');
    }

    try {
      const balance = await web3.eth.getBalance(address);
      const ethBalance = web3.utils.fromWei(balance, 'ether');
      // Format to 4 decimal places
      return (+ethBalance).toFixed(4);
    } catch (error) {
      rpcManager.markEndpointFailed(endpoint);
      throw error;
    }
  }

  async processPrivateKey(privateKey: string): Promise<{ address: string; balance: string } | null> {
    try {
      const address = this.deriveAddress(privateKey);
      if (!address) {
        return null;
      }

      const balance = await this.getBalance(address);
      return { address, balance };
    } catch (error) {
      console.error('Error processing private key:', error);
      return null;
    }
  }

  validateAddress(address: string): boolean {
    return Web3.utils.isAddress(address);
  }
}

export const web3Client = new Web3Client();