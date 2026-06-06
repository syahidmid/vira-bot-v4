function sendDailyReport() {
    try {
        const token = getScheduleToken();
        const chatIds = getAllowedChatIds();

        if (!token) { Logger.log('❌ TOKEN not set'); return; }
        if (!chatIds.length) { Logger.log('❌ ALLOWED_USERS not set'); return; }

        broadcastScheduledMessage(token, chatIds, buildYesterdayReport());
    } catch (e) {
        Logger.log('❌ sendDailyReport error: ' + e.message);
    }
}

/**
 * Build yesterday's spending summary message.
 * Format: ringkasan total per kategori + grand total
 *
 * @return {string} Formatted message (Markdown)
 */
function buildYesterdayReport() {
    const TZ = 'GMT+7';

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayLabel = Utilities.formatDate(yesterday, TZ, 'dd MMMM yyyy');

    const result = processSpendingByDateRange(1);

    let msg = `Hey! Here's your spending summary for yesterday, ${yesterdayLabel} 👋\n\n`;

    if (result.error) {
        msg += `Looks like you didn't spend anything yesterday. Did you forget to log something? 🤔`;
    } else {
        msg += `Here's the breakdown:\n\n`;
        msg += result.response;
        msg += `\n\nStay on track! 💪`;
    }

    return msg;
}