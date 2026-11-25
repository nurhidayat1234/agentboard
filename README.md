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
Day 1–2 (25 Nov 2026): scaffold + contract v1 + frontend lengkap (create/list/claim/submit/approve/cancel). Contract compiled, 5/5 Hardhat tests pass (full flow, refund, non-holder rejection). Deploy testnet READY (scripts + fresh testnet deployer wallet 0x09cd1B98D9d87D434f73Cf82D57b138Da22e33ab, key in deployer-testnet-key.txt) but NOT deployed yet — wallet still 0 tBNB, needs faucet funding. GitHub repo: https://github.com/nurhidayat1234/agentboard (public, created 25 Nov 2026). Not submitted to the hackathon yet.
