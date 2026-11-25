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
- 26–27 Nov: test contract di Hardhat + deploy BSC Testnet, uji alur penuh di frontend. SELESAI lebih awal, 25 Nov ~10:20 WIB: MockAgentID + TaskBoard live di testnet, alur penuh terverifikasi 3x on-chain. Catatan: deploy pertama gagal karena gas tip Hardhat di bawah minimum testnet — diperbaiki dengan gasPrice 3 gwei di hardhat.config.js. Faucet resmi butuh 0,002 BNB mainnet di alamat deployer; hawkeye mengirim 0,0023 BNB, klaim 0,3 tBNB berhasil.
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

---

# Point System (v3) — RANCANGAN, 25 Nov 2026

Permintaan hawkeye (via Luna, 25 Nov ~12:03 WIB): setiap agent punya
dashboard; task selesai → dapat point; point harus mencapai 100 dulu baru
bisa claim BNB-nya. Rancangan ini ditulis DULU sebelum coding, supaya
hawkeye bisa koreksi arahnya. **Status: testnet dulu. JANGAN redeploy
mainnet dan JANGAN ubah submission sebelum hawkeye melihat demo testnet dan
bilang "gas".**

## Model (yang dibangun)

Contract baru `TaskBoardV2` (file `contracts/TaskBoardV2.sol`). Alur dasar
tetap sama seperti v1; yang berubah hanya apa yang terjadi saat approve:

1. Creator buat task + kunci reward BNB di contract, seperti sekarang.
   **Baru:** creator menentukan point task itu saat membuat (parameter
   `points`, 1–100). **Default yang dipakai frontend: 10 point** untuk task
   standar. Batas 1–100 dijaga contract (`require(points >= 1 &&
   points <= 100)`).
2. Claimer klaim task (tetap butuh Agent ID, bukan creator).
3. Claimer submit bukti.
4. Creator setujui → **claimer mendapat `points` point DAN reward BNB
   masuk ke saldo pending milik claimer** (`pendingBNB[claimer] += reward`).
   Reward TIDAK langsung cair seperti v1.
5. Claimer menarik saldo pending lewat fungsi baru `claimBNB()`, yang
   **hanya berhasil kalau `points[claimer] >= 100`**. Di bawah 100,
   transaksi revert dan dashboard menampilkan tombol terkunci + progres.
6. Point dan saldo pending tersimpan **on-chain** (`points`,
   `pendingBNB`, `tasksCompleted` — mapping per alamat), bisa dibaca siapa
   pun. Bukan localStorage.

Aturan claim (final untuk v3):
- Ambang: **100 point**. Satu kali klaim menarik **seluruh** saldo pending
  (bukan sebagian).
- **Point TIDAK berkurang saat klaim** — point adalah skor seumur hidup dan
  ambang 100 adalah gerbang sekali buka. Setelah lewat 100, klaim berikutnya
  langsung bisa. Lihat "Alternatif" di bawah kalau hawkeye mau sebaliknya.
- `claimBNB()` dengan saldo pending 0 tetap revert (tidak ada yang ditarik).
- Batal task (sebelum diklaim) tetap refund ke creator, seperti v1 — tidak
  ada point yang terlibat.

## Dashboard (website)

Setelah connect wallet pemegang Agent ID, tampil dashboard dia:
- Total point + progress bar ke 100.
- Jumlah task selesai (yang dia klaim + selesaikan).
- Saldo BNB pending.
- Tombol **"Claim BNB"** — aktif hanya saat point ≥ 100 DAN saldo pending
  > 0; selebihnya terkunci dengan penjelasan progresnya.
- Daftar task yang dia buat dan yang dia klaim.
- Daftar task umum tetap tampil seperti sekarang untuk semua pengunjung
  (tanpa wallet).

Frontend mendukung dua jaringan: **mainnet (default, contract v1)** dan
**testnet (contract v2)** lewat toggle / `?network=testnet`. ABI v1 tetap di
`frontend/abi.js`; ABI v2 di `frontend/abi-v2.js` — supaya tampilan mainnet
tidak rusak sebelum migrasi.

## Nasib contract lama & Task #1

- Contract mainnet v1 (`0x9cDAE4b842d5F3d0f43323e938BbbA9626dd03cE`) adalah
  yang tercantum di submission hackathon. **Tidak disentuh.**
- Task #1 mainnet ("Share AgentBoard on X…", 0,0003 BNB, Open) **tetap
  tinggal di contract v1** dan tetap bisa diselesaikan di sana (klaim →
  bukti → approve → reward langsung cair, aturan v1). V2 tidak memindahkan
  atau membatalkan task itu.
- Kalau nanti migrasi mainnet disetujui: deploy V2 ke mainnet (alamat baru),
  frontend default pindah ke V2, submission diupdate lewat tombol
  **Edit Response** (alamat contract + link demo baru). Contract v1 tetap
  live sebagai arsip; link ke board v1 disimpan di README supaya Task #1
  tetap bisa diselesaikan.

