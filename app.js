/**
 * Pushti Pravah - Vanilla JS Implementation
 * Follows a "Class based" approach as requested.
 */

class DataService {
    constructor(settingsService) {
        this.settingsService = settingsService;
        this.kirtans = [];
        this.leelas = [];
        this.config = null;
    }

    timeToMinutes(timeStr) {
        const [time, modifier] = timeStr.split(" ");
        let [hours, minutes] = time.split(":").map(Number);

        if (modifier === "PM" && hours !== 12) hours += 12;
        if (modifier === "AM" && hours === 12) hours = 0;

        return hours * 60 + minutes;
    }

    async init() {
        try {
            const [kRes, sRes, cRes] = await Promise.all([
                fetch('/data/kirtans.json'),
                fetch('/data/leelas.json'),
                fetch('/data/config.json')
            ]);

            const kData = await kRes.json();
            const sData = await sRes.json();
            const cData = await cRes.json();

            this.kirtans = kData.kirtans;
            this.leelas = sData.leelas;
            this.config = cData;
        } catch (error) {
            console.error("Failed to load data:", error);
        }
    }

    getLocalized(obj, forcedLang = null) {
        if (!obj) return '';
        if (typeof obj === 'string') return obj;
        const lang = forcedLang || this.settingsService.getLanguage();
        return obj[lang] || obj['sanskrit'] || obj['hindi'] || obj['gujarati'] || obj['english'] || Object.values(obj)[0];
    }

    getKirtans(search = '', filter = 'All') {
        return this.kirtans.filter(k => {
            const title = this.getLocalized(k.title);
            const matchesSearch = title.toLowerCase().includes(search.toLowerCase()) || 
                                   k.poet.toLowerCase().includes(search.toLowerCase());
            
            // Handle both string and array for samay
            const kirtanSamays = Array.isArray(k.samay) ? k.samay : [k.samay];
            const matchesFilter = filter === 'All' || kirtanSamays.includes(filter);
            
            return matchesSearch && matchesFilter;
        });
    }

    getleelas(search = '', filter = 'All') {
        return this.leelas.filter(s => {
            const title = this.getLocalized(s.title);
            const matchesSearch = title.toLowerCase().includes(search.toLowerCase()) || 
                                   s.category.toLowerCase().includes(search.toLowerCase());
            const matchesFilter = filter === 'All' || s.category === filter;
            return matchesSearch && matchesFilter;
        });
    }

    async getKirtanById(id) {
        try {
            const res = await fetch(`/data/kirtans/${id}.json`);
            return await res.json();
        } catch (e) { return null; }
    }

    async getStoryById(id) {
        try {
            const res = await fetch(`/data/leelas/${id}.json`);
            return await res.json();
        } catch (e) { return null; }
    }

    getCurrentSamay() {
        if (!this.config) return { name: "Any Time", time: "N/A", icon: "sun.svg" };
        
        const now = new Date();
        const currentMinutes = now.getHours() * 60 + now.getMinutes();
        
        const schedule = this.config.appConfig.samaySchedule
            .filter(s => s.time !== "N/A")
            .map(s => ({
                name: s.name,
                time: s.time,
                icon: s.icon || 'sun.svg',
                minutes: this.timeToMinutes(s.time)
            }))
            .sort((a, b) => a.minutes - b.minutes);

        const next = schedule.find(s => s.minutes > currentMinutes) || schedule[0];
        return next;
    }

    getDynamicRecommendations() {
        if (!this.config) return { kirtans: [], leelas: [] };
        const samay = this.getCurrentSamay();
        const samayName = samay ? samay.name : 'All';
        
        // Filter kirtans by current samay (handle both string and array)
        let relevantKirtans = this.kirtans.filter(k => {
            const kirtanSamays = Array.isArray(k.samay) ? k.samay : [k.samay];
            return kirtanSamays.includes(samayName) || kirtanSamays.includes('Any Time');
        });
        
        let recommendedSamay = samayName;
        if (relevantKirtans.length === 0) {
            relevantKirtans = this.kirtans.filter(k => {
                const kirtanSamays = Array.isArray(k.samay) ? k.samay : [k.samay];
                return kirtanSamays.includes('Any Time');
            });
            recommendedSamay = 'Any Time';
        }
        
        if (relevantKirtans.length === 0) {
            relevantKirtans = this.kirtans;
            recommendedSamay = 'All';
        }
        
        // Filter leelas
        let relevantleelas = this.leelas;

        // Shuffle and pick
        const shuffle = (array) => array.sort(() => Math.random() - 0.5);
        
        return {
            kirtans: shuffle([...relevantKirtans]).slice(0, 2),
            leelas: shuffle([...relevantleelas]).slice(0, 2),
            samay: recommendedSamay
        };
    }

