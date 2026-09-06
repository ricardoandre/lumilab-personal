-- CreateTable
CREATE TABLE `Account` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `provider_id` BIGINT NOT NULL,
    `kind` VARCHAR(191) NOT NULL,
    `currency` VARCHAR(191) NOT NULL,
    `openedAt` DATE NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Account_kind_isActive_sortOrder_idx`(`kind`, `isActive`, `sortOrder`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Security` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `symbol` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NULL,
    `exchange` VARCHAR(191) NULL,
    `currency` VARCHAR(191) NOT NULL DEFAULT 'USD',
    `assetType` VARCHAR(191) NULL,

    UNIQUE INDEX `Security_symbol_exchange_key`(`symbol`, `exchange`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `StatementImport` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `accountId` BIGINT NOT NULL,
    `fileName` VARCHAR(191) NOT NULL,
    `fileChecksum` VARCHAR(191) NOT NULL,
    `kind` VARCHAR(191) NOT NULL,
    `periodStart` DATE NULL,
    `periodEnd` DATE NULL,
    `rowsParsed` INTEGER NOT NULL DEFAULT 0,
    `rowsInserted` INTEGER NOT NULL DEFAULT 0,
    `rowsSkipped` INTEGER NOT NULL DEFAULT 0,
    `status` VARCHAR(191) NOT NULL DEFAULT 'pending',
    `error` TEXT NULL,
    `storageKey` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `StatementImport_accountId_periodStart_idx`(`accountId`, `periodStart`),
    UNIQUE INDEX `StatementImport_accountId_fileChecksum_key`(`accountId`, `fileChecksum`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Transaction` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `accountId` BIGINT NOT NULL,
    `importId` BIGINT NULL,
    `securityId` BIGINT NULL,
    `tradeDate` DATE NOT NULL,
    `settleDate` DATE NULL,
    `type` VARCHAR(191) NOT NULL,
    `quantity` DECIMAL(24, 8) NULL,
    `price` DECIMAL(24, 8) NULL,
    `grossAmount` DECIMAL(24, 4) NULL,
    `fee` DECIMAL(24, 4) NULL,
    `tax` DECIMAL(24, 4) NULL,
    `netAmount` DECIMAL(24, 4) NOT NULL,
    `currency` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `externalRef` VARCHAR(191) NULL,
    `dedupeKey` VARCHAR(191) NOT NULL,
    `rawRow` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Transaction_accountId_tradeDate_idx`(`accountId`, `tradeDate`),
    INDEX `Transaction_securityId_tradeDate_idx`(`securityId`, `tradeDate`),
    INDEX `Transaction_accountId_type_tradeDate_idx`(`accountId`, `type`, `tradeDate`),
    UNIQUE INDEX `Transaction_accountId_dedupeKey_key`(`accountId`, `dedupeKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Account` ADD CONSTRAINT `Account_provider_id_fkey` FOREIGN KEY (`provider_id`) REFERENCES `field_options`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StatementImport` ADD CONSTRAINT `StatementImport_accountId_fkey` FOREIGN KEY (`accountId`) REFERENCES `Account`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Transaction` ADD CONSTRAINT `Transaction_accountId_fkey` FOREIGN KEY (`accountId`) REFERENCES `Account`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Transaction` ADD CONSTRAINT `Transaction_importId_fkey` FOREIGN KEY (`importId`) REFERENCES `StatementImport`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Transaction` ADD CONSTRAINT `Transaction_securityId_fkey` FOREIGN KEY (`securityId`) REFERENCES `Security`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

