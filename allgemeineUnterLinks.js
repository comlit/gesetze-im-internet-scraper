const puppeteer = require('puppeteer');
const fs = require('fs');
const url = require('url');

(async () => {
    // Launch the browser and open a new blank page
    const browser = await puppeteer.launch();
    const page = await browser.newPage();

    // Load the links from the JSON file
    const links = JSON.parse(fs.readFileSync('alleOberLinks.json', 'utf8'));

    for (const link of links) {
        try {
            await page.goto(link);
            await page.waitForSelector('td > a');

            const subLinks = await page.evaluate(() => {
                return Array.from(document.querySelectorAll('td > a')).filter(a => a.href.includes('__')).map( e => e.href);
            });

            const urlParts = url.parse(link);
            const fileNameParts = urlParts.pathname.split("/");
            const fileName = fileNameParts[fileNameParts.length - 2] + '-unterLinks.json';

            fs.writeFileSync(fileName, JSON.stringify(subLinks, null, 2));
        } catch (error) {
            console.error(`Error processing link ${link}: ${error}`);
        }
    }
    await browser.close();
})();
