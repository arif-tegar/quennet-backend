/*
  Warnings:

  - The `lunas` column on the `Pelanggan` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `role` column on the `User` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'PENAGIH');

-- CreateEnum
CREATE TYPE "Status_Pembayaran" AS ENUM ('Lunas', 'Belum_Lunas');

-- AlterTable
ALTER TABLE "Pelanggan" DROP COLUMN "lunas",
ADD COLUMN     "lunas" "Status_Pembayaran" NOT NULL DEFAULT 'Belum_Lunas';

-- AlterTable
ALTER TABLE "User" DROP COLUMN "role",
ADD COLUMN     "role" "Role" NOT NULL DEFAULT 'PENAGIH';

-- DropEnum
DROP TYPE "Staturs_Pembayaran";
