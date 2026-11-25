# AgentBoard — Binance Agent ID Hackathon — Plan

Hackathon: Binance Wallet Agent ID Hackathon
- Submit: 18 Nov – 9 Des 2026, 08:00 UTC. Target submit internal: 8 Des 2026.
- Total: 60.000 USDC. Pioneer Award 29.000 (top 10, juara 1 $10.000) + Innovation Award 29.000 (top 10, panel 100 poin) + Community 2.000.
- Syarat keras: contract di BNB Chain, source terverifikasi + open-source di BscScan, aktif pakai Agent ID, satu proyek per tim, no QR login, no bypass konfirmasi user, no transfer tanpa izin, no kumpul seed phrase/private key, no janji return, no pakai nama Binance/BNB untuk menyamar.
- Agent ID contract (BNB Chain): 0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F, ERC-721, non-transferable. Cek holder: balanceOf(address) > 0.
- Agent ID hawkeye: buybuy.ai, wallet 0x9D0CcAC12a30E46E11F91eb6f0FECAf69b8De753.

## Target award
- Utama: Pioneer Award. Ranking dari data on-chain: jumlah alamat pemegang Agent ID yang berinteraksi, volume, jumlah tx. Top 10 dapat hadiah.
- Bonus: Innovation Award (panel: Agent ID depth 30%, practicality 25%, completion 25%, innovation 20%). Syaratnya produk live + minimal 30 alamat Agent ID berinteraksi selama periode submit — itu target distribusi, bukan target hari pertama.
- Satu proyek hanya dapat satu award.

## Use case (sempit, satu alur saja)
AgentBoard — papan micro-task escrow yang hanya bisa dipakai pemegang Agent ID.
1. Creator (pemegang Agent ID) buat task + kunci reward BNB di contract.
2. Claimer (pemegang Agent ID lain) klaim task.
3. Claimer submit bukti (teks/hash link).
4. Creator setujui → reward cair ke claimer. Creator batalkan sebelum diklaim → refund.
Tidak ada token, tidak ada janji return, tidak ada login QR, tidak ada server yang menyimpan sesi user. Frontend connect wallet langsung (injected wallet), semua konfirmasi tx di wallet user sendiri.

## Stack
- Contract: Solidity 0.8.24, Hardhat, OpenZeppelin ReentrancyGuard.
- Frontend: HTML/CSS/JavaScript polos + ethers.js v6 (CDN), baca contract langsung via BSC RPC. Tanpa backend di v1.
- Deploy: BNB Chain mainnet untuk submit (testnet dulu untuk uji: BSC Testnet, chain 97).

## Timeline (25 Nov – 9 Des 2026)
- 25 Nov (Day 1): scaffold, contract v1, test lokal. SELESAI hari ini — compile OK, 5/5 test lulus.
- 26–27 Nov: test contract di Hardhat + deploy BSC Testnet, uji alur penuh di frontend.
- 28–30 Nov: frontend lengkap (connect, cek Agent ID, create/claim/submit/approve), polish UX, README + demo script.
- 1–3 Des: deploy mainnet (butuh persetujuan hawkeye + BNB gas), verifikasi source di BscScan, uji live dengan wallet Agent ID hawkeye.
- 4–6 Des: distribusi — posting X @dayatjaul, ajak pemegang Agent ID coba (task nyata kecil, reward kecil dari hawkeye — diputuskan terpisah, bukan dari saya), kumpulkan interaksi.
- 7 Des: video demo 2–3 menit, final check (red lines, README, link demo).
- 8 Des: submit (buffer 1 hari sebelum deadline 9 Des 08:00 UTC).

## Risiko
- Solidity bukan stack utama Programmer — mitigasi: contract minimal, pakai OpenZeppelin ReentrancyGuard, test lokal + testnet dulu, jangan tambah fitur.
- Pioneer butuh banyak alamat Agent ID berinteraksi — mitigasi: produk harus live lebih awal (target 1–3 Des), bukan submit di hari terakhir.
- Innovation butuh 30 alamat — itu target distribusi, bukan janji. Kalau tidak tercapai, Pioneer tetap jalan.
- Deploy mainnet butuh BNB gas + tanda tangan hawkeye — tidak akan deploy mainnet tanpa persetujuan eksplisit dia.
