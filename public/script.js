document.addEventListener('DOMContentLoaded', () => {
    const newsContainer = document.getElementById('news-container');
    const dateDisplay = document.getElementById('current-date');
    const yesterdayBtn = document.getElementById('yesterday-btn');
    const todayBtn = document.getElementById('today-btn');
    const categoryNav = document.getElementById('category-nav');

    let allNewsData = []; // Store fetched data
    let currentFilter = { type: 'all', value: null }; // type: 'all' | 'group' | 'specific'

    // Define Allowed Subcategories for Österreich (Order matters!)
    const allowedSubs = [
        'Sport', 'Politik', 'Burgenland', 'Kärnten', 'Niederösterreich',
        'Oberösterreich', 'Salzburg', 'Steiermark', 'Tirol', 'Vorarlberg',
        'Wien', 'Wirtschaft', 'Chronik', 'Wissenschaft', 'Gesellschaft'
    ];

    // Helper to format date for display (German)
    function formatDateDisplay(dateObj) {
        return dateObj.toLocaleDateString('de-DE', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    }

    // Helper: Map raw category to Group and Sub-Category
    function getCategoryGroup(rawCat, url, itemHeadline, itemTeaser) {
        // Safe lower case
        const lower = rawCat ? rawCat.toLowerCase() : '';
        const isAtDomain = url && (url.includes('.at/') || url.endsWith('.at'));

        // 1. STRICT RULE: Österreich ONLY if .at domain
        if (isAtDomain) {
            const group = 'Österreich';

            // Try to find one of the allowed subcategories in the raw string
            let sub = 'Allgemein';
            const foundSub = allowedSubs.find(s => lower.includes(s.toLowerCase()));

            if (foundSub) {
                sub = foundSub;
            } else {
                // Fallbacks / Mappings for things not in list
                if (lower.includes('kultur') || lower.includes('film') || lower.includes('musik')) sub = 'Gesellschaft';
                else if (lower.includes('finanzen')) sub = 'Wirtschaft';
                else if (lower.includes('wetter')) sub = 'Chronik';
                // If it's just "Österreich" or others, it stays "Allgemein"
            }

            return { group, sub, original: rawCat };
        }

        // 2. Non-Austrian Categories (Standard Logic)
        if (!rawCat) return { group: 'Allgemein', sub: null, original: '' };

        // Wissenschaft
        // Includes: Archäologie, Bildung, Business & Erfolg (maybe?), Datenschutz
        // + existing: technik, science, ki
        if (lower.includes('wissenschaft') || lower.includes('technik') || lower.includes('science') || lower.includes('ki') ||
            lower.includes('archäologie') || lower.includes('bildung') || lower.includes('datenschutz')) {
            return { group: 'Wissenschaft', sub: null, original: rawCat };
        }

        // Politik
        // Includes: Krieg, Medien, Medienkritik, Nahost, Soziales
        // + existing: ausland, international, inland
        if (lower.includes('politik') || lower.includes('ausland') || lower.includes('international') || lower.includes('inland') ||
            lower.includes('krieg') || lower.includes('nahost') || lower.includes('soziales') ||
            (lower.includes('medien') && !lower.includes('unternehmen'))) { // 'Medien' in Politik context, but 'Medien' also in Wirtschaft? User put Medien in Wirtschaft too. Let's optimize.
            return { group: 'Politik', sub: null, original: rawCat };
        }

        // Wirtschaft
        // Includes: Medien, Netzwerk, Personalia, Unternehmen, Business & Erfolg
        // + existing: finanzen
        if (lower.includes('wirtschaft') || lower.includes('finanzen') || lower.includes('unternehmen') ||
            lower.includes('netzwerk') || lower.includes('personalia') || lower.includes('business')) {
            return { group: 'Wirtschaft', sub: null, original: rawCat };
        }

        // Gesellschaft
        // Includes: Alltag & Lifestyle, Bezirke, Bücher, Dating, Digital Lifestyle, Familie, Glücksspiel, Haus & Garten, Hilfe, Korrekturen, Lifestyle, Literatur, Reisen, Tourismus, Weltgeschehen
        // + existing: kultur, film, musik, gesundheit, natur, tier, umwelt, unterhaltung
        const gesellschaftKeywords = [
            'gesellschaft', 'kultur', 'film', 'musik', 'gesundheit', 'natur', 'tier', 'umwelt', 'unterhaltung',
            'alltag', 'lifestyle', 'bezirke', 'bücher', 'dating', 'familie', 'glücksspiel', 'haus', 'garten',
            'hilfe', 'korrekturen', 'literatur', 'reisen', 'tourismus', 'weltgeschehen', 'kunstmarkt'
        ];
        if (gesellschaftKeywords.some(k => lower.includes(k))) {
            return { group: 'Gesellschaft', sub: null, original: rawCat };
        }

        // Sport
        if (lower.includes('sport')) return { group: 'Sport', sub: null, original: rawCat };

        // Wetter
        if (lower.includes('wetter')) return { group: 'Wetter', sub: null, original: rawCat };

        // Chronik
        if (lower.includes('chronik')) return { group: 'Chronik', sub: null, original: rawCat };

        // Allgemein (Explicit from User)
        // Includes: Afrika, Audio/Podcasts
        if (lower.includes('afrika') || lower.includes('audio') || lower.includes('podcast')) {
            return { group: 'Allgemein', sub: null, original: rawCat };
        }

        // Check if rawCat itself was "Österreich" but not .at -> map to "Ausland" or keep raw? 
        // User said "alle anderen nicht" belong in category Österreich.
        if (lower.includes('österreich')) return { group: 'Allgemein', sub: null, original: rawCat };

        // Default: use raw category as group
        return { group: rawCat, sub: null, original: rawCat };
    }

    // Set initial date in header
    dateDisplay.textContent = formatDateDisplay(new Date());

    // Fetch News function
    async function fetchNews(dateParam = null) {
        newsContainer.innerHTML = '<div class="loading-state">Nachrichten werden geladen...</div>';
        categoryNav.innerHTML = ''; // Clear buttons on reload
        currentFilter = { type: 'all', value: null };

        try {
            let url = '/api/news';
            if (dateParam) {
                url += `?date=${dateParam}`;
            }

            const response = await fetch(url);

            if (!response.ok) {
                throw new Error('Netzwerkfehler oder keine Daten');
            }

            const rawData = await response.json();

            // Enrich data with grouping info
            allNewsData = rawData.map(item => {
                const groupInfo = getCategoryGroup(item.category || 'Allgemein', item.source_url, item.headline, item.teaser);
                return { ...item, ...groupInfo };
            });

            renderCategoryButtons();

            // Initial render: show all
            renderNews(allNewsData);

            // Update header date if yesterday was requested
            if (dateParam === 'yesterday') {
                const d = new Date();
                d.setDate(d.getDate() - 1);
                dateDisplay.textContent = formatDateDisplay(d);
                yesterdayBtn.style.display = 'none'; // Hide button after clicking
                todayBtn.style.display = 'block'; // Show 'Today' button
            } else {
                // If fetching today (default), ensure Yesterday is shown
                yesterdayBtn.style.display = 'block';
                todayBtn.style.display = 'none';
                dateDisplay.textContent = formatDateDisplay(new Date());
            }

        } catch (error) {
            console.error('Fehler:', error);
            newsContainer.innerHTML = '<div class="error-state">Keine Nachrichten verfügbar. Bitte prüfen Sie später erneut.</div>';
        }
    }

    // Render Category Buttons (Groups and Dropdowns)
    function renderCategoryButtons() {
        categoryNav.innerHTML = '';

        // 1. "Alle" Button
        const allBtn = document.createElement('button');
        allBtn.className = 'category-btn active';
        allBtn.textContent = 'Alle';
        allBtn.onclick = () => {
            setActiveButton(allBtn);
            currentFilter = { type: 'all', value: null };
            renderNews(allNewsData);
        };
        categoryNav.appendChild(allBtn);

        // 2. Identify Groups and their Sub-Items
        const groups = {};
        allNewsData.forEach(item => {
            if (!groups[item.group]) {
                groups[item.group] = new Set();
            }
            if (item.sub) {
                groups[item.group].add(item.sub);
            }
        });

        // Sort groups alphabetically or by fixed order
        const prioritiedGroups = ['Österreich', 'Chronik', 'Politik', 'Sport', 'Wirtschaft', 'Wissenschaft', 'Gesellschaft', 'Wetter'];
        const otherGroups = Object.keys(groups).filter(g => !prioritiedGroups.includes(g)).sort();
        const sortedGroups = [...prioritiedGroups.filter(g => groups[g]), ...otherGroups];

        // 3. Render Buttons/Dropdowns
        sortedGroups.forEach(groupName => {
            const subItems = Array.from(groups[groupName]);

            // Special case: "Österreich" or any group with sub-items gets a dropdown
            // Limitation: For "Wissenschaft", we merged categories but didn't assign sub-items in mapping (sub was null).
            // So they will be simple buttons unless I change mapping logic.
            // Requirement was: Dropdown for Österreich. Merging for others. 
            // My mapping returns `sub` only for Österreich currently. Correct.

            if (groupName === 'Österreich' && subItems.length > 0) {
                // Dropdown Structure
                const dropdown = document.createElement('div');
                dropdown.className = 'dropdown';

                const dropBtn = document.createElement('button');
                dropBtn.className = 'dropdown-btn category-btn'; // Add category-btn for base styles
                dropBtn.innerHTML = `${groupName} <span class="dropdown-arrow">▼</span>`;

                // Toggle Dropdown logic
                dropBtn.onclick = (e) => {
                    e.stopPropagation();
                    // content is defined below, which is fine for closure
                    const isShown = content.classList.contains('show');
                    closeDropdowns(); // Close others

                    if (!isShown) {
                        const rect = dropBtn.getBoundingClientRect();
                        content.style.top = `${rect.bottom}px`;
                        content.style.left = `${rect.left}px`;
                        content.classList.add('show');
                    }
                };

                const content = document.createElement('div');
                content.className = 'dropdown-content';

                // "Alle aus [Group]" option
                const allLink = document.createElement('a');
                allLink.href = '#';
                allLink.textContent = `Alle aus ${groupName}`;
                allLink.onclick = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setActiveButton(dropBtn);
                    currentFilter = { type: 'group', value: groupName };
                    renderNews(allNewsData.filter(i => i.group === groupName));
                    closeDropdowns();
                };
                content.appendChild(allLink);

                // Sub-items
                subItems.sort((a, b) => {
                    const indexA = allowedSubs.indexOf(a);
                    const indexB = allowedSubs.indexOf(b);
                    // If both are in list, sort by index
                    if (indexA !== -1 && indexB !== -1) return indexA - indexB;
                    // If only A is in list, A comes first
                    if (indexA !== -1) return -1;
                    // If only B is in list, B comes first
                    if (indexB !== -1) return 1;
                    // Otherwise sort alphabetically
                    return a.localeCompare(b);
                }).forEach(sub => {
                    const link = document.createElement('a');
                    link.href = '#';
                    link.textContent = sub;
                    link.onclick = (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setActiveButton(dropBtn);
                        currentFilter = { type: 'specific-sub', group: groupName, sub: sub };
                        renderNews(allNewsData.filter(i => i.group === groupName && i.sub === sub));
                        closeDropdowns();
                    };
                    content.appendChild(link);
                });

                dropdown.appendChild(dropBtn);
                dropdown.appendChild(content);
                categoryNav.appendChild(dropdown);

            } else {
                // Simple Button (Mergers logic)
                const btn = document.createElement('button');
                btn.className = 'category-btn';
                btn.textContent = groupName;
                btn.onclick = () => {
                    setActiveButton(btn);
                    currentFilter = { type: 'group', value: groupName };
                    renderNews(allNewsData.filter(i => i.group === groupName));
                };
                categoryNav.appendChild(btn);
            }
        });

    }

    function closeDropdowns() {
        document.querySelectorAll('.dropdown-content').forEach(el => el.classList.remove('show'));
    }

    // Helper: Set active class on buttons
    function setActiveButton(activeBtn) {
        document.querySelectorAll('.category-btn, .dropdown-btn').forEach(b => b.classList.remove('active'));
        // If it's a dropdown button part of a structure, we need to find the button
        // activeBtn is passed directly.
        activeBtn.classList.add('active');
    }

    // Render News function
    function renderNews(newsData) {
        newsContainer.innerHTML = '';

        const newsCount = document.getElementById('news-count');
        if (newsCount) {
            newsCount.textContent = `Anzahl der Einträge: ${newsData.length}`;
        }

        if (newsData.length === 0) {
            newsContainer.innerHTML = '<div class="error-state">Keine Nachrichten in dieser Kategorie.</div>';
            return;
        }

        // Group by DISPLAY category (The unified Group Name)
        const grouped = newsData.reduce((acc, item) => {
            const cat = item.group || 'Allgemein';
            if (!acc[cat]) acc[cat] = [];
            acc[cat].push(item);
            return acc;
        }, {});

        for (const [category, items] of Object.entries(grouped)) {
            const catSection = document.createElement('div');
            catSection.className = 'news-category';

            const catTitle = document.createElement('div');
            catTitle.className = 'category-title';
            catTitle.textContent = category;
            catSection.appendChild(catTitle);

            // SORTING LOGIC: Prioritize Football in "Österreich > Sport"
            items.sort((a, b) => {
                // Check if items are "Sport" (under Österreich)
                const isSportA = (a.group === 'Österreich' && a.sub === 'Sport');
                const isSportB = (b.group === 'Österreich' && b.sub === 'Sport');

                // If both are Sport, check for Football content
                if (isSportA && isSportB) {
                    const footballKeywords = [
                        'fußball', 'fussball', 'soccer', 'bundesliga', 'oefb', 'öfb', 'fifa', 'uefa', 'kicker', 'ball', 'tor', 'match', 'spiel', 'lig',
                        'champions league', 'europa league', 'conference league', 'nationalteam', 'teamchef',
                        'rapid', 'sturm', 'austria wien', 'lask', 'altach', 'hartberg', 'wolfsberg', 'wac', 'klagenfurt', 'blau-weiß', 'gak', 'red bull', 'salzburg', 'liefering', 'svr', 'ried', 'admira', 'vienna', 'sportclub',
                        'tabellenführer', 'meisterschaft', 'cup', 'abstieg', 'aufstieg', 'relegation'
                    ];

                    // Safe text concatenation
                    const txtA = ((a.headline || '') + ' ' + (a.teaser || '')).toLowerCase();
                    const txtB = ((b.headline || '') + ' ' + (b.teaser || '')).toLowerCase();

                    const aIsFootball = footballKeywords.some(k => txtA.includes(k));
                    const bIsFootball = footballKeywords.some(k => txtB.includes(k));

                    if (aIsFootball && !bIsFootball) return -1; // A (Football) comes first
                    if (!aIsFootball && bIsFootball) return 1;  // B (Football) comes first
                }

                // Keep original order otherwise
                return 0;
            });

            items.forEach(item => {
                const article = createNewsItem(item);
                catSection.appendChild(article);
            });

            newsContainer.appendChild(catSection);
        }
    }

    // Create single news item element
    function createNewsItem(item) {
        const el = document.createElement('div');
        el.className = 'news-item';

        const warningHtml = item.warning
            ? `<div class="warning-badge">\u26A0 ${item.warning}</div>`
            : '';

        el.innerHTML = `
            <div class="news-header">
                <span class="news-emoji">${item.emoji || '\uD83D\uDCF0'}</span>
                <span class="news-headline">${item.headline}</span>
            </div>
            <div class="news-content">
                <div class="news-body">
                    <p class="news-teaser">${item.teaser}</p>
                    <div class="news-meta">
                        ${warningHtml}
                        <a href="${item.source_url}" target="_blank" class="source-link">
                            ${item.source_name} \u2197
                        </a>
                    </div>
                </div>
            </div>
        `;

        // Add Click Listener for Accordion
        const header = el.querySelector('.news-header');
        header.addEventListener('click', () => {
            const content = el.querySelector('.news-content');
            const isOpen = content.classList.contains('open');

            if (isOpen) {
                content.classList.remove('open');
            } else {
                content.classList.add('open');
            }
        });

        return el;
    }

    // Event Listeners
    yesterdayBtn.addEventListener('click', () => {
        fetchNews('yesterday');
    });

    todayBtn.addEventListener('click', () => {
        fetchNews(null); // default to today
    });

    // Initial Load
    fetchNews();

    // Drag-to-Scroll Logic for Category Nav
    let isDown = false;
    let startX;
    let scrollLeft;

    categoryNav.addEventListener('mousedown', (e) => {
        isDown = true;
        categoryNav.classList.add('active');
        startX = e.pageX - categoryNav.offsetLeft;
        scrollLeft = categoryNav.scrollLeft;
    });

    categoryNav.addEventListener('mouseleave', () => {
        isDown = false;
        categoryNav.classList.remove('active');
    });

    categoryNav.addEventListener('mouseup', () => {
        isDown = false;
        categoryNav.classList.remove('active');
    });

    categoryNav.addEventListener('mousemove', (e) => {
        if (!isDown) return;
        e.preventDefault();
        const x = e.pageX - categoryNav.offsetLeft;
        const walk = (x - startX) * 2; // Scroll-fast
        categoryNav.scrollLeft = scrollLeft - walk;
    });

    // Back to Top Logic
    const backToTopBtn = document.getElementById('back-to-top');

    window.addEventListener('scroll', () => {
        if (window.scrollY > 300) {
            backToTopBtn.classList.add('visible');
        } else {
            backToTopBtn.classList.remove('visible');
        }
    });

    backToTopBtn.addEventListener('click', () => {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    });

    // Close dropdowns when clicking outside
    document.addEventListener('click', closeDropdowns);
    // Also update position or close on scroll
    categoryNav.addEventListener('scroll', closeDropdowns);
});
