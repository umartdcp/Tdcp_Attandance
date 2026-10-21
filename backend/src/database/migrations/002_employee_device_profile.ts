import { Pool } from 'mysql2/promise';
import { logger } from '../../utils/logger';

export const name = '002_employee_device_profile';

export async function up(pool: Pool): Promise<void> {
  await pool.query(
    `ALTER TABLE employees
      ADD COLUMN gender ENUM('male','female','other') NULL AFTER phone,
      ADD COLUMN device_user_id VARCHAR(64) NULL AFTER gender,
      ADD COLUMN shift_start TIME NULL AFTER device_user_id,
      ADD COLUMN shift_end TIME NULL AFTER shift_start,
      ADD COLUMN finger_status ENUM('not_captured','captured','failed') NOT NULL DEFAULT 'not_captured' AFTER shift_end`
  );
  await pool.query(
    `ALTER TABLE resorts
      ADD COLUMN latitude DECIMAL(10,7) NULL AFTER address,
      ADD COLUMN longitude DECIMAL(10,7) NULL AFTER latitude`
  );
  logger.info('Employee device profile columns added');
}

export async function down(pool: Pool): Promise<void> {
  await pool.query(
    `ALTER TABLE employees
      DROP COLUMN finger_status,
      DROP COLUMN shift_end,
      DROP COLUMN shift_start,
      DROP COLUMN device_user_id,
      DROP COLUMN gender`
  );
  await pool.query(
    `ALTER TABLE resorts
      DROP COLUMN longitude,
      DROP COLUMN latitude`
  );
}
