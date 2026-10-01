/**
 * MySQL Database Access Layer for PIMS.
 * Parameterized SQL queries via mysql2.
 * All functions use the shared connection pool.
 */
import { getPool } from "../config/db.js";

// ─── Generic helpers ─────────────────────────────────────────────────────────

/**
 * Execute a parameterized query and return rows.
 */
export const query = async (sql, params = []) => {
  const pool = getPool();
  const [rows] = await pool.execute(sql, params);
  return rows;
};

/**
 * Execute a parameterized query and return the result object (for INSERT/UPDATE/DELETE).
 */
export const execute = async (sql, params = []) => {
  const pool = getPool();
  const [result] = await pool.execute(sql, params);
  return result;
};

/**
 * Get a connection from the pool (for transactions).
 */
export const getConnection = async () => {
  const pool = getPool();
  return pool.getConnection();
};

// ─── Row formatter: converts snake_case DB rows to camelCase objects ──────────
const toCamel = (row) => {
  if (!row) return null;
  const out = {};
  for (const [key, value] of Object.entries(row)) {
    // Convert snake_case to camelCase
    const camelKey = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    out[camelKey] = value;
  }
  // Add _id alias for backward compatibility with frontend
  if (out.id !== undefined) {
    out._id = out.id;
  }
  return out;
};

/**
 * Convert an array of rows to camelCase.
 */
export const toCamelRows = (rows) => rows.map(toCamel);

/**
 * Convert a single row to camelCase.
 */
export const toCamelRow = toCamel;

/**
 * Helper to build dynamic SQL WHERE clauses from filter objects.
 */
export const buildWhere = (filter = {}) => {
  const conditions = [];
  const params = [];
  for (const [key, value] of Object.entries(filter)) {
    if (value === undefined) continue;
    if (key === "_id" || key === "id") {
      if (value && typeof value === "object" && value.$ne !== undefined) {
        conditions.push("id != ?");
        params.push(value.$ne);
      } else if (value && typeof value === "object" && value.$in !== undefined) {
        if (!value.$in.length) {
          conditions.push("1 = 0");
        } else {
          conditions.push(`id IN (${value.$in.map(() => "?").join(",")})`);
          params.push(...value.$in);
        }
      } else {
        conditions.push("id = ?");
        params.push(value);
      }
    } else if (value && typeof value === "object" && value.$ne !== undefined) {
      const col = key.replace(/([A-Z])/g, "_$1").toLowerCase();
      conditions.push(`${col} != ?`);
      params.push(value.$ne);
    } else if (value && typeof value === "object" && value.$in !== undefined) {
      const col = key.replace(/([A-Z])/g, "_$1").toLowerCase();
      if (!value.$in.length) {
        conditions.push("1 = 0");
      } else {
        conditions.push(`${col} IN (${value.$in.map(() => "?").join(",")})`);
        params.push(...value.$in);
      }
    } else if (value instanceof RegExp) {
      const col = key.replace(/([A-Z])/g, "_$1").toLowerCase();
      const pattern = value.source
        .replace(/\\\[/g, "[")
        .replace(/\\\]/g, "]")
        .replace(/\\\(/g, "(")
        .replace(/\\\)/g, ")")
        .replace(/\\/g, "")
        .replace(/^[\^]/, "")
        .replace(/[\$]$/, "")
        .trim();
      conditions.push(`${col} LIKE ?`);
      params.push(`%${pattern}%`);
    } else {
      const col = key.replace(/([A-Z])/g, "_$1").toLowerCase();
      conditions.push(`${col} = ?`);
      params.push(typeof value === "string" && (key === "email" || key === "slug") ? value.toLowerCase().trim() : value);
    }
  }
  return {
    where: conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "",
    params
  };
};

// ─── Pharmacy ────────────────────────────────────────────────────────────────
export const Pharmacy = {
  async findBySlug(slug) {
    const rows = await query("SELECT * FROM pharmacies WHERE slug = ?", [slug]);
    return toCamel(rows[0]);
  },
  async findById(id) {
    const rows = await query("SELECT * FROM pharmacies WHERE id = ?", [id]);
    return toCamel(rows[0]);
  },
  async findOne(filter) {
    if (!filter) return null;
    if (filter.slug) return this.findBySlug(filter.slug);
    if (filter._id || filter.id) return this.findById(filter._id || filter.id);
    return null;
  },
  async create({ slug, name, address, phone, email }) {
    const result = await execute(
      "INSERT INTO pharmacies (slug, name, address, phone, email) VALUES (?, ?, ?, ?, ?)",
      [slug, name, address || "", phone || "", email || ""]
    );
    return { id: result.insertId, _id: result.insertId, slug, name, address, phone, email };
  },
  async deleteById(id) {
    return execute("DELETE FROM pharmacies WHERE id = ?", [id]);
  },
  async deleteBySlug(slug) {
    return execute("DELETE FROM pharmacies WHERE slug = ?", [slug]);
  },
  async deleteOne(filter) {
    if (!filter) return null;
    if (filter._id || filter.id) return this.deleteById(filter._id || filter.id);
    if (filter.slug) return this.deleteBySlug(filter.slug);
    return null;
  },
  async deleteMany(filter) {
    if (!filter || Object.keys(filter).length === 0) return execute("DELETE FROM pharmacies");
    if (filter.slug) return this.deleteBySlug(filter.slug);
    if (filter._id || filter.id) return this.deleteById(filter._id || filter.id);
    return null;
  }
};

