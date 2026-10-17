/*
  Warnings:

  - The `lunas` column on the `Pelanggan` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "Staturs_Pembayaran" AS ENUM ('Lunas', 'Belum_Lunas');

-- AlterTable
ALTER TABLE "Pelanggan" DROP COLUMN "lunas",
ADD COLUMN     "lunas" "Staturs_Pembayaran" NOT NULL DEFAULT 'Belum_Lunas';

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "nama" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'PENAGIH',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
