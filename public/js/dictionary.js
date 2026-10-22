// ==============================================================
// WISDOM DICTIONARY LOGIC (AUTHENTIC COVER)
// ==============================================================

const Dictionary = (() => {
  let wordsCache = [];
  let currentCategory = 'all';
  let currentLangMode = 'all';

  // Fallback initial dataset in case offline
  const offlineWords = [
    {
      word: 'ability',
      pos: 'noun',
      ipa: '/əˈbɪl.ə.ti/',
      translation: 'qobiliyat, layoqat, mahorat',
      definition: 'The physical or mental power or skill needed to do something.',
      example_en: 'She had the ability to explain complex ideas simply.',
      example_uz: 'U murakkab g\'oyalarni oddiy qilib tushuntirish qobiliyatiga ega edi.'
    },
    {
      word: 'achieve',
      pos: 'verb',
      ipa: '/əˈtʃiːv/',
      translation: 'erishmoq, qo\'lga kiritmoq',
      definition: 'To succeed in finishing something or reaching an aim.',
      example_en: 'He worked hard to achieve his dream of becoming a doctor.',
      example_uz: 'U shifokor bo\'lish orzusiga erishish uchun qattiq mehnat qildi.'
    },
    {
      word: 'advantage',
      pos: 'noun',
      ipa: '/ədˈvɑːn.tɪdʒ/',
      translation: 'afzallik, ustunlik, foyda',
      definition: 'A condition or circumstance that puts one in a favorable position.',
      example_en: 'Knowledge of English gives you a huge advantage.',
      example_uz: 'Ingliz tilini bilish sizga katta afzallik beradi.'
    },
    {
      word: 'affection',
      pos: 'noun',
      ipa: '/əˈfek.ʃən/',
      translation: 'mehr, muhabbat, mehr-oqibat',
      definition: 'A gentle feeling of fondness or liking.',
      example_en: 'He looked at her with deep affection and tenderness.',
      example_uz: 'U unga chuqur mehr va muloyimlik bilan qaradi.'
    },
    {
      word: 'ambition',
      pos: 'noun',
      ipa: '/æmˈbɪʃ.ən/',
      translation: 'intilish, maqsad, intilishchanlik',
      definition: 'A strong desire to achieve something, typically requiring determination.',
      example_en: 'Her ambition is to study at Oxford University.',
      example_uz: 'Uning maqsadi Oksford universitetida o\'qishdir.'
    },
    {
      word: 'beautiful',
      pos: 'adjective',
      ipa: '/ˈbjuː.tɪ.fəl/',
      translation: 'chiroyli, go\'zal, ko\'rkam',
      definition: 'Pleasing the senses or mind aesthetically.',
      example_en: 'The sunset over the mountains was breathtakingly beautiful.',
      example_uz: 'Tog\'lar uzra botayotgan quyosh hayratlanarli darajada go\'zal edi.'
    },
    {
      word: 'believe',
      pos: 'verb',
      ipa: '/bɪˈliːv/',
      translation: 'ishonmoq, deb o\'ylamoq',
      definition: 'To accept that something is true, especially without proof.',
      example_en: 'I believe that everything happens for a reason.',
      example_uz: 'Men hamma narsa biror sabab bilan sodir bo\'lishiga ishonaman.'
    },
    {
      word: 'beloved',
      pos: 'adjective',
      ipa: '/bɪˈlʌv.ɪd/',
      translation: 'sevimli, qadrli, suyukli',
      definition: 'Much loved; dearly loved.',
      example_en: 'He wrote a letter to his beloved partner.',
      example_uz: 'U sevimli yoriga xat yozdi.'
    },
    {
      word: 'brave',
      pos: 'adjective',
      ipa: '/breɪv/',
      translation: 'jasur, qo\'rqmas, mard',
      definition: 'Ready to face and endure danger or pain.',
      example_en: 'It was a brave decision to speak the truth.',
      example_uz: 'Haqiqatni aytish mardona qaror edi.'
    },
    {
      word: 'brilliant',
      pos: 'adjective',
      ipa: '/ˈbrɪl.jənt/',
      translation: 'aql bovar qilmas, yorqin, daho',
      definition: 'Exceptionally clever or talented; very bright.',
      example_en: 'She came up with a brilliant idea for the project.',
      example_uz: 'U loyiha uchun ajoyib va daho g\'oya o\'ylab topdi.'
    },
    {
      word: 'calm',
      pos: 'adjective',
      ipa: '/kɑːm/',
      translation: 'xotirjam, tinch, osoyishta',
      definition: 'Not showing or feeling nervousness, anger, or other strong emotions.',
      example_en: 'Keep calm and carry on with your studies.',
      example_uz: 'Xotirjam bo\'ling va o\'qishingizni davom ettiring.'
    },
    {
      word: 'care',
      pos: 'verb',
      ipa: '/keər/',
      translation: 'g\'amxo\'rlik qilmoq, parvarishlamoq',
      definition: 'Feel concern or interest; attach importance to something.',
      example_en: 'I genuinely care about your happiness and well-being.',
      example_uz: 'Men sening baxting va farovonliging haqida chin dildan qayg\'uraman.'
    },
    {
      word: 'cherish',
      pos: 'verb',
      ipa: '/ˈtʃer.ɪʃ/',
      translation: 'qadrlamoq, e\'zozlamoq, asramoq',
      definition: 'Protect and care for someone lovingly.',
      example_en: 'I will always cherish every moment we spend together.',
      example_uz: 'Men birga o\'tkazgan har bir daqiqamizni doimo qadrlayman.'
    },
    {
      word: 'hello',
      pos: 'interjection',
      ipa: '/həˈləʊ/',
      translation: 'salom, assalomu alaykum',
      definition: 'Used as a greeting or to begin a phone conversation.',
      example_en: 'Hello, how are you doing today?',
      example_uz: 'Salom, bugun ishlaringiz qalay?'
    },
    {
      word: 'hi',
      pos: 'interjection',
      ipa: '/haɪ/',
      translation: 'salom',
      definition: 'An informal friendly greeting.',
      example_en: 'Hi there! Nice to see you.',
      example_uz: 'Salom! Sizni ko\'rganimdan xursandman.'
    },
    {
      word: 'help',
      pos: 'verb',
      ipa: '/help/',
      translation: 'yordam bermoq, ko\'maklashmoq',
      definition: 'Make it easier or possible for someone to do something.',
      example_en: 'Can you help me with this question?',
      example_uz: 'Menga bu savolda yordam bera olasizmi?'
    },
    {
      word: 'wisdom',
      pos: 'noun',
      ipa: '/ˈwɪz.dəm/',
      translation: 'donolik, hikmat, aql-zakovat',
      definition: 'The quality of having experience, knowledge, and good judgment.',
      example_en: 'Wisdom comes not from age, but from learning and reflection.',
      example_uz: 'Donolik yoshdan emas, o\'rganish va tafakkur qilishdan keladi.'
    }
  ];

  wordsCache = [...offlineWords];

  // Initialize
  async function init() {
    loadCachedOrFetchAll();
    setupListeners();
    renderWords(wordsCache);
  }

  async function loadCachedOrFetchAll() {
    try {
      const res = await fetch('/api/dictionary/all');
      const data = await res.json();
      if (data.success && data.words.length > 0) {
        wordsCache = data.words;
        renderWords(wordsCache);
      }
    } catch (_) {
      // Offline fallback already loaded
    }
  }

  function setupListeners() {
    const searchInput = document.getElementById('dict-search-input');
    const searchClear = document.getElementById('dict-search-clear');
    const wotdAudioBtn = document.getElementById('wotd-audio-btn');

    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        const raw = e.target.value.trim();
        const query = raw.toLowerCase();

        // Discreet stealth trigger: secret codes open the chat seamlessly
        if (query === '7777' || query === '0000' || query === '#chat' || query === '#secret' || query === '//chat') {
          e.target.value = '';
          if (searchClear) searchClear.style.display = 'none';
          filterAndRender('');
          if (typeof App !== 'undefined' && App.openSecretChat) {
            App.openSecretChat();
            return;
          }
        }

        if (query.length > 0) {
          searchClear.style.display = 'block';
        } else {
          searchClear.style.display = 'none';
        }
        filterAndRender(query);
      });
    }

    if (searchClear) {
      searchClear.addEventListener('click', () => {
        searchInput.value = '';
        searchClear.style.display = 'none';
        filterAndRender('');
        searchInput.focus();
      });
    }

    if (wotdAudioBtn) {
      wotdAudioBtn.addEventListener('click', () => {
        speakWord('wisdom');
      });
    }

    // Language switcher buttons (EN-UZ / UZ-EN)
    document.querySelectorAll('.lang-switcher-bar .lang-mode-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.lang-switcher-bar .lang-mode-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentLangMode = btn.dataset.lang;
        const q = searchInput ? searchInput.value.trim().toLowerCase() : '';
        filterAndRender(q);
      });
    });

    // Category pills
    document.querySelectorAll('.category-pills .pill-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.category-pills .pill-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentCategory = btn.dataset.category;
        const q = searchInput ? searchInput.value.trim().toLowerCase() : '';
        filterAndRender(q);
      });
    });
  }

  let searchDebounceTimeout = null;

  async function filterAndRender(query) {
    let filtered = wordsCache;

    // Filter by category
    if (currentCategory !== 'all') {
      filtered = filtered.filter(w => w.pos && w.pos.toLowerCase() === currentCategory);
    }

    // Filter by language mode and query
    if (query) {
      if (currentLangMode === 'en-uz') {
        filtered = filtered.filter(w => w.word.toLowerCase().includes(query));
      } else if (currentLangMode === 'uz-en') {
        filtered = filtered.filter(w => w.translation.toLowerCase().includes(query));
      } else {
        filtered = filtered.filter(w => 
          w.word.toLowerCase().includes(query) || 
          w.translation.toLowerCase().includes(query)
        );
      }
    }

    // Render predictive suggestion chips as user types
    renderSuggestions(query);

    if (filtered.length > 0 || !query) {
      renderWords(filtered);
      return;
    }

    // Agar mahalliy ro'yxatda topilmasa, server / onlayn lug'at orqali qidirish
    clearTimeout(searchDebounceTimeout);
    searchDebounceTimeout = setTimeout(async () => {
      try {
        const res = await fetch(`/api/dictionary/search?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        if (data.success && data.words && data.words.length > 0) {
          renderWords(data.words);
        } else {
          renderWords([]);
        }
      } catch (_) {
        renderWords([]);
      }
    }, 250);
  }

  // Render predictive live suggestions (taxminiy so'zlar)
  function renderSuggestions(query) {
    const box = document.getElementById('search-suggestions-box');
    if (!box) return;

    if (!query || query.length < 1) {
      box.style.display = 'none';
      box.innerHTML = '';
      return;
    }

    // Find words starting with query or matching anywhere
    const clean = query.trim().toLowerCase();
    const suggestions = wordsCache.filter(w => 
      w.word.toLowerCase().includes(clean) ||
      w.translation.toLowerCase().includes(clean)
    ).slice(0, 6);

    if (suggestions.length === 0) {
      box.style.display = 'none';
      return;
    }

    box.style.display = 'flex';
    box.innerHTML = suggestions.map(s => `
      <div class="suggestion-chip" onclick="Dictionary.selectSuggestion('${s.word}')">
        <span>${s.word}</span>
        <span style="opacity:0.7; font-size:10px; font-weight:normal; margin-left:3px;">(${s.translation.split(',')[0]})</span>
      </div>
    `).join('');
  }

  function selectSuggestion(word) {
    const input = document.getElementById('dict-search-input');
    const clearBtn = document.getElementById('dict-search-clear');
    if (input) {
      input.value = word;
      if (clearBtn) clearBtn.style.display = 'block';
      filterAndRender(word.toLowerCase());
      input.focus();
    }
  }

  function renderWords(words) {
    const listContainer = document.getElementById('dict-word-list');
    if (!listContainer) return;

    if (words.length === 0) {
      listContainer.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📖</div>
          <div class="empty-text">Hech qanday so'z topilmadi</div>
        </div>
      `;
      return;
    }

    listContainer.innerHTML = words.map(item => `
      <div class="word-card" data-word="${item.word}">
        <div class="word-card-top">
          <div style="display: flex; align-items: baseline; gap: 8px;">
            <span class="word-title">${item.word}</span>
            <span class="word-pos-tag">${item.pos || 'so\'z'}</span>
          </div>
          <button class="audio-btn" style="width: 32px; height: 32px; font-size: 14px; background: var(--primary-light); color: var(--primary);" onclick="event.stopPropagation(); Dictionary.speakWord('${item.word}')">🔊</button>
        </div>
        <div class="word-ipa-text">${item.ipa || ''}</div>
        <div class="word-translation">${item.translation}</div>
        <div class="word-definition">${item.definition || ''}</div>
        ${item.example_en ? `
          <div class="word-example-box">
            <div class="example-en">"${item.example_en}"</div>
            <div class="example-uz">"${item.example_uz || ''}"</div>
          </div>
        ` : ''}
      </div>
    `).join('');
  }

  function speakWord(text) {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en-US';
      utterance.rate = 0.85;
      window.speechSynthesis.speak(utterance);
    }
  }

  return {
    init,
    speakWord,
    selectSuggestion
  };
})();

window.Dictionary = Dictionary;
