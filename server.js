const express = require('express');
const helmet = require('helmet');
const path = require('path');
const fs = require('fs');
const http = require('http');
const { Server } = require("socket.io");
const { spawn, fork } = require('child_process');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = 4000;

// --- Auto-Start Text_To_Json Subsystem (Port 3001) ---
const textToJsonPath = path.join(__dirname, '..', 'Text_To_Json', 'server.js');
console.log(`Starting Text_To_Json subsystem at ${textToJsonPath}...`);

// Use 'fork' to run it as a separate node process but linked
const textToJsonProcess = fork(textToJsonPath, [], {
    cwd: path.dirname(textToJsonPath),
    stdio: 'inherit' // See logs in main console
});

textToJsonProcess.on('error', (err) => {
    console.error('Failed to start Text_To_Json:', err);
});

// Kill child when main process exits
process.on('exit', () => {
    textToJsonProcess.kill();
});

// --- End Subsystem Start ---

// Security Middleware
// Security Middleware
app.use(helmet({
    contentSecurityPolicy: false, // Disable CSP for now to ensure Socket.IO works without issues
}));
app.use(express.json()); // Enable JSON body parsing

// HTTPS Redirect
app.use((req, res, next) => {
    if (process.env.NODE_ENV === 'production' && req.headers['x-forwarded-proto'] !== 'https') {
        return res.redirect('https://' + req.headers.host + req.url);
    }
    next();
});

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Socket.IO Connection
io.on('connection', (socket) => {
    console.log('Client connected to cockpit');
    socket.on('disconnect', () => {
        console.log('Client disconnected');
    });
});

// Helper to run python scripts
function runScript(command, args, cwd, socketEvent) {
    console.log(`Executing: ${command} ${args.join(' ')} in ${cwd}`);
    const process = spawn(command, args, { cwd: cwd, shell: true });

    process.on('error', (err) => {
        console.error(`[${socketEvent} ERROR] Failed to start process: ${err.message}`);
        io.emit(socketEvent, `ERROR: Failed to start process: ${err.message}`);
    });

    process.stdout.on('data', (data) => {
        const line = data.toString().trim();
        console.log(`[${socketEvent}] ${line}`);
        io.emit(socketEvent, line);
    });

    process.stderr.on('data', (data) => {
        const line = data.toString().trim();
        console.error(`[${socketEvent} STDERR] ${line}`);
        // Don't prefix with ERROR: as some libs log info to stderr
        io.emit(socketEvent, line);
    });

    process.on('close', (code) => {
        console.log(`[${socketEvent}] Process exited with code ${code}`);
        io.emit(socketEvent, `DONE (Code: ${code})`);
    });
}

// API Endpoints for Cockpit
app.post('/api/run/recherche', (req, res) => {
    const { urls } = req.body;
    // Navigate up from Nachrichten_App to Project root, then to Recherche
    const cwd = path.join(__dirname, '..', 'Recherche');
    const args = ['headless.py'];
    if (urls && Array.isArray(urls) && urls.length > 0) {
        args.push('--urls', ...urls);
    }

    runScript('python', args, cwd, 'log-recherche');
    res.json({ status: 'started' });
});

app.post('/api/run/video2text', (req, res) => {
    const { url, mode, translate } = req.body;
    const cwd = path.join(__dirname, '..', 'Video2Text');
    const args = ['headless_video.py'];

    if (mode === 'batch') {
        args.push('--scan-dir');
    } else {
        if (!url) return res.status(400).json({ error: 'URL required' });
        args.push('--url', url);
    }

    if (translate === false) {
        args.push('--no-translate');
    }

    runScript('python', args, cwd, 'log-video');
    res.json({ status: 'started' });
});

app.post('/api/open-video-downloads', (req, res) => {
    const downloadsPath = path.join(__dirname, '..', 'Video2Text', 'downloads');
    const { exec } = require('child_process');
    console.log(`Opening folder: ${downloadsPath}`);

    // Windows specific command to open folder
    exec(`explorer "${downloadsPath}"`, (err) => {
        if (err) {
            console.error('Failed to open folder:', err);
            return res.status(500).json({ error: 'Failed to open folder' });
        }
        res.json({ success: true });
    });
});

app.post('/api/open-app-data', (req, res) => {
    const dataPath = path.join(__dirname, 'data');
    const { exec } = require('child_process');
    console.log(`Opening folder: ${dataPath}`);

    exec(`explorer "${dataPath}"`, (err) => {
        if (err) {
            console.error('Failed to open folder:', err);
            return res.status(500).json({ error: 'Failed to open folder' });
        }
        res.json({ success: true });
    });
});

app.post('/api/open-notes', (req, res) => {
    const notesPath = path.join(__dirname, 'notes.txt');
    const { exec } = require('child_process');

    // Check if file exists, create if not
    if (!fs.existsSync(notesPath)) {
        fs.writeFileSync(notesPath, '', 'utf8');
    }

    console.log(`Opening notes: ${notesPath}`);
    // Windows specific command to open file
    exec(`start "" "${notesPath}"`, { shell: true }, (err) => {
        if (err) {
            console.error('Failed to open notes:', err);
            return res.status(500).json({ error: 'Failed to open notes' });
        }
        res.json({ success: true });
    });
});

