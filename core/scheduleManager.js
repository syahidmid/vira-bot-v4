/**
 * core/scheduleManager.js
 * Schedule config stored in PropertiesService.
 * Trigger creation must be done manually from Apps Script editor
 * (ScriptApp scope is a sensitive OAuth scope blocked by Google for web apps).
 */

function getScheduleStatus() {
  var props = PropertiesService.getScriptProperties();
  var jobs = [
    { fn: 'sendDailyReport',             defaultHour: 7 },
    { fn: 'sendMissingTransactionAlert', defaultHour: 8 }
  ];

  return jobs.map(function (job) {
    var active = props.getProperty('SCHEDULE_ACTIVE_' + job.fn) === 'true';
    var hour   = parseInt(props.getProperty('SCHEDULE_HOUR_'   + job.fn) || job.defaultHour, 10);
    return { fn: job.fn, active: active, hour: hour };
  });
}

function setScheduleTrigger(fnName, hour) {
  try {
    var props = PropertiesService.getScriptProperties();
    props.setProperty('SCHEDULE_ACTIVE_' + fnName, 'true');
    props.setProperty('SCHEDULE_HOUR_'   + fnName, String(hour));
    return { success: true };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

function deleteScheduleTrigger(fnName) {
  try {
    PropertiesService.getScriptProperties()
      .setProperty('SCHEDULE_ACTIVE_' + fnName, 'false');
    return { success: true };
  } catch (e) {
    return { success: false, message: e.message };
  }
}
