/**
 * Helper function: Format empty report message with smart UX
 * 
 * @param {Object} params - Configuration object
 * @param {string} params.isToday - Boolean: true if request is for 'today' (single day mode)
 * @param {string} params.startDate - Start date in YYYY-MM-DD format
 * @param {string} params.endDate - End date in YYYY-MM-DD format
 * @param {string} params.locale - Language locale ('id' for Indonesia, 'en' for English)
 * @return {string} - Formatted empty report message
 */
function formatEmptyReportMessage(params = {}) {
  const { isToday = false, startDate, endDate, locale = 'id' } = params;

  // If request is for 'today' and single day → short message only
  if (isToday && startDate === endDate) {
    if (locale === 'id') {
      return "Belum ada transaksi hari ini.";
    } else {
      return "No transactions for today.";
    }
  }

  // For other date ranges → include range info
  if (locale === 'id') {
    if (startDate === endDate) {
      // Single day but NOT 'today' mode (user requested specific date)
      return `Tidak ada transaksi pada ${startDate}.`;
    } else {
      // Multi-day range
      return `Tidak ada transaksi pada ${startDate} s/d ${endDate}.`;
    }
  } else {
    if (startDate === endDate) {
      return `No transactions on ${startDate}.`;
    } else {
      return `No transactions between ${startDate} and ${endDate}.`;
    }
  }
}

function getRecentSpending(rowCount) {
  const dbTransactions = getDbTransactions();
  const lastRow = dbTransactions.last_row;
  const startRow = Math.max(2, lastRow - rowCount + 1);
  const numRows = lastRow - startRow + 1;

  if (numRows <= 0) return "";

  const data = dbTransactions
    .range(startRow, 2, numRows, 5)
    .getValues()
    .filter(row => row[2] === "spending") // D = index 2
    .sort((a, b) => new Date(a[0]) - new Date(b[0])); // sort by date (B = index 0)

  if (data.length === 0) return "";

  let table = "```\n";
  table += "Date     | Expense        | Amount    \n";
  table += "---------|----------------|-----------\n";

  let totalSpending = 0;

  for (let i = 0; i < data.length; i++) {
    const dateObj = new Date(data[i][0]); // B = date
    const formattedDate = Utilities
      .formatDate(dateObj, "GMT+7", "dd/MM/yy")
      .padEnd(8);

    const expenseName = data[i][1] // C = name
      .toString()
      .slice(0, 14)
      .padEnd(14);

    const amount = Number(data[i][4]) || 0; // F = amount
    const formattedAmount = new Intl.NumberFormat("en-US")
      .format(amount)
      .padEnd(10);

    table += `${formattedDate} | ${expenseName} | ${formattedAmount}\n`;
    totalSpending += amount;
  }

  const formattedTotal = new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0
  }).format(totalSpending);

  table += "---------|----------------|-----------\n";
  table += `Total    |                | ${formattedTotal}\n`;
  table += "```";

  return table;
}

