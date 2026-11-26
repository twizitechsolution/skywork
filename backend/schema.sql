-- Sky Work MySQL Production Database Schema
-- Compatible with MySQL 5.7+ / MySQL 8.0+ / MariaDB 10.3+

CREATE DATABASE IF NOT EXISTS `skywork` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `skywork`;

CREATE TABLE IF NOT EXISTS `users` (
  `id` INT NOT NULL PRIMARY KEY,
  `uid` VARCHAR(64) NOT NULL,
  `username` VARCHAR(128) DEFAULT NULL,
  `mobile` VARCHAR(32) NOT NULL,
  `password_hash` VARCHAR(255) NOT NULL,
  `pin` VARCHAR(32) DEFAULT NULL,
  `ref_code` VARCHAR(64) DEFAULT NULL,
  `parent_id` INT DEFAULT NULL,
  `inr_balance` DECIMAL(16,2) DEFAULT 0.00,
  `bcoin_balance` DECIMAL(16,2) DEFAULT 0.00,
  `usdt_balance` DECIMAL(16,4) DEFAULT 0.0000,
  `total_earnings` DECIMAL(16,2) DEFAULT 0.00,
  `today_profit` DECIMAL(16,2) DEFAULT 0.00,
  `yesterday_profit` DECIMAL(16,2) DEFAULT 0.00,
  `is_blocked` TINYINT(1) DEFAULT 0,
  `fcm_tokens` JSON DEFAULT NULL,
  `created_at` VARCHAR(64) DEFAULT NULL,
  `extra_json` JSON DEFAULT NULL,
  INDEX `idx_users_uid` (`uid`),
  INDEX `idx_users_mobile` (`mobile`),
  INDEX `idx_users_ref_code` (`ref_code`),
  INDEX `idx_users_parent_id` (`parent_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `orders` (
  `id` INT NOT NULL PRIMARY KEY,
  `order_id` VARCHAR(128) NOT NULL,
  `user_id` INT NOT NULL,
  `receiver_id` INT DEFAULT NULL,
  `asset_type` VARCHAR(32) DEFAULT 'INR',
  `amount` DECIMAL(16,4) DEFAULT 0.0000,
  `expected_income` DECIMAL(16,4) DEFAULT 0.0000,
  `quota` DECIMAL(16,4) DEFAULT 0.0000,
  `status` VARCHAR(64) DEFAULT 'Pending',
  `utr` VARCHAR(128) DEFAULT NULL,
  `proof_image` MEDIUMTEXT DEFAULT NULL,
  `created_at` VARCHAR(64) DEFAULT NULL,
  `extra_json` JSON DEFAULT NULL,
  INDEX `idx_orders_order_id` (`order_id`),
  INDEX `idx_orders_user_id` (`user_id`),
  INDEX `idx_orders_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `bank_accounts` (
  `id` INT NOT NULL PRIMARY KEY,
  `user_id` INT NOT NULL,
  `bank_name` VARCHAR(128) DEFAULT NULL,
  `account_holder` VARCHAR(128) DEFAULT NULL,
  `account_number` VARCHAR(64) DEFAULT NULL,
  `ifsc_code` VARCHAR(32) DEFAULT NULL,
  `status` VARCHAR(32) DEFAULT 'Active',
  `created_at` VARCHAR(64) DEFAULT NULL,
  `extra_json` JSON DEFAULT NULL,
  INDEX `idx_bank_user_id` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `transactions` (
  `id` INT NOT NULL PRIMARY KEY,
  `user_id` INT NOT NULL,
  `type` VARCHAR(64) DEFAULT NULL,
  `amount` DECIMAL(16,4) DEFAULT 0.0000,
  `balance_after` DECIMAL(16,4) DEFAULT 0.0000,
  `description` TEXT DEFAULT NULL,
  `created_at` VARCHAR(64) DEFAULT NULL,
  `extra_json` JSON DEFAULT NULL,
  INDEX `idx_txn_user_id` (`user_id`),
  INDEX `idx_txn_type` (`type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `user_tasks` (
  `id` INT NOT NULL PRIMARY KEY,
  `user_id` INT NOT NULL,
  `task_key` VARCHAR(64) NOT NULL,
  `completed` TINYINT(1) DEFAULT 0,
  `claimed` TINYINT(1) DEFAULT 0,
  `created_at` VARCHAR(64) DEFAULT NULL,
  INDEX `idx_tasks_user_key` (`user_id`, `task_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `messages` (
  `id` INT NOT NULL PRIMARY KEY,
  `title` VARCHAR(255) DEFAULT NULL,
  `content` TEXT DEFAULT NULL,
  `created_at` VARCHAR(64) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `withdrawals` (
  `id` INT NOT NULL PRIMARY KEY,
  `user_id` INT NOT NULL,
  `amount` DECIMAL(16,2) DEFAULT 0.00,
  `status` VARCHAR(64) DEFAULT 'Pending',
  `utr` VARCHAR(128) DEFAULT NULL,
  `created_at` VARCHAR(64) DEFAULT NULL,
  `extra_json` JSON DEFAULT NULL,
  INDEX `idx_withdrawals_user_id` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `disputes` (
  `id` INT NOT NULL PRIMARY KEY,
  `order_id` VARCHAR(128) DEFAULT NULL,
  `user_id` INT NOT NULL,
  `reason` TEXT DEFAULT NULL,
  `status` VARCHAR(64) DEFAULT 'Open',
  `created_at` VARCHAR(64) DEFAULT NULL,
  `extra_json` JSON DEFAULT NULL,
  INDEX `idx_disputes_user_id` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `products` (
  `id` INT NOT NULL PRIMARY KEY,
  `name` VARCHAR(128) DEFAULT NULL,
  `amount` DECIMAL(16,2) DEFAULT 0.00,
  `income` DECIMAL(16,2) DEFAULT 0.00,
  `quota` DECIMAL(16,2) DEFAULT 0.00,
  `color` VARCHAR(32) DEFAULT 'blue',
  `type` VARCHAR(32) DEFAULT 'Bank',
  `percent` VARCHAR(32) DEFAULT NULL,
  `created_at` VARCHAR(64) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `price_ranges` (
  `id` INT NOT NULL PRIMARY KEY,
  `label` VARCHAR(64) DEFAULT NULL,
  `min_val` DECIMAL(16,2) DEFAULT 0.00,
  `max_val` DECIMAL(16,2) DEFAULT 0.00,
  `created_at` VARCHAR(64) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `sliders` (
  `id` INT NOT NULL PRIMARY KEY,
  `image_data` MEDIUMTEXT DEFAULT NULL,
  `created_at` VARCHAR(64) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `settings` (
  `id` INT NOT NULL PRIMARY KEY DEFAULT 1,
  `level1_commission` DECIMAL(8,2) DEFAULT 5.00,
  `level2_commission` DECIMAL(8,2) DEFAULT 2.50,
  `level3_commission` DECIMAL(8,2) DEFAULT 2.00,
  `telegram_link` VARCHAR(255) DEFAULT 'https://t.me/SkyWork',
  `proof_channel_link` VARCHAR(255) DEFAULT 'https://t.me/skyworkxcwdrl',
  `payment_mode` VARCHAR(32) DEFAULT 'manual',
  `upi_ids` TEXT DEFAULT NULL,
  `winpey_api_key` VARCHAR(255) DEFAULT NULL,
  `winpey_api_secret` VARCHAR(255) DEFAULT NULL,
  `orders_repaired_v2` TINYINT(1) DEFAULT 1,
  `history_split_repaired` TINYINT(1) DEFAULT 1,
  `extra_json` JSON DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `admins` (
  `id` INT NOT NULL PRIMARY KEY DEFAULT 1,
  `username` VARCHAR(64) NOT NULL,
  `password` VARCHAR(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `id_trackers` (
  `table_name` VARCHAR(64) NOT NULL PRIMARY KEY,
  `last_id` INT NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
