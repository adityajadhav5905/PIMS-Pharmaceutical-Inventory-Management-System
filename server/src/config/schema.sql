-- PIMS MySQL Schema
-- Recreatable migration script: DROP + CREATE all tables

SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS support_tickets;
DROP TABLE IF EXISTS user_preferences;
DROP TABLE IF EXISTS otps;
DROP TABLE IF EXISTS predictions;
DROP TABLE IF EXISTS alerts;
DROP TABLE IF EXISTS transactions;
DROP TABLE IF EXISTS inventories;
DROP TABLE IF EXISTS medicines;
DROP TABLE IF EXISTS staff;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS pharmacies;

SET FOREIGN_KEY_CHECKS = 1;

-- ─── Pharmacies ──────────────────────────────────────────────────────────────
CREATE TABLE pharmacies (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  slug        VARCHAR(255) NOT NULL UNIQUE,
  name        VARCHAR(255) NOT NULL,
  address     VARCHAR(500) DEFAULT '',
  phone       VARCHAR(50)  DEFAULT '',
  email       VARCHAR(255) DEFAULT '',
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_pharmacies_slug (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── Users ───────────────────────────────────────────────────────────────────
CREATE TABLE users (
  id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  pharmacy_id  INT UNSIGNED NOT NULL,
  name         VARCHAR(255) NOT NULL,
  email        VARCHAR(255) NOT NULL UNIQUE,
  password     VARCHAR(255) NOT NULL,
  role         ENUM('Admin','Pharmacist') DEFAULT 'Pharmacist',
  is_active    TINYINT(1) DEFAULT 1,
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_users_pharmacy (pharmacy_id),
  INDEX idx_users_email (email),
  FOREIGN KEY (pharmacy_id) REFERENCES pharmacies(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── Staff ───────────────────────────────────────────────────────────────────
CREATE TABLE staff (
  id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  pharmacy_id  INT UNSIGNED NOT NULL,
  name         VARCHAR(255) NOT NULL,
  email        VARCHAR(255) DEFAULT '',
  position     VARCHAR(100) DEFAULT 'Pharmacist',
  department   VARCHAR(100) DEFAULT 'Dispensing',
  salary       DECIMAL(12,2) DEFAULT 0,
  join_date    DATE DEFAULT NULL,
  total_sales  DECIMAL(14,2) DEFAULT 0,
  status       ENUM('Active','Inactive') DEFAULT 'Active',
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_staff_pharmacy (pharmacy_id),
  FOREIGN KEY (pharmacy_id) REFERENCES pharmacies(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── Medicines ───────────────────────────────────────────────────────────────
CREATE TABLE medicines (
  id             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  pharmacy_id    INT UNSIGNED NOT NULL,
  sku            VARCHAR(100) NOT NULL,
  name           VARCHAR(255) NOT NULL,
  brand          VARCHAR(255) DEFAULT '',
  description    TEXT DEFAULT NULL,
  category       VARCHAR(100) DEFAULT '',
  supplier       VARCHAR(255) DEFAULT '',
  buying_price   DECIMAL(12,2) DEFAULT 0,
  selling_price  DECIMAL(12,2) DEFAULT 0,
  lead_time_days INT DEFAULT 7,
  is_active      TINYINT(1) DEFAULT 1,
  deleted_at     TIMESTAMP NULL DEFAULT NULL,
  created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_medicines_pharmacy (pharmacy_id),
  INDEX idx_medicines_name (name),
  INDEX idx_medicines_category (category),
  UNIQUE KEY uq_medicines_pharmacy_sku (pharmacy_id, sku),
  FOREIGN KEY (pharmacy_id) REFERENCES pharmacies(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── Inventories ─────────────────────────────────────────────────────────────
CREATE TABLE inventories (
  id             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  pharmacy_id    INT UNSIGNED NOT NULL,
  medicine_id    INT UNSIGNED NOT NULL,
  batch_number   VARCHAR(100) NOT NULL,
  current_stock  INT DEFAULT 0,
  reorder_level  INT DEFAULT 20,
  expiry_date    DATE NOT NULL,
  created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_inventories_pharmacy (pharmacy_id),
  INDEX idx_inventories_medicine (medicine_id),
  INDEX idx_inventories_expiry (expiry_date),
  INDEX idx_inventories_composite (pharmacy_id, medicine_id, batch_number),
  FOREIGN KEY (pharmacy_id) REFERENCES pharmacies(id) ON DELETE CASCADE,
  FOREIGN KEY (medicine_id) REFERENCES medicines(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── Transactions ────────────────────────────────────────────────────────────
CREATE TABLE transactions (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  pharmacy_id     INT UNSIGNED NOT NULL,
  medicine_id     INT UNSIGNED NOT NULL,
  inventory_id    INT UNSIGNED DEFAULT NULL,
  type            ENUM('IN','OUT') NOT NULL,
  quantity        INT NOT NULL,
  unit_buy_price  DECIMAL(12,2) DEFAULT 0,
  unit_sell_price DECIMAL(12,2) DEFAULT 0,
  total_cost      DECIMAL(14,2) DEFAULT 0,
  total_revenue   DECIMAL(14,2) DEFAULT 0,
  profit          DECIMAL(14,2) DEFAULT 0,
  employee_id     INT UNSIGNED DEFAULT NULL,
  note            TEXT DEFAULT NULL,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_transactions_pharmacy (pharmacy_id),
  INDEX idx_transactions_pharmacy_date (pharmacy_id, created_at),
  FOREIGN KEY (pharmacy_id) REFERENCES pharmacies(id) ON DELETE CASCADE,
  FOREIGN KEY (medicine_id) REFERENCES medicines(id) ON DELETE CASCADE,
  FOREIGN KEY (inventory_id) REFERENCES inventories(id) ON DELETE SET NULL,
  FOREIGN KEY (employee_id) REFERENCES staff(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── Alerts ──────────────────────────────────────────────────────────────────
CREATE TABLE alerts (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  pharmacy_id   INT UNSIGNED NOT NULL,
  inventory_id  INT UNSIGNED DEFAULT NULL,
  type          ENUM('LOW_STOCK','OVERSTOCK','EXPIRY_WARNING','EXPIRED') NOT NULL,
  message       TEXT NOT NULL,
  severity      ENUM('Low','Medium','High') DEFAULT 'Medium',
  is_resolved   TINYINT(1) DEFAULT 0,
  closed_at     TIMESTAMP NULL DEFAULT NULL,
  closed_by     INT UNSIGNED DEFAULT NULL,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_alerts_pharmacy (pharmacy_id),
  INDEX idx_alerts_inventory (inventory_id),
  INDEX idx_alerts_resolved (is_resolved),
  INDEX idx_alerts_composite (pharmacy_id, inventory_id, type, is_resolved),
  FOREIGN KEY (pharmacy_id) REFERENCES pharmacies(id) ON DELETE CASCADE,
  FOREIGN KEY (inventory_id) REFERENCES inventories(id) ON DELETE SET NULL,
  FOREIGN KEY (closed_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── Predictions ─────────────────────────────────────────────────────────────
CREATE TABLE predictions (
  id               INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  pharmacy_id      INT UNSIGNED NOT NULL,
  medicine_id      INT UNSIGNED NOT NULL,
  prediction_date  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  predicted_demand JSON NOT NULL,
  confidence       DECIMAL(5,4) DEFAULT 0.8000,
  source           VARCHAR(255) DEFAULT 'Deterministic Demand Forecast',
  created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_predictions_pharmacy_medicine (pharmacy_id, medicine_id),
  INDEX idx_predictions_pharmacy (pharmacy_id),
  INDEX idx_predictions_medicine (medicine_id),
  FOREIGN KEY (pharmacy_id) REFERENCES pharmacies(id) ON DELETE CASCADE,
  FOREIGN KEY (medicine_id) REFERENCES medicines(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── OTPs ────────────────────────────────────────────────────────────────────
CREATE TABLE otps (
  id               INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  email            VARCHAR(255) NOT NULL,
  hashed_otp       VARCHAR(255) NOT NULL,
  purpose          ENUM('PHARMACY_REGISTRATION','STAFF_CREATE','STAFF_UPDATE','STAFF_DELETE','CHANGE_NAME','CHANGE_PASSWORD','STAFF_MUTATION','SETTINGS_UPDATE') NOT NULL,
  user_id          INT UNSIGNED DEFAULT NULL,
  pharmacy_id      INT UNSIGNED DEFAULT NULL,
  target_entity_id VARCHAR(255) DEFAULT NULL,
  target_payload   JSON DEFAULT NULL,
  attempts         INT DEFAULT 0,
  max_attempts     INT DEFAULT 5,
  verified         TINYINT(1) DEFAULT 0,
  expires_at       TIMESTAMP NOT NULL,
  created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_otps_email (email),
  INDEX idx_otps_purpose (purpose),
  INDEX idx_otps_user (user_id),
  INDEX idx_otps_pharmacy (pharmacy_id),
  INDEX idx_otps_target (target_entity_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── User Preferences ───────────────────────────────────────────────────────
CREATE TABLE user_preferences (
  id                   INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id              INT UNSIGNED NOT NULL UNIQUE,
  email_notifications  TINYINT(1) DEFAULT 1,
  inventory_alerts     TINYINT(1) DEFAULT 1,
  weekly_reports       TINYINT(1) DEFAULT 0,
  created_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── Support Tickets ─────────────────────────────────────────────────────────
CREATE TABLE support_tickets (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  pharmacy_id   INT UNSIGNED NOT NULL,
  user_id       INT UNSIGNED NOT NULL,
  subject       VARCHAR(255) NOT NULL,
  message       TEXT NOT NULL,
  status        ENUM('open','closed') DEFAULT 'open',
  closed_at     TIMESTAMP NULL DEFAULT NULL,
  closed_by     INT UNSIGNED DEFAULT NULL,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_support_pharmacy (pharmacy_id),
  INDEX idx_support_user (user_id),
  INDEX idx_support_status (status),
  FOREIGN KEY (pharmacy_id) REFERENCES pharmacies(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (closed_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── MySQL Scheduled Event to purge expired OTP records ──────────────────────
DROP EVENT IF EXISTS purge_expired_otps;
CREATE EVENT IF NOT EXISTS purge_expired_otps
  ON SCHEDULE EVERY 5 MINUTE
  DO DELETE FROM otps WHERE expires_at < NOW();
