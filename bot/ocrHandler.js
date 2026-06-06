/**
 * =============================================================================
 * bot/ocrHandler.js (PHASE 2.6 - OpenAI Vision OCR - Receipt Parsing)
 * =============================================================================
 * 
 * RESPONSIBILITY: 
 * Handle photo messages and extract text via OCR
 * Uses OpenAI Vision to extract receipt data
 * 
 * WORKFLOW:
 * 1. Receive photo message from handler.js
 * 2. Extract photo file_id from Telegram
 * 3. Download image file via Telegram API
 * 4. Convert to base64 and detect MIME type
 * 5. Send to OpenAI Vision (gpt-4o-mini) with receipt parsing prompt
 * 6. Extract command text and confidence score
 * 7. Return structured result for AI handler
 * 
 * SCOPE:
 * - Receipt OCR and parsing
 * - Extracts merchant name and amount
 * - Returns JSON with text command and confidence score
 * - Integrates with AI command pipeline
 * 
 * INTEGRATION:
 * Called from: bot/handler.js → handlePhotoMessage()
 * Sends to: handleUpdate() via AI pipeline
 * 
 * =============================================================================
 */

/**
 * Handle photo message — parse receipt items and save each as a spending transaction.
 */
function handlePhotoMessage(ctx, photoFileId) {
    const chatID = ctx.from?.id;

    if (!isUserAllowed(chatID)) {
        ctx.reply(MSG_REJECT);
        return;
    }

    try {
        if (!photoFileId) {
            ctx.reply("❌ Foto tidak terdeteksi. Coba kirim ulang ya.");
            return;
        }

        ctx.reply("📸 Foto diterima. Sedang dianalisis struk...");
        Logger.log(`📸 OCR started for user ${chatID}, file_id: ${photoFileId}`);

        const result = askOpenAIReceiptItems(photoFileId);

        Logger.log("===== RECEIPT ITEMS (AI) =====");
        Logger.log("confidence: " + result.confidence);
        Logger.log("items: " + JSON.stringify(result.items));

        if (result.confidence < 0.3) {
            ctx.reply("📸 Struk kurang jelas terbaca. Coba foto ulang dengan pencahayaan lebih baik dan pastikan teks terlihat jelas.");
            return;
        }

        if (!result.items || result.items.length === 0) {
            ctx.reply("⚠️ Tidak ada item yang berhasil terbaca dari struk.");
            return;
        }

        // Save each item and collect results
        const TZ = "GMT+7";
        const savedDate = Utilities.formatDate(new Date(), TZ, "dd MMMM yyyy");
        const db = getDbTransactions();

        const saved = [];
        const failed = [];

        for (const item of result.items) {
            const name = String(item.name || "").trim();
            const amount = Number(item.amount) || 0;

            if (!name || amount <= 0) {
                Logger.log(`⚠️ Skipping invalid item: ${JSON.stringify(item)}`);
                failed.push(name || "?");
                continue;
            }

            try {
                const id = generateUniqueTransactionID();
                const { category, tag, note } = findcatTransaction(name);

                const payload = {
                    ID: id,
                    Date: savedDate,
                    Name: name,
                    Type: "spending",
                    Category: category !== "Not Found" ? category : "Uncategorized",
                    Amount: amount,
                    Tag: tag || "",
                    Account: "",
                    Note: note || ""
                };

                appendSheets(db, payload);
                saved.push({ id, name, amount });
                Logger.log(`✅ Saved: ${name} — Rp${amount} [${id}]`);

            } catch (err) {
                Logger.log(`❌ Failed to save "${name}": ${err.message}`);
                failed.push(name);
            }
        }

        if (saved.length === 0) {
            ctx.reply("❌ Semua item gagal dicatat. Coba kirim ulang foto yang lebih jelas.");
            return;
        }

        ctx.replyWithMarkdown(buildReceiptSummaryCard(saved, failed, savedDate), {
            reply_markup: {
                keyboard: KB_MAIN_MENU,
                resize_keyboard: true,
                one_time_keyboard: true
            }
        });

    } catch (e) {
        Logger.log("❌ Error photo->OCR: " + e.message);
        Logger.log("   Stack: " + e.stack);
        ctx.reply("❌ Gagal memproses struk. Coba kirim ulang foto yang lebih jelas.");
    }
}

/**
 * Build a combined summary card for all saved receipt items.
 *
 * @param {Array<{id, name, amount}>} saved
 * @param {string[]} failed - item names that could not be saved
 * @param {string} date - formatted date string
 * @return {string} Markdown message
 */
