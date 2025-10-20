import { allPatterns as patternsData } from './data.js';

let allPatterns = [];
let learningCounts = {};
const audioCache = {};
let currentAudio = null;
let currentPlayingButton = null;
let wakeLock = null;
let conversationHistory = []; // AI 채팅 기록

// DOM Elements
let patternContainer, currentDateEl, newPatternBtn, openTranslatorBtn, translatorModal,
    closeTranslatorBtn, translateBtn, koreanInput, translationResult, customAlertModal,
    customAlertMessage, customAlertCloseBtn, allPatternsBtn, allPatternsModal,
    closeAllPatternsBtn, allPatternsList, chatBtn, chatModal, closeChatBtn,
    chatHistory, chatInput, sendChatBtn, micBtn, suggestReplyBtn;

// 음성 인식 관련
let recognition = null;
let isRecognizing = false;

function initializeDOM() {
    patternContainer = document.getElementById('pattern-container');
    currentDateEl = document.getElementById('current-date');
    newPatternBtn = document.getElementById('new-pattern-btn');
    openTranslatorBtn = document.getElementById('open-translator-btn');
    translatorModal = document.getElementById('translator-modal');
    closeTranslatorBtn = document.getElementById('close-translator-btn');
    translateBtn = document.getElementById('translate-btn');
    koreanInput = document.getElementById('korean-input');
    translationResult = document.getElementById('translation-result');
    customAlertModal = document.getElementById('custom-alert-modal');
    customAlertMessage = document.getElementById('custom-alert-message');
    customAlertCloseBtn = document.getElementById('custom-alert-close-btn');
    allPatternsBtn = document.getElementById('all-patterns-btn');
    allPatternsModal = document.getElementById('all-patterns-modal');
    closeAllPatternsBtn = document.getElementById('close-all-patterns-btn');
    allPatternsList = document.getElementById('all-patterns-list');
    chatBtn = document.getElementById('chat-btn');
    chatModal = document.getElementById('chat-modal');
    closeChatBtn = document.getElementById('close-chat-btn');
    chatHistory = document.getElementById('chat-history');
    chatInput = document.getElementById('chat-input');
    sendChatBtn = document.getElementById('send-chat-btn');
    micBtn = document.getElementById('mic-btn');
    suggestReplyBtn = document.getElementById('suggest-reply-btn');
}

// --- 커스텀 알림 함수 ---
function showAlert(message) {
    customAlertMessage.textContent = message;
    customAlertModal.classList.remove('hidden');
}

// --- API 호출 공통 함수 (오류 처리 수정) ---
async function callGeminiAPI(action, body) {
    const response = await fetch('/api/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...body })
    });

    if (!response.ok) {
        let errorText = await response.text(); // Get response as text first
        let errorJson = null;
        try {
            // Try to parse it as JSON (for standard API errors)
            errorJson = JSON.parse(errorText);
        } catch (e) {
            // It wasn't JSON (it was "A server error..."), so just use the text
            console.error("Non-JSON error response from server:", errorText);
        }
        
        // Throw a useful error message
        if (errorJson && errorJson.error) {
            throw new Error(errorJson.error);
        } else {
            // Truncate long HTML error messages
            throw new Error(errorText.substring(0, 100) || `API ${action} failed with status ${response.status}`);
        }
    }

    // If response.ok is true, we assume it's valid JSON
    return response.json();
}


