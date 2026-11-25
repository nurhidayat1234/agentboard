# AgentBoard — Binance Agent ID Hackathon Submission Draft

Prepared 2026-11-25. Submission route: Binance survey
https://www.binance.com/en/survey/fb26d2bd25e04329b1ba77c7b3811d23
(requires Binance account login; deadline 9 Dec 2026, 08:00 UTC)

## Fields to submit

- **Project name:** AgentBoard
- **Website (live demo):** https://nurhidayat1234.github.io/agentboard/
  (GitHub Pages, branch gh-pages — being enabled 25 Nov 2026; fallback if
  Pages is not up yet: https://github.com/nurhidayat1234/agentboard)
- **Contract address (BNB Chain mainnet):**
  0x9cDAE4b842d5F3d0f43323e938BbbA9626dd03cE
- **Product Demo Video (required field; created 25 Nov 2026, 67 seconds):**
  https://drive.google.com/file/d/1QBL6JySqkn51hcAwICLKTc-bSxu9l7uN/view?usp=drivesdk
  (Google Drive, anyone with link can view; source file
  `demo/agentboard-demo.mp4` — real screenshots of the live product +
  English voiceover; also attached to the submission chat message)
- **GitHub (open source):** https://github.com/nurhidayat1234/agentboard
- **Telegram:** @dellkomputer12
- **Team name:** hawkeye (Nurhidayat)

## Submission status: ✅ SUBMITTED 25 Nov 2026, 11:08 WIB (04:08 UTC)

- Survey: https://www.binance.com/en/survey/fb26d2bd25e04329b1ba77c7b3811d23
- Confirmation shown after submit: green checkmark, "Survey already completed" —
  "You have already completed this survey. Thanks for your support to Binance."
  An "Edit Response" button is shown, so the response is recorded and editable.
- All 19 questions filled and read back against the authorised values before
  submitting (6 pages: Basic Project Information, Agent ID Integration,
  BNB Chain Contract Information, Project Showcase Materials, Team and Contact
  Information, Participation Declaration — all four declarations ticked).
- Use cases selected: Identity Recognition/Verification, Permission Management /
  Access Control, Payment / Settlement, Agent Identity Binding / Identification.
- Launched: Yes. Agent ID integration completed with on-chain interactions: Yes.
- Deadline was 9 Dec 2026, 08:00 UTC — submitted 14 days early.
- Next milestones: internal review 9–17 Dec 2026, public review 17–20 Dec 2026,
  prizes within 14 working days after public announcement, to the reward
  receiving address above. Pioneer Award ranking is driven by real on-chain
  data (interacting Agent ID holder addresses, tx volume/count) — distribution
  work (getting Agent ID holders to use the mainnet contract) still open.
- **BscScan:** https://bscscan.com/address/0x9cDAE4b842d5F3d0f43323e938BbbA9626dd03cE
  (source verified via Sourcify exact_match — creation + runtime)
- **Agent ID usage description (draft):**
  AgentBoard is a micro-task escrow board where Agent ID is the access
  control and identity layer. Every action — creating a task, claiming a
  task, submitting proof, approving/releasing the reward, and cancelling —
  requires the caller to hold an Agent ID: the contract calls
  balanceOf(caller) on the SPACE ID Agent ID registry
  (0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F) and reverts if it returns 0.
  A creator locks a BNB reward in escrow when creating a task; a claimer
  (a different Agent ID holder) submits proof, and the creator's approval
  releases the reward. No token, no promised returns, no server-held
  sessions, no QR login — every transaction is confirmed in the user's own
  wallet.
- **Reward receiving address (CONFIRMED by hawkeye 25 Nov 2026 ~10:45 WIB):**
  0x9D0CcAC12a30E46E11F91eb6f0FECAf69b8De753
  (his main wallet / Agent ID holder wallet buybuy.ai)

## Eligibility status (25 Nov 2026)

- Contract deployed on BNB Chain mainnet: YES (25 Nov ~10:37 WIB)
- Source verified + open source: YES (Sourcify exact_match; code public
  on GitHub; BscScan native display still being confirmed — Cloudflare
  blocks the page for the cloud browser)
- Product live: YES (frontend on GitHub Pages, contract on mainnet)
- 30 Agent ID addresses interacting during submission period: NOT YET —
  this is the distribution work for 26 Nov – 6 Dec (post on X as
  @dayatjaul, invite Agent ID holders to try it). Pioneer ranking is
  driven by interacting Agent ID addresses / tx volume / tx count, so
  this is the main remaining lever.
- Innovation Award needs the same 30-address threshold.

## Notes

- Testnet deployment (BSC Testnet 0xAD057270a866292913a7739Ef0Fe1EFC3941CDDe)
  is NOT part of the submission — only the mainnet contract counts.
- The mainnet address coincidentally equals the testnet MockAgentID
  address (same deployer, same nonce, different chains). On mainnet it
  is TaskBoard — AGENT_ID() verified on-chain as the real registry.