    getKirtanTabs() {
        if (!this.config) return ['All'];
        return ['All', ...this.config.appConfig.samaySchedule.map(s => s.name)];
    }

    getStoryCategories() {
        if (!this.config) return [];
        return this.config.appConfig.storyCategories;
    }

    getSpotlight() {
        return this.config?.appConfig.spotlight || null;
    }
}

class SettingsService {
    constructor() {
        this.STORAGE_KEY = 'nitya_darshan_settings';
        this.settings = this.load();
    }

    load() {
        const data = localStorage.getItem(this.STORAGE_KEY);
        const defaults = { 
            userName: '', 
            language: 'sanskrit', 
            showTranslation: true,
            translationLanguage: 'english'
        };
        return data ? { ...defaults, ...JSON.parse(data) } : defaults;
    }

    save() {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.settings));
    }

    setUserName(name) {
        this.settings.userName = name;
        this.save();
    }

    setLanguage(lang) {
        this.settings.language = lang;
        this.save();
    }

    setTranslationLanguage(lang) {
        this.settings.translationLanguage = lang;
        this.save();
    }

    setTranslationToggle(show) {
        this.settings.showTranslation = show;
        this.save();
    }

    getLanguage() {
        return this.settings.language;
    }

    getTranslationLanguage() {
        return this.settings.translationLanguage || 'english';
    }

    getUserName() {
        return this.settings.userName || 'Vaishnav';
    }

    getShowTranslation() {
        return this.settings.showTranslation;
    }
}

class Router {
    constructor(dataService, settingsService) {
        this.dataService = dataService;
        this.settingsService = settingsService;
        this.mainContent = document.getElementById('main-content');
        this.currentView = 'home';
        
        // State for search and filter
        this.kirtanSearch = '';
        this.kirtanFilter = 'All';
        this.storySearch = '';
        
        window.addEventListener('popstate', () => {
            const view = new URLSearchParams(window.location.search).get('view') || 'home';
            this.navigate(view, false);
        });
    }

    async navigate(view, pushState = true) {
        this.currentView = view;
        if (pushState) {
            const url = new URL(window.location);
            url.searchParams.set('view', view);
            window.history.pushState({}, '', url);
        }

        this.updateNav();

        if (view === 'home') {
            this.renderHome();
        }
        else if (view === 'settings') {
            this.renderSettings();
        }
        else if (view === 'kirtans') {
            this.renderKirtans();
        }
        else if (view === 'leelas') {
            this.renderleelas();
        }
        else if (view.startsWith('story-list-')) {
            const category = decodeURIComponent(view.replace('story-list-', ''));
            this.renderStoryList(category);
        }
        else if (view.startsWith('kirtan-')) {
            const id = view.replace('kirtan-', '');
            const kirtan = await this.dataService.getKirtanById(id);
            this.renderKirtanDetail(kirtan);
        }
        else if (view.startsWith('story-')) {
            const id = view.replace('story-', '');
            const story = await this.dataService.getStoryById(id);
            this.renderStoryDetail(story);
        }
    }

    back() {
        window.history.back();
    }

    // updateNav() {
    //     const topLevelViews = ['home', 'kirtans', 'leelas'];
    //     const isTopLevel = topLevelViews.includes(this.currentView);
        
    //     const backBtn = document.getElementById('back-nav-btn');
    //     if (backBtn) {
    //         backBtn.style.display = isTopLevel ? 'none' : 'flex';
    //     }

    //     document.querySelectorAll('.nav-btn').forEach(btn => {
    //         if (btn.id !== 'back-nav-btn') {
    //             btn.classList.toggle('active', btn.dataset.view === this.currentView);
    //         }
    //     });
    // }

