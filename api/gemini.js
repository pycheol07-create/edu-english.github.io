// Vercel 서버에서 실행되는 코드입니다.
// 이 파일은 절대 사용자에게 노출되지 않습니다.

export default async function handler(request, response) {
  // 1. Vercel에 저장된 환경 변수에서 API 키를 안전하게 가져옵니다.
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return response.status(500).json({ error: 'API 키가 설정되지 않았습니다.' });
  }

  // 2. 프런트엔드에서 보낸 요청 데이터를 받습니다.
  const { action, text, systemPrompt, history } = request.body;

  try {
    let apiUrl;
    let apiRequestBody;
    let modelShortName = 'gemini-1.0-pro'; // 기본 모델 설정

    // TTS가 아닌 경우 (번역, 채팅, 답변 추천) 모델 동적 선택 필요
    if (action !== 'tts') {
        const listModelsRes = await fetch(
            `https://generativelanguage.googleapis.com/v1/models?key=${apiKey}`
        );
        if (!listModelsRes.ok) {
            const errData = await listModelsRes.json();
            throw new Error(`Google API (ListModels) 오류: ${JSON.stringify(errData)}`);
        }
        const modelData = await listModelsRes.json();
        const availableModels = modelData.models || [];

        const chosenModel =
            availableModels.find(m => m.name.includes('flash') && m.supportedGenerationMethods.includes('generateContent')) ||
            availableModels.find(m => m.name.includes('gemini-1.0-pro') && m.supportedGenerationMethods.includes('generateContent')) ||
            availableModels.find(m => m.name.includes('gemini-pro') && m.supportedGenerationMethods.includes('generateContent'));

        if (!chosenModel) {
            console.warn('API 키로 접근 가능한 (flash 또는 pro) 모델을 찾지 못해 기본 모델(gemini-1.0-pro)을 사용합니다.');
        } else {
             modelShortName = chosenModel.name.split('/').pop();
             console.log("Using model:", modelShortName); // 어떤 모델 쓰는지 로그 출력
        }

        apiUrl = `https://generativelanguage.googleapis.com/v1/models/${modelShortName}:generateContent?key=${apiKey}`;
    }

    // 3. 액션별 요청 본문 설정
    if (action === 'translate') {
        // 영어 번역용 시스템 프롬프트 (JSON 응답 요구)
        const englishSystemPrompt = systemPrompt || `You are a professional Korean-to-English translator and language teacher. Translate the following Korean sentence into natural, native-sounding English. Provide: 1. The main English translation. 2. (Optional) 1-2 alternative natural expressions if applicable. 3. A concise explanation (in Korean) of why this expression is natural, what the key vocabulary or grammar point is. Format your response as a single, valid JSON object with keys "english", "alternatives" (string array), and "explanation" (string, in Korean). Do not include markdown backticks.`;
        apiRequestBody = {
            contents: [{ parts: [{ text: `${englishSystemPrompt}\n\nKorean: "${text}"` }] }]
        };
    } else if (action === 'chat') {
        // 영어 채팅용 시스템 프롬프트 (JSON 응답 요구)
        const chatSystemPrompt = `You are a friendly and encouraging native English speaker named "Ling". Your goal is to have a natural, casual conversation with a user who is learning English.
- Keep your responses concise (1-2 short sentences).
- Ask questions to keep the conversation going.
- If the user makes a small grammar mistake, gently correct it by using the correct form in your response.
- Your entire response MUST be a single, valid JSON object and nothing else. Do not use markdown backticks.
- The JSON object must have these exact keys: "english", "korean".
- "english": Your response in English.
- "korean": A natural Korean translation of your English response.`;

        const contents = [
            { role: "user", parts: [{ text: "Please follow these instructions for all future responses: " + chatSystemPrompt }] },
            { role: "model", parts: [{ text: `Okay, I understand. I will act as Ling and respond in the required { "english", "korean" } JSON format.` }] },
            ...history,
            { role: "user", parts: [{ text: text }] }
        ];
        apiRequestBody = { contents };
    }
    else if (action === 'suggest_reply') {
        // 영어 답변 추천용 시스템 프롬프트 (JSON 응답 요구)
        const suggestSystemPrompt = `Based on the previous conversation history, suggest 1 or 2 simple and natural next replies in English for the user who is learning English. The user just received the last message from the AI model.
- Provide only the suggested replies with their Korean meaning.
- Your entire response MUST be a single, valid JSON object containing a key "suggestions" which is an array of objects.
- Each object in the "suggestions" array must have three keys: "english" (string) and "korean" (string, the Korean meaning).
- Example: {"suggestions": [{"english": "Hello!", "korean": "안녕하세요!"}, {"english": "Thank you.", "korean": "고마워요."}]}
- Do not include any other text or markdown backticks.`;

         const contents = [
            { role: "user", parts: [{ text: suggestSystemPrompt }] },
            { role: "model", parts: [{ text: "Okay, I will provide reply suggestions including Korean meaning in the specified JSON format." }] },
            ...history
        ];
        apiRequestBody = { contents };
    }
    else if (action === 'tts') {
        // 영어 TTS 설정 (MP3)
        apiUrl = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`;
        apiRequestBody = {
            input: { text: text },
            voice: { languageCode: 'en-US', name: 'en-US-Wavenet-F' },
            audioConfig: { audioEncoding: 'MP3' }
        };
    } else {
        return response.status(400).json({ error: '잘못된 요청(action)입니다.' });
    }

    // 4. Google API에 실제 요청 전송
    const apiResponse = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(apiRequestBody),
    });

    const data = await apiResponse.json();

    if (!apiResponse.ok) {
        console.error('Google API Error:', data);
        const errorDetails = data.error ? data.error.message : JSON.stringify(data);
        throw new Error(`Google API 오류: ${errorDetails}`);
    }

    // TTS 응답 처리
    if (action === 'tts') {
        return response.status(200).json(data);
    }

    // 번역, 채팅, 답변 추천 응답 처리 (v1 응답 구조 확인)
    if (!data.candidates || data.candidates.length === 0 || !data.candidates[0].content || !data.candidates[0].content.parts || data.candidates[0].content.parts.length === 0) {
        console.error("Invalid response structure from Google API:", data);
         if (data.promptFeedback && data.promptFeedback.blockReason) {
             throw new Error(`AI 응답 생성 실패 (안전 필터): ${data.promptFeedback.blockReason}`);
        } else if (data.candidates && data.candidates.length > 0 && data.candidates[0].finishReason && data.candidates[0].finishReason !== 'STOP') {
             throw new Error(`AI 응답 생성 중단됨: ${data.candidates[0].finishReason}`);
        } else if (data.candidates && data.candidates.length === 0) {
             throw new Error(`AI 응답 생성 실패: Candidates 배열이 비어있습니다.`);
        }
        throw new Error("AI로부터 유효한 응답 구조를 받지 못했습니다. (candidates 확인 실패)");
    }

     if (action === 'suggest_reply') {
        let suggestionData = null;
        let foundSuggestions = false;
        for (const part of data.candidates[0].content.parts) {
            try {
                const cleanedText = part.text.trim();
                const jsonText = cleanedText.replace(/^```json\s*|\s*```$/g, '');
                const parsedPart = JSON.parse(jsonText);

                // 영어 버전에 맞게 'english'와 'korean' 키 확인
                if (parsedPart.suggestions && Array.isArray(parsedPart.suggestions) &&
                    parsedPart.suggestions.every(item => 
                        typeof item === 'object' &&
                        item.hasOwnProperty('english') &&
                        item.hasOwnProperty('korean')
                    ))
                {
                    suggestionData = parsedPart;
                    foundSuggestions = true;
                    break; 
                } else if (parsedPart.suggestions && Array.isArray(parsedPart.suggestions) && parsedPart.suggestions.length === 0) {
                    suggestionData = parsedPart;
                    foundSuggestions = true;
                    break;
                }
            } catch (e) {
                console.warn("Ignoring non-JSON or invalid JSON part in suggest_reply:", part.text);
            }
        }

        if (foundSuggestions && suggestionData) {
            return response.status(200).json(suggestionData);
        } else {
            console.error("Could not find valid 'suggestions' JSON object array with required keys (english, korean) in any response parts:", JSON.stringify(data.candidates[0].content.parts, null, 2));
            throw new Error("AI로부터 유효한 답변 추천(뜻 포함) JSON 형식을 찾지 못했습니다."); 
        }
    }

    // 번역 및 채팅은 data 전체를 반환 (프론트엔드에서 파싱)
    return response.status(200).json(data);

  } catch (error) {
    console.error('서버 함수 오류:', error);
    return response.status(500).json({ error: error.message });
  }
}