function buildReceiptSummaryCard(saved, failed, date) {
    const total = saved.reduce((sum, t) => sum + t.amount, 0);
    const formattedTotal = new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0
    }).format(total);

    let msg = `✅ *Success recorded — ${saved.length} item*\n`;
    msg += `📅 ${date}\n\n`;
    msg += "```\n";

    for (const t of saved) {
        const id = t.id.padEnd(4);
        const name = t.name.slice(0, 18).padEnd(18);
        const amount = new Intl.NumberFormat("en-US").format(t.amount).padStart(10);
        msg += `${id} | ${name} | ${amount}\n`;
    }

    msg += "```\n";
    msg += `\n💰 *Total: ${formattedTotal}*`;

    if (failed.length > 0) {
        msg += `\n\n⚠️ Failed to record: ${failed.join(", ")}`;
    }

    return msg;
}

/**
 * Convert Telegram file_id to base64 with MIME type detection
 */
function telegramFileIdToBase64(fileId) {
    const tokenBot = PropertiesService.getScriptProperties().getProperty("TELEGRAM_BOT_TOKEN");

    if (!tokenBot) {
        throw new Error("TELEGRAM_BOT_TOKEN not configured");
    }

    // 1) Get file_path from Telegram
    const getFileUrl = `https://api.telegram.org/bot${tokenBot}/getFile?file_id=${encodeURIComponent(fileId)}`;
    const getRes = UrlFetchApp.fetch(getFileUrl);
    const getJson = JSON.parse(getRes.getContentText());

    if (!getJson.ok) {
        throw new Error("Telegram getFile failed: " + getRes.getContentText());
    }

    // 2) Download file
    const filePath = getJson.result.file_path || "";
    const downloadUrl = `https://api.telegram.org/file/bot${tokenBot}/${filePath}`;
    const blob = UrlFetchApp.fetch(downloadUrl).getBlob();

    // 3) Convert bytes to base64
    const base64 = Utilities.base64Encode(blob.getBytes());

    // 4) Detect MIME type from file extension
    let mimeType = "image/jpeg"; // Default: Telegram photos are usually jpg
    const lower = filePath.toLowerCase();
    if (lower.endsWith(".png")) mimeType = "image/png";
    else if (lower.endsWith(".webp")) mimeType = "image/webp";
    else if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) mimeType = "image/jpeg";

    Logger.log("Telegram file_path: " + filePath);
    Logger.log("Blob size: " + blob.getBytes().length + " bytes");
    Logger.log("Detected mimeType: " + mimeType);

    return { base64, mimeType, filePath };
}

/**
 * Ask OpenAI Vision to parse a receipt image and return a list of line items.
 *
 * @param {string} fileId - Telegram file_id
 * @return {{ items: Array<{name: string, amount: number}>, confidence: number }}
 */
