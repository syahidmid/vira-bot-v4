
// Inisialisasi database menggunakan miniSheetDB2

const VIRA_SPREADSHEET_ID = SpreadsheetApp.getActiveSpreadsheet().getId();

function getDbTransactions() {
  return new miniSheetDB2.init(VIRA_SPREADSHEET_ID, "Transactions", {
    col_length: 9,
    row_start: 2,
    col_start: 1,
    json: true,
  });
}

function getDbCatAndTag() {
  return new miniSheetDB2.init(VIRA_SPREADSHEET_ID, "Query", {
    col_length: 5,
    col_start: 1,
    row_start: 2,
    json: true,
  });
}



// Daftar quote dalam format JSON
const quotes = [
  // Rumi
  { quote: "You were born with wings, why prefer to crawl through life?", author: "Rumi" },
  { quote: "The art of knowing is knowing what to ignore.", author: "Rumi" },
  { quote: "You have within you right now, everything you need to deal with whatever the world can throw at you.", author: "Rumi" },
  { quote: "You are not a drop in the ocean. You are the entire ocean in a drop.", author: "Rumi" },
  { quote: "The quieter you become, the more you are able to hear.", author: "Rumi" },
  { quote: "Let yourself be silently drawn by the strange pull of what you really love. It will not lead you astray.", author: "Rumi" },
  // Murphy's Law
  { quote: "Anything that can go wrong will go wrong.", author: "Murphy's Law" },
  { quote: "If anything simply cannot go wrong, it will anyway.", author: "Murphy's Law" },
  { quote: "The probability of a perfect plan is inversely proportional to the number of eyes watching.", author: "Murphy's Law" },
  // Buya Hamka
  { quote: "Cinta bukan mengajar kita lemah, tetapi membangkitkan kekuatan. Cinta bukan mengajar kita menghinakan diri, tetapi menghembuskan kegagahan. Cinta bukan melemahkan semangat, tetapi membangkitkan semangat.", author: "Buya Hamka" },
  { quote: "Bahwasanya cinta yang bersih dan suci (murni) itu, tidaklah tumbuh dengan sendirinya.", author: "Buya Hamka" },
  { quote: "Cinta bukan melemahkan hati, bukan membawa putus asa, bukan menimbulkan tangis sedu sedan. Tetapi cinta menghidupkan pengharapan, menguatkan hati dalam perjuangan menempuh onak dan duri penghidupan.", author: "Buya Hamka" },
  { quote: "Kerana apabila saya bertemu dengan engkau, maka matamu yg sebagai bintang timur itu sentiasa menghilangkan susun kataku.", author: "Buya Hamka" },
  { quote: "Takut akan kena cinta, itulah dua sifat dari cinta, cinta itulah yang telah merupakan dirinya menjadi suatu ketakutan, cinta itu kerap kali berupa putus harapan, takut cemburu, hiba hati dan kadang-kadang berani.", author: "Buya Hamka" },
  // Kahlil Gibran
  { quote: "Cinta adalah kebebasan yang paling agung; kebebasan adalah hak yang paling indah.", author: "Khalil Gibran" },
  { quote: "Kekuatan yang nyata adalah ketenangan yang lembut.", author: "Khalil Gibran" },
  { quote: "Jangan menaruh banyak harapan pada orang yang tidak memiliki harapan untuk dirinya sendiri.", author: "Khalil Gibran" },

];
