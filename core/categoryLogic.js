/**
 * =============================================================================
 * core/categoryLogic.js
 * =============================================================================
 * 
 * RESPONSIBILITY:
 * Business logic for managing spending category mappings
 * - Save spending name → category mapping to dbcatandTag
 * - Retrieve saved mappings
 * - Pure data operations (validation done by caller)
 * 
 * DATABASE:
 * Uses dbcatandTag (miniSheetDB2 instance from core/dbInit.js)
 * Table: "🐈‍⬛ Cat and Tag"
 * Structure: [spending_name, category, ...]
 * 
 * DO NOT:
 * - Validate inputs (caller responsibility)
 * - Access spreadsheet directly (use dbcatandTag abstraction)
 * - Create new databases
 * 
 * =============================================================================
 */

/**
 * Save a spending name → category mapping
 * Stores to dbcatandTag for later auto-categorization
 * 
 /**
 * Save or update spending → category mapping
 *
 * @param {string} spendingName - User-friendly spending name (e.g., "Nasi uduk")
 * @param {string} category - Category to assign (e.g., "Food and Drink")
 * @return {Object} {success: boolean, message?: string}
 */
function saveSpendingCategory(spendingName, category) {
    try {
        if (!spendingName || !category) {
            return {
                success: false,
                message: "Nama pengeluaran dan kategori diperlukan"
            };
        }

        const sheet = dbcatandTag.sheet;

        // Cari apakah spending_name sudah ada
        const existing = dbcatandTag.search({
            col_name: 'spending_name',
            value: spendingName,
        });

        const timestamp = Utilities.formatDate(
            new Date(),
            "GMT+7",
            "yyyy-MM-dd HH:mm:ss"
        );

        if (existing && existing.length > 0) {
            // ===== UPDATE EXISTING =====
            const row = existing[0].row;

            Logger.log(`📝 Updating category: ${spendingName} @ row ${row}`);

            sheet.getRange(row, 2, 1, 3).setValues([[
                spendingName,
                category,
                timestamp
            ]]);

            SpreadsheetApp.flush();

            return {
                success: true,
                message: "✅ Kategori berhasil diperbarui"
            };
        }

        // ===== INSERT NEW =====
        Logger.log(`➕ Adding new category mapping: ${spendingName}`);

        dbcatandTag.add({
            spending_name: spendingName,
            category: category,
            date_added: timestamp
        });

        SpreadsheetApp.flush();

        return {
            success: true,
            message: "✅ Kategori berhasil disimpan"
        };

    } catch (error) {
        Logger.log(`❌ Error in saveSpendingCategory: ${error.message}`);
        return {
            success: false,
            message: `❌ Gagal menyimpan kategori: ${error.message}`
        };
    }
}


/**
 * Retrieve category for a spending name (if exists)
 * Used for auto-categorization in future spending entries
 * 
 * @param {string} spendingName - Spending name to lookup
 * @return {string|null} - Category if found, null otherwise
 */
function getSpendingCategory(spendingName) {
    try {
        const result = dbcatandTag.search({
            col_name: 'spending_name',
            value: spendingName,
        });

        if (result && result.length > 0) {
            return result[0].category || null;
        }

        return null;
    } catch (error) {
        Logger.log(`⚠️ Error retrieving category: ${error.message}`);
        return null;
    }
}

/**
 * Look up category/tag/note for a transaction name using only the local DB.
 * Returns null if not found — does NOT call Gemini.
 * Use this for the fast path; call findcatTransactionWithGemini separately if needed.
 *
 * @param {string} transactionName
 * @return {{category, tag, note}|null}
 */
function findcatInDB(transactionName) {
  const db = getDbCatAndTag();
  const exactMatch = db.search(transactionName);
  if (exactMatch) {
    return { category: exactMatch.data[1], tag: exactMatch.data[2], note: exactMatch.data[3], account: exactMatch.data[4] || '' };
  }
  const words = transactionName.split(/\s+/);
  const regex = new RegExp(words.join("|"), "i");
  const fuzzy = db.search(regex);
  if (fuzzy) {
    return { category: fuzzy.data[1], tag: fuzzy.data[2], note: fuzzy.data[3], account: fuzzy.data[4] || '' };
  }
  return null;
}

/**
 * Get all saved category mappings
 * Used for display/management purposes
 *
 * @return {Array} - Array of {spending_name, category, date_added}
 */
function getAllSpendingCategories() {
    try {
        return dbcatandTag.getAll() || [];
    } catch (error) {
        Logger.log(`⚠️ Error retrieving all categories: ${error.message}`);
        return [];
    }
}

/**
 * Delete a category mapping
 * 
 * @param {string} spendingName - Spending name to remove
 * @return {Object} {success: boolean, message?: string}
 */
function deleteSpendingCategory(spendingName) {
    try {
        const result = dbcatandTag.search({
            col_name: 'spending_name',
            value: spendingName,
        });

        if (result && result.length > 0) {
            const rowIndex = result[0].row;
            dbcatandTag.delete(rowIndex);
            return {
                success: true,
                message: `Kategori '${spendingName}' berhasil dihapus`
            };
        } else {
            return {
                success: false,
                message: `Kategori '${spendingName}' tidak ditemukan`
            };
        }
    } catch (error) {
        Logger.log(`❌ Error deleting category: ${error.message}`);
        return {
            success: false,
            message: `Error: ${error.message}`
        };
    }
}
