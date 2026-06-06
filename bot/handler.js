/**
 * =============================================================================
 * bot/handler.gs
 * =============================================================================
 *
 * ROLE:
 * This file acts as the SINGLE MESSAGE ROUTER.
 * Its only responsibility is to REGISTER and ROUTE incoming Telegram updates
 * to the appropriate handler, skill, or wizard.
 *
 * IMPORTANT:
 * - This file MUST NOT contain business logic.
 * - This file MUST NOT perform data processing or validation.
 *
 * WHAT THIS FILE DOES:
 * 1) Registers slash commands (e.g. /start, /help, /whoiam, /botstatus)
 * 2) Registers hashtag shortcuts (e.g. #Spending, #Income, #Delete)
 * 3) Routes photo messages to OCR pipeline
 * 4) Routes natural language messages to AI handler
 *
 * WHERE THE LOGIC LIVES:
 * - Skills (single capability logic):
 *   → bot/skills/*.skill.gs
 *
 * - Wizards (multi-step user interaction):
 *   → bot/wizard/*.wizard.gs
 *
 * - AI interpretation & response:
 *   → bot/aiMessageHandler.gs
 *
 * - OCR processing:
 *   → bot/ocrHandler.gs
 *
 * ENTRY POINT:
 * This router is invoked from code.js → doPost()
 * after Telegram webhook receives an update.
 *
 * ROUTING RULES:
 * - Slash commands        → Execute skill handlers directly (NO AI)
 * - Hashtag shortcuts     → Execute skill handlers directly (NO AI)
 * - Photo messages        → OCR pipeline → AI handler
 * - Natural language      → AI handler
 * - Catch-all             → Handle gracefully without breaking flow
 *
 * UI LAYER USAGE:
 * - Text responses should be defined in bot/ui/message.js
 * - Keyboard layouts should be defined in bot/ui/keyboard.js
 *
 * PHOTO MESSAGE FLOW (PHASE 2.5):
 * user sends photo
 *   ↓
 * handler.js (this file) registers & routes the message
 *   ↓
 * handlePhotoMessageRouter()
 *   ↓
 * bot/ocrHandler.js
 *   ↓
 * performOCR()
 *   ↓
 * bot/aiMessageHandler.js
 *   ↓
 * OCR text treated as normal user input
 *
 * STRICT RULES — DO NOT:
 * - Implement business logic here
 * - Access or modify spreadsheets
 * - Perform save/update/delete operations
 * - Add validation or decision-making logic
 * - Use AI for slash commands or hashtag shortcuts
 * - Modify AI prompt logic
 *
 * If you need to add new behavior:
 * - Create or update a SKILL (bot/skills/)
 * - Then REGISTER it here
 *
 * =============================================================================
 */


/**
 * Register all message handlers with the bot instance
 * @param {Object} bot - lumpia bot instance
 */
