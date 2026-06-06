/**
 * =============================================================================
 * bot/ui/keyboard.js
 * =============================================================================
 * 
 * RESPONSIBILITY:
 * Build and export keyboard/markup templates for Telegram bot replies
 * 
 * RULES:
 * - Pure functions only (no side effects)
 * - No ctx.reply() calls
 * - No access to core, AI, or handler logic
 * - No database queries
 * - Return only keyboard arrays or markup objects
 * 
 * NAMING CONVENTION:
 * - All exports MUST be prefixed with KB_ (keyboard builder)
 * - Example: KB_MAIN_MENU, KB_CONFIRM, KB_CANCEL
 * 
 * =============================================================================
 */

/**
 * Main menu keyboard - displayed on /start
 * Options: Input Spending/Income, View Spending, Help, Settings
 */
const KB_MAIN_MENU = [
    ["💸 Add Spending", "💰 Add Income"],
    ["📊 View Spending", "📈 View Income"],
    ["🔍 Find Transaction"],
    ["❓ Help", "⚙️ Settings"]
];

/**
 * Credit/Spending entry confirmation keyboard
 * Options: View Today, Edit Description/Category/Amount/Date, Delete, View All
 */
const KB_TRANSACTION_ENTRY = [
    ["📅 View Spending"],
    ["Edit Description", "Edit Category"],
    ["Edit Amount", "Edit Date"],
    ["Delete This Transaction"],
    ["Transaction"]
];

/**
 * Transaction menu keyboard - for viewing spending reports
 * Options: Today, Yesterday, 3 days, 7 days, Delete Last
 */
const KB_TRANSACTION_MENU = [
    ["📅 View Spending"],
    ["🧾 Cek Pengeluaran Kemarin"],
    ["📆 3 Hari Terakhir", "📆 7 Hari Terakhir"],
    ["🗑️ Delete Last Transaction"]
];

const KB_SETTINGS_MENU = [
    ['Add Default Category'],
    ['Change Bot Name'],
    ['Update Bot Soul'],
    ['Back to Main Menu']
];


/**
 * Simple cancel keyboard - for operations that can be cancelled
 * Single button: Cancel
 */
const KB_CANCEL = [
    ["❌ Cancel"]
];

/**
 * View spending options keyboard
 * Options: 7 days, 30 days, Cancel
 */
const KB_VIEW_SPENDING_OPTIONS = [
    ["7 days", "30 days"],
    ["❌ Cancel"]
];

/**
 * Category wizard confirmation keyboard
 * Options: Ya (Yes) / Tidak (No)
 * Used in category wizard step 3 (confirmation)
 */
const KB_WIZARD_CONFIRM = [
    ["✅ Ya", "❌ Tidak"]
];

/**
 * Query DB save confirmation keyboard
 * Used after AI-predicted category to offer saving it for faster future lookup
 */
const KB_QUERY_SAVE = [
    ["✅ Yes, save it", "❌ No thanks"]
];

/**
 * Edit transaction field selection keyboard
 * Used in edit_transaction wizard step 1
 */
const KB_EDIT_FIELDS = [
    ["📅 Change Date", "📝 Change Transaction Name"],
    ["💰 Change Nominal", "🏷️ Change Category"],
    ["🏷️ Change Tag", "📋 Change Notes"],
    ["✅ Done", "❌ Cancel"]
];

/**
 * Helper: Build bookmark action keyboard
 * Inline keyboard for bookmark commands (Show Bookmarks, Back to Start)
 * 
 * @param {Object} button - lumpia.button instance (from global scope)
 * @return {Array} - Inline keyboard array
 */
function buildBookmarkKeyboard(button) {
    return [
        [button.text("🔄 Back to Start", "start")]
    ];
}
