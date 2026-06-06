/**
 * =============================================================================
 * bot/schedule/scheduleUtils.js
 * =============================================================================
 * Shared utilities for all scheduled jobs (dailyReport, missingTransactionAlert, etc.)
 * =============================================================================
 */

/**
 * Get bot token from Script Properties.
 * @return {string|null}
 */
function getScheduleToken() {
    return PropertiesService.getScriptProperties().getProperty('TELEGRAM_BOT_TOKEN') || null;
}

/**
 * Parse ALLOWED_USERS property.
 * Supports JSON array format: [{"name":"Syahid","chatId":"925867562"}]
 * or plain comma-separated: 925867562,123456789
 *
 * @return {string[]} Array of chat IDs
 */
function getAllowedChatIds() {
    const raw = PropertiesService.getScriptProperties().getProperty('ALLOWED_USERS') || '';
    if (!raw) return [];

    try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
            return parsed.map(entry => String(entry.chatId || entry).trim()).filter(Boolean);
        }
        return [String(parsed.chatId || parsed).trim()];
    } catch (e) {
        return raw.split(',').map(id => id.trim()).filter(Boolean);
    }
}

/**
 * Send a Telegram message (outbound, no webhook).
 *
 * @param {string} token
 * @param {string} chatId
 * @param {string} text - Markdown formatted
 */
function sendScheduledMessage(token, chatId, text) {
    const url = `https://api.telegram.org/bot${token}/sendMessage`;

    const payload = {
        chat_id: chatId,
        text: text,
        parse_mode: 'Markdown'
    };

    const options = {
        method: 'post',
        contentType: 'application/json',
        payload: JSON.stringify(payload),
        muteHttpExceptions: true
    };

    const response = UrlFetchApp.fetch(url, options);
    const code = response.getResponseCode();

    if (code < 200 || code >= 300) {
        Logger.log(`❌ Failed to send to ${chatId}: HTTP ${code} - ${response.getContentText()}`);
    } else {
        Logger.log(`✅ Message sent to ${chatId}`);
    }
}

/**
 * Broadcast message to all allowed users.
 *
 * @param {string} token
 * @param {string[]} chatIds
 * @param {string} message
 */
function broadcastScheduledMessage(token, chatIds, message) {
    chatIds.forEach(chatId => sendScheduledMessage(token, chatId, message));
    Logger.log(`✅ Broadcast sent to ${chatIds.length} user(s)`);
}