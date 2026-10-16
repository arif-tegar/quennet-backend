const express = require('express');
const { PrismaClient } = require('@prisma/client');

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 5000;

app.use(express.json());

// 1. Ambil Semua Data Pelanggan (dengan filter desa & rt)
app.get('/api/pelanggan', async (req, res) => {
  try {
    const { desa, rt } = req.query;

    const whereClause = {};
    if (desa) whereClause.desa = desa;
    if (rt) whereClause.rt = rt;

    const dataPelanggan = await prisma.pelanggan.findMany({
      where: whereClause
    });

    res.json({
      status: 'sukses',
      totalData: dataPelanggan.length,
      data: dataPelanggan
    });
  } catch (error) {
    res.status(500).json({ status: 'error', pesan: error.message });
  }
});

// 2. Admin Menambah Pelanggan Baru
app.post('/api/pelanggan', async (req, res) => {
  try {
    const { nama, kecamatan, desa, rt, tagihan } = req.body;

    if (!nama || !desa || !rt || !tagihan) {
      return res.status(400).json({
        status: 'gagal',
        pesan: 'Nama, desa, RT, dan tagihan wajib diisi'
      });
    }

    const pelangganBaru = await prisma.pelanggan.create({
      data: {
        nama,
        kecamatan: kecamatan || 'Kepanjen',
        desa,
        rt,
        tagihan: Number(tagihan)
      }
    });

    res.status(201).json({
      status: 'sukses',
      pesan: 'Pelanggan baru berhasil disimpan ke database!',
      data: pelangganBaru
    });
  } catch (error) {
    res.status(500).json({ status: 'error', pesan: error.message });
  }
});

// 3. Admin Mengubah (Edit) Data Pelanggan Berdasarkan ID
app.put('/api/pelanggan/:id', async (req, res) => {
  try {
    const { id } = req.params; // Mengambil ID dari parameter URL (:id)
    const { nama, kecamatan, desa, rt, tagihan } = req.body;

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
        tagihan: tagihan !== undefined ? Number(tagihan) : pelangganAda.tagihan
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

// 4. Admin Menghapus Pelanggan Berdasarkan ID
app.delete('/api/pelanggan/:id', async (req, res) => {
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

// 5. Paman Mencatat Pembayaran + Hitung Kembalian
app.post('/api/bayar', async (req, res) => {
  try {
    const { idPelanggan, uangDiterima } = req.body;

    const dataPelanggan = await prisma.pelanggan.findUnique({
      where: { id: Number(idPelanggan) }
    });

    if (!dataPelanggan) {
      return res.status(404).json({ status: 'gagal', pesan: 'Pelanggan tidak ditemukan' });
    }

    if (uangDiterima < dataPelanggan.tagihan) {
      const kekurangan = dataPelanggan.tagihan - uangDiterima;
      return res.status(400).json({
        status: 'gagal',
        pesan: `Uang kurang! Kurang Rp ${kekurangan.toLocaleString('id-ID')}`
      });
    }

    const uangKembalian = uangDiterima - dataPelanggan.tagihan;

    // Perbarui status langsung di database
    const hasilUpdate = await prisma.pelanggan.update({
      where: { id: Number(idPelanggan) },
      data: { lunas: "Lunas" }
    });

    res.json({
      status: 'sukses',
      pesan: `Pembayaran ${hasilUpdate.nama} berhasil dicatat!`,
      tagihan: hasilUpdate.tagihan,
      uangDiterima,
      kembalian: uangKembalian,
      statusBayar: 'LUNAS'
    });
  } catch (error) {
    res.status(500).json({ status: 'error', pesan: error.message });
  }
});

// 6. Paman Membatalkan Pembayaran (Undo)
app.post('/api/batal-bayar', async (req, res) => {
  try {
    const { idPelanggan } = req.body;

    const hasilUpdate = await prisma.pelanggan.update({
      where: { id: Number(idPelanggan) },
      data: { lunas: false }
    });

    res.json({
      status: 'sukses',
      pesan: `Status pembayaran ${hasilUpdate.nama} dibatalkan (kembali BELUM LUNAS)`
    });
  } catch (error) {
    res.status(500).json({ status: 'error', pesan: error.message });
  }
});

// 7. Rekap Laporan Keuangan
app.get('/api/laporan', async (req, res) => {
  try {
    const semuaPelanggan = await prisma.pelanggan.findMany();

    const sudahLunas = semuaPelanggan.filter((p) => p.lunas);
    const belumLunas = semuaPelanggan.filter((p) => !p.lunas);

    const totalUangMasuk = sudahLunas.reduce((acc, curr) => acc + curr.tagihan, 0);
    const sisaTertunggak = belumLunas.reduce((acc, curr) => acc + curr.tagihan, 0);

    res.json({
      status: 'sukses',
      ringkasan: {
        totalPelanggan: semuaPelanggan.length,
        jumlahSudahBayar: sudahLunas.length,
        jumlahBelumBayar: belumLunas.length
      },
      keuangan: {
        totalUangTerkumpul: `Rp ${totalUangMasuk.toLocaleString('id-ID')}`,
        sisaTagihanBelumMasuk: `Rp ${sisaTertunggak.toLocaleString('id-ID')}`
      }
    });
  } catch (error) {
    res.status(500).json({ status: 'error', pesan: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server Quennet dengan Database aktif di http://localhost:${PORT}`);
});