-- CreateTable
CREATE TABLE "Pelanggan" (
    "id" SERIAL NOT NULL,
    "nama" TEXT NOT NULL,
    "kecamatan" TEXT NOT NULL DEFAULT 'Kepanjen',
    "desa" TEXT NOT NULL,
    "rt" TEXT NOT NULL,
    "tagihan" INTEGER NOT NULL,
    "lunas" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Pelanggan_pkey" PRIMARY KEY ("id")
);
