CREATE TYPE "DatePrecision" AS ENUM ('FULL', 'YEAR', 'NONE');
ALTER TABLE "Person" ADD COLUMN "publicDatePrecision" "DatePrecision" NOT NULL DEFAULT 'FULL';
ALTER TABLE "Person" ADD COLUMN "hidePhotosPublic" BOOLEAN NOT NULL DEFAULT false;