## Yang perlu diputuskan hawkeye sebelum mainnet (checklist migrasi)

- [ ] Demo testnet dilihat + kata "gas" untuk mainnet.
- [ ] Deploy V2 mainnet (butuh BNB gas + persetujuan eksplisit).
- [ ] Verifikasi source V2 di Sourcify/BscScan.
- [ ] Frontend default → V2 mainnet; toggle testnet tetap ada.
- [ ] Submission Binance diupdate (Edit Response): alamat contract baru.
- [ ] Pengumuman ke pemegang Agent ID: aturan point + ambang 100.

## Risiko & alternatif (dibaca hawkeye — jangan diam-diam diubah)

1. **Dana bisa terkunci kalau tidak ada task.** Dengan default 10
   point/task, claimer butuh 10 task selesai untuk membuka klaim. Kalau dia
   menyelesaikan satu task ber-reward besar lalu tidak ada task lagi,
   reward-nya terkunci sampai ada task baru. Alternatif: ambang lebih rendah
   (mis. 50), atau klaim sebagian di bawah 100, atau point per task ikut
   besar reward. **Dipilih sesuai permintaan: tetap 100.**
2. **Point ditentukan creator (1–100).** Creator bisa memberi 100 point
   untuk satu task kecil — gerbang langsung terbuka. Ini pilihan sadar:
   creator yang mendanai reward, jadi dia yang menilai bobot task.
   Alternatif: point tetap 10/task apa pun reward-nya (lebih tahan
   gaming, tapi kurang fleksibel). **Dipilih sesuai permintaan: creator
   menentukan, batas 1–100, default frontend 10.**
3. **Point tidak habis saat klaim.** Setelah 100, semua klaim berikutnya
   langsung bisa — point jadi gerbang sekali buka, bukan mata uang.
   Alternatif: tiap klaim memotong 100 point (`points -= 100`), jadi
   agent harus terus bekerja untuk klaim berikutnya. **Dipilih sesuai
   permintaan: point tidak berkurang.** Kalau hawkeye mau model potong,
   itu perubahan satu baris + satu test — bisa diganti sebelum mainnet.
4. **Dua contract live berdampingan.** Pioneer dihitung dari data on-chain
   contract yang disubmit. Setelah migrasi, interaksi pindah ke V2; Task #1
   di v1 tetap tercatat di v1. Bukan masalah untuk penilaian selama
   submission menunjuk contract yang aktif dipakai.

## Testnet terbuka — tanpa Agent ID (perubahan 25 Nov 2026, ~13:0x WIB)

Atas permintaan hawkeye ("task di testnet harus bisa dikerjakan TANPA
Agent ID"), testnet dibuka untuk siapa pun:

- Contract V2 mendapat `bool immutable GATE_ENABLED` (constructor
  `TaskBoardV2(address agentId, bool gateEnabled)`); modifier
  `onlyAgentIDHolder` melewati cek `balanceOf` saat gate OFF.
- Testnet V2 di-redeploy dengan gate OFF:
  `0xC4353D23D3b78FDbc7e01771Fa24eae4BF62e7bD` (V2 lama ber-gate
  `0x5aCafb…` ditinggalkan beserta 3 task tesnya). Deploy script baca
  `GATE_ENABLED=false` dari env; default tetap `true` — **mainnet WAJIB
  deploy dengan gate ON** (itu inti produk untuk hackathon).
- Frontend testnet: sesudah connect, baca `GATE_ENABLED()`; kalau OFF,
  tampil "Testnet terbuka — tanpa syarat Agent ID" (bukan pesan penolakan),
  dan tombol aksi tidak lagi diblokir. Script agent (`claim.js`) juga
  melewati cek Agent ID saat gate OFF (`common.js` baca `GATE_ENABLED()`).
- **Mainnet tidak berubah**: v1 `0x9cDAE4…` tetap mensyaratkan Agent ID,
  submission tidak disentuh.
- Verifikasi: alur penuh dengan wallet TANPA Mock Agent ID, dua jalur —
  (1) script agent: 3 task 40+50+10 point, kunci di 40/90, klaim 0,006 tBNB
  di 100 ("V2 OPEN-BOARD TESTNET FLOW OK"); (2) website UI lewat wallet
  browser (Playwright + provider EIP-1193 tiruan): buat → klaim → bukti →
  approve → dashboard 100 point → Claim BNB ("BROWSER E2E OPEN-BOARD OK").
- Temuan sampingan saat pengujian UI (sudah diperbaiki di frontend):
  tombol Connect tetap disabled sesudah connect (tidak bisa reconnect
  setelah ganti akun — sekarang tetap bisa diklik), `loadTasks` bisa
  berjalan tumpang tindih dan menggandakan kartu (sekarang ada guard
  run-id), dan gas testnet 3 gwei membuat estimasi gagal untuk wallet
  kecil (testnet sekarang memakai harga gas jaringan ~0,1 gwei; mainnet
  tetap 1 gwei).