function processSpendingByDateRange(daysAgo) {
  const TZ = "GMT+7";

  let data = getDataByDateRange(Math.max(daysAgo, 2));

  const toYMD = (d) => Utilities.formatDate(new Date(d), TZ, "yyyy-MM-dd");

  const today = new Date();
  const todayYMD = toYMD(today);

  let targetYMD = todayYMD;
  if (daysAgo === 1) {
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    targetYMD = toYMD(yesterday);
  }

  if (daysAgo === 1) {
    data = (data || []).filter(row =>
      toYMD(row[0]) === targetYMD &&
      row[2] === "spending" // ✅ kolom D = type
    );
  } else {
    const start = toYMD(new Date(Date.now() - (daysAgo - 1) * 86400000));
    const endDate = new Date(today);
    endDate.setDate(today.getDate() - 1);
    const endYMD = toYMD(endDate);
    data = (data || []).filter(row => {
      const ymd = toYMD(row[0]);
      return ymd >= start && ymd <= endYMD &&
        row[2] === "spending"; // ✅ kolom D = type
    });
  }

  if (!data || data.length === 0) {
    return { error: `No spending transactions found in the last ${daysAgo} day(s).` };
  }

  let response = "```\n";
  response += "Date     | Expense        | Amount    \n";
  response += "---------|----------------|-----------\n";

  let totalSpending = 0;

  for (let i = 0; i < data.length; i++) {
    const formattedDate = Utilities
      .formatDate(new Date(data[i][0]), TZ, "dd/MM/yy") // [0] = date
      .padEnd(8);

    const expenseName = data[i][1]  // [1] = name
      .toString()
      .slice(0, 14)
      .padEnd(14);

    const amount = Number(data[i][4]) || 0; // [4] = amount
    const formattedAmount = new Intl.NumberFormat("en-US")
      .format(amount)
      .replace(/\.\d+$/, "")
      .padStart(10);

    response += `${formattedDate} | ${expenseName} | ${formattedAmount}\n`;
    totalSpending += amount;
  }

  const formattedTotalSpending = new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0
  }).format(totalSpending);

  response += `\nTotal Spending: ${formattedTotalSpending}\n`;
  response += "```";

  return { response };
}

function processSpendingByCustomDateRange(startDateStr, endDateStr) {
  const TZ = "GMT+7";

  Logger.log("=== [DEBUG] START processSpendingByCustomDateRange ===");
  Logger.log(`Raw input -> startDateStr: ${startDateStr}, endDateStr: ${endDateStr}`);

  const startDate = new Date(startDateStr);
  const endDate = new Date(endDateStr);

  Logger.log(`Parsed Dates -> startDate: ${startDate}, endDate: ${endDate}`);

  if (isNaN(startDate) || isNaN(endDate)) {
    Logger.log("[ERROR] Invalid date format");
    return { error: "Invalid date format. Expected 'YYYY-MM-DD' or 'DD/MM/YYYY'." };
  }

  if (startDate > endDate) {
    Logger.log("[ERROR] Start date is later than end date");
    return { error: "The start date cannot be later than the end date." };
  }

  const dayDiff = Math.ceil((endDate - startDate) / 86400000) + 1;
  Logger.log(`Date difference (dayDiff): ${dayDiff}`);

  let data = getDataByDateRange(Math.max(dayDiff, 2));
  Logger.log(`Raw data count: ${data ? data.length : 0}`);

  const toYMD = (d) => {
    const dateObj = new Date(d);
    if (isNaN(dateObj)) {
      Logger.log(`[WARN] Invalid date in data: ${d}`);
      return null;
    }
    dateObj.setHours(dateObj.getHours() + 12);
    return Utilities.formatDate(dateObj, TZ, "yyyy-MM-dd");
  };

  const startYMD = toYMD(startDate);
  const endYMD = toYMD(endDate);

  Logger.log(`Filtering range from ${startYMD} to ${endYMD}`);

  const filtered = (data || []).filter(row => {
    const rawDate = row[0]; // ✅ [0] = date
    const type = row[2];    // ✅ [2] = type (kolom D)
    const ymd = toYMD(rawDate);
    const inRange = ymd && ymd >= startYMD && ymd <= endYMD && type === "spending"; // ✅ filter type

    if (!inRange) {
      Logger.log(`[SKIP] ${rawDate} (${ymd}) - type: ${type}`);
    } else {
      Logger.log(`[KEEP] ${rawDate} (${ymd}) - type: ${type}`);
    }
    return inRange;
  });

  Logger.log(`Filtered data count: ${filtered.length}`);

  if (!filtered || filtered.length === 0) {
    Logger.log(`[RESULT] No spending found between ${startYMD} and ${endYMD}`);
    Logger.log("=== [DEBUG END] ===");
    return { error: `No spending transactions found between ${startYMD} and ${endYMD}.` };
  }

  let response = "```\n";
  response += "Date     | Expense        | Amount    \n";
  response += "---------|----------------|-----------\n";

  let totalSpending = 0;

  for (let i = 0; i < filtered.length; i++) {
    const formattedDate = Utilities
      .formatDate(new Date(filtered[i][0]), TZ, "dd/MM/yy") // ✅ [0] = date
      .padEnd(8);

    const expenseName = filtered[i][1] // ✅ [1] = name
      .toString()
      .slice(0, 14)
      .padEnd(14);

    const amount = Number(filtered[i][4]) || 0; // ✅ [4] = amount
    const formattedAmount = new Intl.NumberFormat("en-US")
      .format(amount)
      .replace(/\.\d+$/, "")
      .padStart(10);

    response += `${formattedDate} | ${expenseName} | ${formattedAmount}\n`;
    totalSpending += amount;
  }

  const formattedTotal = new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(totalSpending);

  response += `\nTotal Spending: ${formattedTotal}\n`;
  response += "```";

  Logger.log(`[RESULT] Total Spending: ${formattedTotal}`);
  Logger.log("=== [DEBUG END] ===");

  return { response };
}



