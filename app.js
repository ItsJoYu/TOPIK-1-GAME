/**
 * TOPIK I Vocabulary Game & Study App Logic
 * Designed for offline responsiveness, multiplatform (Android & PC), and CORS-free operation.
 */

class TopikApp {
    constructor() {
        // App State
        this.words = window.TOPIK_WORDS || [];
        this.currentScreen = 'lobby';
        
        // Quiz Configuration
        this.quizSize = 25; // 25, 50, 100, 'all'
        this.quizOrder = 'sequential'; // 'sequential', 'random'
        this.activeBlockIndex = 0; // selected block index (0-based)
        
        // Active Quiz State
        this.quizWords = [];
        this.currentIndex = 0;
        this.score = 0;
        this.startTime = null;
        this.mistakenWords = []; // Array of { word, userChoice }
        this.isAnsweringAllowed = true;
        this.autoAdvanceTimeout = null;

        // Active Study State
        this.hideStudyMeanings = false;
        
        // Lifetime Stats (loaded from localStorage)
        this.stats = {
            totalCorrect: 0,
            completedBlocks: [] // list of completed block identifiers (e.g. "size_50_block_2")
        };
    }

    /**
     * Initialize application
     */
    init() {
        console.log(`App initialized with ${this.words.length} words.`);
        
        // Load stats from LocalStorage
        this.loadStats();

        // Setup Lobby UI listeners
        this.setupLobbyListeners();
        
        // Initialize block list for the default size
        this.generateLobbyBlocks();
        
        // Render initial stats
        this.updateStatsUI();
        
        // Check for saved quiz progress
        this.checkSavedProgress();

        // Render first batch of dictionary items
        this.initDictionary();
    }

    // ==========================================
    // SCREEN & PERSISTENCE MANAGEMENT
    // ==========================================

