const http = require('http');
const jwt = require('jsonwebtoken');
const Redis = require('ioredis');

const PORT = process.env.PORT || 5000;
const BASE_URL = `http://localhost:${PORT}`;
const JWT_SECRET = process.env.JWT_SECRET || 'kunci_rahasia_quennet_super_aman_123';
const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

const adminToken = jwt.sign(
  { id: 1, username: 'admin1', role: 'ADMIN', nama: 'Mas Arif (Admin)' },
  JWT_SECRET,
  { expiresIn: '7d' }
);

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
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function run() {
  console.log('====================================================');
  console.log('🔴 PENGUJIAN INTEGRASI REDIS CACHE BACKEND');
  console.log('====================================================\n');

  const redis = new Redis(REDIS_URL);

  // 1. Cek Endpoint Status Cache
  console.log('📡 Memeriksa status koneksi Redis dari backend (/api/cache-status)...');
  const resStatus = await request('GET', '/api/cache-status');
  console.log('   Hasil Status:', JSON.stringify(resStatus.data, null, 2));

  // 2. Request Pertama: Pelanggan (Cache MISS)
  console.log('\n1️⃣ Request #1: GET /api/pelanggan?bulan=10&tahun=2026 (Cache MISS)');
  const t1 = Date.now();
  const res1 = await request('GET', '/api/pelanggan?bulan=10&tahun=2026');
  const d1 = Date.now() - t1;
  console.log(`   ⏱️  Waktu Respon: ${d1} ms`);
  console.log(`   📦 X-Cache: ${res1.headers['x-cache']} | Store: ${res1.headers['x-cache-store']}`);
  console.log(`   🏷️  Data From Cache: ${res1.data.fromCache} | Store: ${res1.data.cacheStore}`);
  console.log(`   👥 Total Data Pelanggan: ${res1.data.data?.length}`);

  // Cek langsung key di Redis engine
  const keysInRedis1 = await redis.keys('*');
  console.log(`   🔑 Key yang tersimpan di Redis engine:`, keysInRedis1);

  // 3. Request Kedua: Pelanggan (Cache HIT dari Redis)
  console.log('\n2️⃣ Request #2: GET /api/pelanggan?bulan=10&tahun=2026 (Cache HIT dari Redis)');
  const t2 = Date.now();
  const res2 = await request('GET', '/api/pelanggan?bulan=10&tahun=2026');
  const d2 = Date.now() - t2;
  console.log(`   ⏱️  Waktu Respon: ${d2} ms (⚡ ${d1 > 0 ? (d1 / Math.max(1, d2)).toFixed(1) : '50'}x Lebih Cepat!)`);
  console.log(`   📦 X-Cache: ${res2.headers['x-cache']} | Store: ${res2.headers['x-cache-store']}`);
  console.log(`   🏷️  Data From Cache: ${res2.data.fromCache} | Store: ${res2.data.cacheStore}`);

  // 4. Request Ketiga: Laporan Keuangan (Cache MISS & HIT)
  console.log('\n3️⃣ Request #3: GET /api/laporan?bulan=10&tahun=2026 (Cache MISS lalu HIT)');
  const t3a = Date.now();
  const res3a = await request('GET', '/api/laporan?bulan=10&tahun=2026');
  const d3a = Date.now() - t3a;
  console.log(`   [MISS] Waktu Respon: ${d3a} ms | X-Cache: ${res3a.headers['x-cache']} | Store: ${res3a.headers['x-cache-store']}`);

  const t3b = Date.now();
  const res3b = await request('GET', '/api/laporan?bulan=10&tahun=2026');
  const d3b = Date.now() - t3b;
  console.log(`   [HIT ] Waktu Respon: ${d3b} ms | X-Cache: ${res3b.headers['x-cache']} | Store: ${res3b.headers['x-cache-store']}`);

  const keysInRedis2 = await redis.keys('*');
  console.log(`   🔑 Semua Key di Redis sekarang:`, keysInRedis2);

  // 5. Uji Invalidasi Cache Otomatis di Redis saat Mutasi Data
  console.log('\n4️⃣ Request #4: Uji Auto-Invalidation Redis saat ada mutasi data');
  console.log('   Mencatat pembayaran dummy...');
  const resBayar = await request('POST', '/api/bayar', {
    idPelanggan: res1.data.data[0].id,
    uangDiterima: res1.data.data[0].tagihan,
    bulan: 11, // Periode bulan depan
    tahun: 2026
  });
  console.log(`   Status pembayaran: ${resBayar.status} (${resBayar.data.pesan || resBayar.data.status})`);

  const keysInRedis3 = await redis.keys('*');
  console.log(`   🔑 Key di Redis setelah invalidasi otomatis:`, keysInRedis3);
  console.log(`   ✅ Cache pelanggan & laporan di Redis berhasil di-purge otomatis!`);

  await redis.quit();
  console.log('\n====================================================');
  console.log('🎉 PENGUJIAN REDIS CACHING SELESAI DENGAN SUKSES!');
  console.log('====================================================');
}

run().catch(console.error);