// ─── User ────────────────────────────────────────────────────────────────────
export const User = {
  async findById(id) {
    const rows = await query("SELECT * FROM users WHERE id = ?", [id]);
    return toCamel(rows[0]);
  },
  async findByEmail(email) {
    const rows = await query("SELECT * FROM users WHERE email = ?", [email.toLowerCase().trim()]);
    return toCamel(rows[0]);
  },
  async findOne(filter) {
    if (!filter || Object.keys(filter).length === 0) return null;
    if (filter._id || filter.id) return this.findById(filter._id || filter.id);
    const { where, params } = buildWhere(filter);
    const rows = await query(`SELECT * FROM users ${where} LIMIT 1`, params);
    return toCamel(rows[0]);
  },
  async find(filter) {
    if (!filter || Object.keys(filter).length === 0) {
      const rows = await query("SELECT * FROM users");
      return toCamelRows(rows);
    }
    const { where, params } = buildWhere(filter);
    const rows = await query(`SELECT * FROM users ${where}`, params);
    return toCamelRows(rows);
  },
  async findActiveByEmail(email) {
    const rows = await query(
      "SELECT u.*, p.slug as pharmacy_slug, p.name as pharmacy_name FROM users u JOIN pharmacies p ON u.pharmacy_id = p.id WHERE u.email = ? AND u.is_active = 1",
      [email.toLowerCase().trim()]
    );
    return toCamelRows(rows);
  },
  async findByIdWithPharmacy(id) {
    const rows = await query(
      "SELECT u.*, p.slug as pharmacy_slug, p.name as pharmacy_name FROM users u JOIN pharmacies p ON u.pharmacy_id = p.id WHERE u.id = ?",
      [id]
    );
    return toCamel(rows[0]);
  },
  async findByEmailAndPharmacy(email, pharmacyId) {
    const rows = await query(
      "SELECT * FROM users WHERE email = ? AND pharmacy_id = ?",
      [email.toLowerCase().trim(), pharmacyId]
    );
    return toCamel(rows[0]);
  },
  async findByEmailExcluding(email, excludeId) {
    const rows = await query(
      "SELECT * FROM users WHERE email = ? AND id != ?",
      [email.toLowerCase().trim(), excludeId]
    );
    return toCamel(rows[0]);
  },
  async findByEmailNotInPharmacy(email, pharmacyId) {
    const rows = await query(
      "SELECT * FROM users WHERE email = ? AND pharmacy_id != ?",
      [email.toLowerCase().trim(), pharmacyId]
    );
    return toCamel(rows[0]);
  },
  async create({ pharmacyId, name, email, password, role }) {
    const result = await execute(
      "INSERT INTO users (pharmacy_id, name, email, password, role) VALUES (?, ?, ?, ?, ?)",
      [pharmacyId, name, email.toLowerCase().trim(), password, role || "Pharmacist"]
    );
    return { id: result.insertId, _id: result.insertId, pharmacyId, name, email: email.toLowerCase().trim(), role: role || "Pharmacist" };
  },
  async updateById(id, fields) {
    const sets = [];
    const params = [];
    for (const [key, value] of Object.entries(fields)) {
      const col = key.replace(/([A-Z])/g, "_$1").toLowerCase();
      sets.push(`${col} = ?`);
      params.push(value);
    }
    if (sets.length === 0) return;
    params.push(id);
    return execute(`UPDATE users SET ${sets.join(", ")} WHERE id = ?`, params);
  },
  async deleteByEmailAndPharmacy(email, pharmacyId) {
    return execute("DELETE FROM users WHERE email = ? AND pharmacy_id = ?", [email.toLowerCase().trim(), pharmacyId]);
  },
  async deleteByPharmacy(pharmacyId) {
    return execute("DELETE FROM users WHERE pharmacy_id = ?", [pharmacyId]);
  },
  async deleteByEmails(emails) {
    if (!emails.length) return;
    const placeholders = emails.map(() => "?").join(",");
    return execute(`DELETE FROM users WHERE email IN (${placeholders})`, emails);
  },
  async deleteMany(filter) {
    if (!filter || Object.keys(filter).length === 0) return execute("DELETE FROM users");
    if (filter.pharmacyId) return this.deleteByPharmacy(filter.pharmacyId);
    if (filter.email?.$in) return this.deleteByEmails(filter.email.$in);
    if (Array.isArray(filter.email)) return this.deleteByEmails(filter.email);
    if (typeof filter.email === "string") return this.deleteByEmails([filter.email]);
    return null;
  },
  async updateStaffSync(pharmacyId, email, updates) {
    const sets = [];
    const params = [];
    for (const [key, value] of Object.entries(updates)) {
      const col = key.replace(/([A-Z])/g, "_$1").toLowerCase();
      sets.push(`${col} = ?`);
      params.push(value);
    }
    if (sets.length === 0) return;
    params.push(pharmacyId, email.toLowerCase().trim());
    return execute(`UPDATE users SET ${sets.join(", ")} WHERE pharmacy_id = ? AND email = ?`, params);
  }
};

// ─── Staff ───────────────────────────────────────────────────────────────────
export const Staff = {
  async findById(id) {
    const rows = await query("SELECT * FROM staff WHERE id = ?", [id]);
    return toCamel(rows[0]);
  },
  async findOne(filter) {
    if (!filter || Object.keys(filter).length === 0) return null;
    const { where, params } = buildWhere(filter);
    const rows = await query(`SELECT * FROM staff ${where} LIMIT 1`, params);
    return toCamel(rows[0]);
  },
  async find(filter) {
    if (!filter || Object.keys(filter).length === 0) {
      const rows = await query("SELECT * FROM staff ORDER BY created_at DESC");
      return toCamelRows(rows);
    }
    const { where, params } = buildWhere(filter);
    const rows = await query(`SELECT * FROM staff ${where} ORDER BY created_at DESC`, params);
    return toCamelRows(rows);
  },
  async findByIdAndPharmacy(id, pharmacyId) {
    const rows = await query("SELECT * FROM staff WHERE id = ? AND pharmacy_id = ?", [id, pharmacyId]);
    return toCamel(rows[0]);
  },
  async findByPharmacy(pharmacyId) {
    const rows = await query("SELECT * FROM staff WHERE pharmacy_id = ? ORDER BY created_at DESC", [pharmacyId]);
    return toCamelRows(rows);
  },
  async findActiveByPharmacy(pharmacyId) {
    const rows = await query("SELECT * FROM staff WHERE pharmacy_id = ? AND status = 'Active'", [pharmacyId]);
    return toCamelRows(rows);
  },
  async findByEmailAndPharmacy(email, pharmacyId) {
    const rows = await query("SELECT * FROM staff WHERE email = ? AND pharmacy_id = ?", [email.toLowerCase().trim(), pharmacyId]);
    return toCamel(rows[0]);
  },
  async create({ pharmacyId, name, email, position, department, salary, joinDate, totalSales, status }) {
    const result = await execute(
      "INSERT INTO staff (pharmacy_id, name, email, position, department, salary, join_date, total_sales, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [pharmacyId, name, (email || "").toLowerCase().trim(), position || "Pharmacist", department || "Dispensing", salary || 0, joinDate || new Date(), totalSales || 0, status || "Active"]
    );
    return { id: result.insertId, _id: result.insertId, pharmacyId, name, email: (email || "").toLowerCase().trim(), position: position || "Pharmacist", department: department || "Dispensing", salary: salary || 0, joinDate, totalSales: totalSales || 0, status: status || "Active" };
  },
  async updateById(id, fields) {
    const sets = [];
    const params = [];
    for (const [key, value] of Object.entries(fields)) {
      const col = key.replace(/([A-Z])/g, "_$1").toLowerCase();
      sets.push(`${col} = ?`);
      params.push(value);
    }
    if (sets.length === 0) return;
    params.push(id);
    return execute(`UPDATE staff SET ${sets.join(", ")} WHERE id = ?`, params);
  },
  async incrementTotalSales(id, amount) {
    return execute("UPDATE staff SET total_sales = total_sales + ? WHERE id = ?", [amount, id]);
  },
  async deleteByIdAndPharmacy(id, pharmacyId) {
    return execute("DELETE FROM staff WHERE id = ? AND pharmacy_id = ?", [id, pharmacyId]);
  },
  async deleteByPharmacy(pharmacyId) {
    return execute("DELETE FROM staff WHERE pharmacy_id = ?", [pharmacyId]);
  },
  async deleteByEmails(emails) {
    if (!emails.length) return;
    const placeholders = emails.map(() => "?").join(",");
    return execute(`DELETE FROM staff WHERE email IN (${placeholders})`, emails);
  },
  async deleteMany(filter) {
    if (!filter || Object.keys(filter).length === 0) return execute("DELETE FROM staff");
    if (filter.pharmacyId) return this.deleteByPharmacy(filter.pharmacyId);
    if (filter.email?.$in) return this.deleteByEmails(filter.email.$in);
    if (Array.isArray(filter.email)) return this.deleteByEmails(filter.email);
    if (typeof filter.email === "string") return this.deleteByEmails([filter.email]);
    return null;
  }
};

