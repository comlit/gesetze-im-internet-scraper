import fs from 'fs';
import path from 'path';
import { Cluster } from 'puppeteer-cluster';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Get the directory name of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Define the input and output directories
const inputDir = path.join(__dirname, 'alleUnterLinks');
const outputDir = path.join(__dirname, 'alleCluster');

// Function to process a single JSON file
async function processJsonFile(filePath, outputFileName) {
    try {
        console.log(`Processing file: ${filePath}`);
        const data = await fs.promises.readFile(filePath, 'utf8');

        // Parse the JSON data
        const links = JSON.parse(data);
        console.log(`Number of links found: ${links.length}`);

        // Initialize Puppeteer Cluster
        const cluster = await Cluster.launch({
            concurrency: Cluster.CONCURRENCY_CONTEXT,
            maxConcurrency: 15,
            puppeteerOptions: {
                headless: true,
                args: ['--no-sandbox', '--disable-setuid-sandbox'],
                executablePath: process.env.CHROME_PATH || undefined,
                timeout: 60000, // Increase the timeout to 60 seconds
            },
            monitor: true,
        });

        cluster.on('taskerror', (err, data, willRetry) => {
            console.log(`Error crawling ${data}: ${err.message}`);
            fs.appendFileSync('error.txt', `Error crawling ${data}: ${err.message}\n`);
        });

        let laws = [];

        await cluster.task(async ({ page, data: url }) => {
            console.log(`Processing URL: ${url}`);
            await page.goto(url, { waitUntil: 'networkidle2' });

            try {
                await page.waitForSelector('body');

                let law = await page.evaluate(() => {
                    const lawData = {
                        title: document.querySelector('.jnentitel')?.innerText || 'No title found',
                        paragraph: document.querySelector('.jnnebz')?.innerText || 'No paragraph found',
                        text: [],
                        footnotes: document.querySelector('.jnfussnote')?.innerText || "",
                        notes: (() => {
                            let notes = document.querySelector('.footnotes dd')?.innerText;
                            return notes ? notes : document.querySelector('.footnotes')?.innerText || "";
                        })(),
                        url: document.location.href
                    };

                    document.querySelectorAll('.jurAbsatz').forEach(p => {
                        lawData.text.push(p.innerText);
                    });

                    return lawData;
                });

                laws.push(law);

            } catch (err) {
                console.error(`Error processing URL ${url}:`, err);
            }
        });

        for (let link of links) {
            console.log(`Adding link to queue: ${link}`);
            await cluster.queue(link);
        }

        await cluster.idle();
        await cluster.close();

        // Sort laws if necessary
        if (laws.length > 0) {
            laws.sort((a, b) => {
                const aNumber = a.paragraph && a.paragraph.split('§ ')[1]?.split(' bis')[0];
                const bNumber = b.paragraph && b.paragraph.split('§ ')[1]?.split(' bis')[0];
                return (aNumber && parseInt(aNumber)) - (bNumber && parseInt(bNumber));
            });
        }

        // Save the processed data to a new JSON file
        const outputFilePath = path.join(outputDir, outputFileName);
        await fs.promises.writeFile(outputFilePath, JSON.stringify(laws, null, 4));

        console.log(`Successfully processed and saved: ${outputFilePath}`);
    } catch (err) {
        console.error(`Error processing file ${filePath}:`, err);
    }
}

// Get the list of all JSON files in the input directory
async function processAllFiles() {
    try {
        const files = await fs.promises.readdir(inputDir);

        if (files.length > 0) {
            // Process only the first 5 JSON files
            const jsonFiles = files.filter(file => path.extname(file) === '.json').slice(0, 5);
            for (const file of jsonFiles) {
                const inputFilePath = path.join(inputDir, file);
                const outputFileName = `cluster_${file}`;
                await processJsonFile(inputFilePath, outputFileName);
            }
        } else {
            console.log('The directory is empty.');
        }
    } catch (err) {
        console.error(`Error reading directory ${inputDir}:`, err);
    }
}

// Start processing files
processAllFiles();
