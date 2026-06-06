
/**
 * =============================================================================
 * This skill fetches today's events from the user's primary Google Calendar and sends
 * a formatted agenda message to specified Telegram chat(s) via the Bot API.
 * 
 * Key functions:
 * - sendDailyCalendar: Main entry point to fetch events and send messages.
 * - buildTodayCalendarReport: Fetches events and builds a Markdown message.
 * - sendCalendarMessage: Utility to send a message via Telegram Bot API.
 * =============================================================================
 */
function sendDailyCalendar() {
    try {
        const token = getScheduleToken();
        const chatIds = getAllowedChatIds();

        if (!token) { Logger.log('❌ TOKEN not set'); return; }
        if (!chatIds.length) { Logger.log('❌ ALLOWED_USERS not set'); return; }

        broadcastScheduledMessage(token, chatIds, buildTodayCalendarReport());
    } catch (e) {
        Logger.log('❌ sendDailyCalendar error: ' + e.message);
    }
}


/**
 * Fetch today's events from Google Calendar (primary)
 * and build a formatted Telegram message.
 *
 * @return {string} Formatted message (Markdown)
 */
function buildTodayCalendarReport() {
    const TZ = 'GMT+7';

    // Define today's time range (00:00:00 - 23:59:59 GMT+7)
    const now = new Date();
    const todayLabel = Utilities.formatDate(now, TZ, 'EEEE, dd MMMM yyyy');

    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);


    // Fetch events from primary calendar
    let events = [];
    try {
        const calendar = CalendarApp.getDefaultCalendar();
        events = calendar.getEvents(startOfDay, endOfDay);
    } catch (e) {
        Logger.log('❌ Failed to fetch calendar: ' + e.message);
        return `📅 *Agenda Hari Ini*\n${todayLabel}\n\n❌ Gagal mengambil data kalender. Pastikan izin Calendar sudah diberikan.`;
    }

    // Header
    let msg = `📅 *Agenda Hari Ini*\n`;
    msg += `🗓 ${todayLabel}\n`;

    // No events today
    if (!events || events.length === 0) {
        msg += `\nTidak ada agenda hari ini. Hari yang tenang! 😌`;
        return msg;
    }

    msg += `🔢 ${events.length} event\n\n`;

    // Sort events by start time
    events.sort((a, b) => a.getStartTime() - b.getStartTime());

    // Build each event block
    events.forEach((event, index) => {
        const title = event.getTitle() || '(Tanpa judul)';
        const isAllDay = event.isAllDayEvent();
        const description = event.getDescription()
            ? event.getDescription().trim().slice(0, 150)
            : null;
        const location = event.getLocation()
            ? event.getLocation().trim()
            : null;

        // Format time
        let timeLabel;
        if (isAllDay) {
            timeLabel = '🔁 Sepanjang hari';
        } else {
            const startTime = Utilities.formatDate(event.getStartTime(), TZ, 'HH:mm');
            const endTime = Utilities.formatDate(event.getEndTime(), TZ, 'HH:mm');
            timeLabel = `⏰ ${startTime} – ${endTime}`;
        }

        msg += `*${index + 1}. ${title}*\n`;
        msg += `${timeLabel}\n`;

        if (location) {
            msg += `📍 ${location}\n`;
        }

        if (description) {
            // Escape any Markdown characters in description
            const safeDesc = description
                .replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&')
                .replace(/\n+/g, ' ');
            msg += `📝 ${safeDesc}\n`;
        }

        msg += `\n`;
    });

    return msg.trim();
}