# Vira Bot — Telegram Personal Finance Manager

A **Google Apps Script-based Telegram bot** for tracking personal spending and income, with AI-assisted natural language processing and receipt OCR.

## Overview

**Vira** is a personal finance bot that runs on Google Apps Script and integrates with Telegram. Users can:

- 💸 Log spending/income via text commands, hashtag shortcuts, or natural language
- 📸 Extract receipt data from photos using OpenAI Vision OCR
- 📊 View spending reports by date range or category
- 🔍 Search transactions by name
- 🤖 Use AI-powered natural language interpretation (OpenAI GPT-4o-mini)
- 🏦 Track which account/wallet was used per transaction (BCA, DANA, GoPay, Cash, etc.)
- 🔖 Bookmark URLs and manage transaction metadata
- ✏️ Edit or delete transactions after creation

All data is stored in a **Google Spreadsheet** via the **miniSheetDB2** library.

---

## Architecture

### Message Flow

```
Telegram User Message
        │
        ▼
code.js::doPost()   ◄── Webhook entry point
        │
        ├─── Slash commands  ──► Direct handler (no AI)
        │    /start, /help, /quote, /update
        │
        ├─── Hashtag shortcuts ──► Direct handler (no AI)
        │    #Spending, #Income, #Delete, #Update
        │
        ├─── Menu buttons (wizard) ──► stage.enter(scene)
        │    View Spending, Find Transaction,
        │    Add Spending, Add Income, Settings
        │
        ├─── Photo message ──► ocrHandler.js
        │                          │
        │                          ▼
        │                    OpenAI Vision → text
        │                          │
        └─── Natural language ──► aiMessageHandler.js
                                       │
                                  ai/openAi.js
                                  parseUserMessage()
                                  → {intent, payload}
                                       │
                                  ai/intentMapper.js
                                  executeIntent()
                                       │
                                  core/ functions
                                       │
                              Google Spreadsheet
```

### Key Components

| Component | File | Purpose |
|-----------|------|---------|
| **Entry Point** | `code.js` | Webhook receiver; initializes bot and delegates to handlers |
| **Config** | `config.js` | Bot configuration constants |
| **Message Router** | `bot/handler.js` | Routes Telegram messages to handlers, wizards, or AI |
| **AI Parser** | `ai/openAi.js` | Calls GPT-4o-mini to parse natural language → `{intent, payload}` |
| **Intent Mapper** | `ai/intentMapper.js` | Translates AI intents into core function calls |
| **Business Logic** | `core/spending.js` | Add/delete/update transactions; no validation or direct DB access |
| **Validation** | `core/validator.js` | Validates all inputs before business logic runs |
| **DB Queries** | `core/dbHandlers.js` | Read operations, search, and response formatting |
| **DB Init** | `core/dbInit.js` | Initializes all miniSheetDB2 instances |
| **Category Logic** | `core/categoryLogic.js` | Category, tag, and account lookup logic |
| **OCR Handler** | `bot/ocrHandler.js` | Downloads and encodes photo, calls OpenAI Vision |
| **Wizard Stage** | `bot/wizard/initWizardStage.js` | Registers all multi-step wizards |
| **UI — Messages** | `bot/ui/message.js` | All `MSG_*` text templates |
| **UI — Keyboards** | `bot/ui/keyboard.js` | All `KB_*` keyboard layout definitions |

---

## Folder Structure

