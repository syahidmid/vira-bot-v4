/**
 * =============================================================================
 * skills/finance_assistant/missingTransactionAlert.js
 * =============================================================================
 *
 * RESPONSIBILITY:
 * Check if yesterday has zero spending transactions.
 * If empty → broadcast a reminder to all allowed users.
 * If not empty → do nothing (silent).
 *
 * TRIGGER:
 * Attach sendMissingTransactionAlert() to a time-based Apps Script trigger.
 * Recommended: daily, early morning (e.g. 07:00 GMT+7).
 *
 * DEPENDS ON:
 * - processSpendingByDateRange()   → core/dbHandlers.js
 * - getScheduleToken()             → bot/schedule/scheduleUtils.js
 * - getAllowedChatIds()            → bot/schedule/scheduleUtils.js
 * - broadcastScheduledMessage()   → bot/schedule/scheduleUtils.js
 * =============================================================================
 */

/**
 * Entry point — call this from an Apps Script time-based trigger.
 * Sends an alert only when yesterday has no recorded transactions.
 */
function sendMissingTransactionAlert() {
    try {
        const token = getScheduleToken();
        const chatIds = getAllowedChatIds();

        if (!token) { Logger.log('❌ [MissingAlert] TOKEN not set'); return; }
        if (!chatIds.length) { Logger.log('❌ [MissingAlert] ALLOWED_USERS not set'); return; }

        const result = processSpendingByDateRange(1);

        if (result.error) {
            // Yesterday is empty — send reminder
            const message = buildMissingTransactionMessage();
            broadcastScheduledMessage(token, chatIds, message);
            Logger.log('✅ [MissingAlert] Alert sent — no transactions yesterday.');
        } else {
            Logger.log('✅ [MissingAlert] Yesterday has transactions, no alert needed.');
        }

    } catch (e) {
        Logger.log('❌ [MissingAlert] Error: ' + e.message);
    }
}

/**
 * Build the reminder message for when yesterday has no transactions.
 *
 * @return {string} Markdown-formatted message
 */
function buildMissingTransactionMessage() {
    const TZ = 'GMT+7';
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayLabel = Utilities.formatDate(yesterday, TZ, 'dd MMMM yyyy');

    return (
        `⚠️ *Spending reminder!*\n\n` +
        `You have *no recorded transactions* for yesterday (${yesterdayLabel}).\n\n` +
        `Did you forget to log something? Tap *💸 Add Spending* to record it now.`
    );
}