// --- TTS (Text-to-Speech) 함수 ---
async function playTTS(text, buttonElement) {
    if (currentAudio) {
        currentAudio.pause();
        currentAudio = null;
        if (currentPlayingButton) currentPlayingButton.classList.remove('is-playing');
        if (currentPlayingButton === buttonElement) {
            currentPlayingButton = null;
            return;
        }
    }
    currentPlayingButton = buttonElement;
    buttonElement.classList.add('is-playing');
    try {
        let audioData = audioCache[text];
        if (!audioData) {
            const result = await callGeminiAPI('tts', { text });
            audioData = result.audioContent;
            audioCache[text] = audioData;
        }
        const audio = new Audio(`data:audio/mp3;base64,${audioData}`);
        currentAudio = audio;
        audio.play();
        audio.onended = () => {
            buttonElement.classList.remove('is-playing');
            currentAudio = null;
            currentPlayingButton = null;
        };
        audio.onerror = (e) => {
            console.error('Audio playback error:', e);
            showAlert('오디오 재생 중 오류가 발생했습니다.');
            buttonElement.classList.remove('is-playing');
            currentAudio = null;
            currentPlayingButton = null;
        };
    } catch (error) {
        console.error('TTS error:', error);
        showAlert(`음성(TTS)을 불러오는 데 실패했습니다: ${error.message}`);
        buttonElement.classList.remove('is-playing');
        currentPlayingButton = null;
    }
}

// --- 학습 카운트 관련 함수 ---
function initializeCounts() {
    const storedCounts = localStorage.getItem('englishLearningCounts'); // 수정
    learningCounts = storedCounts ? JSON.parse(storedCounts) : {};
}
function saveCounts() {
    localStorage.setItem('englishLearningCounts', JSON.stringify(learningCounts)); // 수정
}

// --- 날짜 및 패턴 렌더링 함수 ---
function getTodayString() { return new Date().toISOString().split('T')[0]; }
function displayDate() {
    const today = new Date();
    currentDateEl.textContent = `${today.getFullYear()}년 ${today.getMonth() + 1}월 ${today.getDate()}일`;
}
function getRandomPatterns() {
    const shuffled = [...allPatterns].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, 2);
}

function renderPatterns(patterns, showIndex = false) {
    patternContainer.innerHTML = '';
    patterns.forEach((p, index) => {
        const count = learningCounts[p.pattern] || 0;
        const card = document.createElement('div');
        card.className = 'bg-white p-6 rounded-lg shadow-md hover:shadow-lg transition-shadow duration-300';

        // 영어 버전에 맞게 수정 (pinyin 제거)
        const examplesHtml = p.examples.map(ex => `
            <div class="mt-3">
                <div class="flex items-center">
                    <p class="text-lg english-text text-gray-800">${ex.english}</p>
                    <button class="tts-btn ml-2 p-1 rounded-full hover:bg-gray-200 transition-colors" data-text="${ex.english}">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5 text-gray-500 pointer-events-none">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" />
                        </svg>
                    </button>
                </div>
                <p class="text-md text-gray-600">${ex.korean}</p>
            </div>
        `).join('');

        // 영어 버전에 맞게 수정 (pinyin 제거)
        const vocabHtml = p.vocab.map(v => `
            <div class="flex items-baseline">
                <p class="w-1/2 text-md english-text text-gray-700 font-medium">${v.word}</p>
                <p class="w-1/2 text-sm text-gray-600">${v.meaning}</p>
            </div>
        `).join('');

        const indexHtml = showIndex ? `<span class="bg-blue-100 text-blue-800 text-sm font-semibold mr-3 px-3 py-1 rounded-full">${index + 1}</span>` : '';

        // 영어 버전에 맞게 수정 (pinyin 제거)
        const practiceHtml = p.practice ? `
            <div class="mt-6">
                <h3 class="text-lg font-bold text-gray-700 border-b pb-1">✍️ 직접 말해보기</h3>
                <div class="mt-3 bg-sky-50 p-4 rounded-lg relative">
                    <button id="show-hint-btn-${index}" title="힌트 보기" data-pattern-string="${p.pattern}" data-hint-target="practice-hint-${index}" class="show-hint-btn absolute top-3 right-3 bg-gray-300 hover:bg-gray-400 text-gray-700 p-1.5 rounded-full">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5 pointer-events-none">
                          <path stroke-linecap="round" stroke-linejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 0 0 1.5-.189m-1.5.189a6.01 6.01 0 0 1-1.5-.189m3.75 7.478a12.06 12.06 0 0 1-4.5 0m3.75 2.355a11.95 11.95 0 0 1-8.25 0m11.25 0a11.95 11.95 0 0 0-8.25 0M9 7.5a9 9 0 1 1 6 0a9 9 0 0 1-6 0Z" />
                        </svg>
                    </button>
                    <p class="text-md text-gray-700 mb-2">다음 문장을 영어로 입력해보세요:</p>
                    <p class="text-md font-semibold text-sky-800 mb-3">"${p.practice.korean}"</p>
                    <div class="flex items-center space-x-2">
                        <input type="text" id="practice-input-${index}" class="w-full p-2 border border-gray-300 rounded-md english-text" placeholder="영어를 입력하세요...">
                        <button id="check-practice-btn-${index}" data-answer="${p.practice.english}" data-input-id="practice-input-${index}" class="check-practice-btn bg-sky-500 hover:bg-sky-600 text-white font-bold py-2 px-4 rounded-lg whitespace-nowrap">정답 확인</button>
                    </div>
                    <div id="practice-hint-${index}" class="mt-3"></div>
                    <div id="practice-result-${index}" class="mt-3 text-center"></div>
                </div>
            </div>
        ` : '';

        // 영어 버전에 맞게 수정 (pinyin 제거)
        card.innerHTML = `
            <div class="flex items-center justify-between mb-3">
                <div class="flex items-center">
                    ${indexHtml}
                    <div>
                       <h2 class="text-2xl font-bold text-gray-800 english-text">"${p.pattern}"</h2>
                    </div>
                </div>
                <div class="text-right">
                     <button data-pattern="${p.pattern}" class="learn-btn bg-yellow-400 hover:bg-yellow-500 text-white text-sm font-bold py-1 px-3 rounded-full transition-colors">학습 완료!</button>
                     <p class="text-xs text-gray-500 mt-1">학습 <span class="font-bold text-red-500 count-display">${count}</span>회</p>
                </div>
            </div>
            <div class="mt-4">
                <p class="text-lg text-blue-700 font-semibold mb-2">${p.meaning}</p>
                <p class="text-sm text-gray-500 bg-gray-100 p-2 rounded-md"><b>🤔 어떻게 사용할까요?</b> ${p.structure || '구조 정보 없음'}</p>
            </div>

            <div class="mt-4">
                <h3 class="text-lg font-bold text-gray-700 border-b pb-1">💡 예문 살펴보기</h3>
                ${examplesHtml}
            </div>

            <div class="mt-6">
                <h3 class="text-lg font-bold text-gray-700 border-b pb-1">📌 주요 단어</h3>
                <div class="mt-3 space-y-2">
                   ${vocabHtml}
                </div>
            </div>
            ${practiceHtml}
        `;
        patternContainer.appendChild(card);
    });
}

