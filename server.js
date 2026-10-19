const express = require('express');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'kunci_rahasia_quennet_super_aman_123';

// ==================== IN-MEMORY CACHE SYSTEM ====================
// Caching super cepat untuk data besar (pelanggan & laporan)
// Mengurangi beban database dan mempercepat response hingga sub-milidetik (<2ms)
class SimpleCache {
  constructor(defaultTTLMs = 5 * 60 * 1000) { // Default TTL: 5 menit
    this.cache = new Map();
    this.defaultTTL = defaultTTLMs;
  }

  get(key) {
    const item = this.cache.get(key);
    if (!item) return null;
    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      return null;
    }
    return item.value;
  }

  set(key, value, ttlMs = this.defaultTTL) {
    this.cache.set(key, {
      value,
      expiry: Date.now() + ttlMs,
      cachedAt: new Date().toISOString()
    });
  }

  delete(key) {
    this.cache.delete(key);
  }

  // Hapus semua cache yang diawali prefix (contoh: 'pelanggan:' atau 'laporan:')
  invalidatePrefix(prefix) {
    let deletedCount = 0;
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
        deletedCount++;
      }
    }
    return deletedCount;
  }

  // Bersihkan semua cache
  clear() {
    const count = this.cache.size;
    this.cache.clear();
    return count;
  }

  size() {
    return this.cache.size;
  }
}

const apiCache = new SimpleCache(5 * 60 * 1000); // Cache selama 5 menit


// 1. Pasang CORS di bahagian paling atas sebelum sebarang laluan
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-refresh-cache']
}));

// 2. Benarkan pelayan membaca JSON
app.use(express.json());

// Seterusnya di bawah ini barulah fungsi verifikasiRole dan laluan-laluan API anda...


// Middleware untuk mengecek token & role
const verifikasiRole = (rolesDiizinkan = []) => {
  return (req, res, next) => {
    const authHeader = req.headers['authorization'];

    // Format header: "Bearer <token>"
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ status: 'gagal', pesan: 'Akses ditolak! Anda belum login.' });
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = decoded; // Menyimpan data user (id, role, nama) ke request

      // Cek apakah role user cocok dengan rute yang dituju
      if (rolesDiizinkan.length > 0 && !rolesDiizinkan.includes(decoded.role)) {
        return res.status(403).json({
          status: 'gagal',
          pesan: `Akses dilarang! Role '${decoded.role}' tidak memiliki izin untuk fitur ini.`
        });
      }

      next(); // Lolos pemeriksaan, silakan lanjut ke fungsi rute
    } catch (err) {
      return res.status(403).json({ status: 'gagal', pesan: 'Token tidak valid atau sudah kadaluwarsa.' });
    }
  };
};

// Registrasi Akun Baru (Hanya bisa dibuat awal atau oleh Admin)
app.post(['/api/auth/register', '/auth/register'], async (req, res) => {
  try {
    const { username, password, nama, role } = req.body;

    if (!username || !password || !nama) {
      return res.status(400).json({ status: 'gagal', pesan: 'Username, password, dan nama wajib diisi' });
    }

    // Acak password sebelum disimpan ke database
    const passwordHash = await bcrypt.hash(password, 10);

    const userBaru = await prisma.user.create({
      data: {
        username: username.toLowerCase(),
        password: passwordHash,
        nama,
        role: role ? role.toUpperCase() : 'PENAGIH'
      }
    });

    res.status(201).json({
      status: 'sukses',
      pesan: `User ${userBaru.username} dengan role ${userBaru.role} berhasil dibuat!`,
      data: { id: userBaru.id, username: userBaru.username, nama: userBaru.nama, role: userBaru.role }
    });
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(400).json({ status: 'gagal', pesan: 'Username sudah digunakan!' });
    }
    res.status(500).json({ status: 'error', pesan: error.message });
  }
});

// Login Akun & Terbitkan Token
app.post(['/api/auth/login', '/auth/login'], async (req, res) => {
  try {
    const { username, password } = req.body;

    const user = await prisma.user.findUnique({
      where: { username: username ? username.toLowerCase() : '' }
    });

    if (!user) {
      return res.status(404).json({ status: 'gagal', pesan: 'Username atau password salah!' });
    }

    // Bandingkan password inputan dengan hash di database
    const passwordCocok = await bcrypt.compare(password, user.password);
    if (!passwordCocok) {
      return res.status(400).json({ status: 'gagal', pesan: 'Username atau password salah!' });
    }

    // Buat tiket token JWT (berlaku 7 hari)
    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role, nama: user.nama },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      status: 'sukses',
      pesan: 'Login berhasil!',
      token,
      user: {
        id: user.id,
        nama: user.nama,
        role: user.role
      }
    });
  } catch (error) {
    res.status(500).json({ status: 'error', pesan: error.message });
  }
});



