<?php
/**
 * AI 代理接口 - 处理前端请求，验证频率限制，转发到 AI 供应商
 */

header('Content-Type: application/json');

// 1. 加载配置
$config = require_once 'config.php';

// 处理跨域
if ($config['allow_origin']) {
    header('Access-Control-Allow-Origin: ' . $config['allow_origin']);
    header('Access-Control-Allow-Methods: POST, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Authorization');
}

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit;
}

// 2. 初始化数据库 (SQLite)
try {
    $db = new PDO('sqlite:usage.db');
    $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $db->exec("CREATE TABLE IF NOT EXISTS usage_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ip TEXT,
        date TEXT,
        count INTEGER,
        UNIQUE(ip, date)
    )");
    $db->exec("CREATE TABLE IF NOT EXISTS global_stats (
        date TEXT PRIMARY KEY,
        count INTEGER
    )");
} catch (Exception $e) {
    die(json_encode(['error' => 'Database initialization failed: ' . $e->getMessage()]));
}

// 3. 获取请求参数
$input = json_decode(file_get_contents('php://input'), true);
$provider = $input['provider'] ?? 'gemini';
$prompt = $input['prompt'] ?? '';
$options = $input['options'] ?? [];

if (empty($prompt)) {
    die(json_encode(['error' => 'Prompt is required']));
}

// 4. 频率限制检查
$ip = $_SERVER['REMOTE_ADDR'];
$today = date('Y-m-d');

// 检查全球总量
$stmt = $db->prepare("SELECT count FROM global_stats WHERE date = ?");
$stmt->execute([$today]);
$globalCount = $stmt->fetchColumn() ?: 0;

if ($config['daily_global_limit'] > 0 && $globalCount >= $config['daily_global_limit']) {
    die(json_encode(['error' => '今日全站 AI 调用额度已用完，请明天再试，或使用自己的 API Key。']));
}

// 检查单设备总量
$stmt = $db->prepare("SELECT count FROM usage_logs WHERE ip = ? AND date = ?");
$stmt->execute([$ip, $today]);
$deviceCount = $stmt->fetchColumn() ?: 0;

if ($config['daily_per_device_limit'] > 0 && $deviceCount >= $config['daily_per_device_limit']) {
    die(json_encode(['error' => '您今日的免费调用次数已达上限，请明天再试，或在设置中使用自己的 API Key。']));
}

// 5. 转发请求到 AI 供应商
$responseContent = '';
$reasoning = null;

try {
    if ($provider === 'deepseek') {
        $apiKey = $config['deepseek_api_key'];
        if (empty($apiKey)) throw new Exception('Admin DeepSeek API key not configured');
        
        $model = $options['thinkingMode'] ? 'deepseek-reasoner' : 'deepseek-chat';
        $ch = curl_init('https://api.deepseek.com/chat/completions');
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode([
            'model' => $model,
            'messages' => [['role' => 'user', 'content' => $prompt]],
            'stream' => false
        ]));
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Content-Type: application/json',
            'Authorization: Bearer ' . $apiKey
        ]);
        
        $result = curl_exec($ch);
        if (curl_errno($ch)) throw new Exception(curl_error($ch));
        curl_close($ch);
        
        $data = json_decode($result, true);
        if (isset($data['error'])) throw new Exception($data['error']['message'] ?? 'DeepSeek API error');
        
        $responseContent = $data['choices'][0]['message']['content'] ?? '';
        $reasoning = $data['choices'][0]['message']['reasoning_content'] ?? null;
        
    } else {
        // Gemini
        $apiKey = $config['gemini_api_key'];
        if (empty($apiKey)) throw new Exception('Admin Gemini API key not configured');
        
        // Gemini API 使用不同的 URL 结构
        $url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=" . $apiKey;
        
        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode([
            'contents' => [['parts' => [['text' => $prompt]]]]
        ]));
        curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
        
        $result = curl_exec($ch);
        if (curl_errno($ch)) throw new Exception(curl_error($ch));
        curl_close($ch);
        
        $data = json_decode($result, true);
        if (isset($data['error'])) throw new Exception($data['error']['message'] ?? 'Gemini API error');
        
        $responseContent = $data['candidates'][0]['content']['parts'][0]['text'] ?? '';
    }

    // 6. 更新使用统计
    $db->beginTransaction();
    // 更新个人
    $stmt = $db->prepare("INSERT INTO usage_logs (ip, date, count) VALUES (?, ?, 1) ON CONFLICT(ip, date) DO UPDATE SET count = count + 1");
    $stmt->execute([$ip, $today]);
    // 更新全局
    $stmt = $db->prepare("INSERT INTO global_stats (date, count) VALUES (?, 1) ON CONFLICT(date) DO UPDATE SET count = count + 1");
    $stmt->execute([$today]);
    $db->commit();

    echo json_encode([
        'content' => $responseContent,
        'reasoning' => $reasoning
    ]);

} catch (Exception $e) {
    if ($db->inTransaction()) $db->rollBack();
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
