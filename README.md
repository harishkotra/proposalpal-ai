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

### 📷 Screenshots

<img width="1799" height="1152" alt="screencapture-localhost-5173-dashboard-2025-09-26-09_10_36" src="https://github.com/user-attachments/assets/3259f4d6-65c9-4e5b-963f-a5bef5444281" />
<img width="1799" height="1152" alt="screencapture-localhost-5173-leaderboard-2025-09-26-09_10_27" src="https://github.com/user-attachments/assets/b1bed2bb-03c8-4eff-badb-64406377fa01" />
<img width="1797" height="1149" alt="ppi-purchase-credits" src="https://github.com/user-attachments/assets/d8b55c46-0b3b-481e-ac8c-6ac4063a4ae7" />
<img width="1793" height="1151" alt="ppai-dark-mode" src="https://github.com/user-attachments/assets/431ef957-bc52-472b-b76a-736d20c48259" />
<img width="1799" height="1477" alt="screencapture-localhost-5173-2025-09-26-09_06_01" src="https://github.com/user-attachments/assets/3b9c44c4-c970-45d0-99df-b51b7703bec4" />
<img width="1799" height="1152" alt="screencapture-localhost-5173-billing-2025-09-25-22_23_06" src="https://github.com/user-attachments/assets/c01f1d58-d3f3-48af-8293-e65b62baaa96" />
<img width="1799" height="1152" alt="screencapture-localhost-5173-2025-09-25-22_18_28" src="https://github.com/user-attachments/assets/d486c93d-caed-4e9b-b026-5423570d2a33" />
<img width="1799" height="1152" alt="screencapture-localhost-5173-leaderboard-2025-09-25-22_16_06" src="https://github.com/user-attachments/assets/89a2e3d7-9db8-4488-8023-224fc22db25b" />
<img width="1799" height="1152" alt="screencapture-localhost-5173-dashboard-2025-09-25-22_16_00" src="https://github.com/user-attachments/assets/131649bf-532d-4c6c-8b0f-c1f845803676" />
<img width="1799" height="1152" alt="screencapture-localhost-5173-faq-2025-09-25-22_15_51" src="https://github.com/user-attachments/assets/1376f8f8-e408-4c58-8891-d97d6b6ab62e" />
<img width="1799" height="1152" alt="screencapture-localhost-5173-faq-2025-09-25-22_15_36" src="https://github.com/user-attachments/assets/8003a0c3-8bcb-4a8d-9d54-038b0f459b54" />
<img width="1799" height="1152" alt="screencapture-localhost-5173-2025-09-25-22_15_27" src="https://github.com/user-attachments/assets/bdf38119-d243-48a4-aaaa-b3fedf4fc21f" />
<img width="1783" height="1146" alt="Screenshot at Sep 26 09-30-01" src="https://github.com/user-attachments/assets/2baa6b42-26a6-4bdb-ba48-d32c686230ca" />
<img width="1348" height="2735" alt="screencapture-localhost-5173-2025-09-26-09_29_30" src="https://github.com/user-attachments/assets/30704ec0-1540-42b7-8821-8db0d3b0ad6e" />
<img width="1348" height="2844" alt="screencapture-localhost-5173-2025-09-26-09_28_55" src="https://github.com/user-attachments/assets/9f91d8a2-f473-4c03-8453-c5403b9846fd" />
<img width="1799" height="1449" alt="screencapture-localhost-5173-2025-09-26-09_32_04" src="https://github.com/user-attachments/assets/b2853d9c-64cc-4128-a0fe-7a8666204686" />
<img width="1799" height="1358" alt="screencapture-preprod-cardanoscan-io-transaction-0e7585a9508877a3d82f9bb3430bd6cfa96388223af0cafccba60a85eeae2dc5-2025-09-26-09_38_03" src="https://github.com/user-attachments/assets/38353a13-a80f-4da1-aef1-134fbb70a3fa" />

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
