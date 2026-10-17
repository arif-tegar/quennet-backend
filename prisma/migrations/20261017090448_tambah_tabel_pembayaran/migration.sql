/*
  Warnings:

  - You are about to drop the column `lunas` on the `Pelanggan` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Pelanggan" DROP COLUMN "lunas";

-- CreateTable
CREATE TABLE "Pembayaran" (
    "id" SERIAL NOT NULL,
    "pelangganId" INTEGER NOT NULL,
    "bulan" INTEGER NOT NULL,
    "tahun" INTEGER NOT NULL,
    "nominalTagihan" INTEGER NOT NULL,
    "nominalDiterima" INTEGER NOT NULL,
    "kembalian" INTEGER NOT NULL,
    "status" "Status_Pembayaran" NOT NULL DEFAULT 'Lunas',
    "namaPenagih" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Pembayaran_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Pembayaran_pelangganId_bulan_tahun_key" ON "Pembayaran"("pelangganId", "bulan", "tahun");

-- AddForeignKey
ALTER TABLE "Pembayaran" ADD CONSTRAINT "Pembayaran_pelangganId_fkey" FOREIGN KEY ("pelangganId") REFERENCES "Pelanggan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
