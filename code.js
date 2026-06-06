function doPost(e) {
  var tokenBot = PropertiesService.getScriptProperties().getProperty('TELEGRAM_BOT_TOKEN') || "";
  var bot = new lumpia.init(tokenBot);
  initWizardStage(bot);
  setupMessageRouters(bot);
  bot.doPost(e);
}

function doGet(e) {
  var params = e && e.parameter ? e.parameter : {};
  var token = params.token || '';
  var adminToken = PropertiesService.getScriptProperties().getProperty('ADMIN_TOKEN') || '';

  if (!adminToken) {
    return HtmlService.createHtmlOutput('<h2>Setup: set ADMIN_TOKEN in Script Properties first.</h2>');
  }
  if (token !== adminToken) {
    return HtmlService.createHtmlOutput('<h2>401 Unauthorized</h2><p>Append ?token=YOUR_ADMIN_TOKEN to the URL.</p>');
  }

  return HtmlService.createTemplateFromFile('sidebar')
    .evaluate()
    .setTitle('Vira Bot V4 Admin')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}