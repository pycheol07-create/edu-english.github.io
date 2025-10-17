// Vercel 서버에서 실행되는 코드입니다.
// 이 파일은 절대 사용자에게 노출되지 않습니다.

export default async function handler(request, response) {
  // 1. Vercel에 저장된 환경 변수에서 API 키를 안전하게 가져옵니다.
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return response.status(500).json({ error: 'API 키가 설정되지 않았습니다.' });
  }

  // 2. 프런트엔드에서 보낸 요청 데이터를 받습니다.
  const { action, text, systemPrompt } = request.body;

  try {
    let apiUrl;
    let apiRequestBody;

    // 3. '번역' 요청일 경우 Gemini Pro 모델을 호출합니다.
    if (action === 'translate') {
      apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`;
      apiRequestBody = {
        contents: [{ parts: [{ text: text }] }],
        systemInstruction: {
            parts: [{ text: systemPrompt }]
        },
      };
    } 
    // 4. '음성 생성(tts)' 요청일 경우 Gemini TTS 모델을 호출합니다.
    else if (action === 'tts') {
      apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-preview-tts:generateContent?key=${apiKey}`;
      
      // ✨ 'Puck' 음성 모델을 사용하도록 요청 본문을 수정했습니다. ✨
      apiRequestBody = {
        model: "gemini-1.5-flash-preview-tts",
        contents: [{
            parts: [{ text: text }]
        }],
        generationConfig: {
            responseModalities: ["AUDIO"],
            speechConfig: {
                voiceConfig: {
                    // 'Puck'이라는 이름의 자연스러운 미국식 영어 음성 모델을 사용하도록 지정
                    prebuiltVoiceConfig: { voiceName: "Puck" }
                }
            }
        },
      };
    } 
    // 그 외의 요청은 오류 처리
    else {
      return response.status(400).json({ error: '잘못된 요청(action)입니다.' });
    }

    // 5. 설정된 주소와 요청 본문으로 Google API에 실제 요청을 보냅니다.
    const apiResponse = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(apiRequestBody),
    });

    if (!apiResponse.ok) {
      // Google API에서 오류가 발생한 경우, 그 내용을 프런트엔드로 전달합니다.
      const errorText = await apiResponse.text();
      console.error('Google API Error:', errorText);
      throw new Error(`Google API 오류: ${errorText}`);
    }

    const data = await apiResponse.json();
    
    // 6. 성공적인 응답을 프런트엔드로 다시 보내줍니다.
    return response.status(200).json(data);

  } catch (error) {
    console.error('서버 함수 오류:', error);
    return response.status(500).json({ error: error.message });
  }
}

