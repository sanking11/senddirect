// News API Configuration
const NEWS_API_KEY = '6f9975f2b3b543a585935f9868c68485';
const CORS_PROXY = 'https://api.allorigins.win/raw?url=';

const categories = {
    'AI': 'artificial intelligence',
    'Q': 'quantum computing',
    'Φ': 'physics',
    'T': 'technology',
    'S': 'space science',
    'N': 'neuroscience'
};

async function fetchNews() {
    const newsGrid = document.querySelector('.news-grid');
    const categoryKeys = Object.keys(categories);
    
    // Show loading state
    newsGrid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 3rem; color: rgba(255,255,255,0.7); font-size: 1.2rem;">Loading real news...</div>';
    
    try {
        // Fetch news for each category
        const newsPromises = categoryKeys.map(async (icon) => {
            const query = categories[icon];
            const apiUrl = `https://newsapi.org/v2/everything?q=${encodeURIComponent(query)}&sortBy=publishedAt&pageSize=1&language=en&apiKey=${NEWS_API_KEY}`;
            const url = CORS_PROXY + encodeURIComponent(apiUrl);
            
            try {
                const response = await fetch(url);
                const data = await response.json();
                
                if (data.articles && data.articles.length > 0) {
                    const article = data.articles[0];
                    return {
                        icon,
                        category: query.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
                        title: article.title,
                        description: article.description || 'No description available',
                        date: new Date(article.publishedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
                        url: article.url,
                        image: article.urlToImage
                    };
                }
            } catch (err) {
                console.error(`Error fetching ${query} news:`, err);
            }
            
            return null;
        });
        
        const newsItems = (await Promise.all(newsPromises)).filter(item => item !== null);
        
        if (newsItems.length === 0) {
            // If API fails, use RSS feeds as backup
            fetchRSSNews();
            return;
        }
        
        // Display real news
        displayNews(newsItems);
        
    } catch (error) {
        console.error('Error fetching news:', error);
        fetchRSSNews();
    }
}

// Backup: Fetch from RSS feeds
async function fetchRSSNews() {
    const newsGrid = document.querySelector('.news-grid');
    
    const rssFeeds = [
        { icon: 'AI', category: 'Artificial Intelligence', url: 'https://www.technologyreview.com/topic/artificial-intelligence/feed' },
        { icon: 'Q', category: 'Quantum Computing', url: 'https://www.sciencedaily.com/rss/computers_math/quantum_computers.xml' },
        { icon: 'Φ', category: 'Physics', url: 'https://www.sciencedaily.com/rss/matter_energy/physics.xml' },
        { icon: 'T', category: 'Technology', url: 'https://www.wired.com/feed/rss' },
        { icon: 'S', category: 'Space Science', url: 'https://www.space.com/feeds/all' },
        { icon: 'N', category: 'Neuroscience', url: 'https://www.sciencedaily.com/rss/mind_brain/neuroscience.xml' }
    ];

    try {
        const newsPromises = rssFeeds.map(async (feed) => {
            try {
                const rss2jsonUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(feed.url)}&count=1`;
                const response = await fetch(rss2jsonUrl);
                const data = await response.json();
                
                if (data.items && data.items.length > 0) {
                    const item = data.items[0];
                    return {
                        icon: feed.icon,
                        category: feed.category,
                        title: item.title,
                        description: item.description ? item.description.replace(/<[^>]*>/g, '').substring(0, 150) : 'Click to read more',
                        date: new Date(item.pubDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
                        url: item.link
                    };
                }
            } catch (err) {
                console.error(`Error fetching RSS for ${feed.category}:`, err);
            }
            return null;
        });

        const newsItems = (await Promise.all(newsPromises)).filter(item => item !== null);
        
        if (newsItems.length > 0) {
            displayNews(newsItems);
        } else {
            showDemoNews();
        }
    } catch (error) {
        console.error('Error fetching RSS news:', error);
        showDemoNews();
    }
}

function displayNews(newsItems) {
    const newsGrid = document.querySelector('.news-grid');
    newsGrid.innerHTML = newsItems.map(item => `
        <article class="news-card liquid-glass" onclick="window.open('${item.url}', '_blank')" style="cursor: pointer;">
            <div class="news-card-image">${item.icon}</div>
            <div class="news-card-content">
                <div class="news-card-category">${item.category}</div>
                <h3 class="news-card-title">${truncateText(item.title, 80)}</h3>
                <p class="news-card-excerpt">${truncateText(item.description, 120)}</p>
                <div class="news-card-meta">
                    <span>${item.date}</span>
                    <span>Read More →</span>
                </div>
            </div>
        </article>
    `).join('');
    
    // Re-apply scroll reveal to new cards
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.animation = 'fadeInUp 0.8s ease-out forwards';
            }
        });
    }, {
        threshold: 0.1,
        rootMargin: '0px 0px -100px 0px'
    });

    document.querySelectorAll('.news-card').forEach(card => {
        card.style.opacity = '0';
        observer.observe(card);
    });
}

function showDemoNews() {
    const newsGrid = document.querySelector('.news-grid');
    const demoNews = [
        {
            icon: 'AI',
            category: 'Artificial Intelligence',
            title: 'Neural Networks Achieve Human-Level Reasoning',
            description: 'New architecture demonstrates unprecedented logical reasoning capabilities, challenging traditional AI limitations.',
            date: 'Jan 12, 2026',
            url: '#'
        },
        {
            icon: 'Q',
            category: 'Quantum Computing',
            title: '1000-Qubit Processor Unveiled',
            description: 'Tech giant announces breakthrough quantum processor with unprecedented qubit count and coherence time.',
            date: 'Jan 11, 2026',
            url: '#'
        },
        {
            icon: 'Φ',
            category: 'Physics',
            title: 'Dark Matter Detection Confirmed',
            description: 'International collaboration reports consistent dark matter signals across multiple underground detectors.',
            date: 'Jan 10, 2026',
            url: '#'
        },
        {
            icon: 'T',
            category: 'Technology',
            title: 'Fusion Reactor Achieves Net Gain',
            description: 'Commercial fusion project demonstrates sustained energy output exceeding input for first time.',
            date: 'Jan 9, 2026',
            url: '#'
        },
        {
            icon: 'S',
            category: 'Space Science',
            title: 'Exoplanet Biosignatures Detected',
            description: 'James Webb telescope identifies potential signs of biological activity in distant planetary atmosphere.',
            date: 'Jan 8, 2026',
            url: '#'
        },
        {
            icon: 'N',
            category: 'Neuroscience',
            title: 'Brain-Computer Interface Milestone',
            description: 'Wireless neural implant enables direct thought-to-text communication at 100 words per minute.',
            date: 'Jan 7, 2026',
            url: '#'
        }
    ];
    
    displayNews(demoNews);
    
    // Add note about demo content
    const note = document.createElement('div');
    note.style.cssText = 'grid-column: 1/-1; text-align: center; padding: 1rem; color: rgba(255,255,255,0.5); font-size: 0.9rem; margin-top: 1rem;';
    note.innerHTML = '📝 Showing demo content. Update NEWS_API_KEY in js/news.js for real news.';
    newsGrid.insertBefore(note, newsGrid.firstChild);
}

function truncateText(text, maxLength) {
    if (!text) return '';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
}

// Initialize news fetch on page load
setTimeout(() => {
    fetchNews();
}, 1000);
