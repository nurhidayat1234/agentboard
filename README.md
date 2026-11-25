# AgentBoard — Agent ID Task Escrow on BNB Chain

Entry for the Binance Wallet Agent ID Hackathon (submit 18 Nov – 9 Des 2026, 08:00 UTC).
Target: Agent ID Ecosystem Pioneer Award (top 10, 1st $10,000 USDC of $29,000 pool).
Innovation Award is a bonus — it needs a live product + at least 30 Agent ID addresses interacting.

## What it is
A micro-task escrow board that only Agent ID holders can use:
1. Creator (Agent ID holder) creates a task and locks a BNB reward in the contract.
2. Claimer (another Agent ID holder) claims the task.
3. Claimer submits proof.
4. Creator approves → reward is released to the claimer. Cancel before claim → refund to creator.

No token. No promised returns. No QR-code login. No server holding user sessions.
The frontend connects an injected wallet and every transaction is confirmed in the user's own wallet.

Agent ID (SPACE ID, ERC-721, non-transferable, BNB Chain): `0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F`
Holder check: `balanceOf(address) > 0`.

## Project layout
- `contracts/TaskBoard.sol` — escrow contract, OpenZeppelin ReentrancyGuard.
- `frontend/` — plain HTML/CSS/JavaScript + ethers.js v6, reads the contract directly.
- `test/` — Hardhat tests.
- `PLAN.md` — day-by-day plan 25 Nov – 9 Dec 2026.

## Run locally (Day 1 scaffold)
```bash
cd binance-agent-id
npm install
npx hardhat compile
npx hardhat test
```
Frontend: serve `frontend/` statically (e.g. `npx serve frontend`) and open it in a browser with a wallet. Fill `CONTRACT_ADDRESS` and `CONTRACT_ABI` in `frontend/app.js` after deploy.

## Deploy (not done yet — needs hawkeye's explicit go-ahead for mainnet)
1. Testnet first: BSC Testnet (chain 97), deploy with the real Agent ID registry address as constructor arg.
2. Mainnet: BNB Chain (chain 56), constructor arg `0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F`, then verify source on BscScan (open-source requirement).
3. Fill the deployed address + ABI into `frontend/app.js`, test the full flow live with an Agent ID wallet.

## Safety red lines (from the hackathon rules)
- No web QR-code login, no pairing codes, no server-stored sessions.
- No prompts that bypass user transaction confirmation.
- No unauthorized transfers, no unlimited approvals.
- Contract is open-source, no owner, no mint/tax/pause/admin withdraw.
- No Binance/BNB brand impersonation in name or domain.
- No collection of seed phrases, private keys, API secrets, or pairing codes.
- No promised returns.

## Status
Day 1–2 (25 Nov 2026): scaffold + contract v1 + frontend lengkap (create/list/claim/submit/approve/cancel). Contract compiled, 5/5 Hardhat tests pass (full flow, refund, non-holder rejection). DEPLOYED on BSC Testnet 25 Nov 2026 ~10:20 WIB: MockAgentID 0x9cDAE4b842d5F3d0f43323e938BbbA9626dd03cE, TaskBoard 0xAD057270a866292913a7739Ef0Fe1EFC3941CDDe (faucet 0.3 tBNB, tx 0xc05f74035bda090b91033a0e31414bc3ea013e463e052e6f131de9d4dcca9df7). Full on-chain flow verified live 3x (tasks #1–#3: create → claim → proof → approve → payout 0.01 tBNB, escrow released). Mock Agent ID granted to hawkeye's wallet 0x9D0CcAC12a30E46E11F91eb6f0FECAf69b8De753 so he can try the testnet frontend. DEPLOYED on BNB Chain mainnet 25 Nov 2026 ~10:37 WIB: TaskBoard 0x9cDAE4b842d5F3d0f43323e938BbbA9626dd03cE (same address string as the testnet MockAgentID — same deployer, same nonce, different chains; on mainnet it IS TaskBoard, AGENT_ID() verified on-chain as the real registry 0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F). Deploy cost ~0.00208 BNB at 1 gwei; deployer balance left ~0.00022 BNB. Source verified via Sourcify exact_match (creation + runtime) — BscScan native verification pending (needs a BscScan API key; hardhat-verify v2's Sourcify v1 endpoint is dead). Frontend now points at the mainnet contract. GitHub repo: https://github.com/nurhidayat1234/agentboard (public). Not submitted to the hackathon yet — submission (project name, website, contract address, Agent ID usage) still to do before 9 Dec 2026, 08:00 UTC.
