-- Run as MySQL root (or an admin account) once:
-- mysql -u root -p < scripts/bootstrap-mysql.sql

CREATE DATABASE IF NOT EXISTS tdcp_attendance_db
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE USER IF NOT EXISTS 'tdcp_app'@'localhost' IDENTIFIED BY 'change_me_strong_password';
CREATE USER IF NOT EXISTS 'tdcp_app'@'%' IDENTIFIED BY 'change_me_strong_password';

GRANT ALL PRIVILEGES ON tdcp_attendance_db.* TO 'tdcp_app'@'localhost';
GRANT ALL PRIVILEGES ON tdcp_attendance_db.* TO 'tdcp_app'@'%';
FLUSH PRIVILEGES;
