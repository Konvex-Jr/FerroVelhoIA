-- CreateTable
CREATE TABLE "Product" (
    "id" INTEGER NOT NULL,
    "code" VARCHAR(60),
    "name" VARCHAR(200),
    "unit" VARCHAR(10),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "totalBalance" DECIMAL(18,3),
    "totalReserved" DECIMAL(18,3),
    "lastTinyChange" TIMESTAMP(3),

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DepositStock" (
    "id" SERIAL NOT NULL,
    "productId" INTEGER NOT NULL,
    "deposit" VARCHAR(120) NOT NULL,
    "company" VARCHAR(120),
    "balance" DECIMAL(18,3),
    "reserved" DECIMAL(18,3),

    CONSTRAINT "DepositStock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncCursor" (
    "key" TEXT NOT NULL,
    "valueStr" TEXT,
    "valueDate" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SyncCursor_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "DepositStock_productId_deposit_key" ON "DepositStock"("productId", "deposit");

-- AddForeignKey
ALTER TABLE "DepositStock" ADD CONSTRAINT "DepositStock_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