// ─── Medicine ────────────────────────────────────────────────────────────────
export const Medicine = {
  async findById(id) {
    const rows = await query("SELECT * FROM medicines WHERE id = ?", [id]);
    return toCamel(rows[0]);
  },
  async findOne(filter) {
    if (!filter || Object.keys(filter).length === 0) return null;
    if (filter._id || filter.id) return this.findById(filter._id || filter.id);
    const { where, params } = buildWhere(filter);
    const rows = await query(`SELECT * FROM medicines ${where} LIMIT 1`, params);
    return toCamel(rows[0]);
  },
  async find(filter) {
    if (!filter || Object.keys(filter).length === 0) {
      const rows = await query("SELECT * FROM medicines ORDER BY name ASC");
      return toCamelRows(rows);
    }
    const { where, params } = buildWhere(filter);
    const rows = await query(`SELECT * FROM medicines ${where} ORDER BY name ASC`, params);
    return toCamelRows(rows);
  },
  async findByIdAndPharmacy(id, pharmacyId) {
    const rows = await query("SELECT * FROM medicines WHERE id = ? AND pharmacy_id = ?", [id, pharmacyId]);
    return toCamel(rows[0]);
  },
  async findActiveByPharmacy(pharmacyId) {
    const rows = await query("SELECT * FROM medicines WHERE pharmacy_id = ? AND is_active = 1 ORDER BY name ASC", [pharmacyId]);
    return toCamelRows(rows);
  },
  async findBySkuAndPharmacy(sku, pharmacyId) {
    const rows = await query("SELECT * FROM medicines WHERE sku = ? AND pharmacy_id = ?", [sku, pharmacyId]);
    return toCamel(rows[0]);
  },
  async findByNameAndPharmacy(name, pharmacyId) {
    const rows = await query("SELECT * FROM medicines WHERE LOWER(name) = LOWER(?) AND pharmacy_id = ?", [name, pharmacyId]);
    return toCamel(rows[0]);
  },
  async searchByPharmacy(pharmacyId, searchTerm) {
    const like = `%${searchTerm}%`;
    const rows = await query(
      "SELECT id FROM medicines WHERE pharmacy_id = ? AND (name LIKE ? OR brand LIKE ? OR category LIKE ?)",
      [pharmacyId, like, like, like]
    );
    return rows.map(r => r.id);
  },
  async create({ pharmacyId, name, sku, brand, description, category, supplier, buyingPrice, sellingPrice, leadTimeDays, isActive }) {
    const result = await execute(
      `INSERT INTO medicines (pharmacy_id, name, sku, brand, description, category, supplier, buying_price, selling_price, lead_time_days, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [pharmacyId, name, sku, brand || "", description || "", category || "", supplier || "", buyingPrice || 0, sellingPrice || 0, leadTimeDays || 7, isActive !== undefined ? (isActive ? 1 : 0) : 1]
    );
    return { id: result.insertId, _id: result.insertId, pharmacyId, name, sku, brand: brand || "", description: description || "", category: category || "", supplier: supplier || "", buyingPrice: buyingPrice || 0, sellingPrice: sellingPrice || 0, leadTimeDays: leadTimeDays || 7, isActive: isActive !== false };
  },
  async updateById(id, fields) {
    const sets = [];
    const params = [];
    for (const [key, value] of Object.entries(fields)) {
      const col = key.replace(/([A-Z])/g, "_$1").toLowerCase();
      sets.push(`${col} = ?`);
      params.push(value);
    }
    if (sets.length === 0) return;
    params.push(id);
    return execute(`UPDATE medicines SET ${sets.join(", ")} WHERE id = ?`, params);
  },
  async deleteByIdAndPharmacy(id, pharmacyId) {
    return execute("DELETE FROM medicines WHERE id = ? AND pharmacy_id = ?", [id, pharmacyId]);
  },
  async deleteByPharmacy(pharmacyId) {
    return execute("DELETE FROM medicines WHERE pharmacy_id = ?", [pharmacyId]);
  },
  async deleteMany(filter) {
    if (!filter || Object.keys(filter).length === 0) return execute("DELETE FROM medicines");
    if (filter.pharmacyId) return this.deleteByPharmacy(filter.pharmacyId);
    return null;
  }
};

// ─── Inventory ───────────────────────────────────────────────────────────────
export const Inventory = {
  async findById(id) {
    const rows = await query("SELECT * FROM inventories WHERE id = ?", [id]);
    return toCamel(rows[0]);
  },
  async findByIdAndPharmacy(id, pharmacyId) {
    const rows = await query("SELECT * FROM inventories WHERE id = ? AND pharmacy_id = ?", [id, pharmacyId]);
    return toCamel(rows[0]);
  },
  async findByIdWithMedicine(id, pharmacyId) {
    const rows = await query(
      `SELECT i.*, m.name as med_name, m.brand as med_brand, m.category as med_category,
              m.description as med_description, m.buying_price as med_buying_price, m.selling_price as med_selling_price, m.sku as med_sku
       FROM inventories i JOIN medicines m ON i.medicine_id = m.id
       WHERE i.id = ? AND i.pharmacy_id = ?`,
      [id, pharmacyId]
    );
    return rows[0] ? formatBatchWithMedicine(rows[0]) : null;
  },
  async findByPharmacyPaginated(pharmacyId, { page, limit, search, medIds, batchSearch }) {
    let countSql = "SELECT COUNT(*) as total FROM inventories i WHERE i.pharmacy_id = ?";
    let dataSql = `SELECT i.*, m.name as med_name, m.brand as med_brand, m.category as med_category,
                   m.description as med_description, m.buying_price as med_buying_price, m.selling_price as med_selling_price
                   FROM inventories i JOIN medicines m ON i.medicine_id = m.id WHERE i.pharmacy_id = ?`;
    const countParams = [pharmacyId];
    const dataParams = [pharmacyId];

    if (medIds && medIds.length > 0 && batchSearch) {
      const placeholders = medIds.map(() => "?").join(",");
      const extra = ` AND (i.medicine_id IN (${placeholders}) OR i.batch_number LIKE ?)`;
      countSql += extra;
      dataSql += extra;
      countParams.push(...medIds, `%${batchSearch}%`);
      dataParams.push(...medIds, `%${batchSearch}%`);
    } else if (medIds && medIds.length > 0) {
      const placeholders = medIds.map(() => "?").join(",");
      const extra = ` AND i.medicine_id IN (${placeholders})`;
      countSql += extra;
      dataSql += extra;
      countParams.push(...medIds);
      dataParams.push(...medIds);
    }

    dataSql += " ORDER BY i.created_at DESC LIMIT ? OFFSET ?";
    dataParams.push(limit, (page - 1) * limit);

    const [countRows] = await getPool().execute(countSql, countParams);
    const total = countRows[0].total;
    const [dataRows] = await getPool().execute(dataSql, dataParams);

    return { total, rows: dataRows.map(formatBatchWithMedicine) };
  },
  async findAvailableStock(pharmacyId) {
    const rows = await query(
      `SELECT i.*, m.name as med_name, m.brand as med_brand, m.selling_price as med_selling_price
       FROM inventories i JOIN medicines m ON i.medicine_id = m.id
       WHERE i.pharmacy_id = ? AND i.current_stock > 0 AND i.expiry_date >= CURDATE()
       ORDER BY i.expiry_date ASC`,
      [pharmacyId]
    );
    return rows.map(r => ({
      id: r.id, _id: r.id,
      batchNumber: r.batch_number,
      currentStock: r.current_stock,
      expiryDate: r.expiry_date,
      medicine: { id: r.medicine_id, _id: r.medicine_id, name: r.med_name, brand: r.med_brand, sellingPrice: r.med_selling_price }
    }));
  },
  async findAllWithMedicine(pharmacyId) {
    const rows = await query(
      `SELECT i.*, m.name as med_name, m.brand as med_brand, m.category as med_category,
              m.description as med_description, m.buying_price as med_buying_price, m.selling_price as med_selling_price
       FROM inventories i JOIN medicines m ON i.medicine_id = m.id
       WHERE i.pharmacy_id = ? ORDER BY i.created_at DESC`,
      [pharmacyId]
    );
    return rows.map(formatBatchWithMedicine);
  },
  async findByMedicineAndPharmacy(medicineId, pharmacyId) {
    const rows = await query("SELECT * FROM inventories WHERE medicine_id = ? AND pharmacy_id = ?", [medicineId, pharmacyId]);
    return toCamelRows(rows);
  },
  async countByMedicineAndPharmacy(medicineId, pharmacyId) {
    const rows = await query("SELECT COUNT(*) as cnt FROM inventories WHERE medicine_id = ? AND pharmacy_id = ?", [medicineId, pharmacyId]);
    return rows[0].cnt;
  },
  async create({ pharmacyId, medicineId, batchNumber, currentStock, reorderLevel, expiryDate }) {
    const result = await execute(
      "INSERT INTO inventories (pharmacy_id, medicine_id, batch_number, current_stock, reorder_level, expiry_date) VALUES (?, ?, ?, ?, ?, ?)",
      [pharmacyId, medicineId, batchNumber, currentStock || 0, reorderLevel || 20, expiryDate]
    );
    return { id: result.insertId, _id: result.insertId, pharmacyId, medicineId, batchNumber, currentStock: currentStock || 0, reorderLevel: reorderLevel || 20, expiryDate };
  },
  async updateById(id, fields) {
    const sets = [];
    const params = [];
    for (const [key, value] of Object.entries(fields)) {
      const col = key.replace(/([A-Z])/g, "_$1").toLowerCase();
      sets.push(`${col} = ?`);
      params.push(value);
    }
    if (sets.length === 0) return;
    params.push(id);
    return execute(`UPDATE inventories SET ${sets.join(", ")} WHERE id = ?`, params);
  },
  /**
   * Atomic stock decrement with row locking. Returns the updated row or null if insufficient stock.
   * Uses SELECT FOR UPDATE + UPDATE inside a transaction for concurrency safety.
   */
  async atomicDecrement(id, pharmacyId, qty) {
    const conn = await getConnection();
    try {
      await conn.beginTransaction();

      // Lock the row
      const [rows] = await conn.execute(
        "SELECT * FROM inventories WHERE id = ? AND pharmacy_id = ? FOR UPDATE",
        [id, pharmacyId]
      );
      if (!rows[0] || rows[0].current_stock < qty) {
        await conn.rollback();
        return null;
      }

      const newStock = rows[0].current_stock - qty;
      await conn.execute(
        "UPDATE inventories SET current_stock = ? WHERE id = ?",
        [newStock, id]
      );

      await conn.commit();
      return { ...toCamel(rows[0]), currentStock: newStock };
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  },
  /**
   * Atomic stock increment.
   */
  async atomicIncrement(id, pharmacyId, qty) {
    const conn = await getConnection();
    try {
      await conn.beginTransaction();
      const [rows] = await conn.execute(
        "SELECT * FROM inventories WHERE id = ? AND pharmacy_id = ? FOR UPDATE",
        [id, pharmacyId]
      );
      if (!rows[0]) {
        await conn.rollback();
        return null;
      }
      const newStock = rows[0].current_stock + qty;
      await conn.execute("UPDATE inventories SET current_stock = ? WHERE id = ?", [newStock, id]);
      await conn.commit();
      return { ...toCamel(rows[0]), currentStock: newStock };
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  },
  async findOne(filter) {
    if (!filter || Object.keys(filter).length === 0) return null;
    if (filter._id || filter.id) return this.findById(filter._id || filter.id);
    const { where, params } = buildWhere(filter);
    const rows = await query(`SELECT * FROM inventories ${where} LIMIT 1`, params);
    return toCamel(rows[0]);
  },
  async find(filter) {
    if (!filter || Object.keys(filter).length === 0) {
      const rows = await query("SELECT * FROM inventories");
      return toCamelRows(rows);
    }
    const { where, params } = buildWhere(filter);
    const rows = await query(`SELECT * FROM inventories ${where}`, params);
    return toCamelRows(rows);
  },
  async deleteByIdAndPharmacy(id, pharmacyId) {
    return execute("DELETE FROM inventories WHERE id = ? AND pharmacy_id = ?", [id, pharmacyId]);
  },
  async deleteByPharmacy(pharmacyId) {
    return execute("DELETE FROM inventories WHERE pharmacy_id = ?", [pharmacyId]);
  },
  async deleteMany(filter) {
    if (!filter || Object.keys(filter).length === 0) return execute("DELETE FROM inventories");
    if (filter.pharmacyId) return this.deleteByPharmacy(filter.pharmacyId);
    return null;
  },
  // Dashboard queries
  async countExpired(pharmacyId) {
    const rows = await query("SELECT COUNT(*) as cnt FROM inventories WHERE pharmacy_id = ? AND expiry_date < CURDATE()", [pharmacyId]);
    return rows[0].cnt;
  },
  async countExpiringSoon(pharmacyId, days = 10) {
    const rows = await query(
      "SELECT COUNT(*) as cnt FROM inventories WHERE pharmacy_id = ? AND expiry_date >= CURDATE() AND expiry_date <= DATE_ADD(CURDATE(), INTERVAL ? DAY)",
      [pharmacyId, days]
    );
    return rows[0].cnt;
  },
  async countLowStock(pharmacyId) {
    const rows = await query(
      "SELECT COUNT(*) as cnt FROM inventories WHERE pharmacy_id = ? AND current_stock > 0 AND current_stock <= reorder_level",
      [pharmacyId]
    );
    return rows[0].cnt;
  },
  async findExpiredWithMedicine(pharmacyId, limit = 10) {
    const rows = await query(
      `SELECT i.*, m.name as med_name, m.brand as med_brand, m.buying_price as med_buying_price, m.selling_price as med_selling_price
       FROM inventories i JOIN medicines m ON i.medicine_id = m.id
       WHERE i.pharmacy_id = ? AND i.expiry_date < CURDATE()
       ORDER BY i.expiry_date ASC LIMIT ?`,
      [pharmacyId, limit]
    );
    return rows.map(formatBatchWithMedicine);
  },
  async findExpiringSoonWithMedicine(pharmacyId, days = 10, limit = 10) {
    const rows = await query(
      `SELECT i.*, m.name as med_name, m.brand as med_brand, m.buying_price as med_buying_price, m.selling_price as med_selling_price
       FROM inventories i JOIN medicines m ON i.medicine_id = m.id
       WHERE i.pharmacy_id = ? AND i.expiry_date >= CURDATE() AND i.expiry_date <= DATE_ADD(CURDATE(), INTERVAL ? DAY)
       ORDER BY i.expiry_date ASC LIMIT ?`,
      [pharmacyId, days, limit]
    );
    return rows.map(formatBatchWithMedicine);
  },
  async findLowStockWithMedicine(pharmacyId, limit = 10) {
    const rows = await query(
      `SELECT i.*, m.name as med_name, m.brand as med_brand, m.buying_price as med_buying_price, m.selling_price as med_selling_price
       FROM inventories i JOIN medicines m ON i.medicine_id = m.id
       WHERE i.pharmacy_id = ? AND i.current_stock > 0 AND i.current_stock <= i.reorder_level
       ORDER BY i.current_stock ASC LIMIT ?`,
      [pharmacyId, limit]
    );
    return rows.map(formatBatchWithMedicine);
  },
  async findByIdWithPharmacy(id) {
    const rows = await query(
      `SELECT i.*, m.name as med_name, m.brand as med_brand, p.slug as pharmacy_slug, p.id as pharm_id
       FROM inventories i
       JOIN medicines m ON i.medicine_id = m.id
       JOIN pharmacies p ON i.pharmacy_id = p.id
       WHERE i.id = ?`,
      [id]
    );
    if (!rows[0]) return null;
    const r = rows[0];
    return {
      id: r.id, _id: r.id,
      pharmacyId: { _id: r.pharmacy_id, id: r.pharmacy_id, slug: r.pharmacy_slug },
      medicineId: { _id: r.medicine_id, id: r.medicine_id, name: r.med_name, brand: r.med_brand },
      batchNumber: r.batch_number,
      currentStock: r.current_stock,
      reorderLevel: r.reorder_level,
      expiryDate: r.expiry_date
    };
  },
  async findAllIds() {
    const rows = await query("SELECT id FROM inventories");
    return rows.map(r => r.id);
  },
  // Financials: stock value
  async getStockValue(pharmacyId) {
    const rows = await query(
      `SELECT COALESCE(SUM(i.current_stock * m.buying_price), 0) as total_value
       FROM inventories i JOIN medicines m ON i.medicine_id = m.id
       WHERE i.pharmacy_id = ? AND i.current_stock > 0`,
      [pharmacyId]
    );
    return Number(rows[0].total_value) || 0;
  }
};

function formatBatchWithMedicine(r) {
  return {
    id: r.id, _id: r.id,
    batchNumber: r.batch_number,
    currentStock: r.current_stock,
    reorderLevel: r.reorder_level,
    expiryDate: r.expiry_date,
    createdAt: r.created_at,
    medicine: r.med_name ? {
      id: r.medicine_id, _id: r.medicine_id,
      name: r.med_name,
      brand: r.med_brand || "",
      category: r.med_category || "",
      description: r.med_description || "",
      buyingPrice: Number(r.med_buying_price) || 0,
      sellingPrice: Number(r.med_selling_price) || 0
    } : null,
    // Also expose for dashboard formatBatch
    medicineName: r.med_name || "Unknown",
    medicineId: r.medicine_id,
    buyingPrice: Number(r.med_buying_price) || 0,
    sellingPrice: Number(r.med_selling_price) || 0
  };
}

// ─── Transaction ─────────────────────────────────────────────────────────────
export const Transaction = {
  async findById(id) {
    const rows = await query("SELECT * FROM transactions WHERE id = ?", [id]);
    return toCamel(rows[0]);
  },
  async findOne(filter) {
    if (!filter || Object.keys(filter).length === 0) return null;
    if (filter._id || filter.id) return this.findById(filter._id || filter.id);
    const { where, params } = buildWhere(filter);
    const rows = await query(`SELECT * FROM transactions ${where} ORDER BY created_at DESC LIMIT 1`, params);
    return toCamel(rows[0]);
  },
  async find(filter) {
    if (!filter || Object.keys(filter).length === 0) {
      const rows = await query("SELECT * FROM transactions ORDER BY created_at DESC");
      return toCamelRows(rows);
    }
    const { where, params } = buildWhere(filter);
    const rows = await query(`SELECT * FROM transactions ${where} ORDER BY created_at DESC`, params);
    return toCamelRows(rows);
  },
  async findByIdAndPharmacy(id, pharmacyId) {
    const rows = await query("SELECT * FROM transactions WHERE id = ? AND pharmacy_id = ?", [id, pharmacyId]);
    return toCamel(rows[0]);
  },
  async findByPharmacyPaginated(pharmacyId, { page, limit }) {
    const countRows = await query("SELECT COUNT(*) as total FROM transactions WHERE pharmacy_id = ?", [pharmacyId]);
    const total = countRows[0].total;

    const rows = await query(
      `SELECT t.*, m.name as med_name, m.brand as med_brand, s.name as emp_name
       FROM transactions t
       LEFT JOIN medicines m ON t.medicine_id = m.id
       LEFT JOIN staff s ON t.employee_id = s.id
       WHERE t.pharmacy_id = ?
       ORDER BY t.created_at DESC LIMIT ? OFFSET ?`,
      [pharmacyId, limit, (page - 1) * limit]
    );
    return { total, rows: rows.map(formatTransactionRow) };
  },
  async findByPharmacy(pharmacyId) {
    const rows = await query(
      `SELECT t.*, m.name as med_name, m.brand as med_brand
       FROM transactions t
       LEFT JOIN medicines m ON t.medicine_id = m.id
       WHERE t.pharmacy_id = ?
       ORDER BY t.created_at DESC`,
      [pharmacyId]
    );
    return rows;
  },
  async findOutByPharmacy(pharmacyId) {
    const rows = await query(
      `SELECT t.*, m.name as med_name
       FROM transactions t
       LEFT JOIN medicines m ON t.medicine_id = m.id
       WHERE t.pharmacy_id = ? AND t.type = 'OUT'
       ORDER BY t.created_at DESC LIMIT 10`,
      [pharmacyId]
    );
    return rows;
  },
  async findByInventory(inventoryId, type) {
    const rows = await query("SELECT * FROM transactions WHERE inventory_id = ? AND type = ?", [inventoryId, type]);
    return toCamelRows(rows);
  },
  async findByMedicineAndPharmacy(medicineId, pharmacyId, type) {
    let sql = "SELECT * FROM transactions WHERE pharmacy_id = ? AND medicine_id = ?";
    const params = [pharmacyId, medicineId];
    if (type) {
      sql += " AND type = ?";
      params.push(type);
    }
    sql += " ORDER BY created_at ASC";
    const rows = await query(sql, params);
    return toCamelRows(rows);
  },
  async create({ pharmacyId, medicineId, inventoryId, type, quantity, unitBuyPrice, unitSellPrice, totalCost, totalRevenue, profit, employeeId, note, createdAt }) {
    const result = await execute(
      `INSERT INTO transactions (pharmacy_id, medicine_id, inventory_id, type, quantity, unit_buy_price, unit_sell_price, total_cost, total_revenue, profit, employee_id, note${createdAt ? ", created_at" : ""})
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?${createdAt ? ", ?" : ""})`,
      [pharmacyId, medicineId, inventoryId || null, type, quantity, unitBuyPrice || 0, unitSellPrice || 0, totalCost || 0, totalRevenue || 0, profit || 0, employeeId || null, note || "", ...(createdAt ? [createdAt] : [])]
    );
    return { id: result.insertId, _id: result.insertId, pharmacyId, medicineId, inventoryId, type, quantity, unitBuyPrice: unitBuyPrice || 0, unitSellPrice: unitSellPrice || 0, totalCost: totalCost || 0, totalRevenue: totalRevenue || 0, profit: profit || 0, employeeId, note: note || "" };
  },
  async updateById(id, fields) {
    const sets = [];
    const params = [];
    for (const [key, value] of Object.entries(fields)) {
      const col = key.replace(/([A-Z])/g, "_$1").toLowerCase();
      sets.push(`${col} = ?`);
      params.push(value);
    }
    if (sets.length === 0) return;
    params.push(id);
    return execute(`UPDATE transactions SET ${sets.join(", ")} WHERE id = ?`, params);
  },
  async deleteByIdAndPharmacy(id, pharmacyId) {
    return execute("DELETE FROM transactions WHERE id = ? AND pharmacy_id = ?", [id, pharmacyId]);
  },
  async deleteByPharmacy(pharmacyId) {
    return execute("DELETE FROM transactions WHERE pharmacy_id = ?", [pharmacyId]);
  },
  async deleteMany(filter) {
    if (!filter || Object.keys(filter).length === 0) return execute("DELETE FROM transactions");
    if (filter.pharmacyId) return this.deleteByPharmacy(filter.pharmacyId);
    return null;
  },
  // Aggregation replacements
  async aggregateByType(pharmacyId) {
    const rows = await query(
      `SELECT type,
              COALESCE(SUM(total_revenue), 0) as total_revenue,
              COALESCE(SUM(total_cost), 0) as total_cost,
              COALESCE(SUM(profit), 0) as total_profit,
              COUNT(*) as cnt
       FROM transactions WHERE pharmacy_id = ? GROUP BY type`,
      [pharmacyId]
    );
    return rows;
  },
  async aggregateMonthOutSales(pharmacyId, since) {
    const rows = await query(
      `SELECT COALESCE(SUM(total_revenue), 0) as month_revenue,
              COALESCE(SUM(profit), 0) as month_profit,
              COUNT(*) as month_sales_count
       FROM transactions WHERE pharmacy_id = ? AND type = 'OUT' AND created_at >= ?`,
      [pharmacyId, since]
    );
    return rows[0];
  },
  async aggregateMonthlyTrends(pharmacyId, since) {
    const rows = await query(
      `SELECT YEAR(created_at) as yr, MONTH(created_at) as mo,
              COALESCE(SUM(total_revenue), 0) as revenue,
              COALESCE(SUM(profit), 0) as profit
       FROM transactions
       WHERE pharmacy_id = ? AND type = 'OUT' AND created_at >= ?
       GROUP BY yr, mo ORDER BY yr ASC, mo ASC`,
      [pharmacyId, since]
    );
    return rows;
  },
  async aggregateMonthProfit(pharmacyId, since) {
    const rows = await query(
      `SELECT COALESCE(SUM(profit), 0) as profit
       FROM transactions WHERE pharmacy_id = ? AND type = 'OUT' AND created_at >= ?`,
      [pharmacyId, since]
    );
    return Number(rows[0].profit) || 0;
  },
  async aggregateStaffSales(pharmacyId) {
    const rows = await query(
      `SELECT employee_id,
              COALESCE(SUM(total_revenue), 0) as total_sales,
              COUNT(*) as transaction_count,
              COALESCE(SUM(profit), 0) as total_profit
       FROM transactions
       WHERE pharmacy_id = ? AND type = 'OUT' AND employee_id IS NOT NULL
       GROUP BY employee_id`,
      [pharmacyId]
    );
    return rows;
  },
  async aggregateEmployeePerformance(pharmacyId) {
    return this.aggregateStaffSales(pharmacyId);
  }
};

function formatTransactionRow(r) {
  return {
    id: r.id, _id: r.id,
    type: r.type,
    quantity: r.quantity,
    unitBuyPrice: Number(r.unit_buy_price),
    unitSellPrice: Number(r.unit_sell_price),
    totalCost: Number(r.total_cost),
    totalRevenue: Number(r.total_revenue),
    profit: Number(r.profit),
    note: r.note || "",
    createdAt: r.created_at,
    medicine: r.med_name ? { _id: r.medicine_id, name: r.med_name, brand: r.med_brand || "" } : null,
    employee: r.emp_name ? { _id: r.employee_id, name: r.emp_name } : null
  };
}

// ─── Alert ───────────────────────────────────────────────────────────────────
export const Alert = {
  async findById(id) {
    const rows = await query("SELECT * FROM alerts WHERE id = ?", [id]);
    return toCamel(rows[0]);
  },
  async findOne(filter) {
    if (!filter || Object.keys(filter).length === 0) return null;
    if (filter._id || filter.id) return this.findById(filter._id || filter.id);
    const { where, params } = buildWhere(filter);
    const rows = await query(`SELECT * FROM alerts ${where} ORDER BY created_at DESC LIMIT 1`, params);
    return toCamel(rows[0]);
  },
  async find(filter) {
    if (!filter || Object.keys(filter).length === 0) {
      const rows = await query("SELECT * FROM alerts ORDER BY created_at DESC");
      return toCamelRows(rows);
    }
    const { where, params } = buildWhere(filter);
    const rows = await query(`SELECT * FROM alerts ${where} ORDER BY created_at DESC`, params);
    return toCamelRows(rows);
  },
  async findByIdAndPharmacy(id, pharmacyId) {
    const rows = await query("SELECT * FROM alerts WHERE id = ? AND pharmacy_id = ?", [id, pharmacyId]);
    return toCamel(rows[0]);
  },
  async findByIdAndPharmacyWithInventory(id, pharmacyId) {
    const rows = await query(
      `SELECT a.*, i.batch_number as inv_batch, i.current_stock as inv_stock, i.reorder_level as inv_reorder
       FROM alerts a LEFT JOIN inventories i ON a.inventory_id = i.id
       WHERE a.id = ? AND a.pharmacy_id = ?`,
      [id, pharmacyId]
    );
    return rows[0] ? formatAlertRow(rows[0]) : null;
  },
  async findByPharmacyPaginated(pharmacyId, { page, limit, status, type }) {
    let countSql = "SELECT COUNT(*) as total FROM alerts WHERE pharmacy_id = ?";
    let dataSql = `SELECT a.*, i.batch_number as inv_batch, i.current_stock as inv_stock, i.reorder_level as inv_reorder,
                   u.name as closer_name, u.email as closer_email
                   FROM alerts a
                   LEFT JOIN inventories i ON a.inventory_id = i.id
                   LEFT JOIN users u ON a.closed_by = u.id
                   WHERE a.pharmacy_id = ?`;
    const countParams = [pharmacyId];
    const dataParams = [pharmacyId];

    if (status === "resolved") {
      countSql += " AND is_resolved = 1";
      dataSql += " AND a.is_resolved = 1";
    } else if (status === "active" || status === "unresolved") {
      countSql += " AND is_resolved = 0";
      dataSql += " AND a.is_resolved = 0";
    }

    if (type) {
      countSql += " AND type = ?";
      dataSql += " AND a.type = ?";
      countParams.push(type);
      dataParams.push(type);
    }

    dataSql += " ORDER BY a.created_at DESC LIMIT ? OFFSET ?";
    dataParams.push(limit, (page - 1) * limit);

    const cRows = await query(countSql, countParams);
    const total = cRows[0].total;
    const dRows = await query(dataSql, dataParams);

    return { total, rows: dRows.map(formatAlertRow) };
  },
  async create({ pharmacyId, inventoryId, type, message, severity, isResolved }) {
    const result = await execute(
      "INSERT INTO alerts (pharmacy_id, inventory_id, type, message, severity, is_resolved) VALUES (?, ?, ?, ?, ?, ?)",
      [pharmacyId, inventoryId || null, type || "LOW_STOCK", message, severity || "Medium", isResolved ? 1 : 0]
    );
    return { id: result.insertId, _id: result.insertId, pharmacyId, inventoryId, type: type || "LOW_STOCK", message, severity: severity || "Medium", isResolved: isResolved || false };
  },
  async updateById(id, fields) {
    const sets = [];
    const params = [];
    for (const [key, value] of Object.entries(fields)) {
      const col = key.replace(/([A-Z])/g, "_$1").toLowerCase();
      sets.push(`${col} = ?`);
      params.push(value);
    }
    if (sets.length === 0) return;
    params.push(id);
    return execute(`UPDATE alerts SET ${sets.join(", ")} WHERE id = ?`, params);
  },
  async findUnresolvedByBatchAndType(pharmacyId, inventoryId, type) {
    const rows = await query(
      "SELECT * FROM alerts WHERE pharmacy_id = ? AND inventory_id = ? AND type = ? AND is_resolved = 0",
      [pharmacyId, inventoryId, type]
    );
    return toCamel(rows[0]);
  },
  async resolveByBatchAndType(pharmacyId, inventoryId, type) {
    return execute(
      "UPDATE alerts SET is_resolved = 1, closed_at = NOW() WHERE pharmacy_id = ? AND inventory_id = ? AND type = ? AND is_resolved = 0",
      [pharmacyId, inventoryId, type]
    );
  },
  async findUnresolvedByMessage(pharmacyId, type, messagePattern) {
    const rows = await query(
      "SELECT * FROM alerts WHERE pharmacy_id = ? AND type = ? AND is_resolved = 0 AND message LIKE ?",
      [pharmacyId, type, `%${messagePattern}%`]
    );
    return toCamel(rows[0]);
  },
  async deleteByPharmacy(pharmacyId) {
    return execute("DELETE FROM alerts WHERE pharmacy_id = ?", [pharmacyId]);
  },
  async deleteMany(filter) {
    if (!filter || Object.keys(filter).length === 0) return execute("DELETE FROM alerts");
    if (filter.pharmacyId) return this.deleteByPharmacy(filter.pharmacyId);
    return null;
  }
};

function formatAlertRow(r) {
  return {
    id: r.id, _id: r.id,
    type: r.type,
    message: r.message,
    severity: r.severity,
    isResolved: !!r.is_resolved,
    closedAt: r.closed_at,
    createdAt: r.created_at,
    inventory: r.inv_batch ? {
      id: r.inventory_id, _id: r.inventory_id,
      batchNumber: r.inv_batch,
      currentStock: r.inv_stock,
      reorderLevel: r.inv_reorder
    } : null,
    closedBy: r.closer_name ? {
      id: r.closed_by, _id: r.closed_by,
      name: r.closer_name,
      email: r.closer_email
    } : null
  };
}

// ─── Prediction ──────────────────────────────────────────────────────────────
export const Prediction = {
  async findById(id) {
    const rows = await query("SELECT * FROM predictions WHERE id = ?", [id]);
    return toCamel(rows[0]);
  },
  async findOne(filter) {
    if (!filter || Object.keys(filter).length === 0) return null;
    if (filter._id || filter.id) return this.findById(filter._id || filter.id);
    const { where, params } = buildWhere(filter);
    const rows = await query(`SELECT * FROM predictions ${where} ORDER BY updated_at DESC LIMIT 1`, params);
    return toCamel(rows[0]);
  },
  async find(filter) {
    if (!filter || Object.keys(filter).length === 0) {
      const rows = await query("SELECT * FROM predictions ORDER BY updated_at DESC");
      return toCamelRows(rows);
    }
    const { where, params } = buildWhere(filter);
    const rows = await query(`SELECT * FROM predictions ${where} ORDER BY updated_at DESC`, params);
    return toCamelRows(rows);
  },
  async upsert(pharmacyId, medicineId, { predictedDemand, confidence, source, predictionDate }) {
    // Try update first
    const existing = await query(
      "SELECT id FROM predictions WHERE pharmacy_id = ? AND medicine_id = ?",
      [pharmacyId, medicineId]
    );
    if (existing.length > 0) {
      await execute(
        "UPDATE predictions SET predicted_demand = ?, confidence = ?, source = ?, prediction_date = ? WHERE pharmacy_id = ? AND medicine_id = ?",
        [JSON.stringify(predictedDemand), confidence, source, predictionDate || new Date(), pharmacyId, medicineId]
      );
      return { id: existing[0].id, _id: existing[0].id };
    } else {
      const result = await execute(
        "INSERT INTO predictions (pharmacy_id, medicine_id, predicted_demand, confidence, source, prediction_date) VALUES (?, ?, ?, ?, ?, ?)",
        [pharmacyId, medicineId, JSON.stringify(predictedDemand), confidence, source, predictionDate || new Date()]
      );
      return { id: result.insertId, _id: result.insertId };
    }
  },
  async findByPharmacyPaginated(pharmacyId, { page, limit, medicineId }) {
    let countSql = "SELECT COUNT(*) as total FROM predictions WHERE pharmacy_id = ?";
    let dataSql = `SELECT p.*, m.name as med_name, m.sku as med_sku
                   FROM predictions p LEFT JOIN medicines m ON p.medicine_id = m.id
                   WHERE p.pharmacy_id = ?`;
    const countParams = [pharmacyId];
    const dataParams = [pharmacyId];

    if (medicineId) {
      countSql += " AND medicine_id = ?";
      dataSql += " AND p.medicine_id = ?";
      countParams.push(medicineId);
      dataParams.push(medicineId);
    }

    dataSql += " ORDER BY p.updated_at DESC LIMIT ? OFFSET ?";
    dataParams.push(limit, (page - 1) * limit);

    const cRows = await query(countSql, countParams);
    const total = cRows[0].total;
    const dRows = await query(dataSql, dataParams);

    return {
      total,
      rows: dRows.map(r => ({
        id: r.id, _id: r.id,
        medicineId: r.medicine_id,
        medicineName: r.med_name || "Unknown",
        medicineSku: r.med_sku || "",
        predictionDate: r.prediction_date,
        predictedDemand: typeof r.predicted_demand === "string" ? JSON.parse(r.predicted_demand) : r.predicted_demand,
        confidence: Number(r.confidence),
        source: r.source,
        createdAt: r.created_at
      }))
    };
  },
  async deleteByPharmacy(pharmacyId) {
    return execute("DELETE FROM predictions WHERE pharmacy_id = ?", [pharmacyId]);
  },
  async deleteMany(filter) {
    if (!filter || Object.keys(filter).length === 0) return execute("DELETE FROM predictions");
    if (filter.pharmacyId) return this.deleteByPharmacy(filter.pharmacyId);
    return null;
  }
};

// ─── OTP ─────────────────────────────────────────────────────────────────────
export const Otp = {
  async create({ email, hashedOtp, purpose, userId, pharmacyId, targetEntityId, targetPayload, attempts, maxAttempts, expiresAt, verified }) {
    const result = await execute(
      `INSERT INTO otps (email, hashed_otp, purpose, user_id, pharmacy_id, target_entity_id, target_payload, attempts, max_attempts, expires_at, verified)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [email, hashedOtp, purpose, userId || null, pharmacyId || null, targetEntityId || null, targetPayload ? JSON.stringify(targetPayload) : null, attempts || 0, maxAttempts || 5, expiresAt, verified ? 1 : 0]
    );
    return { id: result.insertId, _id: result.insertId };
  },
  async findOne(filter) {
    if (!filter) return null;
    return this.findLatest(filter.email, filter.purpose, filter.targetEntityId);
  },
  async findLatest(email, purpose, targetEntityId) {
    let sql = "SELECT * FROM otps WHERE email = ? AND purpose = ?";
    const params = [email, purpose];
    if (targetEntityId) {
      sql += " AND target_entity_id = ?";
      params.push(String(targetEntityId));
    }
    sql += " ORDER BY created_at DESC LIMIT 1";
    const rows = await query(sql, params);
    if (!rows[0]) return null;
    const r = rows[0];
    return {
      id: r.id, _id: r.id,
      email: r.email,
      hashedOtp: r.hashed_otp,
      purpose: r.purpose,
      userId: r.user_id,
      pharmacyId: r.pharmacy_id,
      targetEntityId: r.target_entity_id,
      targetPayload: r.target_payload ? (typeof r.target_payload === "string" ? JSON.parse(r.target_payload) : r.target_payload) : null,
      attempts: r.attempts,
      maxAttempts: r.max_attempts,
      verified: !!r.verified,
      expiresAt: r.expires_at,
      createdAt: r.created_at
    };
  },
  async deleteByEmailAndPurpose(email, purpose, targetEntityId) {
    let sql = "DELETE FROM otps WHERE email = ? AND purpose = ?";
    const params = [email, purpose];
    if (targetEntityId) {
      sql += " AND target_entity_id = ?";
      params.push(String(targetEntityId));
    }
    return execute(sql, params);
  },
  async deleteById(id) {
    return execute("DELETE FROM otps WHERE id = ?", [id]);
  },
  async updateById(id, fields) {
    const sets = [];
    const params = [];
    for (const [key, value] of Object.entries(fields)) {
      const col = key.replace(/([A-Z])/g, "_$1").toLowerCase();
      sets.push(`${col} = ?`);
      params.push(value);
    }
    if (sets.length === 0) return;
    params.push(id);
    return execute(`UPDATE otps SET ${sets.join(", ")} WHERE id = ?`, params);
  },
  async deleteAll() {
    return execute("DELETE FROM otps");
  },
  async deleteMany(filter) {
    if (!filter || Object.keys(filter).length === 0) return this.deleteAll();
    if (filter.email && filter.purpose) return this.deleteByEmailAndPurpose(filter.email, filter.purpose, filter.targetEntityId);
    return this.deleteAll();
  }
};

