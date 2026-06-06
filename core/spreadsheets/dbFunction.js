/**
 * Build a spending card string directly from a payload object.
 * Avoids a DB round-trip after appendSheets — use this in saveSpending.
 *
 * @param {Object} payload - Same shape as the payload passed to appendSheets
 * @return {string} Markdown-formatted card
 */
/**
 * Build a spending card string directly from a payload object.
 * Pass fromGemini=true to append an AI source indicator.
 *
 * @param {Object} payload
 * @param {boolean} [fromGemini]
 * @return {string} Markdown-formatted card
 */
function buildSpendingCard(payload, fromGemini) {
    const amount = parseFloat(payload.Amount || 0);
    const formattedAmount = new Intl.NumberFormat("en-US").format(amount);
    const sourceNote = fromGemini ? '\n\n_🤖 Category predicted by Gemini AI_' : '';
    return `📅 Record date: ${payload.Date}
🎲 Transaction ID: \`${payload.ID}\`
🐳 Expenses Name: ${payload.Name}
💰 Amount: Rp${formattedAmount}
😼 Category: ${payload.Category || ' '}
🔖 Tag: ${payload.Tag || ' '}
🏦 Account: ${payload.Account || 'Cash'}
📝 Note: ${payload.Note || ' '}${sourceNote}`;
}

/**
 * Build an income card string directly from a payload object.
 * Pass fromGemini=true to append an AI source indicator.
 *
 * @param {Object} payload
 * @param {boolean} [fromGemini]
 * @return {string} Markdown-formatted card
 */
function buildIncomeCard(payload, fromGemini) {
    const amount = parseFloat(payload.Amount || 0);
    const formattedAmount = new Intl.NumberFormat("en-US").format(amount);
    const sourceNote = fromGemini ? '\n\n_🤖 Category predicted by Gemini AI_' : '';
    return `📅 Record date: ${payload.Date}
🎲 Transaction ID: \`${payload.ID}\`
📥 Income Name: ${payload.Name}
💰 Amount: Rp${formattedAmount}
😼 Category: ${payload.Category || ' '}
🔖 Tag: ${payload.Tag || ' '}
🏦 Account: ${payload.Account || 'Cash'}
📝 Note: ${payload.Note || ' '}${sourceNote}`;
}

function printspendingTransaction(id) {
    const dbTransactions = getDbTransactions();
    const record = dbTransactions.key(id);
    if (record) {
        const transactionID = id;
        const date = record.data[1];
        const formattedDate = Utilities.formatDate(date, "GMT+7", "E MMM dd yyyy");
        const expenseName = record.data[2];
        const amount = parseFloat(record.data[5] || 0); // Mengambil data amount sebagai angka
        const category = record.data[4] || " ";
        const tag = record.data[6] || " ";
        const account = record.data[7] || "Cash";
        const note = record.data[8] || " ";

        const formattedAmount = new Intl.NumberFormat("en-US").format(amount); // Format amount sebagai ribuan

        const pesan = `📅 Record date: ${formattedDate}
🎲 Transaction ID: \`${transactionID}\`
🐳 Expenses Name: ${expenseName}
💰 Amount: Rp${formattedAmount}
😼 Category: ${category}
🔖 Tag: ${tag}
🏦 Account: ${account}
📝 Note: ${note}`;
        return pesan;
    } else {
        return `Transaction with ID ${id} not found.`;
    }
}

function printincomeTransaction(id) {
    const dbTransactions = getDbTransactions();
    const record = dbTransactions.key(id);
    if (record) {
        const transactionID = id;
        const date = record.data[1];
        const formattedDate = Utilities.formatDate(date, "GMT+7", "E MMM dd yyyy");
        const incomeName = record.data[2];
        const amount = parseFloat(record.data[5] || 0);
        const category = record.data[4] || " ";
        const tag = record.data[6] || " ";
        const account = record.data[7] || "Cash";
        const note = record.data[8] || " ";

        const formattedAmount = new Intl.NumberFormat("en-US").format(amount);

        const pesan = `📅 Record date: ${formattedDate}
🎲 Transaction ID: \`${transactionID}\`
📥 Income Name: ${incomeName}
💰 Amount: Rp${formattedAmount}
😼 Category: ${category}
🔖 Tag: ${tag}
🏦 Account: ${account}
📝 Note: ${note}`;

        return pesan;
    } else {
        return `Transaction with ID ${id} not found.`;
    }
}
