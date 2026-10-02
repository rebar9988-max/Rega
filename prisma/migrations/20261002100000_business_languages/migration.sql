-- AlterTable
ALTER TABLE "Business" ADD COLUMN     "languages" TEXT[] DEFAULT ARRAY[]::TEXT[];