/*
-----------------
*/

function setrecordSpending(transactionID, savedDate, expenseName, category, amount, tag, note) {
  var newRow = dbSpending.last_row + 1;
  var saveRecord = dbSpending.range(newRow, 2, 1, 7);
  var recordValues = [
    transactionID,
    savedDate,
    expenseName,
    category,
    amount,
    tag,
    note,
  ];

  var recordLogvalues = [
    chatingId,
    full_name,
    username,
    message,
    savedDate,
  ];

  try {

    saveRecord.setValues([recordValues]);
    return true;
  } catch (error) {
    console.error("Error while recording spending:", error);
    return false;
  }
}



function getDataByDateRange(daysAgo) {
  const dbTransactions = getDbTransactions(); // ✅ pakai getDbTransactions()
  const lastRow = dbTransactions.last_row;

  const startRow = 2;
  const data = dbTransactions
    .range(startRow, 2, lastRow - startRow + 1, 5)
    .getValues();

  const today = new Date();
  const dateThreshold = new Date(today);
  dateThreshold.setDate(today.getDate() - daysAgo);

  const filteredData = data.filter(row => {
    const transactionDate = new Date(row[0]); // ✅ [0] = date (kolom B)
    return transactionDate >= dateThreshold;
  });

  Logger.log(`Transactions in the last ${daysAgo} day(s):`);
  Logger.log(JSON.stringify(filteredData, null, 2));
  return filteredData;
}
function generateUniqueTransactionID() {
  const characters = "abcdefghijklmnopqrstuvwxyz0123456789";
  const idLength = 4;

  while (true) {
    let generatedID = "";
    for (let i = 0; i < idLength; i++) {
      const randomIndex = Math.floor(Math.random() * characters.length);
      generatedID += characters.charAt(randomIndex);
    }

    const existingData = getDbTransactions().key(generatedID);
    if (!existingData) {
      return generatedID;
    }
  }
}

/**
 * Generate a 4-char transaction ID using timestamp + random suffix.
 * Collision probability is negligible (requires two saves within same ms).
 * Does NOT read the database — use this instead of generateUniqueTransactionID()
 * when speed matters.
 */
function generateFastTransactionID() {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  const t = Date.now().toString(36);
  let r = "";
  for (let i = 0; i < 2; i++) {
    r += chars[Math.floor(Math.random() * chars.length)];
  }
  return (t.slice(-2) + r);
}



function listmaincommandFinance() {
  const commands = ["#Record", "#Update", "#Summary"];
  const formattedCommands = commands.map((command) => `- ${command}`).join("\n");
  return `> Here are the valid update commands:\n${formattedCommands}`;
}


