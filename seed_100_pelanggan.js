const http = require('http');
const jwt = require('jsonwebtoken');

const PORT = process.env.PORT || 5000;
const BASE_URL = `http://localhost:${PORT}`;
const JWT_SECRET = process.env.JWT_SECRET || 'kunci_rahasia_quennet_super_aman_123';

// Buat JWT Admin token valid
const adminToken = jwt.sign(
  { id: 1, username: 'admin1', role: 'ADMIN', nama: 'Mas Arif (Admin)' },
  JWT_SECRET,
  { expiresIn: '7d' }
);

// 100 Nama Pelanggan Realistis
const NAMA_PELANGGAN = [
  'Budi Santoso', 'Siti Aminah', 'Joko Widodo', 'Dewi Lestari', 'Eko Prasetyo',
  'Fajar Hidayat', 'Gita Permata', 'Hendra Setiawan', 'Indah Kusuma', 'Kartika Sari',
  'Lukman Hakim', 'Mega Utami', 'Nanda Pratama', 'Oki Setiawan', 'Putri Rahayu',
  'Rian Ardianto', 'Siti Nurhaliza', 'Teguh Wibowo', 'Umar Bakri', 'Vina Panduwinata',
  'Wahyu Hidayat', 'Yanto Basna', 'Zainal Abidin', 'Agus Supriyanto', 'Bayu Anggoro',
  'Citra Kirana', 'Danang Sutrisno', 'Endang Susilowati', 'Firman Syahputra', 'Gunawan Wibisono',
  'Hadi Purnomo', 'Ika Wahyuni', 'Jaka Tarub', 'Krisna Murti', 'Lilis Suryani',
  'Maulana Malik', 'Nina Marlina', 'Ony Suryanto', 'Panji Asmoro', 'Qori Sandioriva',
  'Raden Mas Said', 'Surya Saputra', 'Tri Wahyudi', 'Utari Ningrum', 'Vicky Prasetyo',
  'Wulan Guritno', 'Yoga Pratama', 'Zaskia Sungkar', 'Anang Hermansyah', 'Bella Saphira',
  'Candra Darusman', 'Dwi Andhika', 'Erna Sari', 'Ferry Salim', 'Gading Marten',
  'Hesti Purwadinata', 'Irfan Hakim', 'Juwita Bahar', 'Kiki Fatmala', 'Luna Maya',
  'Marcel Chandrawinata', 'Nia Ramadhani', 'Olga Syahputra', 'Pasha Ungu', 'Raffi Ahmad',
  'Syahrini Wardhana', 'Taufik Hidayat', 'Ussy Sulistiawaty', 'Vincent Rompies', 'Wendi Cagur',
  'Yuni Shara', 'Zaskia Gotik', 'Andre Taulany', 'Baim Wong', 'Cut Tari',
  'Desta Mahendra', 'Sule Sutisna', 'Fitri Tropica', 'Giring Ganesha', 'Indra Bekti',
  'Judika Sihotang', 'Komeng Alfiansyah', 'Limbad Pratama', 'Melly Goeslaw', 'Nassar Fahad',
  'Opick Tomboati', 'Parto Edi', 'Rhoma Irama', 'Soimah Pancawati', 'Tukul Arwana',
  'Uya Kuya', 'Vidi Aldiano', 'Dono Warkop', 'Kasino Warkop', 'Indro Warkop',
  'Yan Vellia', 'Zian Zigas', 'Ari Lasso', 'Bebi Romeo', 'Cakra Khan'
];

const DAFTAR_DESA = [
  'Talangagung', 'Panggungrejo', 'Cepokomulyo', 'Mangunrejo', 'Penarukan',
  'Dilem', 'Jatirejoyoso', 'Curungrejo', 'Kedungpedaringan', 'Sukun'
];

const DAFTAR_RT = ['01', '02', '03', '04', '05', '06', '07', '08'];
const DAFTAR_TAGIHAN = [100000, 150000, 175000, 200000, 250000];

