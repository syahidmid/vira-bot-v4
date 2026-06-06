/*
This file contains the implementation of the Gemini-based transaction categorization function.
It defines a function `findcatTransactionWithGemini` that takes a transaction name as input and returns a predicted category and tag based on the transaction description.

The function constructs a prompt for the Gemini model, sends a request to the Gemini API, and processes the response to extract the category and tag. It also includes special rules for categorization based on certain keywords in the transaction description.

The `testGemini` function is provided as an example of how to use the `findcatTransactionWithGemini` function to test its functionality.
*/

function testGemini() {
    const transactionName = "Nasi Kuning";
    const category = findcatTransactionWithGemini(transactionName);
    Logger.log(category);
}

function findcatTransactionWithGemini(transactionName) {
    const prompt = `
You are a financial transaction categorization system.
Use **only** the following categories (do not create new ones):

${VALID_CATEGORIES.join(", ")}

Special rules:

* If the transaction involves giving food, drinks, or money to someone else, categorize it as **"Donation"** even if it sounds like **"Food and Drink"**.
* If the transaction mentions **"for Atika, Affan, Dad, or Mom"**, always assign the category **"Family"**.
* If the category is food-related, consider adding tags such as **"Lunch"**, **"Breakfast"**, **"Snack"**, etc. Estimate based on the type of food.

Transaction: "${transactionName}"

Respond only in valid JSON, without using \`\`\`:
{
  "category": "...",
  "tag": "..."
}
`;

    try {
        const apiKey = PropertiesService.getScriptProperties().getProperty("AI_API_KEY_GEMINI");
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

        const payload = {
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.2 }
        };

        const options = {
            method: "post",
            contentType: "application/json",
            payload: JSON.stringify(payload),
            muteHttpExceptions: true,
        };

        const response = UrlFetchApp.fetch(url, options);
        const json = JSON.parse(response.getContentText());
        Logger.log(JSON.stringify(json));

        let aiAnswer = json.candidates[0].content.parts[0].text.trim();
        aiAnswer = aiAnswer.replace(/```json/i, "").replace(/```/g, "").trim();

        const parsed = JSON.parse(aiAnswer);

        if (!VALID_CATEGORIES.includes(parsed.category)) {
            parsed.category = "Not Found";
        }

        return {
            category: parsed.category || "AI Not Found",
            tag: parsed.tag || "AI Not Found",
        };
    } catch (e) {
        Logger.log("AI categorization error: " + e);
        return { category: "AI Not Found", tag: "AI Not Found" };
    }
}