function loadDailyPatterns() {
    const todayStr = getTodayString();
    const storedData = JSON.parse(localStorage.getItem('dailyEnglishPatterns')); // 수정
    if (storedData && storedData.date === todayStr) {
        renderPatterns(storedData.patterns);
    } else {
        const newPatterns = getRandomPatterns();
        localStorage.setItem('dailyEnglishPatterns', JSON.stringify({ date: todayStr, patterns: newPatterns })); // 수정
        renderPatterns(newPatterns);
    }
}
function renderAllPatternsList() {
    allPatternsList.innerHTML = '';
    allPatterns.forEach((p, index) => {
        const patternItem = document.createElement('div');
        patternItem.className = 'p-4 hover:bg-gray-100 cursor-pointer';
        patternItem.dataset.patternIndex = index;
        // 영어 버전에 맞게 수정 (pinyin 제거)
        patternItem.innerHTML = `
            <div class="flex items-start pointer-events-none">
                <span class="mr-3 text-gray-500 font-medium w-8 text-right">${index + 1}.</span>
                <div>
                    <p class="text-lg font-semibold english-text text-gray-800">"${p.pattern}"</p>
                    <p class="text-sm text-gray-600">${p.meaning}</p>
                </div>
            </div>
        `;
        allPatternsList.appendChild(patternItem);
    });
}

