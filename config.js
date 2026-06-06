// ═══════════════════════════════════════════════
//  CONFIG SHEET UTILITIES
//  Semua data disimpan di sheet "_config"
// ═══════════════════════════════════════════════

function getConfigSheet() {
  var id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (!id) throw new Error('SPREADSHEET_ID belum diset di Script Properties.');
  var ss = SpreadsheetApp.openById(id);
  var sheet = ss.getSheetByName('_config');
  if (!sheet) {
    sheet = ss.insertSheet('_config');
    sheet.appendRow(['key', 'value']);
    sheet.hideSheet();
  }
  return sheet;
}

/**
 * Simpan nilai berdasarkan key
 */
function saveToSheet(key, value) {
  var sheet = getConfigSheet();
  var data = sheet.getDataRange().getValues();

  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === key) {
      sheet.getRange(i + 1, 2).setValue(value);
      return;
    }
  }
  // Key belum ada → tambah baris baru
  sheet.appendRow([key, value]);
}

/**
 * Ambil nilai berdasarkan key
 */
function getFromSheet(key) {
  var sheet = getConfigSheet();
  var data = sheet.getDataRange().getValues();

  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === key) return data[i][1] || '';
  }
  return '';
}

/**
 * Hapus key dari config sheet
 */
function deleteFromSheet(key) {
  var sheet = getConfigSheet();
  var data = sheet.getDataRange().getValues();

  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === key) {
      sheet.deleteRow(i + 1);
      return;
    }
  }
}


// ═══════════════════════════════════════════════
//  SIDEBAR — dipanggil dari HTML
// ═══════════════════════════════════════════════

function saveValue(key, value) {
  if (key === 'TELEGRAM_BOT_TOKEN' || key === 'DEPLOYMENT_ID' || key === 'SPREADSHEET_ID') {
    PropertiesService.getScriptProperties().setProperty(key, value);
  } else {
    saveToSheet(key, value);
  }
}

function getValue(key) {
  if (key === 'TELEGRAM_BOT_TOKEN' || key === 'DEPLOYMENT_ID' || key === 'SPREADSHEET_ID') {
    return PropertiesService.getScriptProperties().getProperty(key) || '';
  }
  return getFromSheet(key);
}

/** Load semua config untuk sidebar Connection tab */
function getBotAndDeploymentIds() {
  const props = PropertiesService.getScriptProperties();
  return {
    telegramId: props.getProperty('TELEGRAM_BOT_TOKEN') || '',
    deploymentId: props.getProperty('DEPLOYMENT_ID') || '',
    spreadsheetId: props.getProperty('SPREADSHEET_ID') || ''
  };
}

/** Cek status bot */
function getBotStatus() {
  const props = PropertiesService.getScriptProperties();
  var telegramId = props.getProperty('TELEGRAM_BOT_TOKEN') || '';
  var deploymentId = props.getProperty('DEPLOYMENT_ID') || '';
  if (!telegramId || !deploymentId) return 'Disconnected';

  try {
    var url = 'https://api.telegram.org/bot' + telegramId + '/getWebhookInfo';
    var resp = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    var json = JSON.parse(resp.getContentText());
    if (json.ok && json.result && json.result.url && json.result.url !== '') {
      return 'Connected';
    }
  } catch (e) { }
  return 'Disconnected';
}

/** Set webhook */
function setWebhook(telegramId, deploymentId) {
  var webhookUrl = 'https://script.google.com/macros/s/' + deploymentId + '/exec';
  var url = 'https://api.telegram.org/bot' + telegramId + '/setWebhook?url=' + encodeURIComponent(webhookUrl);
  try {
    var resp = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    var json = JSON.parse(resp.getContentText());
    return json.ok ? '✅ Bot berhasil terhubung!' : '❌ Gagal: ' + json.description;
  } catch (e) {
    return '❌ Error: ' + e.message;
  }
}

/** Delete webhook */
function deleteWebhook() {
  var telegramId = PropertiesService.getScriptProperties().getProperty('TELEGRAM_BOT_TOKEN') || '';
  if (!telegramId) return '⚠️ Token tidak ditemukan.';
  var url = 'https://api.telegram.org/bot' + telegramId + '/deleteWebhook';
  try {
    var resp = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    var json = JSON.parse(resp.getContentText());
    return json.ok ? '🔌 Bot berhasil diputuskan.' : '❌ Gagal: ' + json.description;
  } catch (e) {
    return '❌ Error: ' + e.message;
  }
}


