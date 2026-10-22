// Comprehensive English-Uzbek Dictionary Dataset for Wisdom Dictionary
const dictionaryWords = [
  // A
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
    word: 'about',
    pos: 'preposition',
    ipa: '/əˈbaʊt/',
    translation: 'haqida, to\'g\'risida, taxminan',
    definition: 'On the subject of; concerning.',
    example_en: 'We talked about our future plans.',
    example_uz: 'Biz kelajakdagi rejalarimiz haqida gaplashdik.'
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
    word: 'always',
    pos: 'adverb',
    ipa: '/ˈɔːl.weɪz/',
    translation: 'doimo, har doim, hamisha',
    definition: 'At all times; on all occasions.',
    example_en: 'I will always be there to support you.',
    example_uz: 'Men seni qo\'llab-quvvatlash uchun har doim yoningda bo\'laman.'
  },
  {
    word: 'ambition',
    pos: 'noun',
    ipa: '/æmˈbɪʃ.ən/',
    translation: 'intilish, maqsad, orzu',
    definition: 'A strong desire to achieve something, typically requiring determination.',
    example_en: 'Her ambition is to study at Oxford University.',
    example_uz: 'Uning maqsadi Oksford universitetida o\'qishdir.'
  },
  {
    word: 'apple',
    pos: 'noun',
    ipa: '/ˈæp.əl/',
    translation: 'olma',
    definition: 'A round fruit with red, green, or yellow skin and a firm white flesh.',
    example_en: 'An apple a day keeps the doctor away.',
    example_uz: 'Kunda bir olma yesangiz, tabibga hojat qolmaydi.'
  },
  // B
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
    word: 'book',
    pos: 'noun',
    ipa: '/bʊk/',
    translation: 'kitob',
    definition: 'A written or printed work consisting of pages bound together.',
    example_en: 'Reading a good book enriches the soul.',
    example_uz: 'Yaxshi kitob o\'qish qalbni boyitadi.'
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
    word: 'brother',
    pos: 'noun',
    ipa: '/ˈbrʌð.ər/',
    translation: 'aka, uka, birodar',
    definition: 'A man or boy in relation to other sons and daughters of his parents.',
    example_en: 'My brother helped me with my homework.',
    example_uz: 'Akam uy vazifamni bajarishga yordam berdi.'
  },
  // C
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
    word: 'challenge',
    pos: 'noun',
    ipa: '/ˈtʃæl.ɪndʒ/',
    translation: 'qiyinchilik, chaqiriq, sinov',
    definition: 'A call to take part in a contest or fight; a demanding task.',
    example_en: 'Learning a new language is a wonderful challenge.',
    example_uz: 'Yangi til o\'rganish ajoyib sinovdir.'
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
    word: 'clever',
    pos: 'adjective',
    ipa: '/ˈklev.ər/',
    translation: 'aqlli, ziyrak, uddaburon',
    definition: 'Quick to understand, learn, and devise or apply ideas.',
    example_en: 'She is a clever student who learns quickly.',
    example_uz: 'U tez o\'rganadigan aqlli talabadir.'
  },
  {
    word: 'confidence',
    pos: 'noun',
    ipa: '/ˈkɒn.fɪ.dəns/',
    translation: 'ishonch, o\'ziga ishonch',
    definition: 'The feeling or belief that one can rely on someone or something.',
    example_en: 'She spoke English with remarkable confidence.',
    example_uz: 'U ingliz tilida ajoyib ishonch bilan gapirdi.'
  },
  {
    word: 'courage',
    pos: 'noun',
    ipa: '/ˈkʌr.ɪdʒ/',
    translation: 'jasorat, mardlik, sabot',
    definition: 'The ability to do something that frightens one.',
    example_en: 'Have the courage to follow your heart.',
    example_uz: 'Yuragingizga ergashish uchun jasoratga ega bo\'ling.'
  },
  // D
  {
    word: 'day',
    pos: 'noun',
    ipa: '/deɪ/',
    translation: 'kun, kunduz',
    definition: 'Each of the twenty-four-hour periods; daylight hours.',
    example_en: 'Have a wonderful and productive day!',
    example_uz: 'Kuningiz ajoyib va unumli o\'tsin!'
  },
  {
    word: 'delight',
    pos: 'noun',
    ipa: '/dɪˈlaɪt/',
    translation: 'zavq, quvonch, shodlik',
    definition: 'Great pleasure or satisfaction.',
    example_en: 'It was a delight to meet you again.',
    example_uz: 'Siz bilan yana uchrashish katta quvonch edi.'
  },
  {
    word: 'determination',
    pos: 'noun',
    ipa: '/dɪˌtɜː.mɪˈneɪ.ʃən/',
    translation: 'qat\'iyat, iroda, sabot',
    definition: 'The firmness of purpose; resoluteness.',
    example_en: 'Success requires patience and determination.',
    example_uz: 'Muvaffaqiyat sabr va qat\'iyatni talab qiladi.'
  },
  {
    word: 'dictionary',
    pos: 'noun',
    ipa: '/ˈdɪk.ʃən.ər.i/',
    translation: 'lug\'at, qomus',
    definition: 'A book or electronic resource that lists the words of a language.',
    example_en: 'Use this dictionary to expand your vocabulary.',
    example_uz: 'So\'z boyligingizni oshirish uchun ushbu lug\'atdan foydalaning.'
  },
  {
    word: 'diligent',
    pos: 'adjective',
    ipa: '/ˈdɪl.ɪ.dʒənt/',
    translation: 'mehnatkash, tirishqoq, g\'ayratli',
    definition: 'Having or showing care and conscientiousness in one\'s work.',
    example_en: 'A diligent student will always achieve great results.',
    example_uz: 'Tirishqoq o\'quvchi har doim yuqori natijalarga erishadi.'
  },
  {
    word: 'dream',
    pos: 'noun',
    ipa: '/driːm/',
    translation: 'orzu, tush, niyat',
    definition: 'A cherished aspiration, ambition, or ideal.',
    example_en: 'Never give up on your biggest dreams.',
    example_uz: 'Eng buyuk orzularingizdan hech qachon voz kechmang.'
  },
  // E
  {
    word: 'education',
    pos: 'noun',
    ipa: '/ˌedʒ.ʊˈkeɪ.ʃən/',
    translation: 'ta\'lim, ma\'lumot, tarbiya',
    definition: 'The process of receiving or giving systematic instruction.',
    example_en: 'Education is the most powerful weapon to change the world.',
    example_uz: 'Ta\'lim — bu dunyoni o\'zgartirish uchun eng qudratli quroldir.'
  },
  {
    word: 'empathy',
    pos: 'noun',
    ipa: '/ˈem.pə.θi/',
    translation: 'hamdardlik, his-tuyg\'uni tushunish',
    definition: 'The ability to understand and share the feelings of another.',
    example_en: 'Empathy is essential for any healthy relationship.',
    example_uz: 'Hamdardlik har qanday sog\'lom munosabat uchun muhimdir.'
  },
  {
    word: 'encourage',
    pos: 'verb',
    ipa: '/ɪnˈkʌr.ɪdʒ/',
    translation: 'ruhlandirmoq, dalda bermoq',
    definition: 'Give support, confidence, or hope to someone.',
    example_en: 'My teacher always encouraged me to read more books.',
    example_uz: 'O\'qituvchim menga har doim ko\'proq kitob o\'qishga dalda berardi.'
  },
  {
    word: 'english',
    pos: 'noun',
    ipa: '/ˈɪŋ.ɡlɪʃ/',
    translation: 'ingliz tili',
    definition: 'The language originating in England, spoken worldwide.',
    example_en: 'She is studying English grammar diligently.',
    example_uz: 'U ingliz tili grammatikasini tirishqoqlik bilan o\'rganmoqda.'
  },
  {
    word: 'enthusiasm',
    pos: 'noun',
    ipa: '/ɪnˈθjuː.zi.æz.əm/',
    translation: 'shavq-zavq, g\'ayrat, ishtiyoq',
    definition: 'Intense and eager enjoyment, interest, or approval.',
    example_en: 'She tackled the new assignment with great enthusiasm.',
    example_uz: 'U yangi vazifani katta ishtiyoq bilan bajara boshladi.'
  },
  {
    word: 'essential',
    pos: 'adjective',
    ipa: '/ɪˈsen.ʃəl/',
    translation: 'muhim, zarur, asosiy',
    definition: 'Absolutely necessary; extremely important.',
    example_en: 'Regular practice is essential to master English vocabulary.',
    example_uz: 'Ingliz tili so\'z boyligini egallash uchun muntazam mashq qilish zarur.'
  },
  // F
  {
    word: 'faithful',
    pos: 'adjective',
    ipa: '/ˈfeɪθ.fəl/',
    translation: 'vafodor, sodiq, ishonchli',
    definition: 'Remaining loyal and steadfast.',
    example_en: 'A faithful companion makes the journey pleasant.',
    example_uz: 'Sodiq yo\'ldosh sayohatni yoqimli qiladi.'
  },
  {
    word: 'family',
    pos: 'noun',
    ipa: '/ˈfæm.əl.i/',
    translation: 'oila, xonadon',
    definition: 'A group of one or more parents and their children living together.',
    example_en: 'Family is where life begins and love never ends.',
    example_uz: 'Oila — hayot boshlanadigan va mehr tugamaydigan maskandir.'
  },
  {
    word: 'father',
    pos: 'noun',
    ipa: '/ˈfɑː.ðər/',
    translation: 'ota, dada',
    definition: 'A man in relation to his natural or adopted child.',
    example_en: 'Her father always wants the best for his daughter.',
    example_uz: 'Uning otasi har doim qizi uchun eng yaxshisini tilaydi.'
  },
  {
    word: 'forgive',
    pos: 'verb',
    ipa: '/fəˈɡɪv/',
    translation: 'kechirmoq, afv etmoq',
    definition: 'Stop feeling angry or resentful toward someone for an offense.',
    example_en: 'To forgive is the mark of a noble heart.',
    example_uz: 'Kechirish olijanob qalbning belgisidir.'
  },
  {
    word: 'friend',
    pos: 'noun',
    ipa: '/frend/',
    translation: 'do\'st, o\'rtoq, birodar',
    definition: 'A person whom one knows and with whom one has a bond of mutual affection.',
    example_en: 'A true friend is a treasure beyond compare.',
    example_uz: 'Haqiqiy do\'st — tengsiz xazinadir.'
  },
  {
    word: 'future',
    pos: 'noun',
    ipa: '/ˈfjuː.tʃər/',
    translation: 'kelajak, istiqbol',
    definition: 'The period of time that will come after the present time.',
    example_en: 'We are building a brighter future together.',
    example_uz: 'Biz birgalikda yorqin kelajak quryapmiz.'
  },
  // G
  {
    word: 'generous',
    pos: 'adjective',
    ipa: '/ˈdʒen.ər.əs/',
    translation: 'saxiy, saxovatli, ochiqko\'ngil',
    definition: 'Showing a readiness to give more of something than is strictly necessary.',
    example_en: 'He was generous with both his time and knowledge.',
    example_uz: 'U o\'z vaqtini ham, bilimini ham ayamaydigan saxiy inson edi.'
  },
  {
    word: 'gratitude',
    pos: 'noun',
    ipa: '/ˈɡræt.ɪ.tjuːd/',
    translation: 'minnatdorlik, shukronalik',
    definition: 'The quality of being thankful; readiness to show appreciation.',
    example_en: 'She expressed deep gratitude for all the help received.',
    example_uz: 'U ko\'rsatilgan barcha yordam uchun chuqur minnatdorlik bildirdi.'
  },
  // H
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
    word: 'happiness',
    pos: 'noun',
    ipa: '/ˈhæp.i.nəs/',
    translation: 'baxt, saodat, quvonch',
    definition: 'The state of being happy; contentment.',
    example_en: 'True happiness comes from inner peace and loving people.',
    example_uz: 'Haqiqiy baxt ichki xotirjamlik va insonlarni sevishdan keladi.'
  },
  {
    word: 'harmony',
    pos: 'noun',
    ipa: '/ˈhɑː.mə.ni/',
    translation: 'uyg\'unlik, ahillik, murosa',
    definition: 'Agreement or concord; pleasant combination of elements.',
    example_en: 'They lived together in peace and harmony.',
    example_uz: 'Ular tinchlik va ahillikda birga yashadilar.'
  },
  {
    word: 'heart',
    pos: 'noun',
    ipa: '/hɑːt/',
    translation: 'yurak, qalb, ko\'ngil',
    definition: 'The central organ of circulation; the center of emotion.',
    example_en: 'Listen to the gentle whisper of your heart.',
    example_uz: 'Qalbingizning mayin shivirlashiga quloq soling.'
  },
  {
    word: 'help',
    pos: 'verb',
    ipa: '/help/',
    translation: 'yordam bermoq, ko\'maklashmoq',
    definition: 'Make it easier for someone to do something by offering services or resources.',
    example_en: 'Can I help you with your language lessons?',
    example_uz: 'Til darslaringizga yordam beraymi?'
  },
  {
    word: 'honesty',
    pos: 'noun',
    ipa: '/ˈɒn.ə.sti/',
    translation: 'rostgo\'ylik, to\'g\'riso\'zlik, halollik',
    definition: 'The quality of being honest and truthful.',
    example_en: 'Honesty is always the best foundation for trust.',
    example_uz: 'Halollik har doim ishonchning eng yaxshi poydevoridir.'
  },
  {
    word: 'hope',
    pos: 'noun',
    ipa: '/həʊp/',
    translation: 'umid, ishonch',
    definition: 'A feeling of expectation and desire for a certain thing to happen.',
    example_en: 'Never lose hope, even in the darkest hours.',
    example_uz: 'Eng qorong\'i damlarda ham hech qachon umidingizni yo\'qotmang.'
  },
  // I
  {
    word: 'inspire',
    pos: 'verb',
    ipa: '/ɪnˈspaɪər/',
    translation: 'ilhomlantirmoq, ruhlantirmoq',
    definition: 'Fill someone with the urge or ability to do something creative.',
    example_en: 'Your dedication inspires everyone around you.',
    example_uz: 'Sening fidoyiliging atrofingdagi barchani ilhomlantiradi.'
  },
  {
    word: 'intelligence',
    pos: 'noun',
    ipa: '/ɪnˈtel.ɪ.dʒəns/',
    translation: 'aql-idrok, zakovat, fahm',
    definition: 'The ability to acquire and apply knowledge and skills.',
    example_en: 'Emotional intelligence is just as valuable as academic success.',
    example_uz: 'Hissiy zakovat ham akademik muvaffaqiyat kabi qadrlidir.'
  },
  // J
  {
    word: 'journey',
    pos: 'noun',
    ipa: '/ˈdʒɜː.ni/',
    translation: 'sayohat, yo\'l, hayot yo\'li',
    definition: 'An act of traveling from one place to another.',
    example_en: 'Every great journey begins with a single step.',
    example_uz: 'Har bir buyuk sayohat bitta qadamdan boshlanadi.'
  },
  // K
  {
    word: 'kindness',
    pos: 'noun',
    ipa: '/ˈkaɪnd.nəs/',
    translation: 'mehribonlik, muloyimlik, yaxshilik',
    definition: 'The quality of being friendly, generous, and considerate.',
    example_en: 'A small act of kindness can change someone\'s whole day.',
    example_uz: 'Kichik bir yaxshilik insonning butun kunini o\'zgartirib yuborishi mumkin.'
  },
  {
    word: 'knowledge',
    pos: 'noun',
    ipa: '/ˈnɒl.ɪdʒ/',
    translation: 'bilim, ma\'lumot, ilm',
    definition: 'Facts, information, and skills acquired through experience or education.',
    example_en: 'Knowledge is power when put into action.',
    example_uz: 'Bilim amalda qo\'llanilganda qudratga aylanadi.'
  },
  // L
  {
    word: 'language',
    pos: 'noun',
    ipa: '/ˈlæŋ.ɡwɪdʒ/',
    translation: 'til, nutq',
    definition: 'The method of human communication, either spoken or written.',
    example_en: 'Learning a language opens doors to new worlds.',
    example_uz: 'Til o\'rganish yangi dunyolarga eshik ochadi.'
  },
  {
    word: 'laughter',
    pos: 'noun',
    ipa: '/ˈlɑːf.tər/',
    translation: 'kulgi, shodlik',
    definition: 'The action or sound of laughing.',
    example_en: 'Her laughter brought warmth to the entire room.',
    example_uz: 'Uning kulgisi butun xonaga iliqlik olib kirdi.'
  },
  {
    word: 'learn',
    pos: 'verb',
    ipa: '/lɜːn/',
    translation: 'o\'rganmoq, yod olmoq',
    definition: 'Gain or acquire knowledge of or skill in something by study or experience.',
    example_en: 'I learn new English words every morning.',
    example_uz: 'Men har kuni ertalab yangi inglizcha so\'zlarni o\'rganaman.'
  },
  {
    word: 'lesson',
    pos: 'noun',
    ipa: '/ˈles.ən/',
    translation: 'dars, saboq',
    definition: 'A period of learning or teaching.',
    example_en: 'The grammar lesson was very helpful and clear.',
    example_uz: 'Grammatika darsi juda foydali va tushunarli bo\'ldi.'
  },
  {
    word: 'life',
    pos: 'noun',
    ipa: '/laɪf/',
    translation: 'hayot, umr',
    definition: 'The condition that distinguishes animals and plants from inorganic matter.',
    example_en: 'Life is beautiful when shared with loved ones.',
    example_uz: 'Hayot sevimli insonlar bilan baham ko\'rilganda go\'zaldir.'
  },
  {
    word: 'love',
    pos: 'noun',
    ipa: '/lʌv/',
    translation: 'sevgi, muhabbat, mehr',
    definition: 'An intense feeling of deep affection.',
    example_en: 'Love and respect conquer all obstacles.',
    example_uz: 'Sevgi va hurmat barcha to\'siqlarni yengadi.'
  },
  {
    word: 'loyalty',
    pos: 'noun',
    ipa: '/ˈlɔɪ.əl.ti/',
    translation: 'sodiqlik, vafodorlik',
    definition: 'A strong feeling of support or allegiance.',
    example_en: 'Loyalty and honesty are rare and precious virtues.',
    example_uz: 'Sodiqlik va halollik noyob va qimmatbaho fazilatlardir.'
  },
  // M
  {
    word: 'memory',
    pos: 'noun',
    ipa: '/ˈmem.ər.i/',
    translation: 'xotira, esdalik',
    definition: 'The faculty by which the mind stores and remembers information.',
    example_en: 'I hold this sweet memory close to my heart.',
    example_uz: 'Men bu shirin xotirani qalbimga yaqin asrayman.'
  },
  {
    word: 'mother',
    pos: 'noun',
    ipa: '/ˈmʌð.ər/',
    translation: 'ona, oyi',
    definition: 'A woman in relation to her child or children.',
    example_en: 'A mother\'s prayer is the greatest blessing.',
    example_uz: 'Onaning duosi eng ulug\' ne\'matdir.'
  },
  // O
  {
    word: 'opportunity',
    pos: 'noun',
    ipa: '/ˌɒp.əˈtjuː.nə.ti/',
    translation: 'imkoniyat, qulay fursat',
    definition: 'A set of circumstances that makes it possible to do something.',
    example_en: 'Take this opportunity to improve your speaking skills.',
    example_uz: 'Gapirish ko\'nikmangizni oshirish uchun bu imkoniyatdan foydalaning.'
  },
  // P
  {
    word: 'patience',
    pos: 'noun',
    ipa: '/ˈpeɪ.ʃəns/',
    translation: 'sabr, sabr-toqat, bardosh',
    definition: 'The capacity to accept or tolerate delay, trouble, or suffering without getting angry.',
    example_en: 'Patience is bitter, but its fruit is sweet.',
    example_uz: 'Sabr achchiq, ammo uning mevasi shirin.'
  },
  {
    word: 'peace',
    pos: 'noun',
    ipa: '/piːs/',
    translation: 'tinchlik, osoyishtalik, xotirjamlik',
    definition: 'Freedom from disturbance; tranquility.',
    example_en: 'May your mind be filled with peace and clarity.',
    example_uz: 'Xayolingiz tinchlik va ravshanlikka to\'lsin.'
  },
  {
    word: 'promise',
    pos: 'noun',
    ipa: '/ˈprɒm.ɪs/',
    translation: 'va\'da, so\'z',
    definition: 'A declaration or assurance that one will do something.',
    example_en: 'A true gentleman always keeps his promise.',
    example_uz: 'Haqiqiy inson har doim o\'z va\'dasini bajaradi.'
  },
  // R
  {
    word: 'respect',
    pos: 'noun',
    ipa: '/rɪˈspekt/',
    translation: 'hurmat, ehtirom',
    definition: 'A feeling of deep admiration for someone elicited by their abilities or qualities.',
    example_en: 'Mutual respect is the bedrock of lasting relationships.',
    example_uz: 'O\'zaro hurmat mustahkam munosabatlarning poydevoridir.'
  },
  // S
  {
    word: 'school',
    pos: 'noun',
    ipa: '/skuːl/',
    translation: 'maktab, o\'quv dargohi',
    definition: 'An institution for educating children.',
    example_en: 'She enjoys going to school and seeing her friends.',
    example_uz: 'U maktabga borishni va do\'stlarini ko\'rishni yoqtiradi.'
  },
  {
    word: 'sincere',
    pos: 'adjective',
    ipa: '/sɪnˈsɪər/',
    translation: 'samimiy, dildan, toza qalb',
    definition: 'Free from pretense or deceit; proceeding from genuine feelings.',
    example_en: 'Please accept my sincere congratulations and best wishes.',
    example_uz: 'Iltimos, samimiy tabriklarim va ezgu tilaklarimni qabul qiling.'
  },
  {
    word: 'sister',
    pos: 'noun',
    ipa: '/ˈsɪs.tər/',
    translation: 'opa, singil',
    definition: 'A woman or girl in relation to other children of her parents.',
    example_en: 'Her sister is also studying foreign languages.',
    example_uz: 'Uning opasi ham chet tillarini o\'rganmoqda.'
  },
  {
    word: 'strength',
    pos: 'noun',
    ipa: '/streŋθ/',
    translation: 'kuch, qudrat, baquvvatlik',
    definition: 'The quality or state of being physically or mentally strong.',
    example_en: 'She found the strength to overcome every hurdle.',
    example_uz: 'U har bir to\'siqni yengib o\'tish uchun o\'zida kuch topdi.'
  },
  {
    word: 'study',
    pos: 'verb',
    ipa: '/ˈstʌd.i/',
    translation: 'o\'qimoq, o\'rganmoq, tadqiq qilmoq',
    definition: 'Devote time and attention to acquiring knowledge on an academic subject.',
    example_en: 'They study English together every afternoon.',
    example_uz: 'Ular har kuni tushdan keyin birgalikda ingliz tilini o\'rganadilar.'
  },
  // T
  {
    word: 'time',
    pos: 'noun',
    ipa: '/taɪm/',
    translation: 'vaqt, soat, fursat',
    definition: 'The indefinite continued progress of existence and events.',
    example_en: 'Time spent with you is always precious.',
    example_uz: 'Sen bilan o\'tgan vaqt doimo qadrlidir.'
  },
  {
    word: 'trust',
    pos: 'noun',
    ipa: '/trʌst/',
    translation: 'ishonch, e\'tiqod',
    definition: 'Firm belief in the reliability, truth, or ability of someone.',
    example_en: 'Trust takes years to build and seconds to break.',
    example_uz: 'Ishonchni qurish uchun yillar kerak, sindirish uchun esa soniyalar yetadi.'
  },
  // W
  {
    word: 'water',
    pos: 'noun',
    ipa: '/ˈwɔː.tər/',
    translation: 'suv',
    definition: 'A colorless, transparent, odorless liquid essential for life.',
    example_en: 'Drink plenty of fresh water every day.',
    example_uz: 'Har kuni ko\'p toza suv iching.'
  },
  {
    word: 'wisdom',
    pos: 'noun',
    ipa: '/ˈwɪz.dəm/',
    translation: 'donolik, hikmat, aql-zakovat',
    definition: 'The quality of having experience, knowledge, and good judgment.',
    example_en: 'Wisdom comes not from age, but from learning and reflection.',
    example_uz: 'Donolik yoshdan emas, o\'rganish va tafakkur qilishdan keladi.'
  },
  {
    word: 'word',
    pos: 'noun',
    ipa: '/wɜːd/',
    translation: 'so\'z, kalom, gap',
    definition: 'A single distinct meaningful element of speech or writing.',
    example_en: 'Kind words can heal a wounded spirit.',
    example_uz: 'Iliq so\'zlar yaralangan qalbga malham bo\'ladi.'
  },
  {
    word: 'work',
    pos: 'noun',
    ipa: '/wɜːk/',
    translation: 'ish, mehnat, faoliyat',
    definition: 'Activity involving mental or physical effort done in order to achieve a result.',
    example_en: 'Hard work always brings success.',
    example_uz: 'Og\'ir mehnat har doim muvaffaqiyat keltiradi.'
  }
];

