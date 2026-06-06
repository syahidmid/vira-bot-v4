/**
 * Wizard: Find Transaction by Name
 * STEP 1: Ask user to type a keyword
 * STEP 2: Search DB, display up to 5 matching spending transactions
 */
function createFindTransactionWizard(Scene) {
    return new Scene(
        'find_transaction',

        /**
         * STEP 1 — Ask for search keyword
         */
        (ctx) => {
            ctx.data = {};

            ctx.reply(
                '🔍 *Find Transaction by Name*\n\n' +
                'Type a keyword to search.\n' +
                'Example: `nasi kuning`',
                {
                    parse_mode: 'Markdown',
                    reply_markup: {
                        keyboard: KB_CANCEL,
                        resize_keyboard: true,
                        one_time_keyboard: true
                    }
                }
            );

            return ctx.wizard.next();
        },

        /**
         * STEP 2 — Run search and display results
         */
        (ctx) => {
            const raw = (ctx.message?.text || '').trim();

            if (!raw) {
                ctx.reply('Please type a keyword to search.');
                return;
            }

            if (raw.toLowerCase() === 'cancel' || raw.includes('❌')) {
                ctx.reply('Cancelled.', {
                    reply_markup: {
                        keyboard: KB_MAIN_MENU,
                        resize_keyboard: true,
                        one_time_keyboard: true
                    }
                });
                return ctx.wizard.leave();
            }

            try {
                const results = findTransactionsByName(raw, 5);

                if (!results) {
                    ctx.reply(
                        `No transactions found matching *"${raw}"*.`,
                        {
                            parse_mode: 'Markdown',
                            reply_markup: {
                                keyboard: KB_MAIN_MENU,
                                resize_keyboard: true,
                                one_time_keyboard: true
                            }
                        }
                    );
                    return ctx.wizard.leave();
                }

                const TZ = 'GMT+7';
                let table = '```\n';
                table += 'Date     | Name           | Amount    \n';
                table += '---------|----------------|----------\n';

                for (const t of results) {
                    const date = Utilities
                        .formatDate(new Date(t.date), TZ, 'dd/MM/yy')
                        .padEnd(8);
                    const name = t.expenseName.slice(0, 14).padEnd(14);
                    const amount = new Intl.NumberFormat('en-US')
                        .format(t.amount)
                        .padStart(10);
                    table += `${date} | ${name} | ${amount}\n`;
                }

                table += '```';

                ctx.replyWithMarkdown(
                    `🔍 Results for *"${raw}"* (last ${results.length}):\n\n${table}`,
                    {
                        parse_mode: 'Markdown',
                        reply_markup: {
                            keyboard: KB_MAIN_MENU,
                            resize_keyboard: true,
                            one_time_keyboard: true
                        }
                    }
                );

            } catch (err) {
                Logger.log('❌ FindTransaction STEP2 error: ' + err.message);
                ctx.reply('❌ Failed to search transactions.', {
                    reply_markup: {
                        keyboard: KB_MAIN_MENU,
                        resize_keyboard: true,
                        one_time_keyboard: true
                    }
                });
            }

            return ctx.wizard.leave();
        }
    );
}
