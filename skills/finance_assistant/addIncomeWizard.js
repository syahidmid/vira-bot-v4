/**
 * Wizard: Save Income (Smart Input — No Draft)
 * STEP 1: Prompt user to input name + amount together
 * STEP 2: Parse input — if both found, save immediately; if only name, ask amount
 * STEP 3 (conditional): Get amount → save immediately
 *
 * If category was predicted by Gemini, a separate inline-keyboard message is
 * sent after the card asking the user to remember the category. The response
 * is handled by handleQuerySaveCallback() in handler.js — NOT a wizard step.
 */

/**
 * Handle menu button: Input Income
 */
function handleMenuInputIncome(ctx) {
    const chatID = ctx.from.id;

    if (!isUserAllowed(chatID)) {
        ctx.reply(MSG_REJECT);
        return;
    }

    return stage.enter('save_income');
}

function createSaveIncomeWizard(Scene) {

    function isCancelInput(raw) {
        return raw === 'cancel' || raw.includes('❌');
    }

    function parseIncomeInput(text) {
        let raw = text.trim();

        const backdate = /\bBackdate\b/i.test(raw);
        if (backdate) raw = raw.replace(/\bBackdate\b/i, '').trim().replace(/\s+/g, ' ');

        const rpMatch = raw.match(/rp\.?\s*([\d.,]+)/i);
        const numMatch = raw.match(/\b(\d[\d.,]*)\b/);
        const amountMatch = rpMatch || numMatch;

        if (!amountMatch) {
            return { name: raw, amount: null, backdate };
        }

        const rawNum = amountMatch[1].replace(/\./g, '').replace(/,/g, '');
        const amount = parseInt(rawNum, 10);
        const name = raw.replace(amountMatch[0], '').trim().replace(/\s+/g, ' ');

        return {
            name: name || null,
            amount: isNaN(amount) || amount <= 0 ? null : amount,
            backdate
        };
    }

    /**
     * Persist income to DB.
     * Returns { payload, fromGemini } — does NOT send any reply.
     */
    function saveIncome(incomeName, amount, date) {
        const id = generateFastTransactionID();
        const dateStr = date || Utilities.formatDate(new Date(), 'GMT+7', 'dd MMMM yyyy');

        const dbHit = findcatInDB(incomeName);
        const fromGemini = !dbHit;

        let category, tag, note, account;
        if (dbHit) {
            category = dbHit.category;
            tag = dbHit.tag || '';
            note = dbHit.note || '';
            account = dbHit.account || 'Cash';
        } else {
            const aiResult = findcatTransactionWithGemini(incomeName);
            category = (aiResult.category && aiResult.category !== 'AI Not Found') ? aiResult.category : 'Uncategorized';
            tag = (aiResult.tag && aiResult.tag !== 'AI Not Found') ? aiResult.tag : '';
            note = '';
            account = 'Cash';
        }

        const payload = {
            ID: id,
            Date: dateStr,
            Name: incomeName,
            Type: 'income',
            Category: category,
            Amount: amount,
            Tag: tag,
            Account: account,
            Note: note
        };

        appendSheets(getDbTransactions(), payload);
        return { payload, fromGemini };
    }

    /**
     * Send card with Edit/Delete inline buttons + (if Gemini) query prompt.
     * Restores KB_MAIN_MENU via a separate first message so inline_keyboard
     * and reply keyboard don't conflict.
     */
    function replyWithCard(ctx, payload, fromGemini) {
        ctx.reply('✅ Income saved!', {
            reply_markup: { keyboard: KB_MAIN_MENU, resize_keyboard: true }
        });

        ctx.replyWithMarkdown('*Income Card:*\n\n' + buildIncomeCard(payload, fromGemini), {
            reply_markup: {
                inline_keyboard: [[
                    { text: '✏️ Edit', callback_data: 'edit_tx:' + payload.ID },
                    { text: '🗑 Delete', callback_data: 'del_tx:' + payload.ID }
                ]]
            }
        });

        if (fromGemini) {
            CacheService.getScriptCache().put(
                'qsave_' + ctx.from.id,
                JSON.stringify({ name: payload.Name, category: payload.Category, tag: payload.Tag, account: payload.Account }),
                3600
            );

            ctx.reply('💾 Remember this category for faster recognition next time?', {
                reply_markup: {
                    inline_keyboard: [[
                        { text: '✅ Yes', callback_data: 'qsave:yes' },
                        { text: '❌ No', callback_data: 'qsave:no' }
                    ]]
                }
            });
        }
    }

    return new Scene(
        'save_income',

        // ======================
        // STEP 1 — Prompt
        // ======================
        (ctx) => {
            ctx.data = {};

            ctx.replyWithMarkdown(
                '💰 *Add Income*\n\n' +
                'Type the name and amount together:\n' +
                '• `Salary 5000000`\n' +
                '• `Freelance Rp800000`\n' +
                '• `Bonus 1.500.000`\n\n' +
                'Add `Backdate` to record as yesterday:\n' +
                '• `Salary Backdate 5000000`\n\n' +
                'Or just the name — I\'ll ask for the amount next.',
                {
                    reply_markup: {
                        keyboard: KB_CANCEL,
                        resize_keyboard: true,
                        one_time_keyboard: true
                    }
                }
            );

            return ctx.wizard.next();
        },

        // ======================
        // STEP 2 — Parse name [+ amount]
        // ======================
        (ctx) => {
            const raw = (ctx.message?.text || '').trim();

            if (!raw || isCancelInput(raw.toLowerCase())) {
                ctx.reply('❌ Cancelled.', { reply_markup: { keyboard: KB_MAIN_MENU, resize_keyboard: true } });
                return ctx.wizard.leave();
            }

            const { name, amount, backdate } = parseIncomeInput(raw);

            if (!name) {
                ctx.reply('Please enter at least the income name 🙂');
                return;
            }

            const nameValidation = validateExpenseName(name);
            if (!nameValidation.valid) {
                ctx.reply(nameValidation.message);
                return;
            }

            ctx.data.incomeName = nameValidation.data;
            ctx.data.backdate = backdate;

            if (amount !== null) {
                const amountValidation = validateAmount(amount);
                if (!amountValidation.valid) {
                    ctx.reply(amountValidation.message);
                    return;
                }

                const savedDate = backdate
                    ? backDate(new Date())
                    : Utilities.formatDate(new Date(), 'GMT+7', 'dd MMMM yyyy');

                try {
                    const { payload, fromGemini } = saveIncome(ctx.data.incomeName, amountValidation.data, savedDate);
                    replyWithCard(ctx, payload, fromGemini);
                } catch (err) {
                    Logger.log('❌ SaveIncome error: ' + err.message);
                    ctx.reply('❌ Failed to save your income.', { reply_markup: { keyboard: KB_MAIN_MENU, resize_keyboard: true } });
                }

                ctx.data = {};
                return ctx.wizard.leave();
            }

            ctx.replyWithMarkdown(
                `Got it! *${ctx.data.incomeName}* 📝\n\n` +
                'How much was it? 💰\n' +
                'Example: `5000000` or `Rp5.000.000`',
                {
                    reply_markup: {
                        keyboard: KB_CANCEL,
                        resize_keyboard: true,
                        one_time_keyboard: true
                    }
                }
            );

            return ctx.wizard.next();
        },

        // ======================
        // STEP 3 — Get amount (only when not provided in step 2)
        // ======================
        (ctx) => {
            const raw = (ctx.message?.text || '').trim();

            if (!raw || isCancelInput(raw.toLowerCase())) {
                ctx.reply('❌ Cancelled.', { reply_markup: { keyboard: KB_MAIN_MENU, resize_keyboard: true } });
                return ctx.wizard.leave();
            }

            const numMatch = raw.match(/(\d[\d.,]*)/);
            if (!numMatch) {
                ctx.replyWithMarkdown('I couldn\'t find a number 😅 Please enter the amount, e.g. `5000000`');
                return;
            }

            const rawNum = numMatch[1].replace(/\./g, '').replace(/,/g, '');
            const amount = parseInt(rawNum, 10);

            const amountValidation = validateAmount(amount);
            if (!amountValidation.valid) {
                ctx.reply(amountValidation.message);
                return;
            }

            const savedDate = ctx.data.backdate
                ? backDate(new Date())
                : Utilities.formatDate(new Date(), 'GMT+7', 'dd MMMM yyyy');

            try {
                const { payload, fromGemini } = saveIncome(ctx.data.incomeName, amountValidation.data, savedDate);
                replyWithCard(ctx, payload, fromGemini);
            } catch (err) {
                Logger.log('❌ SaveIncome error: ' + err.message);
                ctx.reply('❌ Failed to save your income.', { reply_markup: { keyboard: KB_MAIN_MENU, resize_keyboard: true } });
            }

            ctx.data = {};
            return ctx.wizard.leave();
        }

    );
}
