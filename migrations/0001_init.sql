-- Categories for expenses and other income
CREATE TABLE categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL DEFAULT 'expense' CHECK (type IN ('expense', 'income')),
  active INTEGER NOT NULL DEFAULT 1
);

-- Fixed / recurring costs. 'auto' items add a daily share to every day's report.
CREATE TABLE recurring_costs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id INTEGER NOT NULL REFERENCES categories(id),
  amount REAL NOT NULL,
  period TEXT NOT NULL CHECK (period IN ('daily', 'monthly', 'yearly')),
  mode TEXT NOT NULL DEFAULT 'auto' CHECK (mode IN ('auto', 'manual')),
  start_date TEXT NOT NULL,
  end_date TEXT,
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE daily_sales (
  date TEXT PRIMARY KEY,
  cash_amount REAL NOT NULL DEFAULT 0,
  card_amount REAL NOT NULL DEFAULT 0,
  note TEXT
);

CREATE TABLE expenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  category_id INTEGER NOT NULL REFERENCES categories(id),
  amount REAL NOT NULL,
  method TEXT NOT NULL DEFAULT 'cash' CHECK (method IN ('cash', 'card', 'bank')),
  note TEXT
);
CREATE INDEX idx_expenses_date ON expenses(date);

-- Customers (udhaar) and suppliers
CREATE TABLE parties (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('customer', 'supplier')),
  phone TEXT
);

-- Balance per party is computed from these entries, never stored
CREATE TABLE credit_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  party_id INTEGER NOT NULL REFERENCES parties(id),
  date TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('given', 'received', 'bought', 'paid')),
  amount REAL NOT NULL,
  note TEXT
);
CREATE INDEX idx_credit_entries_date ON credit_entries(date);

CREATE TABLE other_income (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  amount REAL NOT NULL,
  source TEXT,
  note TEXT
);
CREATE INDEX idx_other_income_date ON other_income(date);

-- Seed data from his current sheet
INSERT INTO categories (name) VALUES
  ('Salary'), ('Room Rent'), ('Staff Accommodation'), ('Food'), ('Visa'),
  ('Licence'), ('Current Bill'), ('Electricity & Other'), ('Owner'), ('Other');

INSERT INTO recurring_costs (category_id, amount, period, mode, start_date) VALUES
  ((SELECT id FROM categories WHERE name = 'Room Rent'), 18000, 'yearly', 'auto', '2026-01-01'),
  ((SELECT id FROM categories WHERE name = 'Salary'), 195, 'daily', 'auto', '2026-01-01'),
  ((SELECT id FROM categories WHERE name = 'Visa'), 50, 'daily', 'auto', '2026-01-01'),
  ((SELECT id FROM categories WHERE name = 'Owner'), 1500, 'monthly', 'auto', '2026-01-01'),
  ((SELECT id FROM categories WHERE name = 'Licence'), 60, 'daily', 'auto', '2026-01-01'),
  ((SELECT id FROM categories WHERE name = 'Electricity & Other'), 100, 'daily', 'auto', '2026-01-01');