// ═══════════════════════════════════════════════
//  USER MANAGEMENT — disimpan di config sheet
//  key: ALLOWED_USERS → JSON array
// ═══════════════════════════════════════════════

/** Ambil semua user */
function getUsers() {
  var raw = PropertiesService.getScriptProperties().getProperty('ALLOWED_USERS');
  try { return raw ? JSON.parse(raw) : []; } catch (e) { return []; }
}

function saveUsers(usersArray) {
  PropertiesService.getScriptProperties().setProperty('ALLOWED_USERS', JSON.stringify(usersArray));
}

/** Tambah satu user baru */
function addUser(name, chatId) {
  var users = getUsers();

  // Cek duplikat chat ID
  for (var i = 0; i < users.length; i++) {
    if (users[i].chatId === chatId) {
      return { success: false, message: '⚠️ Chat ID sudah terdaftar.' };
    }
  }

  users.push({ name: name, chatId: chatId });
  saveUsers(users);
  return { success: true, message: '✅ User "' + name + '" ditambahkan.' };
}

/** Hapus user berdasarkan chatId */
function removeUser(chatId) {
  var users = getUsers();
  var before = users.length;
  users = users.filter(function (u) { return u.chatId !== chatId; });
  saveUsers(users);
  return before !== users.length
    ? { success: true, message: '🗑️ User dihapus.' }
    : { success: false, message: '⚠️ User tidak ditemukan.' };
}


// ══════════════════════════════
// AI CONFIG - Multi Provider
// ══════════════════════════════

function saveAiConfig(provider, apiKey, model) {
  try {
    const props = PropertiesService.getScriptProperties();
    const providerUpper = provider.toUpperCase();

    // Simpan key & model per provider
    props.setProperties({
      [`AI_API_KEY_${providerUpper}`]: apiKey,
      [`AI_MODEL_${providerUpper}`]: model || "",
      AI_PROVIDER_ACTIVE: provider,
    });

    return { success: true, message: `${provider} saved & activated` };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

function getAiConfig(provider) {
  const props = PropertiesService.getScriptProperties();
  const providerUpper = provider.toUpperCase();
  return {
    provider: provider,
    apiKey: props.getProperty(`AI_API_KEY_${providerUpper}`) || "",
    model: props.getProperty(`AI_MODEL_${providerUpper}`) || "",
  };
}

function getAiStatus() {
  const props = PropertiesService.getScriptProperties();
  const activeProvider = props.getProperty("AI_PROVIDER_ACTIVE") || "";

  if (!activeProvider) return { active: false, provider: "", model: "" };

  const providerUpper = activeProvider.toUpperCase();
  const apiKey = props.getProperty(`AI_API_KEY_${providerUpper}`) || "";

  return {
    active: !!apiKey,
    provider: activeProvider,
    model: props.getProperty(`AI_MODEL_${providerUpper}`) || "",
    // Status semua provider
    providers: {
      gemini: !!props.getProperty("AI_API_KEY_GEMINI"),
      openai: !!props.getProperty("AI_API_KEY_OPENAI"),
      groq: !!props.getProperty("AI_API_KEY_GROQ"),
    }
  };
}

function getActiveAiConfig() {
  const props = PropertiesService.getScriptProperties();
  const activeProvider = props.getProperty("AI_PROVIDER_ACTIVE") || "";
  if (!activeProvider) return null;

  const providerUpper = activeProvider.toUpperCase();
  const apiKey = props.getProperty(`AI_API_KEY_${providerUpper}`);
  if (!apiKey) return null;

  return {
    provider: activeProvider,
    apiKey: apiKey,
    model: props.getProperty(`AI_MODEL_${providerUpper}`) || "",
  };
}

function deleteAiConfig(provider) {
  try {
    const props = PropertiesService.getScriptProperties();
    const providerUpper = provider.toUpperCase();
    props.deleteProperty(`AI_API_KEY_${providerUpper}`);
    props.deleteProperty(`AI_MODEL_${providerUpper}`);

    // Reset active kalau yang dihapus adalah active
    if (props.getProperty("AI_PROVIDER_ACTIVE") === provider) {
      props.deleteProperty("AI_PROVIDER_ACTIVE");
    }

    return { success: true, message: `${provider} config deleted` };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

function setDefaultProvider(provider) {
  try {
    const props = PropertiesService.getScriptProperties();
    props.setProperty('AI_PROVIDER_ACTIVE', provider);
    return { success: true };
  } catch (e) {
    return { success: false, message: e.message };
  }
}


// include() digunakan oleh template HTML (<?!= include('nama-file') ?>)
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}