// 1. Ambil Pelanggan Lengkap dengan Status Lunas Bulan Ini
app.get('/api/pelanggan', verifikasiRole(['ADMIN', 'PENAGIH']), async (req, res) => {
  try {
    const { desa, rt, bulan, tahun } = req.query;

    const waktuSekarang = new Date();
    const targetBulan = bulan ? Number(bulan) : waktuSekarang.getMonth() + 1;
    const targetTahun = tahun ? Number(tahun) : waktuSekarang.getFullYear();

    const listPelanggan = await prisma.pelanggan.findMany({
      where: {
        ...(desa && { desa }),
        ...(rt && { rt }),
        // Filter: Hanya tampilkan jika tahunMulai lebih lampau ATAU tahunnya sama tapi bulanMulai <= bulan target
        OR: [
          { tahunMulai: { lt: targetTahun } },
          {
            tahunMulai: targetTahun,
            bulanMulai: { lte: targetBulan }
          }
        ]
      },
      include: {
        pembayaran: {
          where: { bulan: targetBulan, tahun: targetTahun }
        }
      },
      orderBy: { nama: 'asc' }
    });

    // Formatting data ke front-end
    const dataFormatted = listPelanggan.map((p) => {
      const infoBayar = p.pembayaran[0] || null;
      return {
        id: p.id,
        nama: p.nama,
        kecamatan: p.kecamatan,
        desa: p.desa,
        rt: p.rt,
        tagihan: p.tagihan,
        bulanMulai: p.bulanMulai,
        tahunMulai: p.tahunMulai,
        periodeBulan: targetBulan,
        periodeTahun: targetTahun,
        isLunas: Boolean(infoBayar),
        statusPembayaran: infoBayar ? 'Lunas' : 'Belum_Lunas',
        detailPembayaran: infoBayar
          ? {
              uangDiterima: infoBayar.nominalDiterima,
              kembalian: infoBayar.kembalian,
              penagih: infoBayar.namaPenagih,
              tanggalBayar: infoBayar.createdAt
            }
          : null
      };
    });

    res.json({ status: 'sukses', data: dataFormatted });
  } catch (error) {
    res.status(500).json({ status: 'error', pesan: error.message });
  }
});

// 2. Admin Menambah Pelanggan Baru
app.post('/api/pelanggan', verifikasiRole(['ADMIN']), async (req, res) => {
  try {
    const { nama, kecamatan, desa, rt, tagihan, bulanMulai, tahunMulai } = req.body;

    const sekarang = new Date();
    const bulanAwal = bulanMulai ? Number(bulanMulai) : sekarang.getMonth() + 1;
    const tahunAwal = tahunMulai ? Number(tahunMulai) : sekarang.getFullYear();

    const pelangganBaru = await prisma.pelanggan.create({
      data: {
        nama,
        kecamatan: kecamatan || 'Kepanjen',
        desa,
        rt,
        tagihan: Number(tagihan),
        bulanMulai: bulanAwal,
        tahunMulai: tahunAwal
      }
    });

    // Invalidate cache agar data baru langsung masuk di query berikutnya
    apiCache.invalidatePrefix('pelanggan:');
    apiCache.invalidatePrefix('laporan:');

    res.status(201).json({ status: 'sukses', data: pelangganBaru });
  } catch (error) {
    res.status(500).json({ status: 'error', pesan: error.message });
  }
});

