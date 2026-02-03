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
    }

    const dateStr = getFormattedDate(targetDate);
    const filePath = path.join(__dirname, 'data', `${dateStr}.json`);

    console.log(`Requesting news for date: ${dateStr}`);
    console.log(`Looking for file at: ${filePath}`);

    fs.access(filePath, fs.constants.F_OK, (err) => {
        if (err) {
            console.error(`File not found: ${filePath}`);
            return res.status(404).json({ message: "Keine Nachrichten f\u00FCr dieses Datum verf\u00FCgbar" });
        }

        res.sendFile(filePath);
    });
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
