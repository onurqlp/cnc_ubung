const DATA_PATHS = {
  topics: './data/topics.json',
  vocabulary: './data/vocabulary.json',
  exercises: './data/exercises.json'
};

let topics = [];
let vocabulary = [];
let exercises = [];

const modes = {
      cards: {
        panel: 'cardsPanel',
        title: 'Kelime Kartları',
        description: 'Bu bölümde Almanca kelimeyi görüp Türkçe anlamını tahmin edeceksiniz.',
        button: 'Kelimeleri Karıştır',
        cardText: 'Almanca kelime, okunuş, Türkçe anlam ve örnek cümleyle çalış.'
      },
      quiz: {
        panel: 'quizPanel',
        title: 'Çoktan Seçmeli Test',
        description: 'Almanca kelimeyi okuyun, doğru Türkçe anlamı seçin.',
        button: 'Yeni Rastgele Soru',
        cardText: 'Almanca sorunun altında okunuş desteği görünür.'
      },
      reverse: {
        panel: 'reversePanel',
        title: 'Türkçe → Almanca Test',
        description: 'Türkçe anlamı okuyun, doğru Almanca kelimeyi seçin.',
        button: 'Yeni Rastgele Soru',
        cardText: 'Cevap sonrası doğru Almanca kelime ve okunuş gösterilir.'
      },
      write: {
        panel: 'writePanel',
        title: 'Yazmalı Alıştırma',
        description: 'Türkçe anlam için Almanca kelimeyi artikeliyle yazın.',
        button: 'Yeni Kelime',
        cardText: 'Cevap verdikten sonra doğru yazım ve okunuş desteği çıkar.'
      },
      quick: {
        panel: 'quickPanel',
        title: 'Hızlı Tekrar',
        description: 'Seçili havuzdan karışık kelimeleri hızlıca gözden geçirin.',
        button: 'Kelimeleri Karıştır',
        cardText: 'Her kartta Almanca, okunuş ve Türkçe anlam yan yana gelir.'
      },
      wrong: {
        panel: 'wrongPanel',
        title: 'Yanlışlarım',
        description: 'Yanlış yaptığınız kelimeleri okunuş desteğiyle tekrar edin.',
        button: 'Yanlışları Karıştır',
        cardText: 'LocalStorage içinde saklanan yanlış kelimeleri tekrar gösterir.'
      },
      dictionary: {
        panel: 'dictionaryPanel',
        title: 'Sözlük / Kelime Listesi',
        description: 'Kelime listesini arayın, filtreleyin ve örnek cümle okunuşlarını görün.',
        button: 'Listeyi Karıştır',
        cardText: 'İlk açılışta 25 kelime görünür, daha fazlasını siz açarsınız.'
      },
      exercises: {
        panel: 'exercisePanel',
        title: 'Mini Alıştırmalar',
        description: 'Konu bazlı kısa soruların çözümünü ve okunuş desteğini inceleyin.',
        button: 'Alıştırmaları Karıştır',
        cardText: 'Çözümü açınca cevap ve yaklaşık okunuş desteği görünür.'
      }
    };

    const els = {
      homeView: document.getElementById('homeView'),
      studyView: document.getElementById('studyView'),
      modeGrid: document.getElementById('modeGrid'),
      viewTitle: document.getElementById('viewTitle'),
      viewDescription: document.getElementById('viewDescription'),
      viewProgress: document.getElementById('viewProgress'),
      viewPool: document.getElementById('viewPool'),
      viewKnown: document.getElementById('viewKnown'),
      viewWrong: document.getElementById('viewWrong'),
      backHome: document.getElementById('backHome'),
      shuffleMode: document.getElementById('shuffleMode'),
      statTotal: document.getElementById('statTotal'),
      statActive: document.getElementById('statActive'),
      statKnown: document.getElementById('statKnown'),
      statSuccess: document.getElementById('statSuccess'),
      activeSummary: document.getElementById('activeSummary'),
      searchInput: document.getElementById('searchInput'),
      topicSelect: document.getElementById('topicSelect'),
      dictionaryTopicSelect: document.getElementById('dictionaryTopicSelect'),
      wrongOnly: document.getElementById('wrongOnly'),
      tableArea: document.getElementById('tableArea'),
      tableSummary: document.getElementById('tableSummary'),
      showMoreWords: document.getElementById('showMoreWords'),
      flashStage: document.getElementById('flashStage'),
      flipCard: document.getElementById('flipCard'),
      knowCard: document.getElementById('knowCard'),
      dontKnowCard: document.getElementById('dontKnowCard'),
      nextCard: document.getElementById('nextCard'),
      quickGrid: document.getElementById('quickGrid'),
      quizCard: document.getElementById('quizCard'),
      reverseQuizCard: document.getElementById('reverseQuizCard'),
      writeCard: document.getElementById('writeCard'),
      wrongList: document.getElementById('wrongList'),
      wrongSummary: document.getElementById('wrongSummary'),
      clearWrong: document.getElementById('clearWrong'),
      exerciseList: document.getElementById('exerciseList'),
      exerciseSummary: document.getElementById('exerciseSummary'),
      toast: document.getElementById('toast')
    };

    const STORAGE_KEY = 'aydaCncGermanPlatform.v2';
    const OLD_STORAGE_KEY = 'aydaCncGermanPlatform.v1';
    let progress = loadProgress();
    let selectedTopic = 'all';
    let wrongOnly = false;
    let searchTerm = '';
    let filteredWords = [];
    let currentView = 'home';
    let currentMode = null;
    let flashSet = [];
    let flashIndex = 0;
    let flashFlipped = false;
    let quizState = createQuizState();
    let reverseQuizState = createQuizState();
    let writeWord = null;
    let quickSet = [];
    let exerciseSet = [];
    let dictionaryWords = [];
    let dictionaryLimit = 25;
    let toastTimer = null;

    function loadProgress() {
      try {
        const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || localStorage.getItem(OLD_STORAGE_KEY) || '{}');
        return {
          known: saved.known || {},
          wrong: saved.wrong || {},
          attempts: Number(saved.attempts || 0),
          correct: Number(saved.correct || 0)
        };
      } catch (error) {
        return { known: {}, wrong: {}, attempts: 0, correct: 0 };
      }
    }

    function saveProgress() {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
    }

    function createQuizState() {
      return { current: null, options: [], answered: false, score: 0, total: 0, feedback: '', selected: '' };
    }

    function escapeHtml(value) {
      return String(value ?? '').replace(/[&<>'"]/g, function(char) {
        return ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' })[char];
      });
    }

    function normalizeText(value) {
      return String(value || '')
        .toLocaleLowerCase('tr-TR')
        .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
        .replace(/â/g, 'a').replace(/î/g, 'i').replace(/û/g, 'u')
        .replace(/[.,;:!?()[\]{}"'’“”„]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    }

    function shuffle(items) {
      const arr = [...items];
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    }

    function sample(items) {
      return items.length ? items[Math.floor(Math.random() * items.length)] : null;
    }

    function uniqueBy(items, keyFn) {
      const seen = new Set();
      return items.filter(function(item) {
        const key = keyFn(item);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    }

    function topicById(id) {
      return topics.find(function(topic) { return topic.id === id; });
    }

    function getWordById(id) {
      return vocabulary.find(function(word) { return word.id === Number(id); });
    }

    function pronunciationBox(text, label) {
      if (!text) return '';
      return '<div class="pronunciation-box"><span>' + escapeHtml(label || 'Okunuş:') + '</span><strong>' + escapeHtml(text) + '</strong></div>';
    }

    function sentencePronunciation(text) {
      if (!text) return '';
      return '<div class="sentence-pronunciation"><span>Cümle okunuşu:</span><em>' + escapeHtml(text) + '</em></div>';
    }

    function getPool() {
      let pool = selectedTopic === 'all' ? [...vocabulary] : vocabulary.filter(function(word) { return word.topicId === selectedTopic; });
      if (wrongOnly) pool = pool.filter(function(word) { return progress.wrong[word.id]; });
      return pool;
    }

    function getDictionaryPool() {
      let pool = getPool();
      const term = normalizeText(searchTerm);
      if (term) {
        pool = pool.filter(function(word) {
          return [word.german, word.pronunciationTr, word.turkish, word.exampleDe, word.examplePronunciationTr, word.exampleTr, word.topic, word.topicTr]
            .some(function(value) { return normalizeText(value).includes(term); });
        });
      }
      return pool;
    }

    function refreshFilteredWords() {
      filteredWords = getPool();
      renderStats();
      updateViewPills();
    }

    function renderStats() {
      const success = progress.attempts ? Math.round((progress.correct / progress.attempts) * 100) : 0;
      els.statTotal.textContent = vocabulary.length;
      els.statActive.textContent = filteredWords.length;
      els.statKnown.textContent = Object.keys(progress.known).length;
      els.statSuccess.textContent = success + '%';
      els.activeSummary.textContent = 'Seçili havuz: ' + filteredWords.length + ' kelime';
    }

    function updateViewPills(extra) {
      const wrongCount = Object.keys(progress.wrong).length;
      const knownCount = Object.keys(progress.known).length;
      els.viewPool.textContent = 'Seçili havuz: ' + filteredWords.length + ' kelime';
      els.viewKnown.textContent = 'Biliyorum: ' + knownCount;
      els.viewWrong.textContent = 'Yanlış: ' + wrongCount;
      if (extra) els.viewProgress.textContent = extra;
    }

    function renderTopicSelect(select) {
      select.innerHTML = '<option value="all">Tüm konular</option>' + topics.map(function(topic) {
        const count = vocabulary.filter(function(word) { return word.topicId === topic.id; }).length;
        return '<option value="' + topic.id + '">' + escapeHtml(topic.titleDe + ' — ' + topic.titleTr + ' (' + count + ')') + '</option>';
      }).join('');
      select.value = selectedTopic;
    }

    function renderModeGrid() {
      els.modeGrid.innerHTML = Object.keys(modes).map(function(key) {
        const mode = modes[key];
        return '<button class="mode-card" data-view="' + key + '"><span><h3>' + escapeHtml(mode.title) + '</h3><p>' + escapeHtml(mode.cardText) + '</p></span><span class="btn">Çalışmaya Başla</span></button>';
      }).join('');
    }

    function showView(viewName) {
      currentView = viewName;
      if (viewName === 'home') {
        currentMode = null;
        els.homeView.classList.add('active');
        els.studyView.classList.remove('active');
        document.getElementById('top').scrollIntoView({ behavior:'smooth', block:'start' });
        refreshFilteredWords();
        return;
      }

      currentMode = viewName;
      const mode = modes[viewName];
      els.homeView.classList.remove('active');
      els.studyView.classList.add('active');
      document.querySelectorAll('.mode-panel').forEach(function(panel) { panel.classList.remove('active'); });
      document.getElementById(mode.panel).classList.add('active');
      els.viewTitle.textContent = mode.title;
      els.viewDescription.textContent = mode.description;
      els.shuffleMode.textContent = mode.button;
      refreshFilteredWords();
      resetMode(viewName);
      els.studyView.scrollIntoView({ behavior:'smooth', block:'start' });
    }

    function resetMode(modeName) {
      if (modeName === 'cards') buildFlashSet();
      if (modeName === 'quiz') newQuiz('normal');
      if (modeName === 'reverse') newQuiz('reverse');
      if (modeName === 'write') newWritingWord();
      if (modeName === 'quick') buildQuickRepeat();
      if (modeName === 'wrong') renderWrongList(true);
      if (modeName === 'dictionary') {
        dictionaryLimit = 25;
        searchTerm = '';
        dictionaryWords = [];
        els.searchInput.value = '';
        renderDictionary();
      }
      if (modeName === 'exercises') buildExerciseSet();
    }

    function shuffleCurrentMode() {
      if (!currentMode) return;
      resetMode(currentMode);
      showToast('Çalışma yenilendi.', 'ok');
    }

    function buildFlashSet() {
      flashSet = shuffle(filteredWords).slice(0, Math.min(20, filteredWords.length));
      flashIndex = 0;
      flashFlipped = false;
      renderFlashcard();
    }

    function renderFlashcard() {
      const hasCards = flashSet.length > 0;
      [els.flipCard, els.knowCard, els.dontKnowCard, els.nextCard].forEach(function(button) { button.disabled = !hasCards; });
      if (!hasCards) {
        updateViewPills('İlerleme: 0 / 0');
        els.flashStage.innerHTML = '<div class="empty">Bu seçimde çalışılacak kelime bulunamadı.</div>';
        return;
      }
      const word = flashSet[flashIndex % flashSet.length];
      updateViewPills('İlerleme: ' + (flashIndex + 1) + ' / ' + flashSet.length);
      els.flipCard.textContent = flashFlipped ? 'Kelimeyi Göster' : 'Cevabı Göster';
      if (!flashFlipped) {
        els.flashStage.innerHTML = '<div class="learning-card"><span class="topic-chip">' + escapeHtml(word.topicTr) + '</span><div class="word-main">' + escapeHtml(word.german) + '</div>' + pronunciationBox(word.pronunciationTr, 'Okunuş:') + '<p class="example">' + escapeHtml(word.exampleDe) + '</p>' + sentencePronunciation(word.examplePronunciationTr) + '</div>';
      } else {
        els.flashStage.innerHTML = '<div class="learning-card back"><span class="topic-chip">' + escapeHtml(word.topic) + '</span><div class="word-main">' + escapeHtml(word.german) + '</div>' + pronunciationBox(word.pronunciationTr, 'Okunuş:') + '<div class="meaning">' + escapeHtml(word.turkish) + '</div><p class="example"><strong>DE:</strong> ' + escapeHtml(word.exampleDe) + '<br><strong>TR:</strong> ' + escapeHtml(word.exampleTr) + '</p>' + sentencePronunciation(word.examplePronunciationTr) + '</div>';
      }
    }

    function markKnown(word) {
      progress.known[word.id] = true;
      delete progress.wrong[word.id];
      saveProgress();
      showToast('Kelime bilinenlere eklendi.', 'ok');
      nextFlashcard();
    }

    function markWrong(word) {
      progress.wrong[word.id] = (progress.wrong[word.id] || 0) + 1;
      delete progress.known[word.id];
      saveProgress();
      showToast('Kelime tekrar listesine eklendi.', 'no');
      nextFlashcard();
    }

    function nextFlashcard() {
      if (!flashSet.length) return;
      flashIndex = (flashIndex + 1) % flashSet.length;
      flashFlipped = false;
      renderStats();
      renderFlashcard();
    }

    function buildOptions(current, mode) {
      const key = mode === 'reverse' ? 'german' : 'turkish';
      const basePool = uniqueBy((filteredWords.length >= 4 ? filteredWords : vocabulary), function(item) { return normalizeText(item[key]); });
      const wrongOptions = shuffle(basePool.filter(function(item) { return item.id !== current.id; })).slice(0, 3).map(function(item) { return item[key]; });
      return shuffle([current[key]].concat(wrongOptions)).slice(0, 4);
    }

    function newQuiz(mode) {
      const state = mode === 'reverse' ? reverseQuizState : quizState;
      const target = sample(filteredWords.length ? filteredWords : vocabulary);
      if (!target) return;
      state.current = target;
      state.options = buildOptions(target, mode);
      state.answered = false;
      state.feedback = '';
      state.selected = '';
      renderQuiz(mode);
    }

    function renderQuiz(mode) {
      const state = mode === 'reverse' ? reverseQuizState : quizState;
      const container = mode === 'reverse' ? els.reverseQuizCard : els.quizCard;
      if (!state.current) {
        container.innerHTML = '<button class="btn" data-action="next-' + mode + '">Yeni Soru</button>';
        return;
      }
      const questionText = mode === 'reverse' ? state.current.turkish : state.current.german;
      const answer = mode === 'reverse' ? state.current.german : state.current.turkish;
      updateViewPills('Soru: ' + (state.total + (state.answered ? 0 : 1)) + ' · Skor: ' + state.score + ' / ' + state.total);
      const questionPronunciation = mode === 'reverse' && !state.answered ? '' : pronunciationBox(state.current.pronunciationTr, 'Okunuş:');
      const answerInfo = state.answered
        ? '<div class="feedback show ' + (state.feedback.startsWith('Doğru') ? 'ok' : 'no') + '">' + escapeHtml(state.feedback) + '<br>Doğru cevap: ' + escapeHtml(answer) + (mode === 'reverse' ? '<br>' + pronunciationBox(state.current.pronunciationTr, 'Okunuş:') : '') + '<br><span class="muted">' + escapeHtml(state.current.exampleDe) + '</span>' + sentencePronunciation(state.current.examplePronunciationTr) + '</div>'
        : '<div class="feedback"></div>';
      container.innerHTML =
        '<div class="quiz-meta"><span>' + escapeHtml(state.current.topicTr) + '</span><span>Skor: ' + state.score + ' / ' + state.total + '</span></div>' +
        '<div class="question">' + escapeHtml(questionText) + '</div>' + questionPronunciation +
        '<div class="options">' + state.options.map(function(option) {
          let cls = 'option';
          if (state.answered && option === answer) cls += ' correct';
          if (state.answered && option === state.selected && option !== answer) cls += ' wrong';
          return '<button class="' + cls + '" data-mode="' + mode + '" data-option="' + escapeHtml(option) + '" ' + (state.answered ? 'disabled' : '') + '>' + escapeHtml(option) + '</button>';
        }).join('') + '</div>' +
        answerInfo +
        '<div class="card-actions"><button class="btn secondary" data-action="next-' + mode + '">Yeni Soru</button></div>';
    }

    function answerQuiz(mode, selected) {
      const state = mode === 'reverse' ? reverseQuizState : quizState;
      if (!state.current || state.answered) return;
      const answer = mode === 'reverse' ? state.current.german : state.current.turkish;
      const correct = selected === answer;
      state.answered = true;
      state.selected = selected;
      state.total += 1;
      progress.attempts += 1;
      if (correct) {
        state.score += 1;
        progress.correct += 1;
        progress.known[state.current.id] = true;
        delete progress.wrong[state.current.id];
        state.feedback = 'Doğru cevap.';
      } else {
        progress.wrong[state.current.id] = (progress.wrong[state.current.id] || 0) + 1;
        delete progress.known[state.current.id];
        state.feedback = 'Yanlış cevap.';
      }
      saveProgress();
      renderStats();
      renderQuiz(mode);
    }

    function newWritingWord() {
      writeWord = sample(filteredWords.length ? filteredWords : vocabulary);
      renderWriting();
    }

    function levenshtein(a, b) {
      const matrix = Array.from({ length:a.length + 1 }, function(_, i) { return [i]; });
      for (let j = 1; j <= b.length; j++) matrix[0][j] = j;
      for (let i = 1; i <= a.length; i++) {
        for (let j = 1; j <= b.length; j++) {
          matrix[i][j] = a[i - 1] === b[j - 1]
            ? matrix[i - 1][j - 1]
            : Math.min(matrix[i - 1][j - 1] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j] + 1);
        }
      }
      return matrix[a.length][b.length];
    }

    function splitArticle(value) {
      const normalized = normalizeText(value);
      const parts = normalized.split(' ');
      if (['der','die','das'].includes(parts[0])) return { article:parts[0], base:parts.slice(1).join(' ') };
      return { article:'', base:normalized };
    }

    function renderWriting() {
      if (!writeWord) {
        els.writeCard.innerHTML = '<div class="empty">Yazmalı alıştırma için kelime bulunamadı.</div>';
        return;
      }
      updateViewPills('Yazmalı kelime: 1 / 1');
      els.writeCard.innerHTML =
        '<div class="topic-chip">' + escapeHtml(writeWord.topicTr) + '</div>' +
        '<div class="question">' + escapeHtml(writeWord.turkish) + '</div>' +
        '<p class="muted">Almanca kelimeyi yazın. Artikel varsa birlikte yazın.</p>' +
        '<div class="write-row"><div class="field"><label for="writeInput">Almanca cevap</label><input class="input" id="writeInput" autocomplete="off" placeholder="Örn. der Messschieber"></div><button class="btn" id="checkWrite">Kontrol Et</button></div>' +
        '<div class="feedback" id="writeFeedback"></div>';
      document.getElementById('checkWrite').addEventListener('click', checkWriting);
      document.getElementById('writeInput').addEventListener('keydown', function(event) { if (event.key === 'Enter') checkWriting(); });
    }

    function checkWriting() {
      if (!writeWord) return;
      const input = document.getElementById('writeInput');
      const feedback = document.getElementById('writeFeedback');
      const raw = input.value;
      const targetFull = normalizeText(writeWord.german);
      const targetBase = normalizeText(writeWord.baseWord || writeWord.german);
      const targetArticle = normalizeText(writeWord.article || '');
      const answer = normalizeText(raw);
      const split = splitArticle(raw);
      const baseDistance = levenshtein(split.base, targetBase);
      progress.attempts += 1;
      let cls = 'warn';
      let message = '';
      let isCorrect = false;
      if (answer === targetFull || (!targetArticle && answer === targetBase)) {
        message = 'Doğru.';
        cls = 'ok';
        isCorrect = true;
      } else if (targetArticle && answer === targetBase) {
        message = 'Kelime doğru, artikel eksik.';
      } else if (targetArticle && split.base === targetBase && split.article && split.article !== targetArticle) {
        message = 'Kelime doğru olabilir ama artikel yanlış. Doğru artikel: ' + targetArticle + '.';
      } else if (baseDistance <= (targetBase.length > 10 ? 2 : 1)) {
        message = 'Kelimeye çok yakınsın.';
      } else {
        message = 'Yanlış.';
        cls = 'no';
      }
      if (isCorrect) {
        progress.correct += 1;
        progress.known[writeWord.id] = true;
        delete progress.wrong[writeWord.id];
      } else {
        progress.wrong[writeWord.id] = (progress.wrong[writeWord.id] || 0) + 1;
        delete progress.known[writeWord.id];
      }
      saveProgress();
      feedback.className = 'feedback show ' + cls;
      feedback.innerHTML =
        escapeHtml(message) + '<br>Doğru cevap: <strong>' + escapeHtml(writeWord.german) + '</strong>' +
        pronunciationBox(writeWord.pronunciationTr, 'Okunuş:') +
        '<span class="muted">Örnek: ' + escapeHtml(writeWord.exampleDe) + '</span>' +
        sentencePronunciation(writeWord.examplePronunciationTr);
      renderStats();
      updateViewPills('Yazmalı kelime: 1 / 1');
    }

    function buildQuickRepeat() {
      const pool = filteredWords.length ? filteredWords : vocabulary;
      quickSet = shuffle(pool).slice(0, Math.min(20, pool.length));
      renderQuickRepeat();
    }

    function renderQuickRepeat() {
      updateViewPills('Hızlı tekrar: ' + quickSet.length + ' kelime');
      els.quickGrid.innerHTML = quickSet.length ? quickSet.map(function(word) {
        return '<div class="quick-card"><strong>' + escapeHtml(word.german) + '</strong>' + pronunciationBox(word.pronunciationTr, 'Okunuş:') + '<div class="meaning">' + escapeHtml(word.turkish) + '</div><small class="muted">' + escapeHtml(word.topicTr) + '</small></div>';
      }).join('') : '<div class="empty">Hızlı tekrar için kelime bulunamadı.</div>';
    }

    function renderWrongList(randomize) {
      let wrongIds = Object.keys(progress.wrong).map(Number).filter(function(id) { return getWordById(id); });
      if (randomize) wrongIds = shuffle(wrongIds);
      els.wrongSummary.textContent = wrongIds.length ? wrongIds.length + ' kelime tekrar bekliyor.' : 'Yanlış listesi boş.';
      updateViewPills('Yanlış listesi: ' + wrongIds.length);
      if (!wrongIds.length) {
        els.wrongList.innerHTML = '<div class="empty">Henüz yanlış yapılan kelime yok. Önce bir test veya yazmalı alıştırma çözebilirsiniz.</div>';
        return;
      }
      els.wrongList.innerHTML = wrongIds.map(function(id) {
        const word = getWordById(id);
        return '<div class="wrong-item"><div><strong>' + escapeHtml(word.german) + '</strong>' + pronunciationBox(word.pronunciationTr, 'Okunuş:') + '<div>' + escapeHtml(word.turkish) + '</div><small class="muted">' + escapeHtml(word.topicTr) + ' · ' + progress.wrong[id] + ' tekrar</small></div><button class="btn secondary small" data-practice="' + id + '">Kartlarda Çalış</button></div>';
      }).join('');
    }

    function renderDictionary() {
      dictionaryWords = currentMode === 'dictionary' && dictionaryWords.length ? dictionaryWords : getDictionaryPool();
      if (!dictionaryWords.length || searchTerm) dictionaryWords = getDictionaryPool();
      const shown = dictionaryWords.slice(0, dictionaryLimit);
      els.tableSummary.textContent = shown.length + ' / ' + dictionaryWords.length + ' kelime gösteriliyor.';
      els.showMoreWords.disabled = shown.length >= dictionaryWords.length;
      updateViewPills('Liste: ' + shown.length + ' / ' + dictionaryWords.length);
      if (!shown.length) {
        els.tableArea.innerHTML = '<div class="empty">Bu filtreyle kelime bulunamadı.</div>';
        return;
      }
      const table = '<div class="table-wrap"><table><thead><tr><th>Almanca</th><th>Okunuş</th><th>Türkçe</th><th>Konu</th><th>Örnek cümle</th><th>Cümle okunuşu</th></tr></thead><tbody>' + shown.map(function(word) {
        return '<tr><td><strong>' + escapeHtml(word.german) + '</strong><br>' + (word.article ? '<span class="article-pill">' + escapeHtml(word.article) + '</span>' : '') + '</td><td>' + escapeHtml(word.pronunciationTr) + '</td><td>' + escapeHtml(word.turkish) + '</td><td>' + escapeHtml(word.topicTr) + '</td><td>' + escapeHtml(word.exampleDe) + '<br><span class="muted">' + escapeHtml(word.exampleTr) + '</span></td><td>' + escapeHtml(word.examplePronunciationTr) + '</td></tr>';
      }).join('') + '</tbody></table></div>';
      const cards = '<h3 class="dict-cards-title">Kelime Kartları</h3><div class="dictionary-cards">' + shown.map(function(word) {
        return '<article class="dictionary-card"><strong>' + escapeHtml(word.german) + '</strong>' + pronunciationBox(word.pronunciationTr, 'Okunuş:') + '<div>' + escapeHtml(word.turkish) + '</div><small class="muted">' + escapeHtml(word.topicTr) + '</small><p>' + escapeHtml(word.exampleDe) + '</p>' + sentencePronunciation(word.examplePronunciationTr) + '</article>';
      }).join('') + '</div>';
      els.tableArea.innerHTML = table + cards;
    }

    function buildExerciseSet() {
      const list = selectedTopic === 'all' ? exercises : exercises.filter(function(exercise) { return exercise.topicId === selectedTopic; });
      exerciseSet = shuffle(list);
      renderExercises();
    }

    function renderExercises() {
      const list = exerciseSet;
      els.exerciseSummary.textContent = list.length + ' mini alıştırma listeleniyor.';
      updateViewPills('Alıştırma: ' + list.length);
      if (!list.length) {
        els.exerciseList.innerHTML = '<div class="empty">Bu seçimde alıştırma bulunamadı.</div>';
        return;
      }
      els.exerciseList.innerHTML = list.map(function(exercise, index) {
        const topic = topicById(exercise.topicId);
        return '<article class="exercise-card"><h3>' + (index + 1) + '. ' + escapeHtml(topic.titleDe) + '</h3><p><strong>DE:</strong> ' + escapeHtml(exercise.questionDe) + '</p><p><strong>TR:</strong> ' + escapeHtml(exercise.questionTr) + '</p><button class="btn secondary small" data-solution>Çözümü Göster</button><div class="solution"><p><strong>Lösung:</strong> ' + escapeHtml(exercise.answerDe) + '</p><p><strong>Cevap:</strong> ' + escapeHtml(exercise.answerTr) + '</p>' + sentencePronunciation(exercise.answerPronunciationTr) + '</div></article>';
      }).join('');
    }

    function showToast(message, type) {
      els.toast.textContent = message;
      els.toast.style.background = type === 'no' ? 'var(--red)' : type === 'ok' ? 'var(--green)' : 'var(--navy-dark)';
      els.toast.classList.add('show');
      clearTimeout(toastTimer);
      toastTimer = setTimeout(function() { els.toast.classList.remove('show'); }, 2200);
    }

    function setTopic(value) {
      selectedTopic = value;
      els.topicSelect.value = selectedTopic;
      els.dictionaryTopicSelect.value = selectedTopic;
      refreshFilteredWords();
      if (currentMode) resetMode(currentMode);
    }


    function showLoadingState() {
      if (els.modeGrid) {
        els.modeGrid.innerHTML = '<div class="empty">Veriler yükleniyor...</div>';
      }
      if (els.activeSummary) els.activeSummary.textContent = 'Veriler yükleniyor...';
      [els.topicSelect, els.dictionaryTopicSelect, els.wrongOnly, els.shuffleMode].forEach(function(control) {
        if (control) control.disabled = true;
      });
    }

    function showDataError() {
      const message = 'Kelime verileri yüklenemedi. Lütfen internet bağlantınızı kontrol edin veya dosyaların data klasöründe olduğundan emin olun.';
      if (els.modeGrid) {
        els.modeGrid.innerHTML = '<div class="empty">' + escapeHtml(message) + '</div>';
      }
      if (els.activeSummary) els.activeSummary.textContent = 'Veri yükleme hatası';
      if (els.statTotal) els.statTotal.textContent = '0';
      if (els.statActive) els.statActive.textContent = '0';
      showToast(message, 'no');
    }

    function validateData() {
      if (!Array.isArray(topics)) {
        console.warn('topics.json bir array değil.');
        topics = [];
      }
      if (!Array.isArray(vocabulary)) {
        console.warn('vocabulary.json bir array değil.');
        vocabulary = [];
      }
      if (!Array.isArray(exercises)) {
        console.warn('exercises.json bir array değil. Boş liste kullanılacak.');
        exercises = [];
      }

      const topicIds = new Set(topics.map(function(topic) { return topic.id; }));
      const seenIds = new Set();
      const duplicateIds = [];
      const missingPronunciation = [];
      const missingExamplePronunciation = [];
      const unknownTopicIds = [];

      vocabulary.forEach(function(word) {
        if (seenIds.has(word.id)) duplicateIds.push(word.id);
        seenIds.add(word.id);
        if (!word.pronunciationTr || !String(word.pronunciationTr).trim()) missingPronunciation.push(word.id);
        if (word.exampleDe && (!word.examplePronunciationTr || !String(word.examplePronunciationTr).trim())) {
          missingExamplePronunciation.push(word.id);
        }
        if (word.topicId && !topicIds.has(word.topicId)) unknownTopicIds.push({ id: word.id, topicId: word.topicId });
      });

      if (duplicateIds.length) console.warn('Tekrar eden kelime id değerleri:', duplicateIds);
      if (missingPronunciation.length) console.warn('pronunciationTr eksik kelime id değerleri:', missingPronunciation);
      if (missingExamplePronunciation.length) console.warn('examplePronunciationTr eksik kelime id değerleri:', missingExamplePronunciation);
      if (unknownTopicIds.length) console.warn('topics.json içinde bulunmayan topicId değerleri:', unknownTopicIds);
    }

    async function loadData() {
      try {
        showLoadingState();

        const [topicsRes, vocabularyRes, exercisesRes] = await Promise.all([
          fetch(DATA_PATHS.topics),
          fetch(DATA_PATHS.vocabulary),
          fetch(DATA_PATHS.exercises)
        ]);

        if (!topicsRes.ok || !vocabularyRes.ok || !exercisesRes.ok) {
          throw new Error('Veri dosyaları yüklenemedi.');
        }

        topics = await topicsRes.json();
        vocabulary = await vocabularyRes.json();
        exercises = await exercisesRes.json();

        validateData();
        initApp();
      } catch (error) {
        console.error('Veri yükleme hatası:', error);
        showDataError();
      }
    }

    function initApp() {
      [els.topicSelect, els.dictionaryTopicSelect, els.wrongOnly, els.shuffleMode].forEach(function(control) {
        if (control) control.disabled = false;
      });
      init();
    }
    function init() {
      renderTopicSelect(els.topicSelect);
      renderTopicSelect(els.dictionaryTopicSelect);
      renderModeGrid();
      refreshFilteredWords();
    }

    els.modeGrid.addEventListener('click', function(event) {
      const button = event.target.closest('[data-view]');
      if (button) showView(button.dataset.view);
    });
    els.backHome.addEventListener('click', function() { showView('home'); });
    els.shuffleMode.addEventListener('click', shuffleCurrentMode);
    els.topicSelect.addEventListener('change', function(event) { setTopic(event.target.value); });
    els.dictionaryTopicSelect.addEventListener('change', function(event) { setTopic(event.target.value); renderDictionary(); });
    els.wrongOnly.addEventListener('change', function(event) {
      wrongOnly = event.target.checked;
      refreshFilteredWords();
      if (currentMode) resetMode(currentMode);
    });
    els.searchInput.addEventListener('input', function(event) {
      searchTerm = event.target.value;
      dictionaryLimit = 25;
      dictionaryWords = [];
      renderDictionary();
    });
    els.showMoreWords.addEventListener('click', function() {
      dictionaryLimit += 25;
      renderDictionary();
    });
    els.flipCard.addEventListener('click', function() { flashFlipped = !flashFlipped; renderFlashcard(); });
    els.nextCard.addEventListener('click', nextFlashcard);
    els.knowCard.addEventListener('click', function() { if (flashSet.length) markKnown(flashSet[flashIndex % flashSet.length]); });
    els.dontKnowCard.addEventListener('click', function() { if (flashSet.length) markWrong(flashSet[flashIndex % flashSet.length]); });
    els.quizCard.addEventListener('click', function(event) {
      const option = event.target.closest('[data-option]');
      const action = event.target.closest('[data-action]');
      if (option) answerQuiz('normal', option.dataset.option);
      if (action) newQuiz('normal');
    });
    els.reverseQuizCard.addEventListener('click', function(event) {
      const option = event.target.closest('[data-option]');
      const action = event.target.closest('[data-action]');
      if (option) answerQuiz('reverse', option.dataset.option);
      if (action) newQuiz('reverse');
    });
    els.wrongList.addEventListener('click', function(event) {
      const button = event.target.closest('[data-practice]');
      if (!button) return;
      const word = getWordById(button.dataset.practice);
      selectedTopic = word.topicId;
      wrongOnly = true;
      els.wrongOnly.checked = true;
      refreshFilteredWords();
      showView('cards');
      const index = flashSet.findIndex(function(item) { return item.id === word.id; });
      flashIndex = index >= 0 ? index : 0;
      renderFlashcard();
    });
    els.clearWrong.addEventListener('click', function() {
      progress.wrong = {};
      saveProgress();
      wrongOnly = false;
      els.wrongOnly.checked = false;
      refreshFilteredWords();
      renderWrongList(false);
      showToast('Yanlış listesi temizlendi.', 'ok');
    });
    els.exerciseList.addEventListener('click', function(event) {
      if (event.target.closest('[data-solution]')) event.target.closest('.exercise-card').classList.toggle('open');
    });

    document.addEventListener('DOMContentLoaded', loadData);
