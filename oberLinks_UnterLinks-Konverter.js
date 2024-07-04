const puppeteer = require('puppeteer');
const fs = require('fs');
const url = require('url');

//Dieses Script greift auf die URLs aus der JSON alleOberLinks.json zu.
//Fuer jede URL werden alle unterLinks der jeweiligen Paragraphen entnommen.
//Pro Gesetz wird eine JSON Datei mit den gesammelten unterLinks erstellt.

(async () => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();

    // Lade alle Websiten der OberLinks (Aller Gesetze).
    const links = JSON.parse(fs.readFileSync('alleOberLinks.json', 'utf8'));

    //Suche nach unterLinks für jeden Oberlink
    for (const link of links) {
        try {
            await page.goto(link);
            await page.waitForSelector('td > a');

            const subLinks = await page.evaluate(() => {
                return Array.from(document.querySelectorAll('td > a')).filter(a => a.href.includes('__')).map( e => e.href);
            });
    //Speichern der unterLinks
            const urlParts = url.parse(link);
            const fileNameParts = urlParts.pathname.split("/");
            const fileName = fileNameParts[fileNameParts.length - 2] + '-unterLinks.json';

            fs.writeFileSync(fileName, JSON.stringify(subLinks, null, 2));
    //Abfangen möglicher Fehler beim Webscrape
        } catch (error) {
            console.error(`Error processing link ${link}: ${error}`);
        }
    }
    await browser.close();
})();
