// --- API 통신 및 데이터 처리 관련 함수 ---

// --- TTS (Text-to-Speech) 관련 함수 ---

function base64ToArrayBuffer(base64) {
    const binaryString = window.atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
}

function pcmToWav(pcmDataView, sampleRate) {
    const header = new ArrayBuffer(44);
    const view = new DataView(header);
    const numChannels = 1;
    const bytesPerSample = 2; // 16-bit
    const blockAlign = numChannels * bytesPerSample;
    const byteRate = sampleRate * blockAlign;
    const dataSize = pcmDataView.byteLength;

    // RIFF chunk descriptor
    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + dataSize, true);
    writeString(view, 8, 'WAVE');
    // "fmt " sub-chunk
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true); // Subchunk1Size for PCM
    view.setUint16(20, 1, true); // AudioFormat for PCM
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, 16, true); // BitsPerSample
    // "data" sub-chunk
    writeString(view, 36, 'data');
    view.setUint32(40, dataSize, true);

    function writeString(view, offset, string) {
        for (let i = 0; i < string.length; i++) {
            view.setUint8(offset + i, string.charCodeAt(i));
        }
    }
    
    return new Blob([view.buffer, pcmDataView.buffer], { type: 'audio/wav' });
}

async function playAudio(text, buttonEl) {
    // currentAudio, currentPlayingButton, audioCache, showAlert 변수는 main.js에 정의됨
    if (currentAudio) {
        currentAudio.pause();
        currentAudio.currentTime = 0;
    }
    document.querySelectorAll('.tts-btn.is-playing').forEach(btn => btn.classList.remove('is-playing'));

    if (currentPlayingButton === buttonEl) {
        currentPlayingButton = null;
        currentAudio = null;
        return;
    }

    buttonEl.classList.add('is-playing');
    currentPlayingButton = buttonEl;

    const playFromAudioObject = (audioObj) => {
        currentAudio = audioObj;
        currentAudio.currentTime = 0;

        const onEnd = () => {
            buttonEl.classList.remove('is-playing');
            currentAudio.removeEventListener('ended', onEnd);
            if (currentPlayingButton === buttonEl) {
                currentPlayingButton = null;
                currentAudio = null;
            }
        };
        currentAudio.addEventListener('ended', onEnd);
        
        const playPromise = currentAudio.play();
        if (playPromise !== undefined) {
            playPromise.catch(error => {
                console.error("Audio play failed:", error);
                showAlert(`오디오 재생에 실패했습니다: ${error.message}`);
                onEnd();
            });
        }
    };

    if (audioCache[text]) {
        playFromAudioObject(audioCache[text]);
        return;
    }

    try {
        const response = await fetch('/api/gemini', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'tts', text: text })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API call failed: ${response.status} - ${errorText}`);
        }
        const result = await response.json();
        
        const audioContent = result?.candidates?.[0]?.content?.parts?.[0];
        const audioData = audioContent?.inlineData?.data;
        const mimeType = audioContent?.inlineData?.mimeType;

        if (audioData && mimeType) {
            const sampleRateMatch = mimeType.match(/rate=(\d+)/);
            const sampleRate = sampleRateMatch ? parseInt(sampleRateMatch[1], 10) : 24000;
            
            const pcmData = base64ToArrayBuffer(audioData);
            const wavBlob = pcmToWav(new DataView(pcmData), sampleRate);
            const audioUrl = URL.createObjectURL(wavBlob);
            const newAudio = new Audio(audioUrl);
            
            newAudio.onerror = function() {
                console.error("Audio format error.");
                showAlert("오디오 파일 형식 오류가 발생했습니다.");
                buttonEl.classList.remove('is-playing');
                if (currentPlayingButton === buttonEl) {
                   currentPlayingButton = null;
                }
            };

            audioCache[text] = newAudio;
            playFromAudioObject(newAudio);

        } else {
            throw new Error("API 응답에 오디오 데이터가 없습니다.");
        }
    } catch (error) {
        console.error("TTS Error:", error);
        showAlert(`음성 생성 중 오류가 발생했습니다: ${error.message}`);
        buttonEl.classList.remove('is-playing');
        currentPlayingButton = null;
    }
}

// --- 번역 API 함수 ---

async function getNativeTranslation(text) {
    const systemPrompt = `You are an expert in Korean-English translation. Your role is to translate the user's Korean sentence into a natural, colloquial English sentence that a native speaker would use in everyday conversation. Your response must be in Korean and follow this structure exactly:
### 자연스러운 표현
[Provide the most natural English sentence here]
#### 💡 이렇게 표현하는 이유
[Provide a brief and clear explanation in Korean about why this expression is natural and used by native speakers. Do not include pinyin.]`;

    try {
        const response = await fetch('/api/gemini', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'translate',
                text: text,
                systemPrompt: systemPrompt
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error("API Error:", errorText);
            throw new Error(`API call failed: ${response.status} - ${errorText}`);
        }

        const result = await response.json();
        
        if (!result.candidates || result.candidates.length === 0 || !result.candidates[0].content?.parts?.[0]?.text) {
             console.error("Invalid API response structure:", result);
             throw new Error("API 응답이 비어있거나 형식이 올바르지 않습니다.");
        }
        return result.candidates[0].content.parts[0].text;
    } catch(error) {
         console.error("Translation function error:", error);
         throw error;
    }
}


// --- 채팅 API 함수 ---

async function handleChatSubmit() {
    // chatInput, chatHistory, sendChatBtn, stopChatBtn, chatAbortController 변수는 main.js에 정의됨
    const text = chatInput.value.trim();
    if (!text) return;

    chatAbortController = new AbortController();

    addChatMessage('user', text); // ui.js
    chatHistory.push({ role: 'user', parts: [{ text: text }] });
    chatInput.value = '';

    sendChatBtn.disabled = true;
    stopChatBtn.classList.remove('hidden');
    showTypingIndicator(true); // ui.js

    const modelMessageDiv = addChatMessage('model', ''); // ui.js
    const modelTextP = modelMessageDiv.querySelector('.english-text');
    modelTextP.textContent = ''; 

    const systemPrompt = "You are a friendly and encouraging English tutor. Your primary role is to help the user practice their English conversation skills. Keep your responses concise, friendly, and always respond in English. If the user asks a question in Korean, gently remind them to ask in English or provide the English translation and answer that.";
    
    let accumulatedText = "";
    let streamBuffer = ""; 

    try {
        const response = await fetch('/api/gemini', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'chat',
                text: text,
                systemPrompt: systemPrompt,
                conversationHistory: chatHistory
            }),
            signal: chatAbortController.signal,
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API 오류: ${response.status} ${errorText}`);
        }
        
        showTypingIndicator(false); // ui.js

        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');

        while (true) {
            const { done, value } = await reader.read();
            if (done) {
                break;
            }

            streamBuffer += decoder.decode(value, { stream: true });
            
            const parts = streamBuffer.split('\n\n');
            
            for (let i = 0; i < parts.length - 1; i++) {
                const chunk = parts[i];
                if (chunk.startsWith('data: ')) {
                    try {
                        const jsonStr = chunk.substring(6); 
                        const data = JSON.parse(jsonStr);
                        const textChunk = data.candidates[0].content.parts[0].text;
                        accumulatedText += textChunk;
                        modelTextP.textContent = accumulatedText.replace(/[*#]/g, '');
                        chatMessages.scrollTop = chatMessages.scrollHeight; // main.js
                    } catch (e) {
                        console.warn("스트림 청크 파싱 오류:", e, chunk);
                    }
                }
            }
            streamBuffer = parts[parts.length - 1]; 
        }

        chatHistory.push({ role: 'model', parts: [{ text: accumulatedText }] });
        
        const ttsButton = modelMessageDiv.querySelector('.tts-btn');
        if (ttsButton) {
            ttsButton.style.display = 'block'; 
        }

    } catch (error) {
        showTypingIndicator(false); // ui.js
        if (error.name === 'AbortError') {
            modelTextP.textContent += "\n(응답이 중지되었습니다.)";
            chatHistory.push({ role: 'model', parts: [{ text: accumulatedText + "\n(응답이 중지되었습니다.)" }] });
        } else {
            console.error('채팅 스트림 오류:', error);
            modelTextP.textContent = `오류가 발생했습니다: ${error.message}`;
        }
    } finally {
        sendChatBtn.disabled = false;
        stopChatBtn.classList.add('hidden');
        chatAbortController = null;
        chatMessages.scrollTop = chatMessages.scrollHeight; // main.js
    }
}