```
vira-bot/
├── code.js                       # Webhook entry point (doPost)
├── config.js                     # Bot constants and configuration
├── openAi.js                     # Root stub → delegates to ai/openAi.js
├── debug.js                      # Root stub → delegates to utils/debug.js
├── appsscript.json               # Apps Script manifest
├── sidebar.html                  # Sidebar UI for bot configuration
├── sidebar-style.html
├── sidebar-script.html
│
├── ai/
│   ├── openAi.js                 # OpenAI API client (GPT-4o-mini)
│   ├── intentMapper.js           # Maps intent → core function call
│   └── gemini.js                 # Gemini API client (category fallback)
│
├── bot/
│   ├── handler.js                # Message router; registers all handlers
│   ├── aiMessageHandler.js       # Bridge between handler and AI layer
│   ├── ocrHandler.js             # Photo → OCR → structured text
│   ├── webhook.js                # Bot setup (token, webhook registration)
│   ├── system/
│   │   ├── botStartcommand.js    # /start handler
│   │   ├── botStatuscommand.js   # /status handler
│   │   └── botSettingscommand.js # /settings handler
│   ├── wizard/
│   │   ├── initWizardStage.js        # Registers all wizards into Stage
│   │   ├── viewSpendingWizard.js     # View spending by date range
│   │   ├── findTransactionWizard.js  # Search transactions by name
│   │   └── wizardTest.js             # Wizard testing utility
│   └── ui/
│       ├── message.js            # MSG_* text response templates
│       └── keyboard.js           # KB_* keyboard layout definitions
│
├── core/
│   ├── spending.js               # Write operations: add, delete, update
│   ├── dbHandlers.js             # Read operations, search, formatting
│   ├── validator.js              # Input validation rules
│   ├── categoryLogic.js          # Category, tag, and account lookup
│   ├── dbInit.js                 # miniSheetDB2 instance initialization
│   ├── credentials.js            # API credential management
│   ├── setup.js                  # User onboarding and config
│   └── spreadsheets/
│       ├── dbFunction.js         # Card builders, print functions
│       └── appendSheets.js       # Positional sheet append helper
│
├── skills/
│   ├── finance_assistant/
│   │   ├── addSpendingWizard.js             # Wizard: add spending
│   │   ├── addIncomeWizard.js               # Wizard: add income
│   │   ├── editTransactionWizard.js         # Wizard: edit transaction fields
│   │   ├── settingdefaultCategorywizard.js  # Wizard: set default category + account
│   │   ├── addTransactioncommands.js        # Hashtag add handlers (#Spending, #Income)
│   │   ├── viewTransactioncommand.js        # View transaction command
│   │   ├── deleteTransactioncommand.js      # Delete transaction command
│   │   ├── updateTransactioncommand.js      # Update transaction fields
│   │   ├── dailyReport.js                   # Daily report skill
│   │   └── function/
│   │       └── dbFunction.js                # Finance-specific DB helpers
│   ├── daily_calendar/
│   │   └── dailyCalendar.js      # Daily calendar skill
│   ├── bookmarks_assistant/
│   │   ├── addBookmarks.js       # Save URL bookmarks
│   │   └── viewBookmarks.js      # List saved bookmarks
│   └── wordpress/
│       └── getPost.js            # WordPress integration
│
└── utils/
    ├── debug.js                  # Development testing utilities
    └── debugdb.js                # Database inspection utilities
```

---

## Database Schema

### Transactions Sheet

| Col | Field | Description |
|-----|-------|-------------|
| A | ID | 4-char unique transaction ID |
| B | Date | `dd MMMM yyyy` (e.g. `06 June 2026`) |
| C | Name | Transaction / expense name |
| D | Type | `spending` or `income` |
| E | Category | e.g. `Food and Drink`, `Transport` |
| F | Amount | Integer (IDR) |
| G | Tag | Optional tag label |
| H | Account | Wallet/account used — default `Cash` |
| I | Note | Optional note |

### Query Sheet (Category Lookup Table)

| Col | Field | Description |
|-----|-------|-------------|
| A | Query | Keyword to match against transaction name |
| B | Cat | Default category |
| C | Tag | Default tag |
| D | Notes | Optional notes |
| E | Account | Default account/wallet for this query |

When a new transaction is saved, the bot looks up the transaction name in the Query sheet. If matched, category, tag, and **account** are auto-filled. If not matched, Gemini AI predicts category/tag and account defaults to `Cash`.

---

## Features

### Main Menu

```
💸 Add Spending   |  💰 Add Income
📊 View Spending  |  📈 View Income
     🔍 Find Transaction
   ❓ Help  |  ⚙️ Settings
```

### Spending / Income Card

Every saved transaction shows a card with Edit/Delete inline buttons:

```
📅 Record date: 06 June 2026
🎲 Transaction ID: `a1b2`
🐳 Expenses Name: Kopi Kenangan
💰 Amount: Rp25,000
😼 Category: Food and Drink
🔖 Tag: Coffee
🏦 Account: Cash
📝 Note:
```

### Hashtag Shortcuts

Direct execution with no AI:

```
#Spending {name} {amount}           → Log expense
#Income {name} {amount}             → Log income
#Delete {id}                        → Delete transaction by ID
#Update {id} -cat "Category"        → Update category
#Update {id} -tag "Tag"             → Update tag
#Update {id} -amount "Amount"       → Update amount
#Update {id} -note "Note"           → Update note
#Update {id} -account "Account"     → Update account/wallet
#Transactions {days}                → View last N days of transactions
```

### Add Default Category (Settings → Add Default Category)

Save a default category, tag, and account for a transaction keyword so future transactions are auto-categorized:

```
# One-liner format:
Kopi category: Food and Drink account: Cash
Gojek category: Transport account: GoPay
Spotify category: Entertainment account: BCA

# Step-by-step: enter name → category → account (or '-' to skip)
```

Once saved in the Query DB, any transaction whose name matches the keyword will auto-fill category, tag, and account.

### Natural Language (AI)

