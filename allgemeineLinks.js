const { Builder, By } = require('selenium-webdriver');
const firefox = require('selenium-webdriver/firefox');
const fs = require('fs');

(async function example() {
    let options = new firefox.Options();
    options.headless = true;
    let driver = await new Builder().forBrowser('firefox').setFirefoxOptions(options).build();

    // Liste der Seiten, die durchsucht werden sollen
    let pages = [];
    let alphabet = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'];
    let numbers = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

    // Generiere die Seiten für den Alphabet
    for (let letter of alphabet) {
        pages.push(`https://www.gesetze-im-internet.de/Teilliste_${letter}.html`);
    }

    // Generiere die Seiten für die Zahlen
    for (let number of numbers) {
        pages.push(`https://www.gesetze-im-internet.de/Teilliste_${number}.html`);
    }

    // Liste für alle verkürzten URLs
    let verkuerzte_urls = [];

    // Durchsuche jede Seite
    for (let page of pages) {
        await driver.get(page);

        let elements = await driver.findElements(By.linkText('PDF'));

        let Liste = [];
        for (let e of elements) {
            let href = await e.getAttribute('href');
            Liste.push(href);
        }

        // Funktion zum Kürzen der URL
        function kuerze_url(url) {
            let parts = url.split("/");
            parts.pop(); // Entfernt das letzte Element (die Datei)
            return parts.join("/") + "/index.html";
        }

        // Verkürze jede URL in der Liste
        for (let link of Liste) {
            let verkuerzte_url = kuerze_url(link);
            verkuerzte_urls.push(verkuerzte_url);
        }
    }

    // Gib die Liste der verkürzten URLs aus
    console.log(verkuerzte_urls);

    // Speichere die verkürzten URLs als JSON-Datei
    fs.writeFileSync('alleOberLinks.json', JSON.stringify(verkuerzte_urls, null, 2));

    // Close the driver
    await driver.quit();
})();
