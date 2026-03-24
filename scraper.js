document.addEventListener('DOMContentLoaded', () => {
    const tabs = document.querySelectorAll('.tab-btn');
    const inputGroups = {
        'url-input': document.getElementById('url-input'),
        'file-input': document.getElementById('file-input')
    };
    
    let currentMode = 'url';
    const scrapeBtn = document.getElementById('scrapeBtn');
    const extractType = document.getElementById('extractType');
    const resultsSection = document.getElementById('resultsSection');
    const resultsContainer = document.getElementById('resultsContainer');
    const resultCount = document.getElementById('resultCount');
    const downloadBtn = document.getElementById('downloadBtn');
    
    let extractedData = [];
    let lastFetchedUrl = '';
    let cachedDoc = null; // Caching to avoid hammering the proxies

    // Tab Switching
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            Object.values(inputGroups).forEach(g => g.classList.remove('active'));
            const target = tab.getAttribute('data-target');
            inputGroups[target].classList.add('active');
            
            currentMode = target === 'url-input' ? 'url' : 'file';
        });
    });

    // Scrape Engine
    scrapeBtn.addEventListener('click', async () => {
        scrapeBtn.classList.add('loading');
        resultsSection.classList.add('hidden');
        
        try {
            let baseUrl = '';

            if (currentMode === 'url') {
                const urlInput = document.getElementById('targetUrl').value;
                if (!urlInput) throw new Error("Please enter a valid URL to fetch.");
                try { new URL(urlInput); } catch { throw new Error("Invalid URL format. Include http:// or https://"); }
                
                baseUrl = urlInput;
                
                // Fetch page if URL changed
                if (lastFetchedUrl !== urlInput || !cachedDoc) {
                    try {
                        // Attempt Primary Proxy Server (Corsproxy.io)
                        const response = await fetch(`https://corsproxy.io/?${encodeURIComponent(urlInput)}`);
                        if (!response.ok) throw new Error("corsproxy failed");
                        const htmlContent = await response.text();
                        const parser = new DOMParser();
                        cachedDoc = parser.parseFromString(htmlContent, 'text/html');
                        lastFetchedUrl = urlInput;
                    } catch (primaryErr) {
                        console.log("Primary proxy route failed, attempting AllOrigins fallback...");
                        // Fallback Proxy Server (AllOrigins)
                        const fallbackResponse = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(urlInput)}`);
                        if (!fallbackResponse.ok) throw new Error(`Network failure. The proxies may be blocked from accessing this domain.`);
                        const data = await fallbackResponse.json();
                        if (!data.contents) throw new Error("Website security directly blocked the extraction proxy.");
                        
                        const parser = new DOMParser();
                        cachedDoc = parser.parseFromString(data.contents, 'text/html');
                        lastFetchedUrl = urlInput;
                    }
                }
            } else {
                const fileInput = document.getElementById('targetFile').files[0];
                if (!fileInput) throw new Error("Please select an HTML file to upload.");
                
                const htmlContent = await fileInput.text();
                baseUrl = 'file://localhost';
                const parser = new DOMParser();
                cachedDoc = parser.parseFromString(htmlContent, 'text/html');
                lastFetchedUrl = 'file_upload';
            }
            
            // Execute the data extraction logic against the cached document
            performExtraction(cachedDoc, baseUrl);
            
        } catch (err) {
            alert("Extraction Failed:\n" + err.message);
        } finally {
            scrapeBtn.classList.remove('loading');
        }
    });

    function resolveUrl(relativeUrl, base) {
        if (!relativeUrl) return '';
        if (relativeUrl.startsWith('data:')) return 'Data URI (image payload)';
        if (relativeUrl.startsWith('javascript:')) return 'Javascript execution block';
        try {
            return new URL(relativeUrl, base).href;
        } catch {
            return relativeUrl;
        }
    }

    function performExtraction(doc, baseUrl) {
        const type = extractType.value;
        extractedData = [];
        const textContent = doc.body.textContent;

        if (type === 'contact-data') {
            const decodeCfEmail = (encoded) => {
                let em = '', key = parseInt(encoded.substr(0, 2), 16);
                for (let i = 2; i < encoded.length; i += 2) {
                    em += String.fromCharCode(parseInt(encoded.substr(i, 2), 16) ^ key);
                }
                return em;
            };

            Array.from(doc.querySelectorAll('[data-cfemail]')).forEach(el => {
                const em = decodeCfEmail(el.getAttribute('data-cfemail'));
                if (em) extractedData.push({ type: 'Email', source: 'Cloudflare', value: em });
            });
            Array.from(doc.querySelectorAll('a[href^="/cdn-cgi/l/email-protection#"]')).forEach(a => {
                const hash = a.getAttribute('href').split('#')[1];
                if (hash) {
                    const em = decodeCfEmail(hash);
                    if (em) extractedData.push({ type: 'Email', source: 'Cloudflare', value: em });
                }
            });

            Array.from(doc.querySelectorAll('a[href^="mailto:"]')).forEach(a => {
                const em = a.getAttribute('href').replace('mailto:', '').split('?')[0].trim();
                if (em) extractedData.push({ type: 'Email', source: 'Mailto Link', value: em });
            });
            
            const standardEmailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,10}\b/gi;
            const standardEmails = textContent.match(standardEmailRegex) || [];
            
            const strictEmailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.(com|org|net|edu|gov|io|co|uk|de|ca|us|info|biz|me|tv|xyz|app|dev)\b/gi;
            const normalizedText = textContent
                .replace(/\s*\[at\]\s*|\s*\(at\)\s*|\s+at\s+/gi, '@')
                .replace(/\s*\[dot\]\s*|\s*\(dot\)\s*|\s+dot\s+/gi, '.');
            const obfuscatedEmails = normalizedText.match(strictEmailRegex) || [];
            
            [...new Set([...standardEmails, ...obfuscatedEmails])].forEach(emailStr => {
                const cleanEmail = emailStr.toLowerCase().trim();
                if (!extractedData.some(e => e.type === 'Email' && e.value.toLowerCase() === cleanEmail)) {
                    extractedData.push({ type: 'Email', source: 'Page Text', value: cleanEmail });
                }
            });

            Array.from(doc.querySelectorAll('a[href^="tel:"]')).forEach(a => {
                const ph = a.getAttribute('href').replace('tel:', '').trim();
                if (ph) extractedData.push({ type: 'Phone', source: 'Tel Link', value: ph });
            });
            const broaderPhoneRegex = /\+?\d{1,4}?[-.\s]?\(?\d{1,3}?\)?[-.\s]?\d{1,4}[-.\s]?\d{1,4}[-.\s]?\d{1,9}/g;
            const phones = textContent.match(broaderPhoneRegex) || [];
            [...new Set(phones)].forEach(ph => {
                const digits = ph.replace(/\D/g, '');
                if (digits.length >= 7 && digits.length <= 15) {
                    if (!extractedData.some(p => p.type === 'Phone' && p.value === ph.trim())) {
                        extractedData.push({ type: 'Phone', source: 'Page Text', value: ph.trim() });
                    }
                }
            });

            const socialFilters = {
                'LinkedIn': (u) => u.hostname.includes('linkedin.com') && (u.pathname.startsWith('/in/') || u.pathname.startsWith('/company/')),
                'Twitter / X': (u) => (u.hostname === 'twitter.com' || u.hostname === 'x.com' || u.hostname.endsWith('.twitter.com') || u.hostname.endsWith('.x.com')) && !u.pathname.includes('/status/'),
                'Facebook': (u) => u.hostname.includes('facebook.com') && !u.pathname.includes('/posts/') && !u.pathname.includes('/groups/'),
                'Instagram': (u) => u.hostname.includes('instagram.com') && !u.pathname.includes('/p/') && !u.pathname.includes('/reel/'),
                'YouTube': (u) => (u.hostname.includes('youtube.com') || u.hostname === 'youtu.be') && !u.pathname.includes('/watch') && !u.pathname.includes('/playlist'),
                'GitHub': (u) => u.hostname.includes('github.com') && u.pathname.split('/').filter(Boolean).length === 1,
                'Medium': (u) => u.hostname.includes('medium.com') && !u.pathname.includes('/p/'),
                'Pinterest': (u) => u.hostname.includes('pinterest.com') && !u.pathname.includes('/pin/')
            };

            Array.from(doc.querySelectorAll('a')).forEach(a => {
                const rawHref = a.getAttribute('href');
                if (rawHref) {
                    try {
                        const parsedUrl = new URL(resolveUrl(rawHref, baseUrl));
                        for (const [platformName, filterFn] of Object.entries(socialFilters)) {
                            if (filterFn(parsedUrl)) {
                                extractedData.push({ type: 'Social Profile', platform: platformName, url: parsedUrl.href });
                                break;
                            }
                        }
                    } catch (e) {}
                }
            });
            
            extractedData = extractedData.filter((v, i, a) => a.findIndex(t => (t.url === v.url && t.type === 'Social Profile') || (t.value === v.value && t.type !== 'Social Profile')) === i);

        } else if (type === 'media-links') {
            Array.from(doc.querySelectorAll('a')).forEach(a => {
                const rawHref = a.getAttribute('href');
                if (rawHref && !rawHref.startsWith('javascript:')) {
                    extractedData.push({ type: 'Web Link', text: a.textContent.trim() || '[No Text]', url: resolveUrl(rawHref, baseUrl) });
                }
            });

            const keywords = ['contact', 'about', 'team', 'support', 'help', 'pricing'];
            Array.from(doc.querySelectorAll('a')).forEach(a => {
                const rawHref = a.getAttribute('href') || '';
                const text = a.textContent.toLowerCase();
                if (keywords.some(k => rawHref.toLowerCase().includes(k) || text.includes(k))) {
                    if (!rawHref.startsWith('javascript:')) {
                        const existingLink = extractedData.find(e => e.url === resolveUrl(rawHref, baseUrl));
                        if(existingLink) existingLink.type = 'Contact Page Link';
                    }
                }
            });

            Array.from(doc.querySelectorAll('img')).forEach(img => {
                const rawSrc = img.getAttribute('src');
                if (rawSrc) {
                    extractedData.push({ type: 'Image', alt: img.getAttribute('alt') || '[No Alt Text]', url: resolveUrl(rawSrc, baseUrl) });
                }
            });
            
            extractedData = extractedData.filter((v, i, a) => a.findIndex(t => t.url === v.url) === i);

        } else if (type === 'text-content') {
            Array.from(doc.querySelectorAll('h1, h2, h3, h4, h5, h6')).forEach(h => {
                const text = h.textContent.trim();
                if (text) extractedData.push({ element: h.tagName.toLowerCase(), content: text });
            });
            Array.from(doc.querySelectorAll('p')).forEach(p => {
                const text = p.textContent.trim();
                if (text.length > 0) extractedData.push({ element: 'paragraph', length: text.length, content: text });
            });

        } else if (type === 'metadata') {
            const title = doc.querySelector('title');
            if (title) extractedData.push({ metaType: 'Page Title', content: title.textContent.trim() });
            
            Array.from(doc.querySelectorAll('meta')).forEach(m => {
                const name = m.getAttribute('name') || m.getAttribute('property');
                const content = m.getAttribute('content');
                if (name && content) extractedData.push({ metaType: name, content: content });
            });
        }

        renderResults();
    }

    function escapeHTML(str) {
        return str.replace(/[&<>'"]/g, tag => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
        }[tag] || tag));
    }

    function renderResults() {
        resultsContainer.innerHTML = '';
        resultCount.textContent = `${extractedData.length} items`;
        
        if (extractedData.length === 0) {
            resultsContainer.innerHTML = '<div class="no-data">No elements matched your extraction query.</div>';
        } else {
            extractedData.forEach(item => {
                const card = document.createElement('div');
                card.className = 'result-card';
                
                Object.entries(item).forEach(([key, value]) => {
                    const row = document.createElement('div');
                    row.className = 'result-row';
                    row.innerHTML = `<span class="result-key">${escapeHTML(key)}:</span> <span class="result-value">${escapeHTML(String(value))}</span>`;
                    card.appendChild(row);
                });
                
                resultsContainer.appendChild(card);
            });
        }
        
        resultsSection.classList.remove('hidden');
    }

    downloadBtn.addEventListener('click', () => {
        if (extractedData.length === 0) return;
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(extractedData, null, 2));
        const anchor = document.createElement('a');
        anchor.href = dataStr;
        anchor.download = `webxtractor-${extractType.value}-${new Date().getTime()}.json`;
        anchor.click();
    });
});