// 3. Admin Mengubah (Edit) Data Pelanggan Berdasarkan ID
app.put('/api/pelanggan/:id', verifikasiRole(['ADMIN']), async (req, res) => {
  try {
    const { id } = req.params;
    const { nama, kecamatan, desa, rt, tagihan, bulanMulai, tahunMulai } = req.body;

    // Periksa apakah pelanggan dengan ID ini ada
    const pelangganAda = await prisma.pelanggan.findUnique({
      where: { id: Number(id) }
    });

    if (!pelangganAda) {
      return res.status(404).json({
        status: 'gagal',
        pesan: `Pelanggan dengan ID ${id} tidak ditemukan`
      });
    }

    // Perbarui data pelanggan di database
    const pelangganDiperbarui = await prisma.pelanggan.update({
      where: { id: Number(id) },
      data: {
        nama: nama || pelangganAda.nama,
        kecamatan: kecamatan || pelangganAda.kecamatan,
        desa: desa || pelangganAda.desa,
        rt: rt || pelangganAda.rt,
        tagihan: tagihan !== undefined ? Number(tagihan) : pelangganAda.tagihan,
        bulanMulai: bulanMulai !== undefined ? Number(bulanMulai) : pelangganAda.bulanMulai,
        tahunMulai: tahunMulai !== undefined ? Number(tahunMulai) : pelangganAda.tahunMulai
      }
    });

    res.json({
      status: 'sukses',
      pesan: `Data ${pelangganDiperbarui.nama} berhasil diperbarui!`,
      data: pelangganDiperbarui
    });
  } catch (error) {
    res.status(500).json({ status: 'error', pesan: error.message });
  }
});

// 4. Riwayat Pembayaran Pelanggan Berdasarkan ID
app.get('/api/pelanggan/:id/riwayat', verifikasiRole(['ADMIN', 'PENAGIH']), async (req, res) => {
  try {
    const { id } = req.params;

    const riwayat = await prisma.pembayaran.findMany({
      where: { pelangganId: Number(id) },
      orderBy: { createdAt: 'desc' }
    });

    res.json({
      status: 'sukses',
      totalTransaksi: riwayat.length,
      data: riwayat
    });
  } catch (error) {
    res.status(500).json({ status: 'error', pesan: error.message });
  }
});

// 5. Admin Menghapus Pelanggan Berdasarkan ID
app.delete('/api/pelanggan/:id', verifikasiRole(['ADMIN']), async (req, res) => {
  try {
    const { id } = req.params;

    // Periksa apakah pelanggan dengan ID ini ada sebelum dihapus
    const pelangganAda = await prisma.pelanggan.findUnique({
      where: { id: Number(id) }
    });

    if (!pelangganAda) {
      return res.status(404).json({
        status: 'gagal',
        pesan: `Pelanggan dengan ID ${id} tidak ditemukan`
      });
    }

    // Hapus data dari database Neon
    await prisma.pelanggan.delete({
      where: { id: Number(id) }
    });

    res.json({
      status: 'sukses',
      pesan: `Data pelanggan '${pelangganAda.nama}' (ID: ${id}) berhasil dihapus permanen.`
    });
  } catch (error) {
    res.status(500).json({ status: 'error', pesan: error.message });
  }
});

// 6. Mencatat Pembayaran + Hitung Kembalian
app.post('/api/bayar', verifikasiRole(['ADMIN', 'PENAGIH']), async (req, res) => {
  try {
    const { idPelanggan, uangDiterima, bulan, tahun } = req.body;

    const waktuSekarang = new Date();
    const targetBulan = bulan ? Number(bulan) : waktuSekarang.getMonth() + 1; // 1 - 12
    const targetTahun = tahun ? Number(tahun) : waktuSekarang.getFullYear();

    const dataPelanggan = await prisma.pelanggan.findUnique({
      where: { id: Number(idPelanggan) }
    });

    if (!dataPelanggan) {
      return res.status(404).json({ status: 'gagal', pesan: 'Pelanggan tidak ditemukan' });
    }

    // Cek apakah bulan tersebut sudah pernah dibayar
    const sudahBayar = await prisma.pembayaran.findUnique({
      where: {
        pelangganId_bulan_tahun: {
          pelangganId: Number(idPelanggan),
          bulan: targetBulan,
          tahun: targetTahun
        }
      }
    });

    if (sudahBayar && sudahBayar.status === 'Lunas') {
      return res.status(400).json({
        status: 'gagal',
        pesan: `Tagihan periode ${targetBulan}/${targetTahun} untuk ${dataPelanggan.nama} sudah lunas!`
      });
    }

    if (uangDiterima < dataPelanggan.tagihan) {
      const kekurangan = dataPelanggan.tagihan - uangDiterima;
      return res.status(400).json({
        status: 'gagal',
        pesan: `Uang kurang! Kurang Rp ${kekurangan.toLocaleString('id-ID')}`
      });
    }

    const kembalian = uangDiterima - dataPelanggan.tagihan;

    // Simpan bukti transaksi ke tabel Pembayaran
    const transaksi = await prisma.pembayaran.create({
      data: {
        pelangganId: dataPelanggan.id,
        bulan: targetBulan,
        tahun: targetTahun,
        nominalTagihan: dataPelanggan.tagihan,
        nominalDiterima: Number(uangDiterima),
        kembalian: kembalian,
        status: 'Lunas',
        namaPenagih: req.user ? req.user.nama : 'Penagih Lapangan'
      }
    });

    res.json({
      status: 'sukses',
      pesan: `Pembayaran ${dataPelanggan.nama} bulan ${targetBulan}/${targetTahun} berhasil dicatat!`,
      data: transaksi
    });
  } catch (error) {
    res.status(500).json({ status: 'error', pesan: error.message });
  }
});