// --- 화면 꺼짐 방지 ---
async function setupScreenWakeLock() {
    if ('wakeLock' in navigator) {
        try {
            wakeLock = await navigator.wakeLock.request('screen');
            wakeLock.addEventListener('release', () => console.log('Screen Wake Lock released'));
            console.log('Screen Wake Lock active');
        } catch (err) { console.error(`${err.name}, ${err.message}`); }
    } else { console.log('Screen Wake Lock API not supported.'); }
}

// --- AI 채팅 관련 함수 ---
function addMessageToHistory(sender, messageData) {
    const messageElement = document.createElement('div');
    if (sender === 'user') {
        messageElement.className = 'flex justify-end';
        messageElement.innerHTML = `<div class="bg-purple-500 text-white p-3 rounded-lg max-w-xs">${messageData.text}</div>`;
    } else { // AI
        // 영어 버전에 맞게 수정 (pinyin 제거)
        messageElement.className = 'flex justify-start';
        messageElement.innerHTML = `
            <div class="bg-white p-3 rounded-lg max-w-xs border">
                <div class="flex items-center">
                    <p class="text-lg english-text text-gray-800">${messageData.english}</p>
                    <button class="tts-btn ml-2 p-1 rounded-full hover:bg-gray-200 transition-colors" data-text="${messageData.english}">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5 text-gray-500 pointer-events-none">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" />
                        </svg>
                    </button>
                </div>
                <p class="text-sm text-gray-600 border-t mt-2 pt-2">${messageData.korean || ''}</p>
            </div>
        `;
    }
    chatHistory.appendChild(messageElement);
    chatHistory.scrollTop = chatHistory.scrollHeight;
}
function addSuggestionToHistory(suggestions) {
    const suggestionElement = document.createElement('div');
    suggestionElement.className = 'flex justify-center my-2';
    // 영어 버전에 맞게 수정 (pinyin 제거)
    const buttonsHtml = suggestions.map(suggestion =>
        `<button class="suggestion-chip bg-blue-100 text-blue-700 px-3 py-1.5 rounded-full text-sm hover:bg-blue-200 mx-1 mb-1 flex flex-col items-center" data-text="${suggestion.english}">
            <span class="english-text font-medium">${suggestion.english}</span>
            <span class="text-xs text-gray-600 mt-0.5">${suggestion.korean}</span>
         </button>`
    ).join('');
    suggestionElement.innerHTML = `
        <div class="bg-gray-100 p-2 rounded-lg text-center w-full">
            <p class="text-xs text-gray-600 mb-1">이렇게 답해보세요:</p>
            <div class="flex flex-wrap justify-center">${buttonsHtml}</div>
        </div>`;
    chatHistory.appendChild(suggestionElement);
    suggestionElement.querySelectorAll('.suggestion-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            chatInput.value = chip.dataset.text; // data-text="${suggestion.english}"
            chatInput.focus();
            suggestionElement.remove();
        });
    });
    chatHistory.scrollTop = chatHistory.scrollHeight;
}
async function handleSendMessage() {
    const userInput = chatInput.value.trim();
    if (!userInput) return;
    chatHistory.querySelectorAll('.suggestion-chip').forEach(chip => chip.closest('div.flex.justify-center')?.remove());
    addMessageToHistory('user', { text: userInput });
    chatInput.value = '';
    const loadingElement = document.createElement('div');
    loadingElement.className = 'flex justify-start';
    loadingElement.id = 'chat-loading';
    loadingElement.innerHTML = `<div class="bg-white p-3 rounded-lg border"><div class="loader"></div></div>`;
    chatHistory.appendChild(loadingElement);
    chatHistory.scrollTop = chatHistory.scrollHeight;
    try {
        conversationHistory.push({ role: 'user', parts: [{ text: userInput }] });
        const result = await callGeminiAPI('chat', { text: userInput, history: conversationHistory });
        let aiResponseData;
        if (result.candidates && result.candidates[0]?.content?.parts?.[0]) {
            const aiResponseText = result.candidates[0].content.parts[0].text;
            try {
                aiResponseData = JSON.parse(aiResponseText);
                conversationHistory.push({ role: 'model', parts: [{ text: aiResponseText }] });
            } catch (e) {
                console.error("AI response is not valid JSON:", aiResponseText);
                // 영어 버전에 맞게 수정
                aiResponseData = { english: aiResponseText, korean: "(번역 오류)" };
                conversationHistory.push({ role: 'model', parts: [{ text: aiResponseText }] });
            }
        } else {
             console.error("Invalid response structure from chat API:", result);
             // 영어 버전에 맞게 수정
             aiResponseData = { english: "(유효하지 않은 응답)", korean: "" };
        }
        addMessageToHistory('ai', aiResponseData);
    } catch (error) {
        console.error('Chat error:', error);
        showAlert(`대화 중 오류가 발생했습니다: ${error.message}`);
    } finally {
        document.getElementById('chat-loading')?.remove();
    }
}
async function handleSuggestReply() {
    chatHistory.querySelectorAll('.suggestion-chip').forEach(chip => chip.closest('div.flex.justify-center')?.remove());
    if (conversationHistory.length === 0) {
        showAlert('추천할 답변을 생성하기 위한 대화 내용이 없습니다.');
        return;
    }
    suggestReplyBtn.disabled = true;
    suggestReplyBtn.textContent = '추천 생성 중...';
    try {
        const result = await callGeminiAPI('suggest_reply', { history: conversationHistory });
        const suggestions = result.suggestions || [];
        // 영어 버전에 맞게 수정 (pinyin 제거)
        if (suggestions.length > 0 && suggestions.every(s => s.english && s.korean)) {
            addSuggestionToHistory(suggestions);
        } else {
             console.warn("Received suggestions are empty or have invalid format:", suggestions);
            showAlert('추천할 만한 답변을 찾지 못했거나 형식이 잘못되었습니다.');
        }
    } catch (error) {
        console.error('Suggest reply error:', error);
        showAlert(`답변 추천 중 오류 발생: ${error.message}`);
    } finally {
        suggestReplyBtn.disabled = false;
        suggestReplyBtn.textContent = '💡 답변 추천받기';
    }
}

