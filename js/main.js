// --- 1. DOM 요소 변수 선언 (var로 변경) ---
var patternContainer = document.getElementById('pattern-container');
var currentDateEl = document.getElementById('current-date');
var newPatternBtn = document.getElementById('new-pattern-btn');

// 번역기 모달
var openTranslatorBtn = document.getElementById('open-translator-btn');
var translatorModal = document.getElementById('translator-modal');
var closeTranslatorBtn = document.getElementById('close-translator-btn');
var translateBtn = document.getElementById('translate-btn');
var koreanInput = document.getElementById('korean-input');
var translationResult = document.getElementById('translation-result');

// 알림 모달
var customAlertModal = document.getElementById('custom-alert-modal');
var customAlertMessage = document.getElementById('custom-alert-message');
var customAlertCloseBtn = document.getElementById('custom-alert-close-btn');

// 전체 패턴 모달
var allPatternsBtn = document.getElementById('all-patterns-btn');
var allPatternsModal = document.getElementById('all-patterns-modal');
var closeAllPatternsBtn = document.getElementById('close-all-patterns-btn');
var allPatternsList = document.getElementById('all-patterns-list');

// 채팅 모달
var openChatBtn = document.getElementById('open-chat-btn');
var chatModal = document.getElementById('chat-modal');
var closeChatBtn = document.getElementById('close-chat-btn');
var chatMessages = document.getElementById('chat-messages');
var chatInput = document.getElementById('chat-input');
var sendChatBtn = document.getElementById('send-chat-btn');
var newChatBtn = document.getElementById('new-chat-btn');
var stopChatBtn = document.getElementById('stop-chat-btn');

// --- 2. 전역 변수 및 상태 (var로 변경) ---
var learningCounts = {};
var audioCache = {};
var currentAudio = null;
var currentPlayingButton = null;

var chatHistory = [];
var chatAbortController = null; // 스트리밍 중단을 위한 컨트롤러

// --- 3. 헬퍼 함수 (UI/API 제외) ---

function initializeCounts() {
    const storedCounts = localStorage.getItem('englishLearningCounts');
    if (storedCounts) {
        learningCounts = JSON.parse(storedCounts);
    } else {
        learningCounts = {};
    }
}

function saveCounts() {
    localStorage.setItem('englishLearningCounts', JSON.stringify(learningCounts));
}

function getTodayString() {
    const today = new Date();
    return today.toISOString().split('T')[0];
}

function getRandomPatterns() {
    // allPatterns는 data.js에 정의되어 있음
    const shuffled = [...allPatterns].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, 2);
}

function loadDailyPatterns() {
    const todayStr = getTodayString();
    const storedData = JSON.parse(localStorage.getItem('dailyEnglishPatterns'));

    if (storedData && storedData.date === todayStr) {
        renderPatterns(storedData.patterns); // ui.js
    } else {
        const newPatterns = getRandomPatterns();
        localStorage.setItem('dailyEnglishPatterns', JSON.stringify({ date: todayStr, patterns: newPatterns }));
        renderPatterns(newPatterns); // ui.js
    }
}

function resetChat() {
    if (chatAbortController) {
        chatAbortController.abort();
    }
    chatHistory = [];
    chatMessages.innerHTML = `
        <div class="chat-bubble-model">
            <p class="english-text">Hello! How can I help you practice your English today?</p>
        </div>`;
    chatInput.value = '';
    sendChatBtn.disabled = false;
    stopChatBtn.classList.add('hidden');
}

// --- 4. 이벤트 리스너 ---

// '새로운 패턴 보기' 버튼
newPatternBtn.addEventListener('click', () => {
     const newPatterns = getRandomPatterns();
     localStorage.setItem('dailyEnglishPatterns', JSON.stringify({ date: getTodayString(), patterns: newPatterns }));
     renderPatterns(newPatterns); // ui.js
     window.scrollTo(0, 0);
});