// Helper to search words with Free Dictionary API live fallback
async function searchDictionary(query) {
  if (!query || typeof query !== 'string') {
    return dictionaryWords.slice(0, 20);
  }
  const cleanQ = query.trim().toLowerCase();
  if (!cleanQ) {
    return dictionaryWords.slice(0, 20);
  }

  // 1. Mahalliy lug'atdan qidirish
  const localResults = dictionaryWords.filter(item => 
    item.word.toLowerCase().startsWith(cleanQ) ||
    item.word.toLowerCase().includes(cleanQ) ||
    item.translation.toLowerCase().includes(cleanQ)
  );

  if (localResults.length > 0) {
    return localResults;
  }

  // 2. Agar mahalliy bazada topilmasa, Free Dictionary API orqali onlayn qidirish
  try {
    const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(cleanQ)}`);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        const item = data[0];
        const phonetic = item.phonetic || (item.phonetics && item.phonetics.find(p => p.text)?.text) || '';
        const firstMeaning = item.meanings && item.meanings[0];
        const pos = firstMeaning ? firstMeaning.partOfSpeech : 'noun';
        const defObj = firstMeaning && firstMeaning.definitions && firstMeaning.definitions[0];
        const defEn = defObj ? defObj.definition : '';
        const exEn = defObj ? defObj.example : '';

        return [{
          word: item.word,
          pos,
          ipa: phonetic,
          translation: `[Ta'rif]: ${defEn}`,
          definition: defEn,
          example_en: exEn || `Study how to use "${item.word}" in English sentences.`,
          example_uz: `"${item.word}" so'zini inglizcha gaplarda qo'llashni o'rganing.`
        }];
      }
    }
  } catch (err) {
    console.warn('Dictionary API so\'rovida xatolik:', err.message);
  }

  return [];
}

module.exports = {
  dictionaryWords,
  searchDictionary
};
