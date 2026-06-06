/**
 * Handler: Add Default Category
 */
function handleAddCategoryWizard(ctx) {
    const chatID = ctx.from.id;

    // Access control
    if (!isUserAllowed(chatID)) {
        ctx.reply(MSG_REJECT);
        return;
    }

    return stage.enter('add_default_category');
}

/**
 * Wizard: Add Default Category
 * STEP 1: Prompt
 * STEP 2: Parse query [+ category [+ account]] from one-liner, or just query
 *   - If all three → save immediately
 *   - If query + category → ask for account → STEP 3 handles account
 *   - If query only → ask for category → STEP 3 handles category → STEP 4 handles account
 * STEP 3: Multi-purpose — get category (if missing) OR account (if category already set)
 * STEP 4: Get account → save
 */
function createAddDefaultCategoryWizard(Scene) {

    function isCancelInput(raw) {
        return raw === 'cancel' || raw.includes('❌');
    }

    /**
     * Parse free-form input into { query, category, account }.
     * Supports:
     *   "Kopi category: Food account: Cash"
     *   "query: Bensin category: Transport account: BCA"
     *   "Gojek category: Transport"
     *   "Spotify"
     */
    function parseCategoryInput(text) {
        const raw = text.trim();

        const queryMatch = raw.match(/query:\s*(.+?)(?:\s+category:|$)/i);
        const catMatch = raw.match(/category:\s*(.+?)(?:\s+account:|$)/i);
        const accountMatch = raw.match(/account:\s*(.+?)$/i);
        const nameCatMatch = !queryMatch
            ? raw.match(/^(.+?)\s+category:\s*(.+?)(?:\s+account:\s*(.+))?$/i)
            : null;

        let query = null, category = null, account = null;

        if (queryMatch) {
            query = queryMatch[1].trim();
            category = catMatch ? catMatch[1].trim() : null;
            account = accountMatch ? accountMatch[1].trim() : null;
        } else if (nameCatMatch) {
            query = nameCatMatch[1].trim();
            category = nameCatMatch[2].trim();
            account = nameCatMatch[3] ? nameCatMatch[3].trim() : null;
        } else {
            query = raw;
        }

        return { query: query || null, category: category || null, account: account || null };
    }

    /**
     * Persist to Query DB and reply with summary.
     */
    function saveDefaultCategory(ctx, query, category, account) {
        const payload = {
            Query: query,
            Cat: category,
            Tag: '',
            Notes: '',
            Account: account || ''
        };

        try {
            appendSheets(getDbCatAndTag(), payload);
            ctx.reply(
                '✅ Default category saved:\n\n' +
                `• Query: ${payload.Query}\n` +
                `• Category: ${payload.Cat}\n` +
                `• Account: ${payload.Account || '(not set)'}`,
                { reply_markup: { keyboard: KB_MAIN_MENU, resize_keyboard: true } }
            );
        } catch (err) {
            Logger.log('❌ AddDefaultCategory error: ' + err.message);
            ctx.reply('❌ Failed to save default category.', {
                reply_markup: { keyboard: KB_MAIN_MENU, resize_keyboard: true }
            });
        }

        ctx.data = {};
    }

    function askForAccount(ctx, queryName) {
        ctx.replyWithMarkdown(
            `🏦 *Account* untuk *${queryName}*?\n\n` +
            'Contoh: `Cash`, `BCA`, `DANA`, `GoPay`, `OVO`\n' +
            'Ketik `-` untuk skip.',
            { reply_markup: { keyboard: KB_CANCEL, resize_keyboard: true, one_time_keyboard: true } }
        );
    }

    return new Scene(
        'add_default_category',

        // ======================
        // STEP 1 — Prompt
        // ======================
        (ctx) => {
            ctx.data = {};

            ctx.replyWithMarkdown(
                '📂 *Add Default Category*\n\n' +
                'Masukkan nama query, kategori, dan akun sekaligus:\n' +
                '• `Kopi category: Food account: Cash`\n' +
                '• `Bensin category: Transport account: BCA`\n\n' +
                'Atau ketik nama query saja — kita isi satu per satu.',
                { reply_markup: { keyboard: KB_CANCEL, resize_keyboard: true, one_time_keyboard: true } }
            );

            return ctx.wizard.next();
        },

        // ======================
        // STEP 2 — Parse query [+ category [+ account]]
        // ======================
        (ctx) => {
            const raw = (ctx.message?.text || '').trim();

            if (!raw || isCancelInput(raw.toLowerCase())) {
                ctx.reply('❌ Cancelled.', { reply_markup: { keyboard: KB_MAIN_MENU, resize_keyboard: true } });
                return ctx.wizard.leave();
            }

            const { query, category, account } = parseCategoryInput(raw);

            if (!query) {
                ctx.reply('Please enter at least the query name 🙂');
                return;
            }

            // All three provided — save immediately
            if (category && account !== null) {
                saveDefaultCategory(ctx, query, category, account === '-' ? '' : account);
                return ctx.wizard.leave();
            }

            ctx.data.query = query;
            ctx.data.category = category || null;

            if (category) {
                // Has category but no account — ask for account (STEP 3 will receive it)
                askForAccount(ctx, query);
            } else {
                // No category — ask for it (STEP 3 will receive category, STEP 4 account)
                ctx.replyWithMarkdown(
                    `Got it! *${query}* 📝\n\n` +
                    'Masukkan *kategori*:\n' +
                    'Contoh: `Food and Drink`, `Transport`, `Entertainment`',
                    { reply_markup: { keyboard: KB_CANCEL, resize_keyboard: true, one_time_keyboard: true } }
                );
            }

            return ctx.wizard.next();
        },

        // ======================
        // STEP 3 — Multi-purpose: category OR account
        // ======================
        (ctx) => {
            const raw = (ctx.message?.text || '').trim();

            if (!raw || isCancelInput(raw.toLowerCase())) {
                ctx.reply('❌ Cancelled.', { reply_markup: { keyboard: KB_MAIN_MENU, resize_keyboard: true } });
                return ctx.wizard.leave();
            }

            // If category already set (came via "query+category" path) → this input is account
            if (ctx.data.category) {
                const account = raw === '-' ? '' : raw;
                saveDefaultCategory(ctx, ctx.data.query, ctx.data.category, account);
                return ctx.wizard.leave();
            }

            // Otherwise this input is category — then ask for account
            ctx.data.category = raw;
            askForAccount(ctx, ctx.data.query);
            return ctx.wizard.next();
        },

        // ======================
        // STEP 4 — Get account (only reached from "query only" path)
        // ======================
        (ctx) => {
            const raw = (ctx.message?.text || '').trim();

            if (!raw || isCancelInput(raw.toLowerCase())) {
                ctx.reply('❌ Cancelled.', { reply_markup: { keyboard: KB_MAIN_MENU, resize_keyboard: true } });
                return ctx.wizard.leave();
            }

            const account = raw === '-' ? '' : raw;
            saveDefaultCategory(ctx, ctx.data.query, ctx.data.category, account);
            return ctx.wizard.leave();
        }
    );
}
