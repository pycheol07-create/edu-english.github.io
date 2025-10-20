// Vercel 서버에서 실행되는 코드입니다.
// 이 파일은 절대 사용자에게 노출되지 않습니다.

export default async function handler(request, response) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return response.status(500).json({ error: 'API 키가 설정되지 않았습니다.' });
  }

  // --- 스트리밍 요청을 위한 AbortController ---
  const controller = new AbortController();
  request.on('close', () => {
    controller.abort();
  });

  const { action, text, systemPrompt, conversationHistory } = request.body;

  try {
    // 모델 목록 가져오기
    const listRes = await fetch(
      `https://generativelanguage.googleapis.com/v1/models?key=${apiKey}`,
      { method: 'GET', signal: controller.signal }
    );
    if (!listRes.ok) {
      const err = await listRes.json();
      throw new Error(`ListModels 오류: ${JSON.stringify(err)}`);
    }
    const modelListData = await listRes.json();
    const models = modelListData.models || [];
    if (models.length === 0) {
      throw new Error('사용 가능한 모델이 없습니다.');
    }
    const chosen = models.find(m => m.name.includes('flash')) || models[0];
    const modelName = chosen.name; // 예: "models/gemini-2.5-flash"

    let apiUrl, apiRequestBody;

    // --- 'chat' 액션 (스트리밍) ---
    if (action === 'chat') {
      apiUrl = `https://generativelanguage.googleapis.com/v1/${modelName}:streamGenerateContent?key=${apiKey}`;
      
      const systemInstruction = {
        role: "user",
        parts: [{ text: systemPrompt }]
      };
      
      const history = (conversationHistory || []).map(msg => ({
        role: msg.role,
        parts: [{ text: msg.parts[0].text }]
      }));
      
      const newMessage = {
        role: "user",
        parts: [{ text: text }]
      };

      apiRequestBody = {
        // 시스템 프롬프트 + 이전 대화 + 새 메시지
        contents: [systemInstruction, ...history, newMessage],
      };

      // Vercel 환경에서 스트리밍 응답 설정
      response.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      });

      const apiResponse = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(apiRequestBody),
        signal: controller.signal,
      });

      if (!apiResponse.ok) {
        const err = await apiResponse.json();
        console.error('Google API Error (Stream):', err);
        throw new Error(`Google API 오류: ${JSON.stringify(err)}`);
      }

      // Google API의 스트림을 Vercel 응답으로 파이핑
      const reader = apiResponse.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }
        // 받은 청크(chunk)를 그대로 클라이언트에 전송
        response.write(decoder.decode(value));
      }
      response.end(); // 스트림 종료

    } else if (action === 'translate') {
      // 'translate' 로직
      apiUrl = `https://generativelanguage.googleapis.com/v1/${modelName}:generateContent?key=${apiKey}`;
      apiRequestBody = {
        contents: [
          {
            parts: [
              { text: `${systemPrompt}\n\n${text}` }
            ]
          }
        ],
      };
      
      const apiResponse = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(apiRequestBody),
        signal: controller.signal,
      });
      if (!apiResponse.ok) {
        const err = await apiResponse.json();
        console.error('Google API Error:', err);
        throw new Error(`Google API 오류: ${JSON.stringify(err)}`);
      }
      const data = await apiResponse.json();
      return response.status(200).json(data);

    } else if (action === 'tts') {
      // 'tts' 로직 (en-US로 수정됨)
      apiUrl = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`;
      apiRequestBody = {
        input: { text },
        voice: {
          languageCode: 'en-US',
          name: 'en-US-Wavenet-F', // 미국 영어 여성 음성
          ssmlGender: 'FEMALE'
        },
        audioConfig: {
          audioEncoding: 'LINEAR16',
          sampleRateHertz: 24000
        }
      };

      const apiResponse = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(apiRequestBody),
        signal: controller.signal,
      });
      if (!apiResponse.ok) {
        const err = await apiResponse.json();
        console.error('Google API Error:', err);
        throw new Error(`Google API 오류: ${JSON.stringify(err)}`);
      }
      const data = await apiResponse.json();

      return response.status(200).json({
        candidates: [{
          content: {
            parts: [{
              inlineData: {
                mimeType: 'audio/wav; rate=24000',
                data: data.audioContent
              }
            }]
          }
        }]
      });

    } else {
      return response.status(400).json({ error: '잘못된 요청(action)입니다.' });
    }

  } catch (error) {
    if (error.name === 'AbortError') {
      console.log('요청이 클라이언트에 의해 중단되었습니다.');
      response.end();
    } else {
      console.error('서버 함수 오류:', error);
      // 스트림이 시작되기 전이라면 json 오류를 보낼 수 있음
      if (!response.headersSent) {
        return response.status(500).json({ error: error.message });
      } else {
        // 스트림이 시작되었다면 오류 메시지를 스트림에 쓰고 종료
        response.write(`\n\n[오류 발생: ${error.message}]\n\n`);
        response.end();
      }
    }
  }
}