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
        fs.appendFileSync('error.txt', `${data}\n`)
    });

    let laws = [];

    await cluster.task(async ({ page, data: url }) => {
        await page.goto(url);

        await page.waitForSelector('.jnentitel')

        let law = {
            title: await page.evaluate(() => {
                return document.querySelector('.jnentitel').innerText
            }),
            paragraph: await page.evaluate(() => {
                return document.querySelector('.jnenbez').innerText
            }),
            text: undefined,
            footnotes: await page.evaluate(() => {
                return (document.querySelector('.jnfussnote')?.innerText) ?? ""
            }),
            notes: await page.evaluate(() => {
                let notes = document.querySelector('.footnotes dd')?.innerText
                return (notes ? notes : document.querySelector('.footnotes')?.innerText) ?? ""
            }),
            url: page.url()
        };

        law.text = await page.evaluate(() => {
            const parseText = (node) => {
                if (!node)
                    return

                if (!!node.querySelector && !!node?.querySelector('sup a.FnR'))
                    return node.innerText;

                if (node instanceof Text)
                    return node.data;

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
                    return { list: childList };
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
            if (paragraphs.length != 0)
                for (let paragraph of paragraphs) {
                    if (!!paragraph.closest && !!paragraph.closest('.jnfussnote'))
                        continue;
                    structuredText.push(parseText(paragraph));
                }
            return structuredText;
        });
        laws.push(law);
    });

    let links = JSON.parse(fs.readFileSync('wogg-unterLinks.json', 'utf8'));
    let i = 0
    for (let link of links) {
        //i++;
        //if (i > 500) break;
        await cluster.queue(link);
    }

    await cluster.idle();
    await cluster.close();

    laws.sort((a, b) => {
        const aNumber = parseInt(a.paragraph.split('§ ')[1].split(' bis')[0]);
        const bNumber = parseInt(b.paragraph.split('§ ')[1].split(' bis')[0]);
        return aNumber - bNumber;
    });

    fs.writeFileSync('wogg.json', JSON.stringify(laws, null, 4));
})();
