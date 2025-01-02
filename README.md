# Ethereum Wallet Balance Checker

A web application for checking Ethereum wallet balances from private keys.

## Installation

### Prerequisites
- Node.js (v18 or higher)
- npm (comes with Node.js)

### Setup
1. Clone the repository:
```bash
git clone [your-repo-url]
cd [repository-name]
```

2. Install dependencies:
```bash
npm install
```

3. Environment Setup (Optional):
Create a `.env` file in the root directory:
```env
# Optional: Custom Ethereum RPC URL
VITE_ETH_RPC_URL=your_ethereum_rpc_url
```

## Development
Run the development server:
```bash
npm run dev
```
The app will be available at `http://localhost:5000`

## Production Deployment

1. Build the application:
```bash
npm run build
```

2. Start the production server:
```bash
npm start
```

The application will run on port 5000. Make sure this port is open on your server.

## Features
- Real-time balance checking
- Support for multiple private key formats
- Automatic address derivation
- Balance sorting
- CSV export functionality
- Progress tracking and persistence

## Security Notes
- Private keys are only used for address derivation
- No keys are stored or transmitted
- All processing is done in memory
- Only addresses and balances are saved locally
