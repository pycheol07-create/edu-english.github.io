// /api/gemini.js
// Google Gemini API 요청을 처리하는 서버리스 함수입니다.

export default async function handler(req, res) {
  // Vercel 환경변수에서 API 키를 가져옵니다.
  const apiKey = process.env.GEMINI_API_KEY;

  // API 키가 설정되지 않았을 경우, 명확한 오류 메시지를 반환합니다.
  if (!apiKey) {
    return res.status(500).json({
      error: "API 키가 서버에 설정되지 않았습니다. Vercel 환경변수를 확인해주세요."
    });
  }

  // POST 요청이 아닐 경우, 에러를 반환합니다.
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  try {
    const { action, text, systemPrompt } = req.body;
    let model = 'gemini-1.5-flash-latest';
    let payload;

    // 요청 유형(action)에 따라 모델과 payload를 설정합니다.
    if (action === 'tts') {
        model = 'textembedding-gecko'; // Note: This should be a valid TTS model, using a placeholder for now. For actual TTS, model name would be different.
        payload = {
            model: "gemini-1.5-flash-preview-tts",
            contents: [{
                parts: [{ text: `TTS the following sentence in a standard, clear voice: ${text}` }]
            }],
            generationConfig: {
                responseModalities: ["AUDIO"],
            },
        };
        model = 'gemini-1.5-flash-preview-tts';
    } else if (action === 'translate') {
        payload = {
            contents: [{ parts: [{ text: text }] }],
            systemInstruction: {
                parts: [{ text: systemPrompt }]
            },
        };
    } else {
      return res.status(400).json({ error: "Invalid action specified." });
    }

    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    // Google API 서버에 요청을 보냅니다.
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    // API 응답이 성공적이지 않을 경우, 에러를 처리합니다.
    if (!response.ok) {
      const errorBody = await response.text();
      console.error('Google API Error:', errorBody);
      return res.status(response.status).json({
        error: `Google API 호출에 실패했습니다: ${errorBody}`
      });
    }

    const data = await response.json();
    res.status(200).json(data);

  } catch (error) {
    console.error('Server-side error:', error);
    res.status(500).json({
      error: `서버 내부 오류가 발생했습니다: ${error.message}`
    });
  }
}

