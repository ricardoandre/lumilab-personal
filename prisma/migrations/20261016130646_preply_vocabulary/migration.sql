-- CreateTable
CREATE TABLE `preply_lesson` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `tutor_name` VARCHAR(100) NOT NULL,
    `lesson_date` DATE NOT NULL,
    `title` VARCHAR(200) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `preply_lesson_tutor_name_lesson_date_key`(`tutor_name`, `lesson_date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `preply_word` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `lesson_id` BIGINT NOT NULL,
    `hanzi` VARCHAR(255) NOT NULL,
    `pinyin` VARCHAR(500) NOT NULL,
    `meaning` VARCHAR(500) NULL,
    `position` INTEGER NOT NULL,

    UNIQUE INDEX `preply_word_lesson_id_hanzi_key`(`lesson_id`, `hanzi`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `preply_word` ADD CONSTRAINT `preply_word_lesson_id_fkey` FOREIGN KEY (`lesson_id`) REFERENCES `preply_lesson`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