// --- 번역기 함수 ---
async function handleTranslation() {
    const text = koreanInput.value.trim();
    if (!text) {
        showAlert('번역할 한국어 문장을 입력하세요.');
        return;
    }
    translateBtn.disabled = true;
    translationResult.innerHTML = '<div class="loader mx-auto"></div>';
    try {
        // 영어 번역용 시스템 프롬프트 (JSON 응답 요구)
        const systemPrompt = `You are a professional Korean-to-English translator and language teacher. Translate the following Korean sentence into natural, native-sounding English. Provide: 1. The main English translation. 2. (Optional) 1-2 alternative natural expressions if applicable. 3. A concise explanation (in Korean) of why this expression is natural, what the key vocabulary or grammar point is. Format your response as a single, valid JSON object with keys "english", "alternatives" (string array), and "explanation" (string, in Korean). Do not include markdown backticks.`;
        const result = await callGeminiAPI('translate', { text, systemPrompt });
        let translationData;
        if (result.candidates && result.candidates[0]?.content?.parts?.[0]) {
            const translationText = result.candidates[0].content.parts[0].text;
            try {
                translationData = JSON.parse(translationText);
            } catch (e) {
                console.error("AI translation response is not valid JSON:", translationText);
                // 영어 버전에 맞게 수정
                translationData = { english: translationText, pinyin: "(JSON 파싱 오류)", alternatives: [], explanation: "(설명 파싱 오류)" };
            }
        } else {
             console.error("Invalid response structure from translate API:", result);
             // 영어 버전에 맞게 수정
             translationData = { english: "(유효하지 않은 응답)", pinyin: "", alternatives: [], explanation: "" };
        }
        let alternativesHtml = '';
        if (translationData.alternatives && Array.isArray(translationData.alternatives) && translationData.alternatives.length > 0) {
            alternativesHtml = `<p class="text-sm text-gray-500 mt-3">다른 표현:</p><ul class="list-disc list-inside text-sm text-gray-600 english-text">${translationData.alternatives.map(alt => `<li>${alt}</li>`).join('')}</ul>`;
        }
        let explanationHtml = '';
        if (translationData.explanation) {
            explanationHtml = `<div class="mt-4 pt-3 border-t"><h4 class="text-sm font-semibold text-gray-700">💡 표현 꿀팁:</h4><p class="text-sm text-gray-600 mt-1">${translationData.explanation.replace(/\n/g, '<br>')}</p></div>`;
        }
        // 영어 버전에 맞게 수정 (pinyin 제거)
        translationResult.innerHTML = `
            <div class="flex items-center">
                <p class="text-xl english-text font-bold text-gray-800">${translationData.english}</p>
                <button class="tts-btn ml-2 p-1 rounded-full hover:bg-gray-200 transition-colors" data-text="${translationData.english}">
                     <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5 text-gray-500 pointer-events-none"> <path stroke-linecap="round" stroke-linejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" /> </svg>
                </button>
            </div>
            ${alternativesHtml}
            ${explanationHtml}`;
    } catch (error) {
        console.error('Translation error:', error);
        translationResult.innerHTML = `<p class="text-red-500 text-center">번역 중 오류가 발생했습니다: ${error.message}</p>`;
    } finally {
        translateBtn.disabled = false;
    }
}