// ─── UserPreference ──────────────────────────────────────────────────────────
export const UserPreference = {
  async findOne(filter) {
    if (!filter) return null;
    if (filter.userId) return this.findByUserId(filter.userId);
    const { where, params } = buildWhere(filter);
    const rows = await query(`SELECT * FROM user_preferences ${where} LIMIT 1`, params);
    if (!rows[0]) return null;
    return {
      emailNotifications: !!rows[0].email_notifications,
      inventoryAlerts: !!rows[0].inventory_alerts,
      weeklyReports: !!rows[0].weekly_reports
    };
  },
  async findOneAndUpdate(filter, update, options = {}) {
    const userId = filter.userId || filter.user_id;
    if (!userId) return null;
    return this.upsert(userId, update);
  },
  async findByUserId(userId) {
    const rows = await query("SELECT * FROM user_preferences WHERE user_id = ?", [userId]);
    if (!rows[0]) return null;
    return {
      emailNotifications: !!rows[0].email_notifications,
      inventoryAlerts: !!rows[0].inventory_alerts,
      weeklyReports: !!rows[0].weekly_reports
    };
  },
  async upsert(userId, { emailNotifications, inventoryAlerts, weeklyReports }) {
    const existing = await query("SELECT id FROM user_preferences WHERE user_id = ?", [userId]);
    if (existing.length > 0) {
      await execute(
        "UPDATE user_preferences SET email_notifications = ?, inventory_alerts = ?, weekly_reports = ? WHERE user_id = ?",
        [emailNotifications ? 1 : 0, inventoryAlerts ? 1 : 0, weeklyReports ? 1 : 0, userId]
      );
    } else {
      await execute(
        "INSERT INTO user_preferences (user_id, email_notifications, inventory_alerts, weekly_reports) VALUES (?, ?, ?, ?)",
        [userId, emailNotifications ? 1 : 0, inventoryAlerts ? 1 : 0, weeklyReports ? 1 : 0]
      );
    }
    return { emailNotifications: !!emailNotifications, inventoryAlerts: !!inventoryAlerts, weeklyReports: !!weeklyReports };
  },
  async deleteByPharmacy(pharmacyId) {
    return execute("DELETE FROM user_preferences WHERE user_id IN (SELECT id FROM users WHERE pharmacy_id = ?)", [pharmacyId]);
  },
  async deleteMany(filter) {
    if (!filter || Object.keys(filter).length === 0) return execute("DELETE FROM user_preferences");
    if (filter.pharmacyId) return this.deleteByPharmacy(filter.pharmacyId);
    return null;
  }
};

