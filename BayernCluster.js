import { Cluster } from 'puppeteer-cluster';
import fs from 'fs';
import cheerio from 'cheerio';

const URL = 'https://www.gesetze-bayern.de/Content/Document/BayRKG/true';

(async () => {
    const cluster = await Cluster.launch({
        concurrency: Cluster.CONCURRENCY_CONTEXT,
        maxConcurrency: 15,
        monitor: true
    });

    cluster.on('taskerror', (err, data, willRetry) => {
        console.log(`Error crawling ${data}: ${err.message}`);
        fs.appendFileSync('error.txt', `${data}\n`);
    });

    let laws = [];
    let lawTitle = '';

    await cluster.task(async ({ page, data: url }) => {
        console.log(`Crawling URL: ${url}`);
        await page.goto(url, { waitUntil: 'domcontentloaded' });

        const content = await page.content();
        const $ = cheerio.load(content);

        // Extrahiere den Gesetzesnamen
        lawTitle = $('h1.absatz.titelzeile').text().trim();

        if (!$('.cont').length) {
            console.log('No .cont elements found on the page.');
        }

        $('.cont').each((i, element) => {
            const section = $(element);
            const sectionTitle = section.find('.paraheading .absatz.paratitel').text().trim();
            const sectionNumber = section.find('.paraheading .absatz.paranr').text().trim();

            if (!sectionTitle || !sectionNumber) {
                console.log(`Skipping empty section at index ${i}`);
                return;
            }

            let paragraphs = [];

            section.find('.absatz.paratext').each((j, para) => {
                paragraphs.push($(para).text().trim());
            });

            laws.push({
                title: sectionTitle,
                paragraph: sectionNumber,
                text: paragraphs
            });
        });

        console.log(`Extracted ${laws.length} sections.`);
    });

    await cluster.queue(URL);

    await cluster.idle();
    await cluster.close();

    if (laws.length > 0) {
        const output = {
            gesetz: lawTitle,
            inhalt: laws
        };
        fs.writeFileSync('bayern_laws.json', JSON.stringify(output, null, 2));
        console.log('Scraping completed. Data saved to bayern_laws.json');
    } else {
        console.log('No data extracted.');
    }
})();
