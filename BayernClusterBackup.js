import { Cluster } from 'puppeteer-cluster';
import fs from 'fs';
import path from 'path';

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

    let laws = {
        gesetz: "",
        sections: []
    };

    await cluster.task(async ({ page, data: url }) => {
        await page.goto(url);

        console.log(`Navigated to ${url}`);

        try {
            // Extract the law name
            const gesetz = await page.evaluate(() => {
                const titleElement = document.querySelector('h1.absatz.titelzeile');
                if (titleElement) {
                    const titleHTML = titleElement.innerHTML.replace(/<br\s*\/?>/gi, '\n');
                    const firstLine = titleHTML.split('\n')[0].trim();
                    return firstLine ? firstLine : "No law name found";
                }
                return "No law name found";
            });

            if (!laws.gesetz) {
                laws.gesetz = gesetz;
            }

            const sections = await page.evaluate(() => {
                const sectionsArray = [];
                const sectionHeaders = document.querySelectorAll('div.paraheading');
                sectionHeaders.forEach(header => {
                    const sectionTitle = header.querySelector('div.absatz.paratitel')?.textContent.trim() || "No title found";
                    const sectionNumber = header.querySelector('div.absatz.paranr')?.textContent.trim() || "No section number found";
                    let sectionContent = "";

                    let nextElem = header.nextElementSibling?.nextElementSibling;
                    while (nextElem && !nextElem.matches('div.paraheading')) {
                        sectionContent += nextElem.textContent.trim() + "\n";
                        nextElem = nextElem.nextElementSibling;
                    }

                    sectionsArray.push({
                        title: sectionTitle,
                        number: sectionNumber,
                        content: sectionContent.trim()
                    });
                });
                return sectionsArray;
            });

            laws.sections = laws.sections.concat(sections);

        } catch (error) {
            console.error(`Error extracting data from ${url}: ${error.message}`);
        }
    });

    // Add URLs to crawl
    const urls = [
        'https://www.gesetze-bayern.de/Content/Document/BayRKG/true',
        // Add more URLs as needed
    ];
    urls.forEach(url => cluster.queue(url));

    await cluster.idle();
    await cluster.close();

    const folderPath = '/Users/nils/WebstormProjects/gesetze-im-internet-scr';
    const filePath = path.join(folderPath, 'bayernReisekosten.json');

    if (!fs.existsSync(folderPath)) {
        console.log(`Creating directory: ${folderPath}`);
        fs.mkdirSync(folderPath, { recursive: true });
    }

    try {
        // Ensure that data is being written to the file
        console.log('Writing data to file:', JSON.stringify(laws, null, 2));
        fs.writeFileSync(filePath, JSON.stringify(laws, null, 2));
        console.log(`Datei wurde erfolgreich in ${filePath} gespeichert.`);
    } catch (writeError) {
        console.error(`Error writing file: ${writeError.message}`);
    }
})();
