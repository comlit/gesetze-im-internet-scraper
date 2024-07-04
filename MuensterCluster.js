import { Cluster } from 'puppeteer-cluster';
import fs from 'fs';
import cheerio from 'cheerio';

//Dieses Script hat die Aufgabe Gesetzestexte von der Datenbank von der Kommune Münsterzu entnehmmen.
//Die Gesetze sollen dann geordnet in einer JSON Datei gespeichert werden welche dann in einer Datenbank weiter verarbeitet werden können.

//Link des spezifischen Gesetz auf der Website der Datenbank von der Kommune Münster.
const URL = 'https://www.stadt-muenster.de/recht/ortsrecht/satzungen/detailansicht/satzungsnummer/32.08';

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

        // Dynamische Erkennung des Gesetzestitels
        lawTitle = $('div.csc-frame-default h2').first().text().trim();

        if (!lawTitle || lawTitle === 'Navigation') {
            lawTitle = $('h2').next('h2').text().trim();
        }

        if (!lawTitle || lawTitle === 'Navigation') {
            lawTitle = $('h1').text().trim();
        }

        if (!$('h3').length) {
            console.log('No h3 elements found on the page.');
        }

        let currentSection = null;

        $('h3, p, table').each((i, element) => {
            const tag = $(element).prop('tagName');

            if (tag === 'H3') {
                if (currentSection) {
                    laws.push(currentSection);
                }
                const fullTitle = $(element).text().trim();
                const match = fullTitle.match(/^§\s?(\d+(\.\d+)?)/);
                if (match) {
                    currentSection = {
                        title: fullTitle.replace(match[0], '').trim(),
                        paragraph: match[0],
                        text: []
                    };
                } else {
                    currentSection = {
                        title: fullTitle,
                        paragraph: '',
                        text: []
                    };
                }
            } else if (tag === 'P' && currentSection) {
                const text = $(element).text().trim().replace(/\s+/g, ' ');
                currentSection.text.push(text);
            } else if (tag === 'TABLE' && currentSection) {
                let tableData = [];
                $(element).find('tr').each((j, row) => {
                    let rowData = [];
                    $(row).find('th, td').each((k, cell) => {
                        rowData.push($(cell).text().trim().replace(/\s+/g, ' '));
                    });
                    tableData.push(rowData);
                });
                currentSection.text.push({ table: tableData });
            }
        });

        if (currentSection) {
            laws.push(currentSection);
        }

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
        //Erstellung der JSON Datei des Gesetz
        fs.writeFileSync('muensterSend.json', JSON.stringify(output, null, 2));
        console.log('Scraping completed. Data saved to muenster_laws.json');
    } else {
        console.log('No data extracted.');
    }
})();
