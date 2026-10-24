-- Where contributors to a family fund send money: the family's own M-Pesa.
ALTER TABLE "ChamaFund" ADD COLUMN "payKind" TEXT,
ADD COLUMN "payNumber" TEXT,
ADD COLUMN "payAccount" TEXT,
ADD COLUMN "payName" TEXT;