// ─── SupportTicket ───────────────────────────────────────────────────────────
export const SupportTicket = {
  async create({ pharmacyId, userId, subject, message, status }) {
    const result = await execute(
      "INSERT INTO support_tickets (pharmacy_id, user_id, subject, message, status) VALUES (?, ?, ?, ?, ?)",
      [pharmacyId, userId, subject, message, status || "open"]
    );
    const rows = await query("SELECT * FROM support_tickets WHERE id = ?", [result.insertId]);
    return toCamel(rows[0]);
  },
  async findById(id) {
    const rows = await query("SELECT * FROM support_tickets WHERE id = ?", [id]);
    return toCamel(rows[0]);
  },
  async findOne(filter) {
    if (!filter || Object.keys(filter).length === 0) return null;
    if (filter._id || filter.id) return this.findById(filter._id || filter.id);
    const { where, params } = buildWhere(filter);
    const rows = await query(`SELECT * FROM support_tickets ${where} ORDER BY created_at DESC LIMIT 1`, params);
    return toCamel(rows[0]);
  },
  async find(filter) {
    if (!filter || Object.keys(filter).length === 0) {
      const rows = await query("SELECT * FROM support_tickets ORDER BY created_at DESC");
      return toCamelRows(rows);
    }
    const { where, params } = buildWhere(filter);
    const rows = await query(`SELECT * FROM support_tickets ${where} ORDER BY created_at DESC`, params);
    return toCamelRows(rows);
  },
  async findByIdAndPharmacy(id, pharmacyId) {
    const rows = await query(
      `SELECT t.*, u.name as user_name, u.email as user_email
       FROM support_tickets t LEFT JOIN users u ON t.user_id = u.id
       WHERE t.id = ? AND t.pharmacy_id = ?`,
      [id, pharmacyId]
    );
    return rows[0] ? formatTicketRow(rows[0]) : null;
  },
  async findByPharmacy(pharmacyId, { status, search }) {
    let sql = `SELECT t.*, u.name as user_name, u.email as user_email
               FROM support_tickets t LEFT JOIN users u ON t.user_id = u.id
               WHERE t.pharmacy_id = ?`;
    const params = [pharmacyId];

    if (status && ["open", "closed"].includes(status)) {
      sql += " AND t.status = ?";
      params.push(status);
    }

    if (search && search.trim()) {
      sql += " AND (t.subject LIKE ? OR t.message LIKE ? OR u.name LIKE ? OR u.email LIKE ?)";
      const like = `%${search.trim()}%`;
      params.push(like, like, like, like);
    }

    sql += " ORDER BY t.created_at DESC LIMIT 200";

    const rows = await query(sql, params);
    return rows.map(formatTicketRow);
  },
  async updateById(id, fields) {
    const sets = [];
    const params = [];
    for (const [key, value] of Object.entries(fields)) {
      const col = key.replace(/([A-Z])/g, "_$1").toLowerCase();
      sets.push(`${col} = ?`);
      params.push(value);
    }
    if (sets.length === 0) return;
    params.push(id);
    return execute(`UPDATE support_tickets SET ${sets.join(", ")} WHERE id = ?`, params);
  },
  async deleteByPharmacy(pharmacyId) {
    return execute("DELETE FROM support_tickets WHERE pharmacy_id = ?", [pharmacyId]);
  },
  async deleteMany(filter) {
    if (!filter || Object.keys(filter).length === 0) return execute("DELETE FROM support_tickets");
    if (filter.pharmacyId) return this.deleteByPharmacy(filter.pharmacyId);
    return null;
  }
};

function formatTicketRow(r) {
  return {
    id: r.id, _id: r.id,
    subject: r.subject,
    message: r.message,
    status: r.status,
    createdAt: r.created_at,
    closedAt: r.closed_at,
    user_name: r.user_name || "",
    user_email: r.user_email || ""
  };
}
