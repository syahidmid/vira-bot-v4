/**
 * Wizard: Edit Transaction
 *
 * Entry: bot.hears(/^✏️ Edit ([a-z0-9]{4})$/i) → stage.enter('edit_transaction')
 *
 * STEP 0 — Parse transaction ID from triggering message, show transaction card + field buttons
 * STEP 1 — Receive field selection (Date, Name, Amount, Category, Notes) → show input prompt
 * STEP 2 — Receive new value → validate → save → show updated card → back to step 1
 */

function createEditTransactionWizard(Scene) {

    function isCancelInput(raw) {
        return raw.toLowerCase() === 'cancel' || raw.includes('❌');
    }

    function isDoneInput(raw) {
        const lower = raw.toLowerCase();
        return raw.includes('✅ Selesai') || lower === 'selesai'
            || raw.includes('✅ Done') || lower === 'done';
    }

    /**
     * Parse date input from user.
     * Accepts YYYY-MM-DD or DD/MM/YYYY or DD-MM-YYYY.
     * Returns formatted "dd MMMM yyyy" string (matching DB format), or null if invalid.
     */
    function parseAndFormatDate(input) {
        const trimmed = input.trim();

        // YYYY-MM-DD
        if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
            const d = new Date(trimmed + 'T12:00:00Z');
            if (!isNaN(d.getTime())) {
                return Utilities.formatDate(d, 'GMT+7', 'dd MMMM yyyy');
            }
        }

        // DD/MM/YYYY or DD-MM-YYYY
        const altMatch = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
        if (altMatch) {
            const isoStr = altMatch[3] + '-' + altMatch[2].padStart(2, '0') + '-' + altMatch[1].padStart(2, '0');
            const d = new Date(isoStr + 'T12:00:00Z');
            if (!isNaN(d.getTime())) {
                return Utilities.formatDate(d, 'GMT+7', 'dd MMMM yyyy');
            }
        }

        return null;
    }

    /**
     * Update transaction date in DB.
     * @param {string} id - Transaction ID
     * @param {string} formattedDate - Date string in "dd MMMM yyyy" format
     */
    function updateDateValidated(id, formattedDate) {
        try {
            const record = getDbTransactions().key(id);
            if (!record) {
                return { success: false, message: 'Transaction ' + id + ' not found' };
            }

            const rowIndex = record.row;
            const currentData = getDbTransactions().range(rowIndex, 2, 1, 7).getValues()[0];
            currentData[1] = formattedDate; // Index 1 = date column (col C)
            getDbTransactions().range(rowIndex, 2, 1, 7).setValues([currentData]);

            Logger.log('✅ Updated date for ' + id + ': ' + formattedDate);
            return { success: true };

        } catch (err) {
            Logger.log('❌ updateDateValidated error: ' + err.message);
            return { success: false, message: err.message };
        }
    }

    /**
     * Show transaction card + edit field selection buttons.
     */
    function showEditMenu(ctx) {
        const id = ctx.data.transactionId;
        const card = printspendingTransaction(id);

        ctx.replyWithMarkdown(
            '✏️ *Edit Transaction*\n\n' + card + '\n\nChoose a field to edit:',
            {
                reply_markup: {
                    keyboard: KB_EDIT_FIELDS,
                    resize_keyboard: true,
                    one_time_keyboard: true
                }
            }
        );
    }

    return new Scene(
        'edit_transaction',

        // ======================
        // STEP 0 — Parse ID from message or cache (inline button), show edit menu
        // ======================
        (ctx) => {
            // Inline-button path: ID was stored by handleEditTxCallback
            const cachedId = CacheService.getScriptCache().get('edit_inline_' + (ctx.from?.id || ''));
            if (cachedId) {
                CacheService.getScriptCache().remove('edit_inline_' + ctx.from.id);
                ctx.data = { transactionId: cachedId };
                showEditMenu(ctx);
                return ctx.wizard.next();
            }

            // Text-message path: "✏️ Edit xxxx"
            const msgText = (ctx.message?.text || '').trim();
            const idMatch = msgText.match(/✏️ Edit ([a-z0-9]{4})/i);

            if (!idMatch) {
                ctx.reply('❌ Transaction ID not found.');
                return ctx.wizard.leave();
            }

            ctx.data = { transactionId: idMatch[1] };
            showEditMenu(ctx);
            return ctx.wizard.next();
        },

        // ======================
        // STEP 1 — Receive field selection
        // ======================
        (ctx) => {
            const raw = (ctx.message?.text || '').trim();

            if (isCancelInput(raw)) {
                ctx.reply('❌ Edit cancelled.', {
                    reply_markup: { keyboard: KB_MAIN_MENU, resize_keyboard: true }
                });
                return ctx.wizard.leave();
            }

            if (isDoneInput(raw)) {
                ctx.reply('✅ Done! Transaction has been updated.', {
                    reply_markup: { keyboard: KB_MAIN_MENU, resize_keyboard: true }
                });
                return ctx.wizard.leave();
            }

            const fieldMap = {
                '📅 Change Date': 'date',
                '📝 Change Transaction Name': 'name',
                '💰 Change Nominal': 'amount',
                '🏷️ Change Category': 'category',
                '🏷️ Change Tag': 'tag',
                '📋 Change Notes': 'notes'
            };

            const field = fieldMap[raw];
            if (!field) {
                ctx.reply('Choose a field from the buttons below 👇', {
                    reply_markup: {
                        keyboard: KB_EDIT_FIELDS,
                        resize_keyboard: true,
                        one_time_keyboard: true
                    }
                });
                return; // stay on step 1
            }

            ctx.data.editField = field;

            const prompts = {
                date: '📅 Input Date:\nFormat: `YYYY-MM-DD` atau `DD/MM/YYYY`\nContoh: `2026-04-10` atau `10/04/2026`',
                name: '📝 Input Transaction Name:',
                amount: '💰 Input Amount:\nContoh: `25000` atau `Rp25.000`',
                category: '🏷️ Input Category:\n(Type `-` to clear)',
                tag: '🏷️ Input Tag:\n(Type `-` to clear)',
                notes: '📋 Input Notes:\n(Type `-` to clear)'
            };

            ctx.replyWithMarkdown(prompts[field], {
                reply_markup: {
                    keyboard: KB_CANCEL,
                    resize_keyboard: true,
                    one_time_keyboard: true
                }
            });

            return ctx.wizard.next();
        },

        // ======================
        // STEP 2 — Save updated value
        // ======================
        (ctx) => {
            const raw = (ctx.message?.text || '').trim();

            if (isCancelInput(raw)) {
                showEditMenu(ctx);
                return ctx.wizard.back(); // back to step 1
            }

            const id = ctx.data.transactionId;
            const field = ctx.data.editField;
            let result;

            if (field === 'date') {
                const formatted = parseAndFormatDate(raw);
                if (!formatted) {
                    ctx.replyWithMarkdown('❌ Format date not valid.\nUse: `YYYY-MM-DD` or `DD/MM/YYYY`\nExample: `2026-04-10`');
                    return; // stay on step 2
                }
                result = updateDateValidated(id, formatted);

            } else if (field === 'name') {
                const nameValidation = validateExpenseName(raw);
                if (!nameValidation.valid) {
                    ctx.reply('❌ ' + nameValidation.message);
                    return;
                }
                result = updateExpenseNameValidated(id, nameValidation.data);

            } else if (field === 'amount') {
                const cleaned = raw.replace(/rp\.?\s*/i, '');
                const numMatch = cleaned.match(/(\d[\d.,]*)/);
                if (!numMatch) {
                    ctx.replyWithMarkdown('❌ Nominal not valid.\nExample: `25000` or `Rp25.000`');
                    return;
                }
                const rawNum = numMatch[1].replace(/\./g, '').replace(/,/g, '');
                const amount = parseInt(rawNum, 10);
                const amountValidation = validateAmount(amount);
                if (!amountValidation.valid) {
                    ctx.reply('❌ ' + amountValidation.message);
                    return;
                }
                result = updateAmountValidated(id, amountValidation.data);

            } else if (field === 'tag') {
                const tagValue = raw === '-' ? '' : raw;
                result = updateTagValidated(id, tagValue);

            } else if (field === 'category') {
                const categoryValue = raw === '-' ? '' : raw;
                result = updateCategoryValidated(id, categoryValue);

            } else if (field === 'notes') {
                const noteValue = raw === '-' ? '' : raw;
                result = updateNoteValidated(id, noteValue);
            }

            if (!result || !result.success) {
                ctx.reply('❌ ' + (result ? result.message : 'Failed to update transaction. Please try again.'));
                return; // stay on step 2
            }

            const updatedCard = printspendingTransaction(id);
            ctx.replyWithMarkdown(
                '✅ Successfully updated!\n\n' + updatedCard + '\n\nChoose another field or press *✅ Done*:',
                {
                    reply_markup: {
                        keyboard: KB_EDIT_FIELDS,
                        resize_keyboard: true,
                        one_time_keyboard: true
                    }
                }
            );

            return ctx.wizard.back(); // back to step 1 for next selection
        }
    );
}
