<?php
/**
 * 配置文件 - 用于存储管理员 API 密钥和流量限制设置
 */

return [
    // --- AI API 设置 ---
    // Gemini API 密钥
    'gemini_api_key' => '', 
    // DeepSeek API 密钥
    'deepseek_api_key' => '',
    
    // --- 流量限制设置 ---
    // 全站每日最大调用次数 (0 为不限制)
    'daily_global_limit' => 500,
    // 每台设备（按 IP）每日最大调用次数 (0 为不限制)
    'daily_per_device_limit' => 20,
    
    // --- 安全设置 ---
    // 允许的跨域域名 (BT 面板部署后请设置为你的域名，或保持 * 允许所有)
    'allow_origin' => '*',
];
