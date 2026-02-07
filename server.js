const express = require('express');
const helmet = require('helmet');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Security Middleware
app.use(helmet());

// HTTPS Redirect (Simple implementation for standard proxies usually found in hosting envs)
app.use((req, res, next) => {
    if (process.env.NODE_ENV === 'production' && req.headers['x-forwarded-proto'] !== 'https') {
        return res.redirect('https://' + req.headers.host + req.url);
    }
    next();
});

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Helper to get formatted date "YYYY-MM-DD" in Vienna Timezone
function getFormattedDate(date) {
    // Use Intl.DateTimeFormat to get the date parts in the specific timezone
    const formatter = new Intl.DateTimeFormat('de-AT', {
        timeZone: 'Europe/Vienna',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });

    const parts = formatter.formatToParts(date);
    const year = parts.find(p => p.type === 'year').value;
    const month = parts.find(p => p.type === 'month').value;
    const day = parts.find(p => p.type === 'day').value;

    return `${year}-${month}-${day}`;
}

// API Endpoint
app.get('/api/news', (req, res) => {
    let targetDate = new Date(); // Current server time

    // Check for "yesterday" query param
    if (req.query.date === 'yesterday') {
        // To get "yesterday" in Vienna:
        // 1. Get current Vienna date string
        // 2. Parse it back to a Date object (noon to avoid dst shifts issues)
        // 3. Subtract 1 day
        const viennaTodayStr = getFormattedDate(new Date());
        const viennaDate = new Date(viennaTodayStr + 'T12:00:00'); // Midday to be safe
        viennaDate.setDate(viennaDate.getDate() - 1);

        // formats correctly because getFormattedDate handles the conversion again, 
        // effectively using the timestamp. 
        // BUT: if we just want the string for yesterday, we can just subtract 24h from *now* 
        // and format that? No, 24h subtraction is risky across DST/Timezones.
        // Better:
        targetDate = viennaDate;

    } else if (req.query.date) {
        // Parse explicit date string if provided (e.g. ?date=2026-02-04)
        const parts = req.query.date.split('-');
        if (parts.length === 3) {
            targetDate = new Date(req.query.date);
        }
    }

    const dateStr = getFormattedDate(targetDate);
    const dataDir = path.join(__dirname, 'data');

    console.log(`Requesting news for date: ${dateStr}`);

    fs.readdir(dataDir, async (err, files) => {
        if (err) {
            console.error('Error reading data directory:', err);
            return res.status(500).json({ message: "Interner Serverfehler" });
        }

        // Filter files that start with the date string OR "permanent" and end with .json
        let matchingFiles = files.filter(file =>
            (file.startsWith(dateStr) || file.startsWith('permanent')) && file.toLowerCase().endsWith('.json')
        );

        if (matchingFiles.length === 0) {
            console.log(`No files found for date: ${dateStr} (and no permanent files)`);
            return res.status(404).json({ message: "Keine Nachrichten für dieses Datum verfügbar" });
        }

        // SORTING: Permanent files first (alphabetical), then Main file (exact match), then others
        matchingFiles.sort((a, b) => {
            const aIsPerm = a.startsWith('permanent');
            const bIsPerm = b.startsWith('permanent');

            // Permanent files always come first
            if (aIsPerm && !bIsPerm) return -1;
            if (!aIsPerm && bIsPerm) return 1;
            if (aIsPerm && bIsPerm) return a.localeCompare(b); // Sort permanent files alphabetically

            // Then standard date files logic
            if (a === `${dateStr}.json`) return -1;
            if (b === `${dateStr}.json`) return 1;
            return a.localeCompare(b);
        });

        console.log(`Found files (sorted): ${matchingFiles.join(', ')}`);

        let mergedData = [];

        try {
            // Read all files in parallel but wait for all to complete
            // We use map to return an array of Promises
            const filePromises = matchingFiles.map(file => {
                return new Promise((resolve, reject) => {
                    const filePath = path.join(dataDir, file);
                    fs.readFile(filePath, 'utf8', (err, content) => {
                        if (err) return reject(err);
                        try {
                            const jsonData = JSON.parse(content);
                            resolve(Array.isArray(jsonData) ? jsonData : []);
                        } catch (parseErr) {
                            console.error(`Error parsing JSON in ${file}:`, parseErr);
                            resolve([]); // Ignore bad files, don't crash
                        }
                    });
                });
            });

            const results = await Promise.all(filePromises);

            // Concatenate in order
            results.forEach(data => {
                mergedData = mergedData.concat(data);
            });

            res.json(mergedData);

        } catch (readError) {
            console.error('Error reading files:', readError);
            res.status(500).json({ message: "Fehler beim Laden der Nachrichten" });
        }
    });
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
