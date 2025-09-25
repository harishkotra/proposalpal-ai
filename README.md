# ProposalPal AI - AI-Powered Cardano Governance

[![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://reactjs.org/)
[![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![Express.js](https://img.shields.io/badge/Express.js-000000?style=for-the-badge&logo=express&logoColor=white)](https://expressjs.com/)
[![SQLite](https://img.shields.io/badge/SQLite-003B57?style=for-the-badge&logo=sqlite&logoColor=white)](https://www.sqlite.org/)

A dApp that simplifies participation in Cardano governance. Get instant, easy-to-understand AI summaries of complex Cardano Improvement Proposals (CIPs), vote directly from your wallet, and track your engagement on the community leaderboard.

---

### 🌟 Core Features

-   **🤖 Intelligent CIP Summaries**:
    -   Utilizes **Gaia Node** to provide AI-powered summaries of any CIP.
    -   Employs a **Retrieval-Augmented Generation (RAG)** model for maximum accuracy by fetching the latest CIP content directly from GitHub.
    -   Gracefully handles even the largest CIPs by automatically chunking and summarizing content that exceeds the AI's context window.

-   **🔗 Seamless Wallet Integration**:
    -   Powered by **MeshJS SDK** for robust and reliable wallet connections.
    -   Supports a wide range of browser wallets (Vespr, Nami, Eternl, Yoroi, Flint, etc.).

-   **🗳️ Interactive Governance & Gamification**:
    -   Cast Yes/No/Abstain votes on CIPs, recorded as on-chain transaction metadata.
    -   **Gamified Leaderboard** where users earn points for each vote.
    -   **Personal Dashboard** to track voting history, points, and leaderboard rank.

-   **💳 Credit & On-Chain Payment System**:
    -   New users receive **500 free AI summary credits**.
    -   Purchase additional credits with ADA directly from the connected wallet.
    -   **Secure payment verification** using the **Blockfrost API** to confirm transactions on-chain before granting credits, preventing fraud.

-   **✨ Modern User Experience**:
    -   Clean, responsive UI that works on all devices.
    -   **Dark Mode / Light Mode** switcher with persistence via `localStorage`.
    -   Comprehensive **FAQ page** with interactive accordions.

### 🛠️ Technology Stack

-   **Frontend**:
    -   **Framework**: React 18 with Vite
    -   **Wallet Connectivity**: MeshJS SDK
    -   **Routing**: React Router
    -   **Styling**: Plain CSS with CSS Variables
    -   **UI/Icons**: Lucide React
    -   **Markdown Rendering**: React Markdown

-   **Backend**:
    -   **Runtime**: Node.js
    -   **Framework**: Express.js
    -   **Database**: SQLite 3
    -   **AI Integration**: OpenAI Node.js Library (for Gaia Node compatibility)
    -   **Blockchain Integration**: Blockfrost JS SDK

---

### 🚀 Getting Started

Follow these instructions to set up and run the project locally for development.

#### Prerequisites

-   [Node.js](https://nodejs.org/) (v18 or later)
-   [npm](https://www.npmjs.com/)
-   A Cardano browser wallet (e.g., Eternl, Nami) set to the **Preprod Testnet**.
-   A [Blockfrost Project ID](https://blockfrost.io/) for the Preprod Testnet.
-   Access to a **Gaia Node** instance (URL, API Key, Model Name).

#### 1. Clone the Repository

```bash
git clone https://github.com/harishkotra/proposalpal-ai.git
cd proposalpal-ai
```
#### 2. Backend Setup

```bash
# Navigate to the server directory
cd server

# Install dependencies
npm install

# Create a local environment file
cp .env.example .env.local
```
Now, open the `backend/.env.local` file and replace the placeholders with your actual values:

```ini
# server/.env.local
PORT=3001
DATABASE_FILENAME=./database.local.db
GAIA_NODE_URL="YOUR_GAIA_NODE_URL"
GAIA_API_KEY="YOUR_GAIA_API_KEY"
GAIA_MODEL_NAME="YOUR_GAIA_MODEL_NAME"
PAYMENT_WALLET_ADDRESS="YOUR_TESTNET_TREASURY_WALLET_ADDRESS"
CARDANO_NETWORK="preprod"
BLOCKFROST_API_KEY="YOUR_PREPROD_BLOCKFROST_PROJECTID"
```

Start the backend server:
```bash
npm run dev
```
The backend API will be running on `http://localhost:3001`.


#### 3. Frontend Setup

In a new terminal window:

```bash
# Navigate to the client (frontend) directory
cd client

# Install dependencies
npm install

# Create a local environment file
cp .env.example .env.local
```

Now, open client/.env.local and fill in the variables. They must match the ones from your backend setup.

```ini
# frontend/.env.local
VITE_API_URL=http://localhost:3001/api
VITE_CARDANOSCAN_URL=https://preprod.cardanoscan.io
VITE_PAYMENT_WALLET_ADDRESS="THE_SAME_TREASURY_ADDRESS_FROM_SERVER_ENV"
VITE_PAYMENT_AMOUNT="1000000" # 1 ADA in Lovelace
```

Start the frontend development server:


```bash
npm run dev
```

The application will be available at http://localhost:5173.

### 🤝 Contributing

Contributions are welcome! If you have suggestions or want to improve the code, please feel free to fork the repository, create a new branch, and submit a pull request.

1.  Fork the Project
2.  Create your Feature Branch (git checkout -b feature/AmazingFeature)
3.  Commit your Changes (git commit -m 'Add some AmazingFeature')
4.  Push to the Branch (git push origin feature/AmazingFeature)
5.  Open a Pull Request
    

### Acknowledgments

-   Built by **[Harish Kotra](https://github.com/harishkotra)** for the Cardano Community.
-   Supported by **[Intersect MBO](https://intersectmbo.org/?proposalpal-ai)**.