import axios from 'axios';
import * as cheerio from 'cheerio';

async function main() {
    const url = 'https://podvodnabazaru.cz/?page=1';
    console.log(`Fetching ${url}...`);
    const { data } = await axios.get(url);
    const $ = cheerio.load(data);

    const posts = $('.card').has('.card-header');
    console.log(`Found ${posts.length} posts.`);

    posts.each((i, element) => {
        if (i > 2) return; // check only first 3

        const card = $(element);
        const headerText = card.find('.card-header').text();
        console.log(`\n--- Post ${i + 1} ---`);
        console.log(`Header Text Raw: "${headerText}"`);
        console.log(`Header Text Trimmed: "${headerText.trim()}"`);

        const dateMatch = headerText.match(/dne:\s*([\d\.\s]+)/i);
        console.log(`Regex Match:`, dateMatch);

        if (dateMatch) {
            const rawDate = dateMatch[1].trim();
            console.log(`Captured rawDate: "${rawDate}"`);
            const cleanDate = rawDate.replace(/\.$/, '');
            // split by dot, trim each part, filter out empty strings
            const parts = cleanDate.split('.').map(s => s.trim()).filter(p => p.length > 0);
            console.log('Parts:', parts);

            if (parts.length === 3) {
                const day = parts[0].padStart(2, '0');
                const month = parts[1].padStart(2, '0');
                const year = parts[2];
                const final = `${year}-${month}-${day} 10:00:00.000Z`;
                console.log(`Final ISO: ${final}`);
            } else {
                console.log('Parse failed: parts length is ' + parts.length);
            }
        } else {
            console.log('NO MATCH for date regex');
        }
    });
}

main();
