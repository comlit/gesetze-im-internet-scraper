const puppeteer = require('puppeteer');
const fs = require('fs');

(async () => {
    // Launch the browser and open a new blank page
    const browser = await puppeteer.launch();
    const page = await browser.newPage();

    const link = 'https://www.gesetze-im-internet.de/bgb/__244.html'

    // Navigate the page to a URL
    await page.goto(link);

    await page.waitForSelector('.jnhtml');

    let law = {
        title: await page.evaluate(() => {
            return document.querySelector('.jnentitel').innerText
        }),
        paragraph: await page.evaluate(() => {
            return document.querySelector('.jnenbez').innerText
        }),
        text: undefined,
        url: page.url()
    };

    law.text = await page.evaluate(() => {
        const parseText = (node) => {
            if (node instanceof Text) {
                return node.data;
            }

            if (node.tagName === 'DL') {
                let childList = []
                for (let child of node.childNodes) {
                    if (child.tagName === 'DT') {
                        childList.push({
                            title: child.innerText,
                            content: parseText(child.nextSibling)
                        });
                    }
                }
                return {list: childList};
            }

            if (node.childNodes.length > 1) {
                let childList = []
                for (let child of node.childNodes) {
                    childList.push(parseText(child));
                }
                return childList;
            }

            return parseText(node.firstChild);
        }


        let structuredText = [];
        let paragraphs = document.querySelectorAll('.jurAbsatz');
        for (let paragraph of paragraphs) {
            structuredText.push(parseText(paragraph));
        }
        return structuredText;
    });

    fs.writeFileSync(`${link.split('__')[1].replace('.html', '')}.json`, JSON.stringify(law, null, 4));

    await browser.close();
})();