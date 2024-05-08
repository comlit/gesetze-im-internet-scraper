const puppeteer = require('puppeteer');
const fs = require('fs');

(async () => {
    // Launch the browser and open a new blank page
    const browser = await puppeteer.launch();
    const page = await browser.newPage();

    const link = 'https://www.gesetze-im-internet.de/bgb/index.html'

    await page.goto(link);

    await page.waitForSelector('td > a');

    const links = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('td > a')).filter(a => a.href.includes('__')).map( e => e.href);
    });

    fs.writeFileSync('bgb.json', JSON.stringify(links, null, 2));

    await browser.close();
})();