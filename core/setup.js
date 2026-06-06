function isUserAllowed(chatID) {
  var users = getUsers();
  if (!users || users.length === 0) return false;
  return users.some(function (u) {
    return u.chatId == chatID;
  });
}


