# Rencana Proyek: TOPIK I Vocabulary Quiz Game

Proyek ini bertujuan membuat sebuah aplikasi web berbasis Single Page Application (SPA) yang interaktif untuk membantu belajar kosakata bahasa Korea (TOPIK I) berdasarkan berkas `TOPIK-I-1671.txt`. Aplikasi ini akan dirancang dengan tampilan premium, responsif (mendukung desktop maupun mobile/Android), serta dapat dijalankan secara langsung tanpa masalah CORS.

---

## 📌 Rencana Langkah Kerja (Checklist)

Silakan centang langkah-langkah di bawah ini seiring dengan progres pengerjaan:

- [x] **Langkah 1: Pembuatan Script Parser Data (`generate_data.js`)**
  - [x] Membuat script parser Node.js untuk membaca dan merapikan data dari `TOPIK-I-1671.txt`.
  - [x] Menangani anomali layout kolom pada halaman bawah PDF yang terekstrak secara bersilangan.
  - [x] Menghasilkan file output `words.js` yang mengekspos array kosakata global `window.TOPIK_WORDS` untuk menghindari isu CORS saat dijalankan lokal.
  - [x] Memverifikasi bahwa jumlah kata tepat 1671 kata tanpa ada ID yang terlewat.

- [x] **Langkah 2: Pembuatan Struktur HTML Aplikasi (`index.html`)**
  - [x] Membuat kerangka dasar HTML5 yang bersih dan semantik.
  - [x] Menghubungkan Google Fonts (`Inter` / `Outfit`) untuk tipografi modern dan premium.
  - [x] Menyediakan kontainer untuk:
    - [x] **Lobby Screen**: Pemilihan tipe aktivitas (Kuis atau Belajar Mandiri/Daftar Kata), jumlah soal (25, 50, 100, Semua), tipe game (Urut berdasarkan blok tertentu atau Acak).
    - [x] **Quiz Screen**: Menampilkan kartu kata Korea, bar progres, pilihan ganda (4 opsi), dan tombol navigasi.
    - [x] **Study Screen (Daftar Kata)**: Menampilkan list kosakata langsung dengan fitur "Sembunyikan/Tampilkan Arti" untuk belajar mandiri, filter blok kata, dan pencarian cepat.
    - [x] **Results Screen**: Menampilkan skor akhir, persentase kelulusan, dan bagian peninjauan ulang kata yang salah (Review Mistaken Words).
    - [x] **Dictionary Screen**: Fitur pencarian kata interaktif untuk seluruh 1671 kata.

- [x] **Langkah 3: Desain Tampilan Premium (`styles.css`)**
  - [x] Menerapkan palet warna modern berbasis *Dark Mode* dengan gradasi ungu/indigo dan aksen oranye hangat.
  - [x] Mendesain tata letak yang sepenuhnya responsif (mobile-first layout) agar pas di layar HP Android maupun monitor PC.
  - [x] Menambahkan efek *glassmorphism* pada kartu pertanyaan dan kontainer utama.
  - [x] Membuat efek transisi dan mikro-animasi pada tombol pilihan (skala saat ditekan, hover menyala, animasi kilat warna hijau/merah saat jawaban benar/salah).
  - [x] Mendesain progress bar yang halus dan modern.

- [x] **Langkah 4: Logika Permainan & Kamus Pencarian (`app.js`)**
  - [x] Mengatur pergantian layar (Lobby, Quiz, Results, Dictionary) secara mulus.
  - [x] Membuat fungsi pengacak opsi ganda (1 jawaban benar + 3 jawaban salah secara acak dari database kosakata dalam Bahasa Indonesia).
  - [x] Menerapkan pembagian blok soal (misal per 25, 50, 100 kata) secara otomatis sesuai total kata.
  - [x] Menyimpan jawaban salah selama kuis berlangsung untuk ditampilkan di bagian akhir (Results Review).
  - [x] Menerapkan fitur **Auto-Save & Resume** menggunakan `localStorage`.
  - [x] Menambahkan pemilih jumlah kosakata dinamis (25, 50, 100, Semua) langsung di layar belajar mandiri.
  - [x] Membuat fungsi pencarian kosakata di kamus (mendukung pencarian berdasarkan huruf Hangeul, arti Indonesia, maupun arti Inggris).

- [x] **Langkah 5: Pengujian & Finalisasi**
  - [x] Menguji pembukaan file `index.html` secara langsung (protokol `file://`) untuk memastikan tidak ada error CORS.
  - [x] Menerjemahkan seluruh 1.671 kosakata ke Bahasa Indonesia (menggabungkan 440 terjemahan terkurasi dengan hasil batch-translate Google API).
  - [x] Memastikan game berjalan lancar di berbagai ukuran layar HP Android & PC.
  - [x] Menyelesaikan dokumentasi walkthrough akhir.

---

## 📂 Struktur Folder Proyek

```text
TOPIK 1 GAME/
├── README.md           # Berkas ini (pencatat rencana dan progres)
├── generate_data.js    # Script parser untuk mengonversi TXT menjadi JS
├── words.js            # Data kosakata hasil parse (global array window.TOPIK_WORDS)
├── index.html          # Kerangka antarmuka game
├── styles.css          # Desain dan animasi premium (CSS)
└── app.js              # Logika game, manajemen skor, dan kamus (JS)
```