    /**
     * Switch active screen in the UI
     */
    showScreen(screenId) {
        // Clear any auto-advance timers from quiz screen
        if (this.autoAdvanceTimeout) {
            clearTimeout(this.autoAdvanceTimeout);
            this.autoAdvanceTimeout = null;
        }

        // Hide all screens
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
        });

        // Show targets
        const activeScreen = document.getElementById(`screen-${screenId}`);
        if (activeScreen) {
            activeScreen.classList.add('active');
            window.scrollTo(0, 0);
        }

        // Update nav buttons active state
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        
        if (screenId === 'lobby') {
            document.getElementById('nav-lobby-btn').classList.add('active');
        } else if (screenId === 'study') {
            document.getElementById('nav-study-btn').classList.add('active');
        } else if (screenId === 'dictionary') {
            document.getElementById('nav-dictionary-btn').classList.add('active');
        }

        this.currentScreen = screenId;
    }

    /**
     * Load stats and completion data from LocalStorage
     */
    loadStats() {
        const savedStats = localStorage.getItem('topik_quiz_stats');
        if (savedStats) {
            try {
                const parsed = JSON.parse(savedStats);
                this.stats = { ...this.stats, ...parsed };
            } catch (e) {
                console.error('Error parsing stats:', e);
            }
        }
    }

    /**
     * Save stats to LocalStorage
     */
    saveStats() {
        localStorage.setItem('topik_quiz_stats', JSON.stringify(this.stats));
        this.updateStatsUI();
    }

    /**
     * Update the lobby dashboard stats cards
     */
    updateStatsUI() {
        document.getElementById('stats-total-correct').innerText = this.stats.totalCorrect.toLocaleString();
        document.getElementById('stats-completed-blocks').innerText = this.stats.completedBlocks.length.toLocaleString();
    }

    /**
     * Check if there's an ongoing quiz in LocalStorage
     */
    checkSavedProgress() {
        const savedProgress = localStorage.getItem('topik_quiz_session');
        if (savedProgress) {
            try {
                const session = JSON.parse(savedProgress);
                // Verify the session has valid data
                if (session && session.quizWords && session.quizWords.length > 0) {
                    const toast = document.getElementById('resume-toast');
                    const details = document.getElementById('resume-details');
                    
                    const percent = Math.round((session.currentIndex / session.quizWords.length) * 100);
                    details.innerText = `Kuis: ${session.quizWords.length} kata (${session.quizOrder === 'random' ? 'Acak' : 'Urut'}). Progres: Soal ${session.currentIndex + 1}/${session.quizWords.length} (${percent}%).`;
                    toast.classList.remove('hidden');
                }
            } catch (e) {
                console.error('Error parsing progress session:', e);
            }
        }
    }

    /**
     * Resume the saved quiz session
     */
    resumeProgress() {
        const savedProgress = localStorage.getItem('topik_quiz_session');
        if (!savedProgress) return;
        
        try {
            const session = JSON.parse(savedProgress);
            this.quizWords = session.quizWords;
            this.currentIndex = session.currentIndex;
            this.score = session.score;
            this.startTime = session.startTime || Date.now();
            this.mistakenWords = session.mistakenWords || [];
            this.quizSize = session.quizSize;
            this.quizOrder = session.quizOrder;
            this.activeBlockIndex = session.activeBlockIndex;

            // Hide the resume card toast
            document.getElementById('resume-toast').classList.add('hidden');
            
            // Go directly to quiz
            this.showScreen('quiz');
            this.renderQuestion();
        } catch (e) {
            console.error('Error resuming session:', e);
            this.clearSavedProgress();
        }
    }

    /**
     * Delete saved progress from LocalStorage
     */
    clearSavedProgress() {
        localStorage.removeItem('topik_quiz_session');
        document.getElementById('resume-toast').classList.add('hidden');
    }

    /**
     * Persist current quiz state
     */
    saveCurrentQuizSession() {
        const session = {
            quizWords: this.quizWords,
            currentIndex: this.currentIndex,
            score: this.score,
            startTime: this.startTime,
            mistakenWords: this.mistakenWords,
            quizSize: this.quizSize,
            quizOrder: this.quizOrder,
            activeBlockIndex: this.activeBlockIndex
        };
        localStorage.setItem('topik_quiz_session', JSON.stringify(session));
    }

    // ==========================================
    // LOBBY SETUP & EVENT HANDLERS
    // ==========================================

    /**
     * Bind click events to lobby settings controls
     */
    setupLobbyListeners() {
        // Size buttons
        document.querySelectorAll('#size-toggles .toggle-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('#size-toggles .toggle-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                
                const val = btn.dataset.size;
                this.quizSize = val === 'all' ? 'all' : parseInt(val, 10);
                
                // Show/hide blocks selector
                const blockGroup = document.getElementById('block-selection-group');
                if (this.quizSize === 'all') {
                    blockGroup.classList.add('hidden');
                } else {
                    blockGroup.classList.remove('hidden');
                    this.generateLobbyBlocks();
                }
            });
        });

        // Order buttons
        document.querySelectorAll('#order-toggles .toggle-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('#order-toggles .toggle-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.quizOrder = btn.dataset.order;
            });
        });
    }

    /**
     * Dynamically generate list of blocks based on selected question size
     */
    generateLobbyBlocks() {
        const container = document.getElementById('block-grid-container');
        container.innerHTML = '';
        
        if (this.quizSize === 'all') return;
        
        const size = this.quizSize;
        const totalWords = this.words.length;
        const blockCount = Math.ceil(totalWords / size);
        
        for (let idx = 0; idx < blockCount; idx++) {
            const start = idx * size + 1;
            const end = Math.min((idx + 1) * size, totalWords);
            
            const btn = document.createElement('button');
            btn.className = 'block-btn';
            if (idx === this.activeBlockIndex) {
                btn.classList.add('active');
            }
            
            // Check if this block is already completed
            const blockId = `size_${size}_block_${idx}`;
            if (this.stats.completedBlocks.includes(blockId)) {
                btn.classList.add('completed');
            }
            
            btn.innerHTML = `Kata ${start}-${end}`;
            btn.addEventListener('click', () => {
                document.querySelectorAll('.block-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.activeBlockIndex = idx;
            });
            
            container.appendChild(btn);
        }
    }

    // ==========================================
    // QUIZ GAME ENGINE
    // ==========================================

    /**
     * Start a fresh quiz
     */
    startQuiz() {
        this.clearSavedProgress(); // Start fresh

        // Filter words based on chosen settings
        if (this.quizSize === 'all') {
            this.quizWords = [...this.words];
        } else {
            const startIdx = this.activeBlockIndex * this.quizSize;
            const endIdx = Math.min(startIdx + this.quizSize, this.words.length);
            
            if (this.quizOrder === 'sequential') {
                this.quizWords = this.words.slice(startIdx, endIdx);
            } else {
                // If random, select quizSize random words from the entire 1671
                this.quizWords = this.getRandomSubarray(this.words, this.quizSize);
            }
        }

        // Shuffle questions order if random mode is chosen
        if (this.quizOrder === 'random') {
            this.shuffleArray(this.quizWords);
        }

        // Reset variables
        this.currentIndex = 0;
        this.score = 0;
        this.mistakenWords = [];
        this.startTime = Date.now();
        
        // Save initial progress
        this.saveCurrentQuizSession();
        
        // Transition screens
        this.showScreen('quiz');
        this.renderQuestion();
    }

    /**
     * Render the current question
     */
    renderQuestion() {
        this.isAnsweringAllowed = true;
        
        const currentWord = this.quizWords[this.currentIndex];
        
        // Update header info
        document.getElementById('quiz-current-idx').innerText = (this.currentIndex + 1).toString();
        document.getElementById('quiz-total-questions').innerText = this.quizWords.length.toString();
        document.getElementById('quiz-score').innerText = this.score.toString();
        
        // Progress bar percentage
        const progressPct = ((this.currentIndex) / this.quizWords.length) * 100;
        document.getElementById('quiz-progress-bar').style.width = `${progressPct}%`;
        
        // Word Card
        document.getElementById('quiz-word-id').innerText = `#${currentWord.id}`;
        document.getElementById('quiz-word-korean').innerText = currentWord.korean;
        
        // Generate options (1 correct, 3 distractors)
        const choices = this.generateChoices(currentWord);
        
        // Render choice buttons
        const choicesContainer = document.getElementById('quiz-choices-container');
        choicesContainer.innerHTML = '';
        
        // Hide next button
        document.getElementById('quiz-next-btn').classList.add('hidden');
        
        choices.forEach((choice, index) => {
            const alphabet = ['A', 'B', 'C', 'D'][index];
            const btn = document.createElement('button');
            btn.className = 'choice-btn';
            btn.innerHTML = `
                <div class="choice-prefix">${alphabet}</div>
                <div class="choice-text">${this.escapeHTML(choice)}</div>
            `;
            
            btn.addEventListener('click', () => this.handleAnswerSelection(btn, choice, currentWord));
            choicesContainer.appendChild(btn);
        });

        // Speak the word on show
        this.speakWord(currentWord.korean);
    }

    /**
     * Create 4 unique choices: 1 correct + 3 random translations
     */
    generateChoices(correctWord) {
        const choices = [correctWord.indonesian];
        
        // Grab incorrect options (distractors)
        while (choices.length < 4) {
            const randomWord = this.words[Math.floor(Math.random() * this.words.length)];
            
            // Prevent duplicate meaning or matching correct word
            if (randomWord.indonesian !== correctWord.indonesian && !choices.includes(randomWord.indonesian)) {
                choices.push(randomWord.indonesian);
            }
        }
        
        // Shuffle choices so correct answer isn't always first
        this.shuffleArray(choices);
        return choices;
    }

    /**
     * Handle choice button click
     */
    handleAnswerSelection(selectedBtn, chosenMeaning, correctWord) {
        if (!this.isAnsweringAllowed) return;
        this.isAnsweringAllowed = false;
        
        const isCorrect = (chosenMeaning === correctWord.indonesian);
        const choicesContainer = document.getElementById('quiz-choices-container');
        const buttons = choicesContainer.querySelectorAll('.choice-btn');
        
        // Disable all buttons to prevent clicking during result display
        buttons.forEach(btn => btn.disabled = true);
        
        if (isCorrect) {
            selectedBtn.classList.add('correct');
            this.score++;
            this.stats.totalCorrect++;
            this.saveStats();
            
            // Auto advance on correct answer after 1000ms
            this.saveCurrentQuizSession();
            this.autoAdvanceTimeout = setTimeout(() => {
                this.nextQuestion();
            }, 1000);
        } else {
            selectedBtn.classList.add('incorrect');
            
            // Find and highlight the correct button in green
            buttons.forEach(btn => {
                const textDiv = btn.querySelector('.choice-text');
                if (textDiv && textDiv.innerText === correctWord.indonesian) {
                    btn.classList.add('correct');
                }
            });
            
            // Record mistake for completion review
            this.mistakenWords.push({
                word: correctWord,
                userChoice: chosenMeaning
            });
            
            // Show Next Button (user must manually proceed after a mistake)
            document.getElementById('quiz-next-btn').classList.remove('hidden');
            this.saveCurrentQuizSession();
        }
    }

    /**
     * Move to next question or complete quiz
     */
    nextQuestion() {
        this.currentIndex++;
        
        if (this.currentIndex < this.quizWords.length) {
            this.saveCurrentQuizSession();
            this.renderQuestion();
        } else {
            this.finishQuiz();
        }
    }

    /**
     * Finish Quiz and render results
     */
    finishQuiz() {
        // Complete current progress bar fill
        document.getElementById('quiz-progress-bar').style.width = '100%';
        
        // Clear saved session since it's finished
        this.clearSavedProgress();

        // Calculate block completion (if playing a sequential block)
        if (this.quizSize !== 'all' && this.quizOrder === 'sequential') {
            const blockId = `size_${this.quizSize}_block_${this.activeBlockIndex}`;
            if (!this.stats.completedBlocks.includes(blockId)) {
                this.stats.completedBlocks.push(blockId);
                this.saveStats();
                this.generateLobbyBlocks(); // Redraw lobby block list
            }
        }

        // Render Results Screen
        this.showScreen('results');
        
        // Calculate percentages & times
        const total = this.quizWords.length;
        const correct = this.score;
        const wrong = total - correct;
        const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
        
        const durationSec = Math.round((Date.now() - this.startTime) / 1000);
        const mins = Math.floor(durationSec / 60);
        const secs = durationSec % 60;
        const durationText = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;

        // Update UI elements
        document.getElementById('results-percentage').innerText = `${pct}%`;
        document.getElementById('results-fraction').innerText = `${correct}/${total} Benar`;
        document.getElementById('results-duration').innerText = durationText;
        document.getElementById('results-correct-count').innerText = correct.toString();
        document.getElementById('results-wrong-count').innerText = wrong.toString();

        // Tailor message based on score
        const headline = document.getElementById('results-headline');
        const subtext = document.getElementById('results-sub');
        const icon = document.getElementById('results-icon');

        if (pct === 100) {
            headline.innerText = "Luar Biasa! Perfect! 🏆";
            subtext.innerText = "Semua kosakata dalam sesi ini berhasil dijawab dengan benar!";
            icon.innerText = "emoji_events";
            icon.style.color = "#eab308";
        } else if (pct >= 80) {
            headline.innerText = "Hebat Sekali! 🌟";
            subtext.innerText = "Pemahaman kosakata Anda sudah sangat baik.";
            icon.innerText = "thumb_up";
            icon.style.color = "#8b5cf6";
        } else if (pct >= 50) {
            headline.innerText = "Cukup Bagus! 👍";
            subtext.innerText = "Terus belajar dan tingkatkan lagi ingatan Anda.";
            icon.innerText = "menu_book";
            icon.style.color = "#6366f1";
        } else {
            headline.innerText = "Semangat Belajar! 💪";
            subtext.innerText = "Kosakata adalah kunci utama TOPIK I. Coba tinjau kesalahan Anda di bawah.";
            icon.innerText = "school";
            icon.style.color = "#94a3b8";
        }

        // Render Mistaken Words Review List
        const reviewPanel = document.getElementById('results-review-panel');
        const reviewListContainer = document.getElementById('results-review-list');
        reviewListContainer.innerHTML = '';

        if (this.mistakenWords.length > 0) {
            reviewPanel.classList.remove('hidden');
            
            this.mistakenWords.forEach(item => {
                const card = document.createElement('div');
                card.className = 'review-item';
                card.innerHTML = `
                    <div class="review-item-word">
                        <span class="korean">${item.word.korean}</span>
                        <span class="correct-label">${item.word.indonesian} <small style="opacity: 0.7; font-size: 11px;">(${item.word.english})</small></span>
                    </div>
                    <div class="review-item-choice">
                        Jawaban Anda: <span class="text-error">${item.userChoice}</span>
                    </div>
                `;
                reviewListContainer.appendChild(card);
            });
        } else {
            reviewPanel.classList.add('hidden');
        }
    }

    /**
     * Retry the same quiz sequence
     */
    retryCurrentQuiz() {
        // Just restart using the lobby configurations
        this.startQuiz();
    }

    /**
     * Confirm before quitting active quiz
     */
    confirmQuitQuiz() {
        if (confirm("Apakah Anda ingin keluar dari kuis? Progres Anda tersimpan dan dapat dilanjutkan nanti.")) {
            this.showScreen('lobby');
            this.checkSavedProgress(); // update resume notice
        }
    }

    // ==========================================
    // STUDY MODE (DAFTAR KATA)
    // ==========================================

    /**
     * Init Study Mode and build dropdown options
     */
    initStudyMode() {
        // Sync study size select
        const sizeSelect = document.getElementById('study-size-select');
        if (sizeSelect) {
            sizeSelect.value = this.quizSize.toString();
        }

        const select = document.getElementById('study-block-select');
        select.innerHTML = '';
        
        // Generate dropdown entries representing the blocks
        const size = this.quizSize === 'all' ? this.words.length : this.quizSize; // show all words if All is chosen
        const totalWords = this.words.length;
        const blockCount = Math.ceil(totalWords / size);
        
        for (let idx = 0; idx < blockCount; idx++) {
            const start = idx * size + 1;
            const end = Math.min((idx + 1) * size, totalWords);
            
            const option = document.createElement('option');
            option.value = idx.toString();
            option.innerText = `Kosakata ${start} - ${end}`;
            if (idx === this.activeBlockIndex) {
                option.selected = true;
            }
            select.appendChild(option);
        }

        // Show study screen
        this.showScreen('study');
        
        // Load initial block
        this.loadStudyBlock();
    }

    /**
     * Handle study size select change dynamically
     */
    changeStudySize() {
        const sizeSelect = document.getElementById('study-size-select');
        if (!sizeSelect) return;
        const val = sizeSelect.value;
        
        this.quizSize = val === 'all' ? 'all' : parseInt(val, 10);
        this.activeBlockIndex = 0; // Reset block index
        
        // Sync back to lobby toggles
        document.querySelectorAll('#size-toggles .toggle-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.size === val) {
                btn.classList.add('active');
            }
        });
        
        // Sync lobby blocks visibility
        const blockGroup = document.getElementById('block-selection-group');
        if (this.quizSize === 'all') {
            if (blockGroup) blockGroup.classList.add('hidden');
        } else {
            if (blockGroup) {
                blockGroup.classList.remove('hidden');
                this.generateLobbyBlocks();
            }
        }
        
        this.initStudyMode();
    }

    /**
     * Load words of the active dropdown block range
     */
    loadStudyBlock() {
        const select = document.getElementById('study-block-select');
        this.activeBlockIndex = parseInt(select.value, 10);
        
        const size = this.quizSize === 'all' ? this.words.length : this.quizSize;
        const startIdx = this.activeBlockIndex * size;
        const endIdx = Math.min(startIdx + size, this.words.length);
        
        this.studyWords = this.words.slice(startIdx, endIdx);
        
        // Reset search input
        document.getElementById('study-search-input').value = '';
        
        this.renderStudyList(this.studyWords);
    }

    /**
     * Render lists of vocabulary items for study
     */
    renderStudyList(wordsList) {
        const container = document.getElementById('study-list-container');
        container.innerHTML = '';

        if (wordsList.length === 0) {
            container.innerHTML = `<div class="text-center" style="padding: 40px; color: var(--text-muted);">Tidak ada kosakata ditemukan.</div>`;
            return;
        }

        wordsList.forEach(word => {
            const item = document.createElement('div');
            item.className = 'study-item';
            
            const meaningClass = this.hideStudyMeanings ? 'study-meaning hidden-meaning' : 'study-meaning';
            
            item.innerHTML = `
                <div class="study-item-left">
                    <span class="study-num">#${word.id}</span>
                    <span class="study-korean-word">${word.korean}</span>
                </div>
                <div class="study-item-right">
                    <div class="${meaningClass}" onclick="app.toggleIndividualStudyMeaning(this)">
                        ${word.indonesian} <span class="study-english-sub" style="font-size: 11px; opacity: 0.65; display: block;">(${word.english})</span>
                    </div>
                    <button class="btn-icon btn-speak" onclick="app.speakWord('${word.korean}')" title="Dengarkan Pengucapan">
                        <span class="material-symbols-outlined" style="font-size: 18px;">volume_up</span>
                    </button>
                </div>
            `;
            container.appendChild(item);
        });
    }

    /**
     * Filter vocabulary study list based on typing search in study screen
     */
    filterStudyList() {
        const query = document.getElementById('study-search-input').value.toLowerCase().trim();
        if (!query) {
            this.renderStudyList(this.studyWords);
            return;
        }

        const filtered = this.studyWords.filter(w => {
            return w.korean.includes(query) || 
                   w.indonesian.toLowerCase().includes(query) ||
                   w.english.toLowerCase().includes(query) || 
                   w.id.toString() === query;
        });

        this.renderStudyList(filtered);
    }

    /**
     * Toggle visibility of all meanings in study mode
     */
    toggleHideMeanings() {
        const toggle = document.getElementById('study-hide-meanings-toggle');
        this.hideStudyMeanings = toggle.checked;
        
        const meanings = document.querySelectorAll('.study-list .study-meaning');
        meanings.forEach(m => {
            if (this.hideStudyMeanings) {
                m.className = 'study-meaning hidden-meaning';
            } else {
                m.className = 'study-meaning';
            }
        });
    }

    /**
     * Click individual hidden study meaning to reveal
     */
    toggleIndividualStudyMeaning(element) {
        if (element.classList.contains('hidden-meaning')) {
            element.classList.remove('hidden-meaning');
        } else {
            element.classList.add('hidden-meaning');
        }
    }

    /**
     * Mark study block completed in localStorage
     */
    markCurrentBlockCompleted() {
        const size = this.quizSize === 'all' ? this.words.length : this.quizSize;
        const blockId = `size_${size}_block_${this.activeBlockIndex}`;
        
        if (!this.stats.completedBlocks.includes(blockId)) {
            this.stats.completedBlocks.push(blockId);
            this.saveStats();
            this.generateLobbyBlocks();
            alert("Kerja bagus! Blok kosakata ini telah ditandai sebagai Selesai.");
        } else {
            alert("Blok ini sudah ditandai Selesai sebelumnya.");
        }
    }

    /**
     * Helper to start study mode directly from the lobby start button
     */
    startStudyFromLobby() {
        this.initStudyMode();
    }

    // ==========================================
    // DICTIONARY TAB ENGINE
    // ==========================================

    /**
     * Setup Dictionary initial state
     */
    initDictionary() {
        // Render first 150 items to keep initialization ultra-fast
        this.renderDictionaryList(this.words.slice(0, 150), 150 < this.words.length);
    }

    /**
     * Search words on input type
     */
    searchDictionary() {
        const query = document.getElementById('dict-search-input').value.toLowerCase().trim();
        const clearBtn = document.getElementById('dict-clear-btn');
        
        if (!query) {
            clearBtn.classList.add('hidden');
            this.renderDictionaryList(this.words.slice(0, 150), true);
            document.getElementById('dict-results-count').innerText = this.words.length.toLocaleString();
            return;
        }

        clearBtn.classList.remove('hidden');

        // Search match ID, Korean, or English/Indonesian translation
        const filtered = this.words.filter(w => {
            return w.korean.includes(query) || 
                   w.indonesian.toLowerCase().includes(query) ||
                   w.english.toLowerCase().includes(query) || 
                   w.id.toString() === query;
        });

        // Limit search rendering to 200 items for layout responsiveness
        const limit = 200;
        const displayWords = filtered.slice(0, limit);
        const hasMore = filtered.length > limit;

        this.renderDictionaryList(displayWords, hasMore);
        document.getElementById('dict-results-count').innerText = filtered.length.toLocaleString();
    }

    /**
     * Render the dictionary view list
     */
    renderDictionaryList(wordsList, showMoreIndicator) {
        const container = document.getElementById('dict-list-container');
        container.innerHTML = '';

        if (wordsList.length === 0) {
            container.innerHTML = `<div class="text-center" style="padding: 40px; color: var(--text-muted);">Tidak ada kosakata yang cocok dengan kata pencarian Anda.</div>`;
            return;
        }

        wordsList.forEach(word => {
            const item = document.createElement('div');
            item.className = 'dict-item';
            item.innerHTML = `
                <div class="dict-info">
                    <span class="dict-num">#${word.id}</span>
                    <span class="dict-korean">${word.korean}</span>
                </div>
                <div class="dict-meanings" style="text-align: right; flex: 1; margin-right: 12px;">
                    <div class="dict-meaning" style="font-weight: 500; font-size: 14px;">${word.indonesian}</div>
                    <div class="dict-meaning-sub" style="font-size: 11px; color: var(--text-muted);">${word.english}</div>
                </div>
                <button class="btn-icon btn-speak" onclick="app.speakWord('${word.korean}')" title="Dengarkan Pengucapan">
                    <span class="material-symbols-outlined" style="font-size: 18px;">volume_up</span>
                </button>
            `;
            container.appendChild(item);
        });

        if (showMoreIndicator) {
            const more = document.createElement('div');
            more.className = 'text-center';
            more.style.padding = '12px';
            more.style.fontSize = '12px';
            more.style.color = 'var(--text-muted)';
            more.innerText = `Menampilkan hasil terbatas. Ketik pencarian Anda untuk mempersempit hasil.`;
            container.appendChild(more);
        }
    }

    /**
     * Clear search in dictionary screen
     */
    clearDictionarySearch() {
        document.getElementById('dict-search-input').value = '';
        this.searchDictionary();
    }

    // ==========================================
    // SPEECH AUDIO PRONUNCIATION ENGINE
    // ==========================================

    /**
     * Speak current word on the quiz screen
     */
    speakCurrentWord() {
        if (this.quizWords.length > 0 && this.quizWords[this.currentIndex]) {
            this.speakWord(this.quizWords[this.currentIndex].korean);
        }
    }

    /**
     * Trigger browser Text-to-Speech voice for Korean
     */
    speakWord(koreanText) {
        if ('speechSynthesis' in window) {
            // Cancel any current speaking
            window.speechSynthesis.cancel();
            
            const utterance = new SpeechSynthesisUtterance(koreanText);
            utterance.lang = 'ko-KR';
            utterance.rate = 0.8; // slightly slower for better learning clarity
            
            // Optional: Find an explicit Korean voice if loaded
            const voices = window.speechSynthesis.getVoices();
            const koVoice = voices.find(v => v.lang.includes('ko'));
            if (koVoice) {
                utterance.voice = koVoice;
            }
            
            window.speechSynthesis.speak(utterance);
        } else {
            console.warn('Text-to-speech not supported in this browser.');
        }
    }

    // ==========================================
    // GENERAL UTILS
    // ==========================================

    /**
     * Shuffle array elements in place (Fisher-Yates)
     */
    shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
    }

    /**
     * Helper to get a random subarray of unique elements
     */
    getRandomSubarray(arr, size) {
        const shuffled = [...arr];
        this.shuffleArray(shuffled);
        return shuffled.slice(0, size);
    }

    /**
     * Sanitize HTML text output
     */
    escapeHTML(str) {
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }
}

// Instantiate global app instance
const app = new TopikApp();

// Bind load event
window.addEventListener('DOMContentLoaded', () => {
    app.init();
    
    // Web Speech API needs voices loaded event sometimes
    if ('speechSynthesis' in window && window.speechSynthesis.onvoiceschanged !== undefined) {
        window.speechSynthesis.onvoiceschanged = () => {
            // Voices refreshed
        };
    }
});
