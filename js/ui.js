// --- UI 렌더링 관련 함수 ---

function displayDate() {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth() + 1;
    const date = today.getDate();
    // currentDateEl 변수는 main.js에 정의되어 있음
    currentDateEl.textContent = `${year}년 ${month}월 ${date}일`;
}

function renderPatterns(patterns, showIndex = false) {
    // patternContainer, learningCounts 변수는 main.js에 정의되어 있음
    patternContainer.innerHTML = '';
    patterns.forEach((p, index) => {
        const count = learningCounts[p.pattern] || 0;
        const card = document.createElement('div');
        card.className = 'bg-white p-6 rounded-lg shadow-md hover:shadow-lg transition-shadow duration-300';
        
        let examplesHtml = p.examples.map(ex => `
            <div class="mt-3">
                <div class="flex items-center">
                    <p class="text-lg english-text text-gray-800">${ex.english}</p>
                    <button class="tts-btn ml-2 p-1 rounded-full hover:bg-gray-200 transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5 text-gray-500 pointer-events-none">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" />
                        </svg>
                    </button>
                </div>
                <p class="text-md text-gray-600">${ex.korean}</p>
            </div>
        `).join('');

        let vocabHtml = p.vocab.map(v => `
            <div class="flex items-baseline">
                <p class="w-1/2 text-md english-text text-gray-700 font-medium">${v.word}</p>
                <p class="w-1/2 text-sm text-gray-600">${v.meaning}</p>
            </div>
        `).join('');

        const indexHtml = showIndex ? `<span class="bg-blue-100 text-blue-800 text-sm font-semibold mr-3 px-3 py-1 rounded-full">${index + 1}</span>` : '';
        
        let practiceHtml = '';
        if (p.practice) {
            practiceHtml = `
                <div class="mt-6">
                    <h3 class="text-lg font-bold text-gray-700 border-b pb-1">✍️ 직접 말해보기</h3>
                    <div class="mt-3 bg-sky-50 p-4 rounded-lg relative">
                        <button id="show-hint-btn-${index}" data-pattern-string="${p.pattern}" data-hint-target="practice-hint-${index}" class="show-hint-btn absolute top-4 right-4 bg-gray-300 hover:bg-gray-400 text-gray-700 font-bold py-1 px-2 rounded-lg text-xs whitespace-nowrap">힌트 보기</button>
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
            `;
        }

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

function renderAllPatternsList() {
    // allPatternsList, allPatterns 변수는 main.js/data.js에 정의되어 있음
    allPatternsList.innerHTML = '';
    const sortedPatterns = [...allPatterns].sort((a, b) => a.pattern.localeCompare(b.pattern));

    sortedPatterns.forEach((p, originalIndex) => {
        const patternItem = document.createElement('div');
        patternItem.className = 'p-4 hover:bg-gray-100 cursor-pointer';
        
        const realIndex = allPatterns.findIndex(item => item.pattern === p.pattern);
        patternItem.dataset.patternIndex = realIndex;

        patternItem.innerHTML = `
            <div class="flex items-start pointer-events-none">
                <div class="w-full">
                    <p class="text-lg font-semibold english-text text-gray-800">"${p.pattern}"</p>
                    <p class="text-sm text-gray-600">${p.meaning}</p>
                </div>
            </div>
        `;
        allPatternsList.appendChild(patternItem);
    });
}

function showAlert(message) {
    // customAlertMessage, customAlertModal 변수는 main.js에 정의되어 있음
    customAlertMessage.textContent = message;
    customAlertModal.classList.remove('hidden');
}

// --- 채팅 UI 함수 ---

function addChatMessage(role, text) {
    // chatMessages 변수는 main.js에 정의되어 있음
    const messageDiv = document.createElement('div');
    messageDiv.className = role === 'user' ? 'chat-bubble-user' : 'chat-bubble-model';
    
    if (role === 'model') {
        messageDiv.innerHTML = `
            <div class="max-w-full">
                <p class="english-text">${text}</p>
            </div>
            <button class="tts-btn ml-2 p-1 rounded-full hover:bg-gray-200 transition-colors flex-shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5 text-gray-500 pointer-events-none">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" />
                </svg>
            </button>
        `;
        messageDiv.classList.add('flex', 'items-center', 'justify-between');
    } else {
        messageDiv.innerHTML = `<p class="english-text">${text}</p>`;
    }

    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    return messageDiv;
}

function showTypingIndicator(show = true) {
    // chatMessages 변수는 main.js에 정의되어 있음
    let indicator = document.getElementById('typing-indicator');
    if (show) {
        if (!indicator) {
            indicator = document.createElement('div');
            indicator.id = 'typing-indicator';
            indicator.className = 'chat-bubble-model typing-indicator';
            indicator.innerHTML = `
                <span class="inline-block w-2 h-2 bg-gray-400 rounded-full"></span>
                <span class="inline-block w-2 h-2 bg-gray-400 rounded-full"></span>
                <span class="inline-block w-2 h-2 bg-gray-400 rounded-full"></span>
            `;
            chatMessages.appendChild(indicator);
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }
    } else {
        if (indicator) {
            indicator.remove();
        }
    }
}