    updateNav() {
        const topLevelViews = ['home', 'kirtans', 'leelas', 'settings'];
        const isTopLevel = topLevelViews.includes(this.currentView);

        const backBtn = document.getElementById('back-nav-btn');
        const logoIcon = document.getElementById('logo-icon-container');

        if (backBtn) backBtn.style.display = isTopLevel ? 'none' : 'flex';
        if (logoIcon) logoIcon.style.display = isTopLevel ? 'flex' : 'none';

        document.querySelectorAll('.nav-btn').forEach(btn => {
            const view = btn.dataset.view;
            let isActive = false;

            if (view === 'home') {
                isActive = this.currentView === 'home';
            } else if (view === 'kirtans') {
                isActive = this.currentView === 'kirtans' || this.currentView.startsWith('kirtan-');
            } else if (view === 'leelas') {
                isActive = this.currentView === 'leelas' || this.currentView.startsWith('story-') || this.currentView.startsWith('story-list-');
            }

            btn.classList.toggle('active', isActive);
        });

        // Set dynamic top nav title for Kirtan/Story pages
        const topNavTitle = document.getElementById('top-nav-title');
        if (topNavTitle) {
            if (this.currentView === 'kirtans') {
                topNavTitle.textContent = 'Kirtans';
            } else if (this.currentView === 'leelas') {
                topNavTitle.textContent = 'Leelas';
            } else if (this.currentView === 'settings') {
                topNavTitle.textContent = 'Settings';
            } else if (this.currentView.startsWith('kirtan-')) {
                const kirtanId = this.currentView.replace('kirtan-', '');
                this.dataService.getKirtanById(kirtanId).then(k => {
                    const kirtanFromIndex = this.dataService.kirtans.find(ki => ki.id === kirtanId);
                    topNavTitle.textContent = this.dataService.getLocalized(kirtanFromIndex?.title) || 'Kirtan';
                });
            } else if (this.currentView.startsWith('story-list-')) {
                const category = decodeURIComponent(this.currentView.replace('story-list-', ''));
                topNavTitle.textContent = category;
            } else if (this.currentView.startsWith('story-')) {
                const storyId = this.currentView.replace('story-', '');
                this.dataService.getStoryById(storyId).then(s => {
                    const storyFromIndex = this.dataService.leelas.find(si => si.id === storyId);
                    topNavTitle.textContent = this.dataService.getLocalized(storyFromIndex?.title) || 'Story';
                });
            } else {
                topNavTitle.textContent = 'Pushti Pravah';
            }
        }
    }