var category = 'life';
function getQuote(category) {
  // Ganti YOUR_API_KEY dengan kunci API yang valid
  var apiKey = 'ihE8aAQyiP4Dj5d/rrUObA==7XBiHX40v1AMeFyv';

  // Periksa apakah kategori didefinisikan, jika tidak, berikan nilai default
  category = category || 'success';

  // URL endpoint API
  var apiUrl = 'https://api.api-ninjas.com/v1/quotes?category=' + category;

  // Konfigurasi opsi permintaan HTTP
  var options = {
    method: 'get',
    headers: {
      'X-Api-Key': apiKey
    }
  };

  try {
    // Lakukan permintaan HTTP
    var response = UrlFetchApp.fetch(apiUrl, options);

    // Mendapatkan konten respons dalam bentuk teks
    var responseText = response.getContentText();

    // Menangani respons JSON
    var result = JSON.parse(responseText);

    // Ekstrak dan log penulis (author) dan kutipan (quote)
    if (result.length > 0) {
      var randomIndex = Math.floor(Math.random() * result.length);
      var quote = result[randomIndex];
      var author = quote.author;
      var quoteText = quote.quote;

      // Mengembalikan string HTML dengan kutipan dan penulis dalam format yang diinginkan
      return '<i>"' + quoteText + '"</i><br/><strong>- ' + author + '</strong>';
    } else {
      return 'Tidak ada kutipan ditemukan untuk kategori: ' + category;
    }
  } catch (error) {
    // Menangani kesalahan
    return '<p>Error: ' + error + '</p>';
  }
}

function schedule() {
  const holiday = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const currentDate = new Date().toLocaleString('en-US', { timeZone: 'Asia/Jakarta', weekday: 'long' });

  // Cek apakah currentDate bukan hari libur
  if (!holiday.includes(currentDate)) {
    const text = '#Credit Parkir CIBIS';
    handleUpdate(text);
    handleUpdate('/schedule');
  }
}


function getLastID() {
  var lastRow = dbSpending.last_row;
  const cellObject = dbSpending.getValue(lastRow, 2);
  const lastID = cellObject.data;
  return lastID; //
}

function getLastDescription() {
  var lastRow = dbSpending.last_row;
  const cellObject = dbSpending.getValue(lastRow, 4);
  const lastID = cellObject.data;
  return lastID; //
}

function getLastamount() {
  var lastRow = dbSpending.last_row;
  const cellObject = dbSpending.getValue(lastRow, 6);
  const lastID = cellObject.data;
  return lastID; //
}

function getListcatspending() {
  const listCat = dbsettings.getValues('⚙️Setting!D2:D');
  const filteredData = listCat.data.filter(item => item[0].trim() !== '');
  return filteredData;
}


function getCatamount(category, month) {
  let result = dbReport.key(category);

  if (result) {
    const monthIndex = getMonthIndex(month);
    if (monthIndex !== -1) {
      const amount = result.data[monthIndex];
      return amount; // Mengembalikan nilai amount
    } else {
      return null; // Jika bulan tidak ditemukan
    }
  } else {
    return null;
  }
}

function getMonthIndex(month) {
  const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUNE", "JULY", "AUG", "SEP", "OCT", "NOV", "DEC"];
  return months.indexOf(month) + 13; // Tambahkan 1 karena array data mungkin dimulai dari indeks 1
}

function findcatTransaction(transactionName) {
  // --- First try exact match in DB ---
  const exactMatch = getDbCatAndTag().search(transactionName);
  let category = "Not Found";
  let tag = "Not Found";
  let note = "Not Found";
  let account = "";

  if (exactMatch) {
    category = exactMatch.data[1];
    tag = exactMatch.data[2];
    note = exactMatch.data[3];
    account = exactMatch.data[4] || '';
  } else {
    const searchWords = transactionName.split(/\s+/);
    const searchRegex = new RegExp(searchWords.join("|"), "i");
    const cat = getDbCatAndTag().search(searchRegex);

    if (cat) {
      category = cat.data[1];
      tag = cat.data[2];
      note = cat.data[3];
      account = cat.data[4] || '';
    }
  }

  // --- If not found in DB, fallback to Gemini ---
  if (category === "Not Found") {
    const aiResult = findcatTransactionWithGemini(transactionName);
    category = aiResult.category;
    tag = aiResult.tag;
  }

  return { category, tag, note, account };
}


