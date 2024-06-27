import { Cluster } from 'puppeteer-cluster';
import fs from 'fs';

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

    await cluster.task(async ({ page, data: url }) => {
        await page.goto(url);

        console.log(`Navigated to ${url}`);

        try {
            // Extract the law name
            const gesetz = await page.evaluate(() => {
                const titleElement = document.querySelector('p.lrueberschrift');
                if (titleElement) {
                    // Extract the text from the title element
                    const titleText = titleElement.innerText.trim();
                    return titleText ? titleText : "No law name found";
                }
                return "No law name found";
            });

            const sections = await page.evaluate(() => {
                const sectionsArray = [];
                const sectionHeaders = document.querySelectorAll('h2.hidden');
                sectionHeaders.forEach(header => {
                    const sectionTitle = header.nextElementSibling?.innerText.trim() || "No title found";
                    const sectionNumber = header.innerText.match(/§ \d+/)?.[0] || "No section number found";
                    let sectionContent = "";

                    // Traverse the DOM to get all content until the next section header
                    let nextElem = header.nextElementSibling?.nextElementSibling;
                    while (nextElem && !nextElem.matches('h2.hidden')) {
                        if (nextElem.matches('p.MsoNormal')) {
                            sectionContent += `${nextElem.innerText.trim()} `;
                        }
                        nextElem = nextElem.nextElementSibling;
                    }

                    sectionsArray.push({
                        title: sectionTitle.replace(/^§\s*\d+\s*/, '').replace(/\n/g, '').trim(), // Clean up the title
                        paragraph: sectionNumber,
                        text: sectionContent.trim() || "No content found"
                    });
                });
                return sectionsArray;
            });

            sections.forEach(section => {
                laws.push({
                    title: section.title,
                    paragraph: section.paragraph,
                    text: section.text
                });
            });

            const finalOutput = {
                gesetz: gesetz,
                inhalt: laws
            };

            fs.writeFileSync('nrwReisekostengesetz.json', JSON.stringify(finalOutput, null, 2));

            console.log('Final Output:', finalOutput);

        } catch (error) {
            console.log(`Error extracting data from ${url}: ${error.message}`);
        }
    });

    const urls = [
        'https://recht.nrw.de/lmi/owa/br_text_anzeigen?v_id=25020220105124746070'
        // Add more URLs if needed
    ];

    urls.forEach(url => cluster.queue(url));

    await cluster.idle();
    await cluster.close();
})();