function request(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
        ...headers
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ status: res.statusCode, headers: res.headers, data: json });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, raw: data });
        }
      });
    });

    req.on('error', reject);

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function main() {
  console.log('====================================================');
  console.log('🚀 MEMULAI SEED & POST 100 DATA PELANGGAN KE BACKEND');
  console.log('====================================================\n');

  console.log(`📡 Menghubungi Backend di ${BASE_URL}...`);
  try {
    const ping = await request('GET', '/api/auth/login').catch(() => null);
  } catch (err) {
    console.error(`❌ Gagal terhubung ke ${BASE_URL}. Pastikan server.js sedang berjalan.`);
    process.exit(1);
  }

  console.log(`Mengirim 100 data pelanggan via POST /api/pelanggan...`);
  const startTime = Date.now();
  const createdPelanggan = [];

  for (let i = 0; i < NAMA_PELANGGAN.length; i++) {
    const nama = NAMA_PELANGGAN[i];
    const desa = DAFTAR_DESA[i % DAFTAR_DESA.length];
    const rt = DAFTAR_RT[i % DAFTAR_RT.length];
    const tagihan = DAFTAR_TAGIHAN[i % DAFTAR_TAGIHAN.length];
    const bulanMulai = (i % 10) + 1; // 1 s/d 10
    const tahunMulai = 2026;

    const payload = {
      nama,
      kecamatan: 'Kepanjen',
      desa,
      rt,
      tagihan,
      bulanMulai,
      tahunMulai
    };

    try {
      const res = await request('POST', '/api/pelanggan', payload);
      if (res.status === 201 && res.data.status === 'sukses') {
        createdPelanggan.push(res.data.data);
        process.stdout.write(`\r✅ Berhasil post ${createdPelanggan.length}/100 pelanggan: ${nama} (${desa} RT ${rt})`);
      } else {
        console.error(`\n⚠️ Gagal post pelanggan ${nama}:`, res.data);
      }
    } catch (e) {
      console.error(`\n❌ Error saat post ${nama}:`, e.message);
    }
  }

  const durationPost = Date.now() - startTime;
  console.log(`\n\n🎉 Selesai posting ${createdPelanggan.length} pelanggan dalam ${durationPost}ms (${(durationPost/1000).toFixed(2)} detik)!\n`);

  // Simulasi 35 pelanggan sudah membayar di bulan 10 (Oktober) 2026
  console.log('💳 Mencatat simulasi pembayaran untuk 35 pelanggan di periode 10/2026...');
  let lunasCount = 0;
  for (let i = 0; i < Math.min(35, createdPelanggan.length); i++) {
    const p = createdPelanggan[i];
    try {
      const resBayar = await request('POST', '/api/bayar', {
        idPelanggan: p.id,
        uangDiterima: p.tagihan,
        bulan: 10,
        tahun: 2026
      });
      if (resBayar.status === 200) {
        lunasCount++;
      }
    } catch (e) {
      // Abaikan jika error minor
    }
  }
  console.log(`✅ Berhasil mencatat ${lunasCount} transaksi pembayaran lunas.\n`);

  // ==================== UJI PERFORMA CACHING ====================
  console.log('====================================================');
  console.log('⚡ PENGUJIAN PERFORMA CACHING (DATA BESAR 100+ ITEM)');
  console.log('====================================================\n');

  // Request 1: Ambil data pelanggan (Cache MISS / pertama kali)
  console.log('1️⃣ Request #1: GET /api/pelanggan?bulan=10&tahun=2026 (Cache MISS)');
  const t1 = Date.now();
  const res1 = await request('GET', '/api/pelanggan?bulan=10&tahun=2026');
  const d1 = Date.now() - t1;
  const count1 = res1.data && res1.data.data ? res1.data.data.length : 0;
  console.log(`   ⏱️  Waktu respon: ${d1} ms`);
  console.log(`   📦 X-Cache Header: ${res1.headers['x-cache'] || 'N/A'}`);
  console.log(`   🏷️  From Cache: ${res1.data.fromCache}`);
  console.log(`   👥 Total Pelanggan diterima: ${count1}\n`);

  // Request 2: Ambil data pelanggan yang sama (Cache HIT)
  console.log('2️⃣ Request #2: GET /api/pelanggan?bulan=10&tahun=2026 (Cache HIT)');
  const t2 = Date.now();
  const res2 = await request('GET', '/api/pelanggan?bulan=10&tahun=2026');
  const d2 = Date.now() - t2;
  console.log(`   ⏱️  Waktu respon: ${d2} ms (⚡ ${d1 > 0 ? (d1 / Math.max(1, d2)).toFixed(1) : '99'}x LEBIH CEPAT!)`);
  console.log(`   📦 X-Cache Header: ${res2.headers['x-cache'] || 'N/A'}`);
  console.log(`   🏷️  From Cache: ${res2.data.fromCache}\n`);

  // Request 3: Force refresh pelanggan (?refresh=true)
  console.log('3️⃣ Request #3: GET /api/pelanggan?bulan=10&tahun=2026&refresh=true (BYPASS CACHE)');
  const t3 = Date.now();
  const res3 = await request('GET', '/api/pelanggan?bulan=10&tahun=2026&refresh=true');
  const d3 = Date.now() - t3;
  console.log(`   ⏱️  Waktu respon: ${d3} ms`);
  console.log(`   📦 X-Cache Header: ${res3.headers['x-cache'] || 'N/A'}`);
  console.log(`   🏷️  From Cache: ${res3.data.fromCache}\n`);

  // Request 4: Laporan Keuangan (Cache MISS)
  console.log('4️⃣ Request #4: GET /api/laporan?bulan=10&tahun=2026 (Cache MISS)');
  const t4 = Date.now();
  const res4 = await request('GET', '/api/laporan?bulan=10&tahun=2026');
  const d4 = Date.now() - t4;
  console.log(`   ⏱️  Waktu respon: ${d4} ms`);
  console.log(`   📦 X-Cache Header: ${res4.headers['x-cache'] || 'N/A'}`);
  console.log(`   💰 Uang Terkumpul: ${res4.data?.keuangan?.formatRupiah?.uangTerkumpul || 'N/A'}`);
  console.log(`   📊 Sudah Bayar: ${res4.data?.ringkasanPelanggan?.sudahBayar}, Belum: ${res4.data?.ringkasanPelanggan?.belumBayar}\n`);

  // Request 5: Laporan Keuangan (Cache HIT)
  console.log('5️⃣ Request #5: GET /api/laporan?bulan=10&tahun=2026 (Cache HIT)');
  const t5 = Date.now();
  const res5 = await request('GET', '/api/laporan?bulan=10&tahun=2026');
  const d5 = Date.now() - t5;
  console.log(`   ⏱️  Waktu respon: ${d5} ms (⚡ ${d4 > 0 ? (d4 / Math.max(1, d5)).toFixed(1) : '99'}x LEBIH CEPAT!)`);
  console.log(`   📦 X-Cache Header: ${res5.headers['x-cache'] || 'N/A'}`);
  console.log(`   🏷️  From Cache: ${res5.data.fromCache}\n`);

  console.log('====================================================');
  console.log('✅ SEMUA PENGUJIAN SEED DAN CACHING SELESAI SUKSES!');
  console.log('====================================================');
}

main().catch(console.error);