    renderHome() {
        const samay = this.dataService.getCurrentSamay();  // Next samay
        const now = new Date();
        const ukTime = now.toLocaleTimeString('en-GB', { 
            hour: 'numeric', 
            minute: '2-digit',
            hour12: true 
        });
        
        const recommendations = this.dataService.getDynamicRecommendations();
        const userName = this.settingsService.getUserName();
        
        this.mainContent.innerHTML = `
            <div class="home-view">
                <!-- Personalised Greeting with UK Time -->
                <section class="mb-8">
                    <span class="nav-label text-secondary letter-spacing-wider">UK TIME ${ukTime}</span>
                    <h2 class="text-primary font-size-4xl margin-top-xs"><span class="text-secondary-variant">Jai Shree Krushna,</span> ${userName}</h2>
                </section>

                <!-- Next Darshan Card -->
                <section class="mb-12">
                    <div class="samay-card samay-hero-card">
                        <div class="samay-info">
                            <div class="logo-icon samay-hero-icon">
                                <img src="${samay.icon}" alt="${samay.name}" class="icon-xl">
                            </div>
                            <div>
                                <span class="nav-label samay-hero-label">Next Darshan • ${samay?.time || ''}</span>
                                <h3 class="samay-title text-white font-size-4xl">${samay?.name || 'Loading...'}</h3>
                            </div>
                        </div>
                    </div>
                </section>

                <!-- Dynamic Kirtan Section -->
                <section class="mb-12">
                    <div class="flex items-center justify-between mb-8">
                        <div>
                            <span class="nav-label text-secondary letter-spacing-wider">DIVINE MELODIES</span>
                            <h3 class="text-primary font-size-4xl margin-top-xs">${samay?.name || 'Daily'} Kirtans</h3>
                        </div>
                    </div>
                    
                    <div class="kirtan-list">
                        ${recommendations.kirtans.map(k => {
                            const title = this.dataService.getLocalized(k.title);
                            const samayDisplay = Array.isArray(k.samay) ? k.samay.join(' • ') : k.samay;
                            return `
                                <div onclick="router.navigate('kirtan-${k.id}')" class="kirtan-item home-kirtan-item">
                                    <div class="kirtan-info">
                                        <span class="nav-label text-secondary margin-bottom-xs display-block opacity-70">${k.poet} • ${samayDisplay}</span>
                                        <h4 class="margin-0 font-size-lg">${title}</h4>
                                    </div>
                                    <div class="logo-icon home-kirtan-icon">
                                        <img src="images/icons/forward.svg" alt="View" class="icon-md text-primary">
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>

                    <div class="mt-6">
                        <button onclick="router.setKirtanFilterAndNavigate('${recommendations.samay}')" class="btn-secondary btn-home-cta">
                            View All ${recommendations.samay}
                        </button>
                    </div>
                </section>

                <!-- Pichwai Motif Delimiter -->
                <div class="section-divider lotus section-divider-margin">
                    <img src="images/icons/lotus.svg" alt="" class="icon-2xl opacity-20">
                </div>

                <!-- Dynamic leelas Section -->
                <section class="mb-12">
                    <div class="flex items-center justify-between mb-8">
                        <div>
                            <span class="nav-label text-secondary letter-spacing-wider">SACRED CHRONICLES</span>
                            <h3 class="text-primary font-size-4xl margin-top-xs">Daily Leela</h3>
                        </div>
                    </div>

                    <div class="gallery-grid">
                        ${recommendations.leelas.map(s => `
                            <div onclick="router.navigate('story-${s.id}')" class="tonal-card home-story-card">
                                <div class="flex items-center justify-between mb-6">
                                    <!--<span class="badge badge-accent font-size-xs">${s.category}</span>-->
                                    <span class="nav-label text-secondary font-size-xs">${s.category}</span> &bull;
                                    <span class="nav-label text-secondary font-size-xs">${s.village}</span>
                                </div>
                                <h4 class="text-primary font-size-2xl margin-bottom-sm line-height-tight">${this.dataService.getLocalized(s.title)}</h4>
                                <p class="opacity-80 font-size-md margin-bottom-md story-excerpt-truncate">
                                    ${s.excerpt}
                                </p>
                                <button class="btn-link-primary w-full padding-sm">Read Chronicle</button>
                            </div>
                        `).join('')}
                    </div>

                    <div class="mt-6">
                        <button onclick="router.navigate('leelas')" class="btn-secondary btn-home-cta">
                            Explore Granths
                        </button>
                    </div>
                </section>

                <div class="lotus-divider margin-top-xl opacity-30">
                    <img src="images/icons/lotus.svg" alt="" class="icon-3xl">
                </div>
            </div>
        `;
    }

    setKirtanFilterAndNavigate(filter) {
        this.kirtanFilter = filter;
        this.navigate('kirtans');
    }

    // getNextSamay() {
    //     const samay = this.dataService.getCurrentSamay();
    //     const now = new Date();
    //     const currentMinutes = now.getHours() * 60 + now.getMinutes();
        
    //     const schedule = this.dataService.config.appConfig.samaySchedule
    //         .filter(s => s.time !== "N/A")
    //         .map(s => ({
    //             name: s.name,
    //             time: s.time,
    //             minutes: this.dataService.timeToMinutes(s.time)
    //         }))
    //         .sort((a, b) => a.minutes - b.minutes);

    //     // Find first samay that starts after now
    //     const next = schedule.find(s => s.minutes > currentMinutes);
    //     return next || schedule[0]; // Always returns something
    // }

    getSamayProgress() {
        const now = new Date();
        const minutes = now.getMinutes();
        return Math.floor((minutes / 60) * 100);
    }

    renderKirtans() {
        const tabs = this.dataService.getKirtanTabs();

        // Render search input and tabs + container
        this.mainContent.innerHTML = `
            <!--<div class="view-header">
                <span class="nav-label text-secondary">Sacred Collection</span>
                <h2 class="view-title text-primary">Kirtan Library</h2>
                <p class="text-italic opacity-60 font-size-lg">The Eternal Melodies of Pustimarg</p>
            </div>-->

            <div class="search-container">
                <img src="images/icons/search.svg" alt="Search" class="search-icon">
                <input 
                    type="text" 
                    id="kirtan-search-input"
                    value="${this.kirtanSearch}"
                    placeholder="Search manuscripts..."
                    class="sacred-input"
                >
            </div>

            <div class="tabs-container hide-scrollbar">
                ${tabs.map(tab => `
                    <button 
                        onclick="router.setKirtanFilter('${tab}')"
                        data-tab="${tab}"
                        class="tab-btn ${this.kirtanFilter === tab ? 'active' : ''}"
                    >
                        ${tab}
                    </button>
                `).join('')}
            </div>

            <div id="kirtan-list-container">
                ${this.renderKirtanListHtml()}
            </div>
        `;

        const searchInput = document.getElementById('kirtan-search-input');
        searchInput.oninput = (e) => {
            this.kirtanSearch = e.target.value;
            document.getElementById('kirtan-list-container').innerHTML = this.renderKirtanListHtml();
        };
    }

    // Helper function
    renderKirtanListHtml() {
        const kirtans = this.dataService.getKirtans(this.kirtanSearch, this.kirtanFilter);

        if (!kirtans.length) {
            return `
                <div class="tonal-card text-center padding-xl">
                    <img src="images/icons/empty.svg" alt="Empty" class="icon-3xl opacity-10">
                    <p class="opacity-60 font-size-lg margin-top-sm">No manuscripts found matching your search.</p>
                </div>
            `;
        }

        return kirtans.map(k => {
            const title = this.dataService.getLocalized(k.title);
            const samayDisplay = Array.isArray(k.samay) ? k.samay.join(' • ') : k.samay;
            return `
                <div onclick="router.navigate('kirtan-${k.id}')" class="kirtan-item">
                    <div class="kirtan-info">
                        <!--<span class="nav-label text-secondary margin-bottom-xs display-block">${k.poet} • ${samayDisplay}</span>-->
                        <span class="nav-label text-primary margin-bottom-xs display-block">${samayDisplay}</span>
                        <h4 class="margin-0">${title}</h4>
                    </div>
                    <div class="logo-icon kirtan-list-icon">
                        <img src="images/icons/forward.svg" alt="View" class="icon-sm text-primary">
                    </div>
                </div>
            `;
        }).join('');
    }

    setKirtanFilter(filter) {
        this.kirtanFilter = filter;

        // Update tab buttons
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === filter);
        });

        // Update list only
        const listContainer = document.getElementById('kirtan-list-container');
        if (listContainer) {
            listContainer.innerHTML = this.renderKirtanListHtml();
        }
    }

    renderleelas() {
        const categories = this.dataService.getStoryCategories();

        this.mainContent.innerHTML = `
            <div class="gallery-grid">
                ${categories.map((cat) => `
                    <div onclick="router.navigate('story-list-${encodeURIComponent(cat.id)}')" class="tonal-card story-category-card">
                        <div class="flex items-center justify-between mb-2">
                            <span class="nav-label text-secondary margin-bottom-xs display-block">
                                ${cat.count} Chronicles
                            </span>
                        </div>
                        <h4 class="text-primary font-size-3xl margin-bottom-sm">${cat.name}</h4>
                        <p class="opacity-80 font-size-md margin-bottom-md">${cat.desc}</p>
                        <button class="btn-link-primary">Browse Collection</button>
                    </div>
                `).join('')}
            </div>
        `;
    }

    renderStoryList(category) {
        // Render search input + container
        this.mainContent.innerHTML = `
            <!--<div class="view-header text-left">
                <h2 class="view-title text-primary">${category}</h2>
            </div>-->

            <div class="search-container">
                <img src="images/icons/search.svg" alt="Search" class="search-icon">
                <input 
                    type="text" 
                    id="story-search-input"
                    value="${this.storySearch}"
                    placeholder="Search ..."
                    class="sacred-input"
                >
            </div>

            <div id="story-list-container">
                ${this.renderStoryListHtml(category)}
            </div>
        `;

        const searchInput = document.getElementById('story-search-input');
        searchInput.oninput = (e) => {
            this.storySearch = e.target.value;
            document.getElementById('story-list-container').innerHTML = this.renderStoryListHtml(category);
        };
    }

    // Helper function
    renderStoryListHtml(category) {
        const leelas = this.dataService.getleelas(this.storySearch, category);

        if (!leelas.length) {
            return `
                <div class="tonal-card text-center padding-xl">
                    <p class="opacity-60 font-size-lg">No chronicles found matching your search.</p>
                </div>
            `;
        }

        return leelas.map(s => {
            const title = this.dataService.getLocalized(s.title);
            return `
                <div onclick="router.navigate('story-${s.id}')" class="kirtan-item">
                    <div class="kirtan-info">
                        <span class="nav-label text-primary margin-bottom-xs display-block">${s.village}</span>
                        <h4 class="margin-0">${title}</h4>
                        <p class="opacity-60 font-size-xs margin-top-xs">${s.excerpt}</p>
                    </div>
                    <div class="logo-icon kirtan-list-icon">
                        <img src="images/icons/forward.svg" alt="View" class="icon-sm text-primary">
                    </div>
                </div>
            `;
        }).join('');
    }

    renderKirtanDetail(kirtan) {
        if (!kirtan) return;
        const showTranslation = this.settingsService.getShowTranslation();
        const translationLang = this.settingsService.getTranslationLanguage();
        const kirtanFromIndex = this.dataService.kirtans.find(k => k.id === kirtan.id);
        const poet = kirtanFromIndex?.poet || '';
        const title = this.dataService.getLocalized(kirtanFromIndex?.title);

        this.mainContent.innerHTML = `
            <div class="detail-container scroll-view">
                <!-- Decorative Watermark -->
                <div class="pichwai-watermark detail-watermark opacity-5">
                    <img src="images/icons/lotus.svg" alt="" class="icon-huge">
                </div>

                <div class="manuscript-scroll">
                    <div class="kirtan-verses">
                        ${kirtan.verses.map((v, index) => `
                            <div class="verse-block text-center mb-16 relative">
                                <div class="verse-number-display mb-4">
                                    <span class="font-serif opacity-20 font-size-4xl">${index + 1}</span>
                                </div>
                                <div class="detail-lyrics font-size-2xl mb-4 text-primary font-weight-600">
                                    ${this.dataService.getLocalized(v.lyrics)}
                                </div>
                                ${showTranslation ? `
                                    <div class="detail-translation text-secondary font-size-lg opacity-80 max-w-md mx-auto">
                                        ${this.dataService.getLocalized(v.translation, translationLang)}
                                    </div>
                                ` : ''}
                            </div>
                        `).join('')}
                    </div>
                </div>

                <!-- Footer Motif -->
                <div class="lotus-divider mb-12">
                    <div class="logo-icon footer-motif-icon">
                        <img src="images/icons/temple.svg" alt="Temple" class="icon-lg text-primary">
                    </div>
                </div>

                <div class="manuscript-header text-center mb-12">
                    <div class="manuscript-title-badge mb-4">
                        <span class="nav-label text-secondary">${kirtanFromIndex?.samay || 'Any Time'}</span>
                    </div>
                    <!--<h2 class="manuscript-title text-primary font-size-4xl mb-2">${title}</h2>-->
                    <p class="manuscript-poet text-italic opacity-60 font-size-lg">— ${poet} —</p>
                </div>

                <div class="lotus-divider mb-12">
                    <div class="logo-icon footer-motif-icon">
                        <img src="images/icons/temple.svg" alt="Temple" class="icon-lg text-primary">
                    </div>
                </div>

                ${kirtanFromIndex?.youtubeId ? `
                    <div class="youtube-container">
                        <iframe 
                            src="https://www.youtube.com/embed/${kirtanFromIndex.youtubeId}" 
                            title="YouTube video player" 
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
                            allowfullscreen>
                        </iframe>
                    </div>
                ` : ''}
                
                <div class="text-center mb-12">
                    <button onclick="router.navigate('kirtans')" class="btn-secondary">Back to Library</button>
                </div>
            </div>
        `;
    }

    renderStoryDetail(story) {
        if (!story) return;
        const showTranslation = this.settingsService.getShowTranslation();
        const translationLang = this.settingsService.getTranslationLanguage();

        this.mainContent.innerHTML = `
            <div class="detail-container">
                <div class="detail-header mb-8">
                    <h2 class="text-primary font-size-3xl text-center">${this.dataService.getLocalized(story.title)}</h2>
                </div>

                <div class="tonal-card padding-lg mb-8">
                    <p class="font-size-lg story-content-text mb-6">${this.dataService.getLocalized(story.content)}</p>
                    
                    ${showTranslation ? `
                        <div class="divider-accent mb-6 opacity-20 mx-auto"></div>
                        <p class="font-size-md story-content-text text-secondary opacity-80 italic">
                            ${this.dataService.getLocalized(story.content, translationLang)}
                        </p>
                    ` : ''}
                </div>

                <div class="text-center mb-12">
                    <button onclick="router.navigate('leelas')" class="btn-secondary">Explore More Granths</button>
                </div>
            </div>
        `;
    }

    renderSettings() {
        const userName = this.settingsService.getUserName();
        const language = this.settingsService.getLanguage();
        const translationLanguage = this.settingsService.getTranslationLanguage();
        const showTranslation = this.settingsService.getShowTranslation();

        this.mainContent.innerHTML = `
            <div class="detail-container">
                <div class="tonal-card mb-8">
                    <h3 class="text-primary font-size-2xl mb-6">Profile Settings</h3>
                    <div class="mb-8">
                        <label class="nav-label text-secondary display-block mb-2">Your Name</label>
                        <input 
                            type="text" 
                            id="settings-name-input" 
                            value="${userName === 'Vaishnav' ? '' : userName}" 
                            placeholder="Enter your name"
                            class="sacred-input"
                            style="border-radius: 1rem;"
                        >
                    </div>
                </div>

                <div class="tonal-card mb-8">
                    <h3 class="text-primary font-size-2xl mb-6">Content Preferences</h3>
                    
                    <div class="mb-8">
                        <label class="nav-label text-secondary display-block mb-2">Primary Language (Lyrics)</label>
                        <div class="flex gap-4 flex-wrap">
                            <button onclick="router.setLanguage('english')" class="tab-btn ${language === 'english' ? 'active' : ''}">English</button>
                            <button onclick="router.setLanguage('hindi')" class="tab-btn ${language === 'hindi' ? 'active' : ''}">Hindi</button>
                            <button onclick="router.setLanguage('gujarati')" class="tab-btn ${language === 'gujarati' ? 'active' : ''}">Gujarati</button>
                        </div>
                    </div>

                    <div class="mb-8">
                        <div class="flex items-center justify-between mb-4">
                            <div>
                                <label class="nav-label text-secondary display-block mb-1">Show Translations</label>
                                <p class="opacity-60 font-size-sm">Display translations for verses</p>
                            </div>
                            <button onclick="router.toggleTranslation()" class="btn-secondary ${showTranslation ? 'bg-accent' : ''}">
                                ${showTranslation ? 'Enabled' : 'Disabled'}
                            </button>
                        </div>

                        ${showTranslation ? `
                            <div class="mt-6">
                                <label class="nav-label text-secondary display-block mb-2">Translation Language</label>
                                <div class="flex gap-4 flex-wrap">
                                    <button onclick="router.setTranslationLanguage('english')" class="tab-btn ${translationLanguage === 'english' ? 'active' : ''}">English</button>
                                    <button onclick="router.setTranslationLanguage('hindi')" class="tab-btn ${translationLanguage === 'hindi' ? 'active' : ''}">Hindi</button>
                                    <button onclick="router.setTranslationLanguage('gujarati')" class="tab-btn ${translationLanguage === 'gujarati' ? 'active' : ''}">Gujarati</button>
                                </div>
                            </div>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;

        const nameInput = document.getElementById('settings-name-input');
        nameInput.oninput = (e) => {
            this.settingsService.setUserName(e.target.value);
        };
    }

    setLanguage(lang) {
        this.settingsService.setLanguage(lang);
        this.renderSettings();
    }

    setTranslationLanguage(lang) {
        this.settingsService.setTranslationLanguage(lang);
        this.renderSettings();
    }

    toggleTranslation() {
        const current = this.settingsService.getShowTranslation();
        this.settingsService.setTranslationToggle(!current);
        this.renderSettings();
    }
}

// Initialize App
const settingsService = new SettingsService();
const dataService = new DataService(settingsService);
const router = new Router(dataService, settingsService);

// Global router for onclick handlers
window.router = router;

async function startApp() {
    await dataService.init();
    
    const initialView = new URLSearchParams(window.location.search).get('view') || 'home';
    router.navigate(initialView, false);

    // Register Service Worker for PWA
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/sw.js').then(registration => {
                console.log('SW registered: ', registration);
            }).catch(registrationError => {
                console.log('SW registration failed: ', registrationError);
            });
        });
    }
}

startApp();