app.post('/api/run/skript', (req, res) => {
    const cwd = path.join(__dirname, '..', 'Skript');
    // Assuming skript_generator is the file, but user mentioned "Skript" -> "upload_daily_news" logic?
    // Wait, the user prompt said "Skript" to run.
    // In the file listing earlier, Skript folder had 3 files but I missed the content check.
    // Let's assume there is a python script there or we use the upload script from Text_To_Json/Skript location?
    // Actually, looking at the previous file list for Skript folder:
    // It had "Skript" directory but the list_dir failed earlier? 
    // Ah, wait. I saw "Skript" directory in root.
    // Let's use upload_daily_news.py from Text_To_Json for now as a placeholder or the actual Skript.
    // Re-reading task 1: "Analyze Skript component".
    // I will hook up a dummy "echo" for safety if file not found, but likely it is `python upload_daily_news.py` 
    // based on typical workflow, OR `skript_generator.py` if I find it.
    // Let's target the one in Text_To_Json/upload_daily_news.py as it seems related to "Skript" action usually.
    // User Update: "Skript" might mean the Skript GENERATOR.
    // I will point to Skript/skript_generator.py (if exists) or just echo for now.
    // I will check the Skript folder existence dynamically or just try running it.

    // Correction: In Step 25 listing of Text_To_Json folder (which was actually Skript folder content? No.)
    // Step 25 was "d:/Antigravity_Projeckte/NachrichtenPro/Skript" listing? 
    // No, Step 25 was "d:/Antigravity_Projeckte/NachrichtenPro/Skript" -> 0 subdirectories, 3 files: check_bom, start_upload, upload_daily_news.
    // So "Skript" action = upload_daily_news.py.

    const cwdSkript = path.join(__dirname, '..', 'Skript');
    runScript('python', ['upload_daily_news.py'], cwdSkript, 'log-skript');
    res.json({ status: 'started' });
});

app.post('/api/kill-all', (req, res) => {
    const batPath = path.join(__dirname, '..', 'KILL_Terminals.bat');
    console.log(`Executing Kill Switch: ${batPath}`);

    // We use exec to run the bat file. It might kill this server process too, which is intended.
    const { exec } = require('child_process');
    exec(`"${batPath}"`, (err, stdout, stderr) => {
        if (err) {
            console.error('Kill switch failed (or server died before reporting):', err);
            // It's possible the server is killed before responding, which is fine.
        }
    });
    res.json({ status: 'shutting_down' });
});


// Helper to get formatted date "YYYY-MM-DD" in Vienna Timezone
function getFormattedDate(date) {
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

    if (req.query.date === 'yesterday') {
        const viennaTodayStr = getFormattedDate(new Date());
        const viennaDate = new Date(viennaTodayStr + 'T12:00:00');
        viennaDate.setDate(viennaDate.getDate() - 1);
        targetDate = viennaDate;
    } else if (req.query.date) {
        const parts = req.query.date.split('-');
        if (parts.length === 3) {
            targetDate = new Date(req.query.date);
        }
    }

    const dateStr = getFormattedDate(targetDate);
    const dataDir = path.join(__dirname, 'data');

    fs.readdir(dataDir, async (err, files) => {
        if (err) {
            console.error('Error reading data directory:', err);
            return res.status(500).json({ message: "Interner Serverfehler" });
        }

        let matchingFiles = files.filter(file =>
            (file.startsWith(dateStr) || file.startsWith('permanent')) && file.toLowerCase().endsWith('.json')
        );

        if (matchingFiles.length === 0) {
            return res.status(404).json({ message: "Keine Nachrichten für dieses Datum verfügbar" });
        }

        matchingFiles.sort((a, b) => {
            const aIsPerm = a.startsWith('permanent');
            const bIsPerm = b.startsWith('permanent');
            if (aIsPerm && !bIsPerm) return -1;
            if (!aIsPerm && bIsPerm) return 1;
            if (aIsPerm && bIsPerm) return a.localeCompare(b);
            if (a === `${dateStr}.json`) return -1;
            if (b === `${dateStr}.json`) return 1;
            return a.localeCompare(b);
        });

        let mergedData = [];
        try {
            const filePromises = matchingFiles.map(file => {
                return new Promise((resolve, reject) => {
                    const filePath = path.join(dataDir, file);
                    fs.readFile(filePath, 'utf8', (err, content) => {
                        if (err) return reject(err);
                        try {
                            const jsonData = JSON.parse(content);
                            resolve(Array.isArray(jsonData) ? jsonData : []);
                        } catch (parseErr) {
                            resolve([]);
                        }
                    });
                });
            });

            const results = await Promise.all(filePromises);
            results.forEach(data => {
                mergedData = mergedData.concat(data);
            });
            res.json(mergedData);

        } catch (readError) {
            res.status(500).json({ message: "Fehler beim Laden der Nachrichten" });
        }
    });
});

server.listen(PORT, () => {
    console.log(`Cockpit Server running on http://localhost:${PORT}`);
});