// 패턴 카드 내부 클릭 이벤트 (학습 완료, 정답 확인 등)
patternContainer.addEventListener('click', (e) => {
    if (e.target.classList.contains('learn-btn')) {
        const pattern = e.target.dataset.pattern;
        learningCounts[pattern] = (learningCounts[pattern] || 0) + 1;
        saveCounts();
        e.target.nextElementSibling.querySelector('.count-display').textContent = learningCounts[pattern];
    } else if (e.target.classList.contains('check-practice-btn')) {
        const button = e.target;
        const inputId = button.dataset.inputId;
        const index = inputId.split('-').pop();
        
        const correctAnswer = button.dataset.answer;
        const userInput = document.getElementById(inputId).value.trim();
        const resultDiv = document.getElementById(`practice-result-${index}`);
        
        const normalize = (str) => str.replace(/[.,'’"!?]/g, '').replace(/\s+/g, ' ').toLowerCase();

        let resultMessageHtml = '';
        
        const answerHtml = `
            <div class="mt-2 p-2 bg-gray-100 rounded text-left">
                <p class="text-sm">정답:</p>
                <div class="flex items-center">
                    <p class="text-md english-text font-semibold text-gray-800">${correctAnswer}</p>
                    <button class="tts-btn ml-2 p-1 rounded-full hover:bg-gray-200 transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5 text-gray-500 pointer-events-none">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" />
                        </svg>
                    </button>
                </div>
            </div>
        `;

        if (normalize(userInput) === normalize(correctAnswer)) {
            resultMessageHtml = `<p class="text-green-600 font-bold text-lg">🎉 정답입니다!</p>` + answerHtml;
        } else {
            resultMessageHtml = `
                <p class="text-red-500 font-bold text-lg">🤔 아쉽네요, 다시 시도해보세요.</p>
                ${answerHtml}
            `;
        }

        resultDiv.innerHTML = `
            ${resultMessageHtml}
            <button class="retry-practice-btn mt-3 bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-lg" data-practice-index="${index}">
                다시하기
            </button>
        `;
        
        button.style.display = 'none';
        document.getElementById(`show-hint-btn-${index}`).style.display = 'none';

    } else if (e.target.classList.contains('show-hint-btn')) {
        const button = e.target;
        const patternString = button.dataset.patternString;
        const hintTargetId = button.dataset.hintTarget;
        const hintDiv = document.getElementById(hintTargetId);

        const patternData = allPatterns.find(p => p.pattern === patternString); // data.js

        if (patternData && patternData.practiceVocab && patternData.practiceVocab.length > 0) {
            const shuffledVocab = [...patternData.practiceVocab].sort(() => 0.5 - Math.random());
            
            const hintsHtml = shuffledVocab.map(hint => `
                <div class="flex items-baseline" style="line-height: 1.3;">
                    <span class="inline-block w-[50%] font-medium english-text pr-2">${hint.word}</span>
                    <span class="inline-block w-[50%] text-sm text-gray-600">${hint.meaning}</span>
                </div>
            `).join('');

            hintDiv.innerHTML = `
            <div class="bg-white/50 rounded-md p-2 text-left">
                <div class="flex items-center mb-1">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5 mr-0.5 text-yellow-500">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.898 20.572L16.25 21.75l-.648-1.178a2.625 2.625 0 00-1.933-1.933L12.5 18l1.178-.648a2.625 2.625 0 001.933-1.933L16.25 14.25l.648 1.178a2.625 2.625 0 001.933 1.933L20 18l-1.178.648a2.625 2.625 0 00-1.933 1.933z" />
                    </svg>
                    <span class="font-semibold text-sm text-gray-700">힌트</span>
                </div>
                <div class="border-t border-gray-300/50 pt-1">${hintsHtml}</div>
            </div>`;
            
        } else {
            hintDiv.innerHTML = `<p class="text-sm text-gray-500">이 문장에 대한 핵심 단어 정보가 없습니다.</p>`;
        }
        
        button.disabled = true;
        button.classList.add('opacity-50', 'cursor-not-allowed');
    } else if (e.target.classList.contains('retry-practice-btn')) {
        const index = e.target.dataset.practiceIndex;

        document.getElementById(`practice-input-${index}`).value = '';
        document.getElementById(`practice-result-${index}`).innerHTML = '';
        document.getElementById(`practice-hint-${index}`).innerHTML = '';

        document.getElementById(`check-practice-btn-${index}`).style.display = '';
        const hintBtn = document.getElementById(`show-hint-btn-${index}`);
        hintBtn.style.display = '';
        hintBtn.disabled = false;
        hintBtn.classList.remove('opacity-50', 'cursor-not-allowed');
    }
});

// '직접 말해보기' Enter 키 이벤트
patternContainer.addEventListener('keydown', (e) => {
    if (e.target.id.startsWith('practice-input-') && e.key === 'Enter') {
        e.preventDefault(); 
        const checkButton = e.target.nextElementSibling;
        if (checkButton && checkButton.classList.contains('check-practice-btn')) {
            checkButton.click();
        }
    }
});

// 번역기 모달 이벤트
openTranslatorBtn.addEventListener('click', () => translatorModal.classList.remove('hidden'));
closeTranslatorBtn.addEventListener('click', () => {
    translatorModal.classList.add('hidden');
    if (currentAudio) {
        currentAudio.pause();
        currentAudio = null;
    }
});

// '전체 패턴 보기' 모달 이벤트
allPatternsBtn.addEventListener('click', () => {
    allPatternsModal.classList.remove('hidden');
});

closeAllPatternsBtn.addEventListener('click', () => {
    allPatternsModal.classList.add('hidden');
});

allPatternsList.addEventListener('click', (e) => {
    const selectedPatternDiv = e.target.closest('[data-pattern-index]');
    if (selectedPatternDiv) {
        const patternIndex = parseInt(selectedPatternDiv.dataset.patternIndex, 10);
        const selectedPattern = allPatterns[patternIndex]; // data.js
        if (selectedPattern) {
            renderPatterns([selectedPattern]); // ui.js
            allPatternsModal.classList.add('hidden');
            window.scrollTo(0, 0);
        }
    }
});

// 번역기 '번역' 버튼
translateBtn.addEventListener('click', async () => {
    const koreanText = koreanInput.value.trim();
    if (!koreanText) {
        showAlert('번역할 한국어 문장을 입력해주세요.'); // ui.js
        return;
    }

    translationResult.innerHTML = '<div class="loader mx-auto"></div>';

    try {
        const resultText = await getNativeTranslation(koreanText); // api.js
        const lines = resultText.split('\n').filter(line => line.trim() !== '');

        const englishText = lines[1] || '번역 결과를 찾을 수 없습니다.';
        const explanationText = lines.slice(3).join('<br>') || '설명을 찾을 수 없습니다.';

        translationResult.innerHTML = `
            <h3 class="text-xl font-bold text-gray-800 mt-2">자연스러운 표현</h3>
            <div class="flex items-center">
                <p class="text-lg english-text text-gray-800">${englishText}</p>
                <button class="tts-btn ml-2 p-1 rounded-full hover:bg-gray-200 transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5 text-gray-500 pointer-events-none">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" />
                    </svg>
                </button>
            </div>
            <h4 class="text-lg font-semibold text-gray-700 mt-2">💡 이렇게 표현하는 이유</h4>
            <p>${explanationText.replace('#### 💡 이렇게 표현하는 이유', '').trim()}</p>
        `;

    } catch (error) {
        console.error('Translation error:', error);
        showAlert(`번역 중 오류가 발생했습니다. 서버 응답: ${error.message}`); // ui.js
        translationResult.innerHTML = `<p class="text-red-500">오류가 발생했습니다. 다시 시도해 주세요.</p>`;
    }
});

// 알림 모달 '확인' 버튼
customAlertCloseBtn.addEventListener('click', () => {
    customAlertModal.classList.add('hidden');
});

// --- (모든) TTS 버튼 이벤트 리스너 ---
document.body.addEventListener('click', (e) => {
    const ttsButton = e.target.closest('.tts-btn');
    if (ttsButton) {
        let textElement = ttsButton.previousElementSibling;
        
        // .english-text 클래스를 가진 p 태그를 찾기 (구조가 다를 수 있으므로)
        if (textElement && !textElement.classList.contains('english-text')) {
             // chat-bubble-model 내부의 구조 (div > p) 대응
            textElement = textElement.querySelector('.english-text');
        }
        
        if (textElement && textElement.classList.contains('english-text')) {
            const text = textElement.textContent.trim();
            if (text) {
                playAudio(text, ttsButton); // api.js
            }
        }
    }
});

// --- 채팅 모달 이벤트 ---

openChatBtn.addEventListener('click', () => {
    chatModal.classList.remove('hidden');
});

closeChatBtn.addEventListener('click', () => {
    chatModal.classList.add('hidden');
    if (chatAbortController) {
        chatAbortController.abort();
    }
    if (currentAudio) {
        currentAudio.pause();
        currentAudio = null;
    }
});

newChatBtn.addEventListener('click', () => {
    resetChat();
});

sendChatBtn.addEventListener('click', () => {
    handleChatSubmit(); // api.js
});

chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleChatSubmit(); // api.js
    }
});

stopChatBtn.addEventListener('click', () => {
    if (chatAbortController) {
        chatAbortController.abort();
        console.log("스트리밍 중단을 요청했습니다.");
    }
});


// --- 5. 앱 초기화 ---

document.addEventListener('DOMContentLoaded', () => {
    displayDate(); // ui.js
    initializeCounts();
    loadDailyPatterns();
    renderAllPatternsList(); // ui.js
});