<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Vercel 서버 기능 테스트</title>
    <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gray-100 flex items-center justify-center h-screen">

    <div class="text-center bg-white p-8 rounded-lg shadow-lg">
        <h1 class="text-2xl font-bold mb-4">Vercel 서버 기능 진단 테스트</h1>
        <p class="text-gray-600 mb-6">아래 버튼을 클릭한 후, Vercel 대시보드의 'Logs' 탭을 확인하세요.</p>
        <button id="test-btn" class="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-6 rounded-lg transition-colors">
            서버 함수 호출 테스트
        </button>
        <div id="result" class="mt-4 font-mono text-sm"></div>
    </div>

    <script>
        const testBtn = document.getElementById('test-btn');
        const resultDiv = document.getElementById('result');

        testBtn.addEventListener('click', async () => {
            resultDiv.textContent = '서버에 요청을 보내는 중...';
            try {
                // '/api/ping' 경로로 POST 요청을 보냅니다.
                const response = await fetch('/api/ping', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    }
                });

                const data = await response.json();

                if (response.ok) {
                    resultDiv.textContent = `✅ 서버 응답 성공: ${JSON.stringify(data)}`;
                    resultDiv.classList.add('text-green-600');
                    resultDiv.classList.remove('text-red-600');
                } else {
                    throw new Error(data.error || '알 수 없는 오류');
                }
            } catch (error) {
                resultDiv.textContent = `❌ 서버 응답 실패: ${error.message}`;
                resultDiv.classList.add('text-red-600');
                resultDiv.classList.remove('text-green-600');
            }
        });
    </script>

</body>
</html>