```
User:  "Beli kopi 15000"
AI:    { intent: "ADD_SPENDING", payload: { expenseName: "kopi", amount: 15000 } }

User:  "Show spending last 7 days"
AI:    { intent: "GET_REPORT", payload: { startDate: "...", endDate: "..." } }

User:  "Delete transaction a1b2"
AI:    { intent: "DELETE_TRANSACTION", payload: { transactionId: "a1b2" } }
```

### Receipt OCR (Photo)

Send a photo of a receipt → bot extracts merchant name and amount → auto-records as spending.

---

## Account / Wallet Tracking

The `Account` field tracks which payment method was used for each transaction.

**Default value:** `Cash`

**Priority (highest to lowest):**
1. Saved in Query DB for the matched transaction name
2. `Cash` (fallback when no Query DB match or Gemini prediction)

**Supported via:**
- Wizard (Add Spending / Add Income)
- Hashtag shortcuts (`#Spending`, `#Income`)
- Query DB (auto-fill from default category settings)
- Gemini category save prompt (saves account to Query DB when user taps ✅ Yes)
- `#Update {id} -account "BCA"` to update after the fact

---

## Setup

### Required Project Properties (Apps Script)

| Property | Description |
|----------|-------------|
| `TOKEN_BOT` | Telegram Bot API token |
| `OPENAI_API_KEY` | OpenAI API key |
| `ALLOWED_CHAT_IDS` | Comma-separated authorized Telegram user IDs |

### Deployment Steps

1. Open the connected Google Spreadsheet
2. Go to **Extensions → Apps Script**
3. Deploy as **Web App** (Execute as: Me, Access: Anyone)
4. Copy the deployment URL
5. From the spreadsheet menu: **Telegram Bot → Settings → Input Token Bot**
6. Then: **Telegram Bot → Settings → Set Webhook** (paste deployment URL)

### Spreadsheet Sheets Required

| Sheet | Purpose |
|-------|---------|
| `Transactions` | All spending and income records (9 columns: A–I) |
| `Query` | Category, tag, and account lookup table (5 columns: A–E) |
| `⚙️Setting` | Bot configuration |
| `Bookmark` | Saved URLs |
| `Log` | User activity log |

---

## Development Guide

### Adding a New Command

1. Add handler to `bot/handler.js::setupMessageRouters()`:
   ```javascript
   bot.hears(/my trigger/i, handleMyCommand);
   ```
2. Define the handler function (with access control):
   ```javascript
   function handleMyCommand(ctx) {
       if (!isUserAllowed(ctx.from.id)) { ctx.reply(MSG_REJECT); return; }
       // logic here
   }
   ```
3. Use `bot/ui/message.js` for text, `bot/ui/keyboard.js` for keyboards.
4. Never access the DB directly from handler — call `core/` functions.

### Adding a New Wizard

1. Create `skills/finance_assistant/myFeatureWizard.js` with `createMyFeatureWizard(Scene)`
2. Register it in `bot/wizard/initWizardStage.js`
3. Add entry point in `bot/handler.js`:
   ```javascript
   bot.hears(/my trigger/i, (ctx) => stage.enter('my_scene'));
   ```

### Adding a New AI Intent

1. Add intent case to `ai/intentMapper.js::executeIntent()`
2. Update system prompt in `ai/openAi.js` to teach the model the new intent
3. Add business logic in `core/spending.js` or a new `core/` file
4. Add response template in `bot/ui/message.js`

### Separation of Concerns

| Layer | Write? | Read? | Validate? | Format? |
|-------|--------|-------|-----------|---------|
| `core/spending.js` | ✅ | — | — | — |
| `core/dbHandlers.js` | — | ✅ | — | ✅ |
| `core/validator.js` | — | — | ✅ | — |
| `bot/handler.js` | — | — | — | — |
| `ai/intentMapper.js` | — | — | — | — |

---

## Known Limitations

- Timezone hardcoded to **GMT+7**
- No duplicate transaction detection
- No rate limiting on AI/API calls
- AI response latency ~1–2 seconds per message
- OCR only handles JPG/PNG (no PDF)
- Receipt parsing prompt not optimized for non-English receipts

---

## Tech Stack

| Aspect | Technology |
|--------|-----------|
| Platform | Google Apps Script (V8 runtime) |
| Bot Framework | lumpia |
| Scene Management | WizardDua |
| Database | Google Spreadsheet + miniSheetDB2 |
| AI / NLP | OpenAI GPT-4o-mini |
| Category Fallback | Google Gemini |
| Vision / OCR | OpenAI Vision |
| Deployment | Apps Script Web App (webhook) |
| Language | JavaScript |

---

## Credits

- **Author:** Syahid Muhammad
- **Framework:** lumpia, WizardDua, miniSheetDB2
