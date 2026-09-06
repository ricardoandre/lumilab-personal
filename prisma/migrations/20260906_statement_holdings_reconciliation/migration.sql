-- AlterTable
ALTER TABLE `Account` ADD COLUMN `external_account_no` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `StatementImport` ADD COLUMN `addition_total` DECIMAL(24, 4) NULL,
    ADD COLUMN `beginning_balance` DECIMAL(24, 4) NULL,
    ADD COLUMN `ending_balance` DECIMAL(24, 4) NULL,
    ADD COLUMN `fee_total` DECIMAL(24, 4) NULL,
    ADD COLUMN `reconcile_note` TEXT NULL,
    ADD COLUMN `reconciled` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `subtraction_total` DECIMAL(24, 4) NULL,
    ADD COLUMN `trade_total` DECIMAL(24, 4) NULL;

-- CreateTable
CREATE TABLE `statement_holding` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `import_id` BIGINT NOT NULL,
    `security_id` BIGINT NOT NULL,
    `asOf` DATE NOT NULL,
    `quantity` DECIMAL(24, 8) NOT NULL,
    `market_price` DECIMAL(24, 8) NULL,
    `market_value` DECIMAL(24, 4) NULL,
    `cost_price` DECIMAL(24, 8) NULL,
    `unrealized` DECIMAL(24, 4) NULL,
    `cost_basis` DECIMAL(24, 4) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `statement_holding_security_id_asOf_idx`(`security_id`, `asOf`),
    UNIQUE INDEX `statement_holding_import_id_security_id_key`(`import_id`, `security_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `Account_provider_id_external_account_no_key` ON `Account`(`provider_id`, `external_account_no`);

-- AddForeignKey
ALTER TABLE `statement_holding` ADD CONSTRAINT `statement_holding_import_id_fkey` FOREIGN KEY (`import_id`) REFERENCES `StatementImport`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `statement_holding` ADD CONSTRAINT `statement_holding_security_id_fkey` FOREIGN KEY (`security_id`) REFERENCES `Security`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

