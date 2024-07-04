import fs from 'fs';
import path from 'path';
import { Cluster } from 'puppeteer-cluster';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Dieses Skript hat die Aufgabe, alle Unterlinks jedes Gesetzes zu besuchen.
// Dabei soll der Inhalt aller Paragraphen geordnet entnommen und in eine JSON exportiert werden.
// Anschließend sollen die Gesetze in einer Datenbank weiterverarbeitet werden können.

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Zuteilung vom Importordner 'alleUnterLinks' und Exportordner 'alleCluster'.
const inputDir = path.join(__dirname, 'alleUnterLinks');
const outputDir = path.join(__dirname, 'alleCluster');

// Funktion zum Verarbeiten einer einzelnen JSON-Datei
async function processJsonFile(filePath, outputFileName) {
    try {
        console.log(`Verarbeite Datei: ${filePath}`);
        const data = await fs.promises.readFile(filePath, 'utf8');

        // Parsen der JSON-Daten
        const links = JSON.parse(data);
        console.log(`Anzahl gefundener Links: ${links.length}`);

        // Initialisierung des Puppeteer-Clusters
        const cluster = await Cluster.launch({
            concurrency: Cluster.CONCURRENCY_CONTEXT,
            maxConcurrency: 15,
            puppeteerOptions: {
                headless: true,
                args: ['--no-sandbox', '--disable-setuid-sandbox'],
                executablePath: process.env.CHROME_PATH || undefined,
                timeout: 60000, // Erhöhen des Timeouts auf 60 Sekunden
            },
            monitor: true,
        });

        cluster.on('taskerror', (err, data, willRetry) => {
            console.log(`Fehler beim Crawlen von ${data}: ${err.message}`);
            fs.appendFileSync('error.txt', `Fehler beim Crawlen von ${data}: ${err.message}\n`);
        });

        let laws = [];

        await cluster.task(async ({ page, data: url }) => {
            console.log(`Verarbeite URL: ${url}`);
            // Gehe zur angegebenen URL und warte, bis das Netzwerk inaktiv ist (alle Anfragen abgeschlossen)
            await page.goto(url, { waitUntil: 'networkidle2' });

            try {
                // Warte, bis das Body-Element geladen ist
                await page.waitForSelector('body');

                // Evaluieren des Inhalts der Seite im Browserkontext
                let law = await page.evaluate(() => {
                    // Initialisiere ein Objekt, um die Gesetzesdaten zu speichern
                    const lawData = {
                        title: document.querySelector('.jnentitel')?.innerText || 'Kein Titel gefunden',
                        paragraph: document.querySelector('.jnnebz')?.innerText || 'Kein Paragraph gefunden',
                        text: [],
                        footnotes: document.querySelector('.jnfussnote')?.innerText || "",
                        notes: (() => {
                            // Suche nach Anmerkungen. Zuerst nach speziellen Fußnoten, dann nach allgemeinen Fußnoten.
                            let notes = document.querySelector('.footnotes dd')?.innerText;
                            return notes ? notes : document.querySelector('.footnotes')?.innerText || "";
                        })(),
                        url: document.location.href // Speichere die aktuelle URL
                    };

                    // Füge den Text der Absätze in das Gesetzesdatenobjekt ein
                    document.querySelectorAll('.jurAbsatz').forEach(p => {
                        lawData.text.push(p.innerText);
                    });

                    // Gebe das gesammelte Gesetzesdatenobjekt zurück
                    return lawData;
                });

                // Füge das gesammelte Gesetzesdatenobjekt zur Liste der Gesetze hinzu
                laws.push(law);

            } catch (err) {
                // Fehlerbehandlung: Gibt eine Fehlermeldung aus, wenn beim Verarbeiten der URL ein Fehler auftritt
                console.error(`Fehler bei der Verarbeitung der URL ${url}:`, err);
            }
        });


        for (let link of links) {
            console.log(`Füge Link zur Warteschlange hinzu: ${link}`);
            await cluster.queue(link);
        }

        await cluster.idle();
        await cluster.close();

        // Sortieren der Gesetze, falls notwendig
        if (laws.length > 0) {
            laws.sort((a, b) => {
                const aNumber = a.paragraph && a.paragraph.split('§ ')[1]?.split(' bis')[0];
                const bNumber = b.paragraph && b.paragraph.split('§ ')[1]?.split(' bis')[0];
                return (aNumber && parseInt(aNumber)) - (bNumber && parseInt(bNumber));
            });
        }

        // Speichern der verarbeiteten Daten in einer neuen JSON-Datei
        const outputFilePath = path.join(outputDir, outputFileName);
        await fs.promises.writeFile(outputFilePath, JSON.stringify(laws, null, 4));

        console.log(`Erfolgreich verarbeitet und gespeichert: ${outputFilePath}`);
    } catch (err) {
        console.error(`Fehler bei der Verarbeitung der Datei ${filePath}:`, err);
    }
}

// Abrufen der Liste aller JSON-Dateien im Eingabeverzeichnis
async function processAllFiles() {
    try {
        const files = await fs.promises.readdir(inputDir);

        if (files.length > 0) {
            // Verarbeiten nur der ersten 5 JSON-Dateien
            const jsonFiles = files.filter(file => path.extname(file) === '.json').slice(0, 5);
            for (const file of jsonFiles) {
                const inputFilePath = path.join(inputDir, file);
                const outputFileName = `cluster_${file}`;
                await processJsonFile(inputFilePath, outputFileName);
            }
        } else {
            console.log('Das Verzeichnis ist leer.');
        }
    } catch (err) {
        console.error(`Fehler beim Lesen des Verzeichnisses ${inputDir}:`, err);
    }
}

// Starten der Verarbeitung der Dateien
processAllFiles();