// --- 음성 인식 초기화 ---
function initializeSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
        recognition = new SpeechRecognition();
        recognition.lang = 'en-US'; // 영어로 수정
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;
        recognition.onresult = (event) => {
            const speechResult = event.results[0][0].transcript;
            chatInput.value = speechResult;
        };
        recognition.onspeechend = () => { if(isRecognizing) recognition.stop(); };
        recognition.onnomatch = () => showAlert('음성을 인식하지 못했습니다. 다시 시도해주세요.');
        recognition.onerror = (event) => {
            console.error("Speech recognition error:", event.error);
            if (event.error !== 'no-speech' && event.error !== 'aborted' && event.error !== 'not-allowed') {
                 showAlert(`음성 인식 오류: ${event.error}. 마이크 권한을 확인하세요.`);
            } else if (event.error === 'not-allowed') {
                 showAlert('마이크 사용 권한이 거부되었습니다. 브라우저 설정을 확인해주세요.');
            }
             micBtn.classList.remove('is-recording');
             isRecognizing = false;
        };
         recognition.onend = () => {
            micBtn.classList.remove('is-recording');
            isRecognizing = false;
        };
    } else {
        console.warn('Web Speech API is not supported in this browser.');
        showAlert('현재 브라우저에서는 음성 인식을 지원하지 않습니다.');
        if(micBtn) micBtn.disabled = true;
    }
}