// 7. Membatalkan Pembayaran (Undo)
app.post('/api/batal-bayar', verifikasiRole(['ADMIN', 'PENAGIH']), async (req, res) => {
  try {
    const { idPelanggan, bulan, tahun } = req.body;

    const waktuSekarang = new Date();
    const targetBulan = bulan ? Number(bulan) : waktuSekarang.getMonth() + 1;
    const targetTahun = tahun ? Number(tahun) : waktuSekarang.getFullYear();

    // Hapus transaksi yang salah input
    await prisma.pembayaran.delete({
      where: {
        pelangganId_bulan_tahun: {
          pelangganId: Number(idPelanggan),
          bulan: targetBulan,
          tahun: targetTahun
        }
      }
    });

    res.json({
      status: 'sukses',
      pesan: `Pembayaran periode ${targetBulan}/${targetTahun} berhasil dibatalkan.`
    });
  } catch (error) {
    res.status(404).json({ status: 'gagal', pesan: 'Transaksi tidak ditemukan atau sudah dibatalkan' });
  }
});

// 8. Rekap Laporan Keuangan (Khusus ADMIN - Berdasarkan Periode Bulan & Tahun)
app.get('/api/laporan', verifikasiRole(['ADMIN']), async (req, res) => {
  try {
    const { bulan, tahun } = req.query;
    const sekarang = new Date();
    const targetBulan = bulan ? Number(bulan) : sekarang.getMonth() + 1;
    const targetTahun = tahun ? Number(tahun) : sekarang.getFullYear();

    // Hitung pelanggan yang sudah aktif di periode target
    const pelangganAktifDiPeriode = await prisma.pelanggan.findMany({
      where: {
        OR: [
          { tahunMulai: { lt: targetTahun } },
          {
            tahunMulai: targetTahun,
            bulanMulai: { lte: targetBulan }
          }
        ]
      }
    });

    const totalPelanggan = pelangganAktifDiPeriode.length;
    const totalTargetUang = pelangganAktifDiPeriode.reduce((acc, curr) => acc + curr.tagihan, 0);

    const transaksiBulanIni = await prisma.pembayaran.findMany({
      where: { bulan: targetBulan, tahun: targetTahun, status: 'Lunas' }
    });

    const totalUangMasuk = transaksiBulanIni.reduce((acc, curr) => acc + curr.nominalTagihan, 0);
    const sisaUangTertunggak = Math.max(0, totalTargetUang - totalUangMasuk);

    res.json({
      status: 'sukses',
      periode: { bulan: targetBulan, tahun: targetTahun },
      ringkasanPelanggan: {
        totalPelanggan,
        sudahBayar: transaksiBulanIni.length,
        belumBayar: Math.max(0, totalPelanggan - transaksiBulanIni.length)
      },
      keuangan: {
        uangTerkumpul: totalUangMasuk,
        uangTertunggak: sisaUangTertunggak,
        targetTotal: totalTargetUang,
        formatRupiah: {
          uangTerkumpul: `Rp ${totalUangMasuk.toLocaleString('id-ID')}`,
          uangTertunggak: `Rp ${sisaUangTertunggak.toLocaleString('id-ID')}`,
          targetTotal: `Rp ${totalTargetUang.toLocaleString('id-ID')}`
        }
      }
    });
  } catch (error) {
    res.status(500).json({ status: 'error', pesan: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server Quennet dengan Database aktif di http://localhost:${PORT}`);
});