function setupMessageRouters(bot) {
    bot.start(handleStartCommand); // Done refactor - moved logic to separate function in the same file
    bot.command('exit', (ctx) => {
        ctx.scene.leave();
        ctx.reply('✅ Scene exited successfully!');
    });

    // Wizard entry points
    bot.hears(/view\s*spending/i, (ctx) => {
        return stage.enter('view_spending');
    });
    bot.hears(/find\s*transaction/i, (ctx) => {
        return stage.enter('find_transaction');
    });
    bot.command('wizardtest', (ctx) => {
        return stage.enter('wizardTest');
    });

    // /help command
    bot.command('help', handleHelpCommand);
    bot.command('ping', handlePingCommand);
    bot.command('whoiam', handleWhoIAmCommand);
    bot.command('quote', handleQuoteCommand);
    bot.command('update', handleUpdateInfoCommand);


    // ===== HASHTAG SHORTCUTS (Direct execution, no AI) =====
    bot.hears(/#Spending (.+) (\d+)/, handleHashtagSpending); // done refactor - moved logic to separate function in the same file
    bot.hears(/#Income (.+) (\d+)/, handleHashtagIncome); // done refactor - moved logic to separate function in the same file
    bot.hears(/#Delete ([0-9A-Za-z]{4})/, handleHashtagDelete); // done refactor - moved logic to separate function in the same file
    bot.hears(/Delete This|Last Transaction/i, handleDeleteLastTransaction); // done refactor - moved logic to separate function in the same file, also updated regex to match both button text and natural language
    bot.hears(/#Update (\w+)/, handleHashtagUpdate); // done refactor - moved logic to separate function in the same file, also updated regex to be more flexible for field names
    bot.hears(/#Transactions (\d+)/, handleHashtagTransactions);


    // ===== UI SHORTCUTS (Menu buttons, no AI) =====
    bot.hears(/Add Income/i, handleMenuInputIncome);
    bot.hears(/Add Spending/i, handleMenuInputExpense);
    bot.hears(/^✏️ Edit ([a-z0-9]{4})$/i, handleEditTransaction);

    // ===== SETTINGS MENU =====
    bot.hears(/^[^\w]*settings$/i, handleSettingsCommand);
    bot.hears(/Add Default Category/i, handleAddCategoryWizard);

    // Other Commands
    bot.hears("Show Bookmarks", handleMenuShowBookmarks);
    bot.hears(/^https?:\/\/\S+/, handleURLBookmark);

    // ===== PHOTO MESSAGES (OCR processing - PHASE 2.5) =====
    bot.on("photo", handlePhotoMessageRouter);

    // ===== INLINE KEYBOARD CALLBACKS =====
    bot.on("callback_query", handleCallbackQuery);

    // ===== NATURAL LANGUAGE (AI-assisted) =====
    bot.hears(/^(?!\/).+/, handleNaturalLanguage);
}



/**
 * Handle /quote command
 */
function handleQuoteCommand(ctx) {
    const chatID = ctx.from.id;

    // Access control
    if (!isUserAllowed(chatID)) {
        ctx.reply(MSG_REJECT);
        return;
    }

    const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];
    const quoteMessage = `<i>"${randomQuote.quote}"</i>\n\n- <b>${randomQuote.author}</b>`;
    ctx.replyWithHTML(quoteMessage);
}

/**
 * Handle /update command (shows update syntax info)
 */
function handleUpdateInfoCommand(ctx) {
    const chatID = ctx.from.id;

    // Access control
    if (!isUserAllowed(chatID)) {
        ctx.reply(MSG_REJECT);
        return;
    }

    ctx.replyWithMarkdown(`🤖 Here are the valid update commands:\n${MSG_UPDATE_COMMANDS}`);
}



/**
 * Handle menu button: Input Pemasukan (Income)
 */
function handleMenuInputIncome(ctx) {
    const chatID = ctx.from.id;

    // Access control
    if (!isUserAllowed(chatID)) {
        ctx.reply(MSG_REJECT);
        return;
    }

    const firstName = ctx.from.first_name;
    ctx.replyWithMarkdown(buildMsgInputIncome(firstName), {
        reply_markup: {
            keyboard: KB_MAIN_MENU,
            resize_keyboard: true,
            one_time_keyboard: true,
        },
    });
}

/**
 * Handle menu button: Lihat Pengeluaran (View Expenses)
 */
function handleMenuViewExpenses(ctx) {
    const chatID = ctx.from.id;

    // Access control
    if (!isUserAllowed(chatID)) {
        ctx.reply(MSG_REJECT);
        return;
    }

    const text = ctx.message.text.toLowerCase();
    let rowCount = 10; // default

    const match = text.match(/^(\d+)\s+pengeluaran\s+terakhir$/i);
    if (match) {
        rowCount = parseInt(match[1]);
    }

    const response = getRecentSpending(rowCount);

    ctx.replyWithMarkdown(response, {
        reply_markup: {
            keyboard: KB_TRANSACTION_MENU,
            resize_keyboard: true,
            one_time_keyboard: true,
        },
    });
}


/**
 * ===== PHOTO MESSAGE HANDLER (PHASE 2.5 - OCR) =====
 */

/**
 * Handle photo messages
 * Routes to OCR handler in bot/ocrHandler.js
 * 
 * Photo message structure from Telegram:
 * ctx.message.photo = array of photo sizes
 * We take the highest resolution (last element)
 */
function handlePhotoMessageRouter(ctx) {
    const chatID = ctx.from.id;

    // Access control
    if (!isUserAllowed(chatID)) {
        ctx.reply(MSG_REJECT);
        return;
    }

    try {
        // Extract photo file_id from Telegram message
        // ctx.message.photo is an array of photo objects with different resolutions
        // Take the last (highest resolution) photo
        const photoArray = ctx.message.photo;

        if (!photoArray || photoArray.length === 0) {
            Logger.log("⚠️ Photo message received but photo array is empty");
            ctx.reply("❌ Gagal membaca foto");
            return;
        }

        // Get the highest resolution photo (last in array)
        const photoFileId = photoArray[photoArray.length - 1].file_id;

        Logger.log(`📸 Photo message received from ${chatID}`);

        // Pass to OCR handler
        handlePhotoMessage(ctx, photoFileId);

    } catch (error) {
        Logger.log(`❌ Error in photo router: ${error.message}`);
        ctx.reply("❌ Gagal membaca foto");
    }
}

/**
 * ===== NATURAL LANGUAGE HANDLER =====
 */

/**
 * Handle "✏️ Edit [ID]" button — enters the edit_transaction wizard
 */
function handleEditTransaction(ctx) {
    const chatID = ctx.from.id;

    if (!isUserAllowed(chatID)) {
        ctx.reply(MSG_REJECT);
        return;
    }

    return stage.enter('edit_transaction');
}

/**
 * Route all inline keyboard callbacks to the appropriate handler.
 * All bot.on("callback_query") traffic passes through here.
 */
function handleCallbackQuery(ctx) {
    const data = ctx.callbackQuery?.data || '';
    if (data.startsWith('qsave:')) {
        handleQuerySaveCallback(ctx);
    } else if (data.startsWith('edit_tx:')) {
        handleEditTxCallback(ctx);
    } else if (data.startsWith('del_tx:')) {
        handleDeleteTxCallback(ctx);
    }
}

/**
 * Handle ✏️ Edit inline button on a spending/income card.
 * Stores the transaction ID in cache and enters the edit_transaction wizard.
 */
function handleEditTxCallback(ctx) {
    const chatId = ctx.from?.id;
    if (!chatId || !isUserAllowed(chatId)) {
        ctx.answerCallbackQuery('❌ Not authorized');
        return;
    }

    const id = (ctx.callbackQuery?.data || '').replace('edit_tx:', '');
    CacheService.getScriptCache().put('edit_inline_' + chatId, id, 60);
    ctx.answerCallbackQuery('');
    return stage.enter('edit_transaction');
}

/**
 * Handle 🗑 Delete inline button on a spending/income card.
 * Delegates to handleHashtagDelete, then removes the card message on success.
 */
function handleDeleteTxCallback(ctx) {
    const chatId = ctx.from?.id;
    if (!chatId || !isUserAllowed(chatId)) {
        ctx.answerCallbackQuery('❌ Not authorized');
        return;
    }

    const id = (ctx.callbackQuery?.data || '').replace('del_tx:', '');
    ctx.answerCallbackQuery('');

    ctx.match = [null, id];
    handleHashtagDelete(ctx);

    // Remove the card only if deletion succeeded (transaction no longer in DB)
    try {
        const stillExists = getDbTransactions().key(id);
        if (!stillExists) {
            ctx.deleteMessage();
        }
    } catch (e) {
        Logger.log('Note: could not delete card after delete: ' + e.message);
    }
}

/**
 * Handle inline keyboard callbacks for Query DB save prompt.
 * Triggered when user taps ✅ Yes / ❌ No on the Gemini category prompt.
 */
function handleQuerySaveCallback(ctx) {
    const chatId = ctx.from?.id;
    if (!chatId || !isUserAllowed(chatId)) {
        ctx.answerCallbackQuery('❌ Not authorized');
        return;
    }

    const data = ctx.callbackQuery?.data || '';
    const cacheKey = 'qsave_' + chatId;

    if (data === 'qsave:yes') {
        const cached = CacheService.getScriptCache().get(cacheKey);
        if (cached) {
            try {
                const pending = JSON.parse(cached);
                appendSheets(getDbCatAndTag(), {
                    Query: pending.name,
                    Cat: pending.category,
                    Tag: pending.tag || '',
                    Notes: '',
                    Account: pending.account || ''
                });
                CacheService.getScriptCache().remove(cacheKey);
                ctx.answerCallbackQuery('✅ Saved! Will be faster next time.');
            } catch (e) {
                Logger.log('❌ qsave callback error: ' + e.message);
                ctx.answerCallbackQuery('❌ Failed to save');
            }
        } else {
            ctx.answerCallbackQuery('⚠️ Session expired, please try again.');
        }
    } else if (data === 'qsave:no') {
        CacheService.getScriptCache().remove(cacheKey);
        ctx.answerCallbackQuery('👌 Got it!');
    } else {
        return; // not our callback
    }

    // Delete the prompt message entirely
    try {
        ctx.deleteMessage();
    } catch (e) {
        Logger.log('Note: could not delete message: ' + e.message);
    }
}

/**
 * Handle natural language messages
 * Routes to AI interpretation layer via aiMessageHandler
 */
function handleNaturalLanguage(ctx) {
    const chatID = ctx.from.id;

    // Access control
    if (!isUserAllowed(chatID)) {
        ctx.reply(MSG_REJECT);
        return;
    }

    const userPrompt = ctx.message.text.trim();

    // Pass to AI handler
    try {
        aiMessageHandler(ctx, userPrompt);
    } catch (error) {
        Logger.log("Error in natural language handler: " + error.message);
        ctx.reply("🤖 An error occurred while processing your request. Please try again.");
    }
}