function askOpenAIReceiptItems(fileId) {
    const apiKey = PropertiesService.getScriptProperties().getProperty("OPENAI_API_KEY");
    if (!apiKey) throw new Error("OPENAI_API_KEY not configured");

    const { base64, mimeType } = telegramFileIdToBase64(fileId);

    const systemPrompt = `You are a receipt parser for a personal finance bot.

Extract every purchased item from the receipt image.
Return ONLY valid JSON in this exact format:
{
  "items": [
    { "name": "Item Name", "amount": 15000 },
    { "name": "Another Item", "amount": 8000 }
  ],
  "confidence": 0.95
}

Rules:
- List every individual item — do NOT sum them into one total.
- "name" must be the item name (short, in the receipt's language).
- "amount" is the item's price as a plain integer (no currency symbol, no separators).
- If an item has quantity (e.g. 2x Aqua 4000), multiply and list as one entry with combined amount.
- Ignore subtotals, taxes, service charges, and grand total rows.
- confidence: 0–1 (how clearly the receipt was read).
- If the image is not a receipt or unreadable, return: { "items": [], "confidence": 0 }`;

    const payload = {
        model: "gpt-4o-mini",
        temperature: 0,
        messages: [
            { role: "system", content: systemPrompt },
            {
                role: "user",
                content: [
                    { type: "text", text: "Parse all items from this receipt." },
                    { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64}` } }
                ]
            }
        ]
    };

    const res = UrlFetchApp.fetch("https://api.openai.com/v1/chat/completions", {
        method: "post",
        contentType: "application/json",
        headers: { Authorization: "Bearer " + apiKey },
        payload: JSON.stringify(payload),
        muteHttpExceptions: true
    });

    const code = res.getResponseCode();
    const body = res.getContentText();
    Logger.log("OpenAI response code: " + code);

    if (code < 200 || code >= 300) {
        throw new Error("OpenAI error " + code + ": " + body);
    }

    const json = JSON.parse(body);
    let out = (json.choices?.[0]?.message?.content || "").trim();
    out = out.replace(/```json/i, "").replace(/```/g, "").trim();

    Logger.log("OpenAI raw response: " + out.substring(0, 500));

    const parsed = JSON.parse(out);
    parsed.confidence = Number(parsed.confidence || 0);
    parsed.items = Array.isArray(parsed.items) ? parsed.items : [];

    return parsed;
}

/**
 * Run this directly from Apps Script editor to test OpenAI Vision connectivity.
 * Does NOT need a real Telegram photo — uses a hardcoded 1x1 JPEG.
 */
function debugTestOCR() {
    Logger.log("=== DEBUG: OpenAI Vision OCR Test ===");

    const apiKey = PropertiesService.getScriptProperties().getProperty("OPENAI_API_KEY");
    if (!apiKey) {
        Logger.log("❌ OPENAI_API_KEY is not set in Script Properties!");
        return;
    }
    Logger.log("✅ OPENAI_API_KEY found, length: " + apiKey.length);

    // Minimal 1x1 white JPEG (valid image, smallest possible)
    const minimalJpeg = "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAAARCAABAAEDASIAAhEBAxEB/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/xAAUAQEAAAAAAAAAAAAAAAAAAAAA/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8AJQAB/9k=";

    const TZ = "GMT+7";
    const today = Utilities.formatDate(new Date(), TZ, "yyyy-MM-dd");

    const systemPrompt = `You generate a SINGLE text command for a Telegram finance bot from a receipt image.
Today's date is ${today} (GMT+7).
Return ONLY valid JSON:
{"text": "#Spending <expenseName> <amount>", "confidence": 0-1}
Rules:
- If cannot read receipt, return confidence 0 with placeholder text "#Spending Struk 0"`;

    const payload = {
        model: "gpt-4o-mini",
        temperature: 0,
        messages: [
            { role: "system", content: systemPrompt },
            {
                role: "user",
                content: [
                    { type: "text", text: "Read this receipt image and output the command JSON." },
                    { type: "image_url", image_url: { url: "data:image/jpeg;base64," + minimalJpeg } }
                ]
            }
        ]
    };

    try {
        const res = UrlFetchApp.fetch("https://api.openai.com/v1/chat/completions", {
            method: "post",
            contentType: "application/json",
            headers: { Authorization: "Bearer " + apiKey },
            payload: JSON.stringify(payload),
            muteHttpExceptions: true
        });

        const code = res.getResponseCode();
        const body = res.getContentText();
        Logger.log("HTTP status: " + code);
        Logger.log("Response body: " + body.substring(0, 500));

        if (code !== 200) {
            const errBody = JSON.parse(body);
            const errCode = errBody?.error?.code;
            if (errCode === "image_parse_error") {
                Logger.log("✅ API key valid & reachable. Test image too small — this is expected.");
                Logger.log("=== API CONNECTION OK — test with a real Telegram file_id below ===");
            } else if (code === 401) {
                Logger.log("❌ API key invalid or expired.");
            } else {
                Logger.log("❌ OpenAI error " + code + ": " + errBody?.error?.message);
            }
            return;
        }

        const json = JSON.parse(body);
        let out = (json.choices?.[0]?.message?.content || "").trim();
        out = out.replace(/```json/i, "").replace(/```/g, "").trim();
        Logger.log("✅ OpenAI Vision responded: " + out);

        const parsed = JSON.parse(out);
        Logger.log("✅ Parsed OK — text: " + parsed.text + ", confidence: " + parsed.confidence);
        Logger.log("=== TEST PASSED ===");

    } catch (e) {
        Logger.log("❌ Exception: " + e.message);
        Logger.log("   Stack: " + e.stack);
    }
}

/**
 * Test OCR with a real Telegram photo.
 * 1. Send any photo to the bot in Telegram
 * 2. The bot will log the file_id — copy it from Apps Script logs
 * 3. Paste the file_id below and run this function
 */
function debugTestOCRWithRealPhoto() {
    const FILE_ID = "PASTE_FILE_ID_HERE"; // ← ganti dengan file_id dari log bot

    if (FILE_ID === "PASTE_FILE_ID_HERE") {
        Logger.log("⚠️  Set FILE_ID dulu! Kirim foto ke bot, copy file_id dari log, paste di sini.");
        return;
    }

    Logger.log("=== DEBUG: OCR with real Telegram photo ===");
    Logger.log("file_id: " + FILE_ID);

    try {
        const { base64, mimeType, filePath } = telegramFileIdToBase64(FILE_ID);
        Logger.log("✅ Download OK — path: " + filePath + ", mimeType: " + mimeType + ", size: " + base64.length + " chars");

        const result = askOpenAIReceiptItems(FILE_ID);
        Logger.log("✅ OCR result — confidence: " + result.confidence);
        Logger.log("✅ Items: " + JSON.stringify(result.items));

    } catch (e) {
        Logger.log("❌ Error: " + e.message);
        Logger.log("   Stack: " + e.stack);
    }
}