/**
 * Find spending transactions whose name contains the given keyword.
 * Returns up to `limit` most-recent matches, sorted newest first.
 *
 * @param {string} term  - Search keyword (case-insensitive partial match)
 * @param {number} limit - Max results (default 5)
 * @return {Array<{id, date, expenseName, amount}>|null}
 */
function findTransactionsByName(term, limit) {
  const db = getDbTransactions();
  const lastRow = db.last_row;
  if (lastRow < 2) return null;

  const numRows = lastRow - 2 + 1;
  // Cols A-F: id(0), date(1), name(2), type(3), category(4), amount(5)
  const rows = db.range(2, 1, numRows, 6).getValues();

  const keyword = String(term || '').toLowerCase().trim();
  const maxResults = limit || 5;

  const matches = rows
    .filter(row => {
      const type = String(row[3]).toLowerCase();
      const name = String(row[2]).toLowerCase();
      return type === 'spending' && name.includes(keyword);
    })
    .reverse()           // newest row first
    .slice(0, maxResults)
    .map(row => ({
      id:          String(row[0]),
      date:        row[1],
      expenseName: String(row[2]),
      amount:      Number(row[5]) || 0,
    }));

  return matches.length > 0 ? matches : null;
}

function searchTransactionByTerm(term, limit) {
  dbSpending.col_start = 4; // tetap mulai dari kolom D

  const searchResults = dbSpending.searchAll(term);

  if (searchResults && searchResults.length > 0) {
    // Batasi jumlah hasil sesuai limit
    const limitedResults = searchResults.slice(0, limit);

    // Misalnya ambil data yang relevan (row, pos, data)
    const formatted = limitedResults.map(r => ({
      row: r.row,
      col: r.col,
      pos: r.pos,
      data: r.data
    }));

    Logger.log(formatted);
    return formatted;
  } else {
    return "Not Found";
  }
}

function logSearchTransaction() {
  // Cari 5 transaksi dengan kata "Sampoerna Mild"
  const results1 = searchTransactionByTerm("Sampoerna Mild", 5);
  Logger.log(results1);

  // Cari 3 transaksi dengan kata "Indomie"
  const results2 = searchTransactionByTerm("Indomie", 3);
  Logger.log(results2);
}



function lastID() {
  let row = dbSpending.last_row;
  let result = dbSpending.getValue(row, 2);
  const id = result.data;
  return id;
}

function backDate(date) {

  const yesterday = new Date(date);
  yesterday.setDate(yesterday.getDate() - 1);
  return Utilities.formatDate(yesterday, "GMT+7", "dd MMMM yyyy");
}

function getBookmarkDB() {
  return new miniSheetDB2.init(ssidMoneyManagement, "Bookmark", {
    col_length: 8,
    row_start: 2,
    json: true,
    key_column: 1 // kolom USER ID
  });
}


function getLatestBookmarks(limit) {
  var db = getBookmarkDB();
  var lastRow = db.last_row;

  var numRows = limit || 5; // default ke 5 jika tidak diisi
  var startRow = Math.max(db.row_start, lastRow - numRows + 1);

  var raw = db.range(startRow, 1, lastRow - startRow + 1, db.col_length).getValues();

  var data = raw.map(row => ({
    userId: row[0],
    name: row[1],
    username: row[2],
    url: row[3],
    date: new Date(row[4]),
    raw: row
  }));

  data.sort((a, b) => b.date - a.date);

  return data.slice(0, numRows);
}

function reloadDbSpending() {
  dbSpending = new miniSheetDB2.init(ssidMoneyManagement, "Spending", {
    col_length: 8,
    row_start: 2,
    col_start: 2,
    json: true,
  });
}


