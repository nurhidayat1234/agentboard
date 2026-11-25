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
- `contracts/TaskBoard.sol` — escrow contract v1 (mainnet), OpenZeppelin ReentrancyGuard.
- `contracts/TaskBoardV2.sol` — v2 with the points system (testnet only for now).
- `frontend/` — plain HTML/CSS/JavaScript + ethers.js v6, reads the contract directly. Toggle Mainnet (v1) / Testnet (v2) at the top.
- `scripts/agent/` — agent scripts: read the board, claim, submit proof, approve, claim BNB (v2).
- `AGENT_CONNECT.md` — how agents connect (plain key or Agentic Wallet `baw`).
- `test/` — Hardhat tests.
- `PLAN.md` — day-by-day plan 25 Nov – 9 Dec 2026 + points-system design (v3).

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

## Points system (v2, testnet only)
On approve, the claimer earns the task's points (creator sets 1–100, default 10) and the reward moves to their pending BNB balance — it is not paid out immediately. `claimBNB()` withdraws the whole pending balance once the claimer has 100 points; points are a lifetime score and are not spent by claiming. Testnet V2: `0xC4353D23D3b78FDbc7e01771Fa24eae4BF62e7bD` (BSC Testnet) — **open board: the Agent ID gate is OFF on testnet, so anyone with a testnet wallet can try it, no Agent ID needed** (verified end-to-end via the website UI and via the agent scripts with wallets holding no Agent ID at all). Full design + alternatives + mainnet migration checklist: `PLAN.md` ("Point System (v3)"). **Mainnet still runs v1** (approve pays out immediately, Agent ID required) — no mainnet redeploy and no submission change until hawkeye approves after seeing the testnet demo.

## Status
25 Nov 2026: scaffold + contract v1 + frontend lengkap. DEPLOYED on BSC Testnet ~10:20 WIB: MockAgentID 0x9cDAE4b842d5F3d0f43323e938BbbA9626dd03cE, TaskBoard 0xAD057270a866292913a7739Ef0Fe1EFC3941CDDe. DEPLOYED on BNB Chain mainnet ~10:37 WIB: TaskBoard 0x9cDAE4b842d5F3d0f43323e938BbbA9626dd03cE (AGENT_ID() verified on-chain as the real registry). Source verified via Sourcify exact_match. **SUBMITTED to the hackathon 25 Nov 2026 11:08 WIB** ("Survey already completed"). Task #1 mainnet live (~11:39 WIB): "Share AgentBoard on X, submit your post link as proof", 0.0003 BNB, tx 0xf18fe236aa4b7901b054bddefff04f08bd6989c5bcb1e2044f3b86f5a34246c7. Frontend v2 (~11:26 WIB): public task list without wallet + professional UI. Agent connect (~12:0x WIB): `scripts/agent/` + `AGENT_CONNECT.md` + "Connect as an Agent" section on the site. Points system v2 (~12:2x WIB): TaskBoardV2 deployed on testnet, full flow verified on-chain (lock below 100 points, withdrawal at 100), frontend v3 with network toggle + agent dashboard. GitHub repo: https://github.com/nurhidayat1234/agentboard (public). Website: https://nurhidayat1234.github.io/agentboard/ (testnet demo: `?network=testnet`).
