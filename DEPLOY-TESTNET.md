# Deploy Testnet — AgentBoard

## Deployer wallet (testnet only, no real funds)
- Fresh wallet generated 25 Nov 2026 for BSC Testnet deploys only.
- Private key: `deployer-testnet-key.txt` (chmod 600, in this folder, gitignored — never print it in chat, never send it anywhere).
- Address: see `deployer-testnet-address.txt`.
- This wallet is NOT hawkeye's main BSC wallet and NOT the bounty wallet. Test BNB only.

## 1. Fund it (test BNB)
- Faucet BSC Testnet: https://testnet.bnbchain.org/faucet-smart
- Paste the deployer address, claim test BNB (usually 0.1 tBNB per claim).
- If the faucet asks for a tweet / login, hawkeye does that step in his own browser — I cannot claim it for him.
- Check balance: `npx hardhat run scripts/check-balance.js --network bscTestnet` (script in this repo).

## 2. Deploy
```bash
cd binance-agent-id
cp .env.example .env   # then put the testnet deployer key in .env (from deployer-testnet-key.txt)
```
2a. Deploy MockAgentID (testnet only — the real registry does not exist on testnet):
```bash
npx hardhat run scripts/deploy-mock-agentid.js --network bscTestnet
```
2b. Deploy TaskBoard pointing at the mock:
```bash
AGENT_ID_OVERRIDE=<mock address dari 2a> npx hardhat run scripts/deploy.js --network bscTestnet
```
Output: contract address + `deployments/bscTestnet.json`.

## 3. Verify + wire frontend
- Verify source on BSC Testnet BscScan (https://testnet.bscscan.com) — required pattern for the hackathon (open-source, verified).
- Paste the deployed address into `frontend/app.js` (`CONTRACT_ADDRESS`) and regenerate `frontend/abi.js`:
  ```bash
  node scripts/generate-abi.js
  ```
- Serve `frontend/` and test the full flow. Note: the real Agent ID registry only exists on BNB mainnet. The testnet V2 board runs with the Agent ID gate OFF (`GATE_ENABLED=false`, see `contracts/TaskBoardV2.sol`) — anyone with a testnet wallet can create/claim tasks there, no Mock Agent ID needed. (The old gate-ON testnet V2 at 0x5aCafb6d81e820Aa2FfEC7e616f26958147A7cEF is abandoned; the live testnet V2 is 0xC4353D23D3b78FDbc7e01771Fa24eae4BF62e7bD.) Mainnet deploy uses the real registry with the gate ON — that is the product.

## Mainnet deploy (needs hawkeye's explicit go-ahead + BNB gas)
```bash
npx hardhat run scripts/deploy.js --network bsc
```
Then verify on https://bscscan.com, update `frontend/app.js` + `deployments/bsc.json`, and test live with hawkeye's Agent ID wallet (buybuy.ai).
