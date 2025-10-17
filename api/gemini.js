// /api/gemini.js

// Vercel 환경에서는 기본적으로 fetch를 지원합니다.
// 이 함수는 Vercel의 서버리스 함수로 동작하며,
// 클라이언트(HTML)에서 오는 모든 API 요청을 중계합니다.

export default async function handler(req, res) {
  // POST 요청만 허용합니다.
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  try {
    // 클라이언트로부터 전달받은 요청 본문을 파싱합니다.
    const { action, text, systemPrompt } = req.body;

    // Gemini API 키를 Vercel 환경 변수에서 안전하게 가져옵니다.
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      // API 키가 없는 경우, Vercel 환경변수 설정을 확인하라는 명확한 메시지를 반환합니다.
      console.error("GEMINI_API_KEY not found in environment variables.");
      return res.status(500).json({ error: "서버에 Gemini API 키가 설정되지 않았습니다. Vercel 프로젝트의 'Settings > Environment Variables'에서 GEMINI_API_KEY를 올바르게 설정했는지 확인해주세요." });
    }

    let apiUrl = '';
    let payload = {};

    // 클라이언트에서 요청한 'action'에 따라 API URL과 payload를 설정합니다.
    if (action === 'translate') {
      apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;
      payload = {
        contents: [{ parts: [{ text: text }] }],
        systemInstruction: {
          parts: [{ text: systemPrompt }]
        },
      };
    } else if (action === 'tts') {
      apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${apiKey}`;
      payload = {
        model: "gemini-2.5-flash-preview-tts",
        contents: [{
            parts: [{ text: text }]
        }],
        generationConfig: {
            responseModalities: ["AUDIO"],
            speechConfig: {
                voiceConfig: {
                    prebuiltVoiceConfig: { voiceName: "Puck" }
                }
            }
        },
      };
    } else {
      // 정의되지 않은 action일 경우 에러 처리
      return res.status(400).json({ error: '알 수 없는 요청입니다.' });
    }

    // 설정된 정보로 Google Gemini API에 요청을 보냅니다.
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    // Google API로부터 받은 응답이 정상이 아닐 경우 에러 처리
    if (!response.ok) {
      const errorBody = await response.text();
      console.error('Google API Error:', errorBody);
      return res.status(response.status).json({ error: `Google API 요청 실패: ${errorBody}` });
    }

    // Google API로부터 받은 JSON 응답을 그대로 클라이언트에 전달합니다.
    const data = await response.json();
    return res.status(200).json(data);

  } catch (error) {
    // 서버 내부 오류 처리
    console.error('Server-side error:', error);
    return res.status(500).json({ error: `서버 내부 오류가 발생했습니다: ${error.message}` });
  }
}