// --- 메인 이벤트 리스너 설정 ---
function setupEventListeners() {
    newPatternBtn.addEventListener('click', () => {
         const newPatterns = getRandomPatterns();
         localStorage.setItem('dailyEnglishPatterns', JSON.stringify({ date: getTodayString(), patterns: newPatterns })); // 수정
         renderPatterns(newPatterns);
         window.scrollTo(0, 0);
    });
    patternContainer.addEventListener('click', (e) => {
        const target = e.target;
        if (target.classList.contains('learn-btn')) { /* 학습 완료 로직 */
            const pattern = target.dataset.pattern;
            learningCounts[pattern] = (learningCounts[pattern] || 0) + 1;
            saveCounts();
            target.nextElementSibling.querySelector('.count-display').textContent = learningCounts[pattern];
        } else if (target.classList.contains('check-practice-btn')) { /* 정답 확인 로직 */
            const button = target;
            const inputId = button.dataset.inputId;
            const index = inputId.split('-').pop();
            const correctAnswer = button.dataset.answer;
            // const correctPinyin = button.dataset.pinyin; // 제거
            const userInput = document.getElementById(inputId).value.trim();
            const resultDiv = document.getElementById(`practice-result-${index}`);
            // 영어용 정규화 (기존 영어 main.js에서 가져옴)
            const normalize = (str) => str.replace(/[.,'’"!?]/g, '').replace(/\s+/g, ' ').toLowerCase();
            let resultMessageHtml = '';
            // 영어 버전에 맞게 수정 (pinyin 제거)
            const answerHtml = `<div class="mt-2 p-2 bg-gray-100 rounded text-left"><p class="text-sm">정답:</p><div class="flex items-center"><p class="text-md english-text font-semibold text-gray-800">${correctAnswer}</p><button class="tts-btn ml-2 p-1 rounded-full hover:bg-gray-200 transition-colors" data-text="${correctAnswer}"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5 text-gray-500 pointer-events-none"><path stroke-linecap="round" stroke-linejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" /></svg></button></div></div>`;
            if (normalize(userInput) === normalize(correctAnswer)) { resultMessageHtml = `<p class="text-green-600 font-bold text-lg">🎉 정답입니다!</p>` + answerHtml; }
            else { resultMessageHtml = `<p class="text-red-500 font-bold text-lg">🤔 아쉽네요, 다시 시도해보세요.</p>${answerHtml}`; }
            resultDiv.innerHTML = `${resultMessageHtml}<button class="retry-practice-btn mt-3 bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-lg" data-practice-index="${index}">다시하기</button>`;
            button.style.display = 'none';
            const hintButton = document.getElementById(`show-hint-btn-${index}`); if(hintButton) hintButton.style.display = 'none';
        } else if (target.closest('.show-hint-btn')) { /* 힌트 보기 로직 */
            const button = target.closest('.show-hint-btn');
            const patternString = button.dataset.patternString;
            const hintTargetId = button.dataset.hintTarget;
            const hintDiv = document.getElementById(hintTargetId);
            const patternData = allPatterns.find(p => p.pattern === patternString);
            
            // 영어 data.js의 'practiceVocab' 사용 (기존 영어 main.js 로직)
            if (patternData && patternData.practiceVocab && patternData.practiceVocab.length > 0) {
                const shuffledVocab = [...patternData.practiceVocab].sort(() => 0.5 - Math.random());
                // 영어 버전에 맞게 수정 (pinyin 제거)
                const hintsHtml = shuffledVocab.map(hint => `<div class="flex items-baseline" style="line-height: 1.3;"><span class="inline-block w-[50%] font-medium english-text pr-2">${hint.word}</span><span class="inline-block w-[50%] text-sm text-gray-600">${hint.meaning}</span></div>`).join('');
                hintDiv.innerHTML = `<div class="bg-white/50 rounded-md p-2 text-left"><div class="flex items-center mb-1"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5 mr-0.5 text-yellow-500"><path stroke-linecap="round" stroke-linejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 0 0 1.5-.189m-1.5.189a6.01 6.01 0 0 1-1.5-.189m3.75 7.478a12.06 12.06 0 0 1-4.5 0m3.75 2.355a11.95 11.95 0 0 1-8.25 0m11.25 0a11.95 11.95 0 0 0-8.25 0M9 7.5a9 9 0 1 1 6 0a9 9 0 0 1-6 0Z" /></svg><span class="font-semibold text-sm text-gray-700">힌트</span></div><div class="border-t border-gray-300/50 pt-1">${hintsHtml}</div></div>`;
            } else { hintDiv.innerHTML = `<p class="text-sm text-gray-500">이 문장에 대한 핵심 단어 정보가 없습니다.</p>`; }
            button.disabled = true; button.classList.add('opacity-50', 'cursor-not-allowed');
        } else if (target.classList.contains('retry-practice-btn')) { /* 다시하기 로직 */
            const index = target.dataset.practiceIndex;
            document.getElementById(`practice-input-${index}`).value = '';
            document.getElementById(`practice-result-${index}`).innerHTML = '';
            document.getElementById(`practice-hint-${index}`).innerHTML = '';
            document.getElementById(`check-practice-btn-${index}`).style.display = '';
            const hintBtn = document.getElementById(`show-hint-btn-${index}`); hintBtn.style.display = ''; hintBtn.disabled = false; hintBtn.classList.remove('opacity-50', 'cursor-not-allowed');
        } else if (target.closest('.tts-btn')) { /* TTS 로직 */
            const ttsButton = target.closest('.tts-btn');
            const textToSpeak = ttsButton.dataset.text; if (textToSpeak) playTTS(textToSpeak, ttsButton);
        }
    });
    patternContainer.addEventListener('keydown', (e) => { if (e.target.id.startsWith('practice-input-') && e.key === 'Enter') { e.preventDefault(); const checkButton = e.target.nextElementSibling; if (checkButton?.classList.contains('check-practice-btn')) checkButton.click(); } });
    openTranslatorBtn.addEventListener('click', () => translatorModal.classList.remove('hidden'));
    closeTranslatorBtn.addEventListener('click', () => { translatorModal.classList.add('hidden'); if (currentAudio) currentAudio.pause(); });
    translateBtn.addEventListener('click', handleTranslation);
    koreanInput.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleTranslation(); } });
    translationResult.addEventListener('click', (e) => { const ttsButton = e.target.closest('.tts-btn'); if (ttsButton) { const textToSpeak = ttsButton.dataset.text; if (textToSpeak) playTTS(textToSpeak, ttsButton); } });
    customAlertCloseBtn.addEventListener('click', () => customAlertModal.classList.add('hidden'));
    allPatternsBtn.addEventListener('click', () => allPatternsModal.classList.remove('hidden'));
    closeAllPatternsBtn.addEventListener('click', () => allPatternsModal.classList.add('hidden'));
    allPatternsList.addEventListener('click', (e) => { const selectedPatternDiv = e.target.closest('[data-pattern-index]'); if (selectedPatternDiv) { const patternIndex = parseInt(selectedPatternDiv.dataset.patternIndex, 10); const selectedPattern = allPatterns[patternIndex]; if (selectedPattern) { renderPatterns([selectedPattern]); allPatternsModal.classList.add('hidden'); window.scrollTo(0, 0); } } });
    
    // 채팅 리스너 (신규)
    chatBtn.addEventListener('click', () => { 
        chatModal.classList.remove('hidden'); 
        if (conversationHistory.length === 0) { 
            // 영어 버전에 맞게 수정
            const firstMsg = { english: 'Hello! I am your AI tutor. Let\'s chat in English!', korean: '안녕하세요! 저는 AI 튜터입니다. 영어로 대화해요!' }; 
            addMessageToHistory('ai', firstMsg); 
            conversationHistory.push({ role: 'model', parts: [{ text: JSON.stringify(firstMsg) }] }); 
        } 
    });
    closeChatBtn.addEventListener('click', () => { chatModal.classList.add('hidden'); if (recognition && isRecognizing) recognition.stop(); });
    sendChatBtn.addEventListener('click', handleSendMessage);
    chatInput.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } });
    chatHistory.addEventListener('click', (e) => { const ttsButton = e.target.closest('.tts-btn'); if (ttsButton) { const textToSpeak = ttsButton.dataset.text; if (textToSpeak) playTTS(textToSpeak, ttsButton); } });
    micBtn.addEventListener('click', () => { if (!recognition) { showAlert('음성 인식이 지원되지 않거나 초기화되지 않았습니다.'); return; } if (isRecognizing) { recognition.stop(); } else { try { recognition.start(); micBtn.classList.add('is-recording'); isRecognizing = true; } catch(e) { console.error("Speech recognition start error:", e); if (e.name === 'NotAllowedError' || e.name === 'SecurityError') { showAlert("마이크 권한이 필요합니다. 브라우저 설정에서 허용해주세요."); } else { showAlert("음성 인식을 시작할 수 없습니다. 잠시 후 다시 시도해주세요."); } micBtn.classList.remove('is-recording'); isRecognizing = false; } } });
    suggestReplyBtn.addEventListener('click', handleSuggestReply);
}

// --- 앱 초기화 함수 ---
export function initializeApp(patterns) {
    allPatterns = patterns;
    document.addEventListener('DOMContentLoaded', () => {
        initializeDOM();
        displayDate();
        initializeCounts();
        loadDailyPatterns();
        renderAllPatternsList();
        setupScreenWakeLock();
        initializeSpeechRecognition();
        setupEventListeners();
    });
}

// --- 앱 실행 ---
initializeApp(patternsData);

// v.2025.10.20_compat-en-main-fix