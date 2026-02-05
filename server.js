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

// Helper to get formatted date "YYYY-MM-DD"
function getFormattedDate(date) {
    const d = new Date(date);
    const month = '' + (d.getMonth() + 1);
    const day = '' + d.getDate();
    const year = d.getFullYear();

    return [year, month.padStart(2, '0'), day.padStart(2, '0')].join('-');
}

// API Endpoint
app.get('/api/news', (req, res) => {
    let targetDate = new Date();

    // Check for "yesterday" query param
    if (req.query.date === 'yesterday') {
        targetDate.setDate(targetDate.getDate() - 1);
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

        // Filter files that start with the date string and end with .json
        let matchingFiles = files.filter(file =>
            file.startsWith(dateStr) && file.toLowerCase().endsWith('.json')
        );

        if (matchingFiles.length === 0) {
            console.log(`No files found for date: ${dateStr}`);
            return res.status(404).json({ message: "Keine Nachrichten für dieses Datum verfügbar" });
        }

        // SORTING: Main file (exact match) first, others alphabetically
        matchingFiles.sort((a, b) => {
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
