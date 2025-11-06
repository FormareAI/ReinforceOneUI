/**
 * 应用配置
 * 支持通过环境变量配置不同环境的 API 地址
 */

/**
 * 获取 AI API 基础 URL
 * 优先级：
 * 1. VITE_AI_API_BASE_URL（如果设置且不为空字符串）- 注意：远程 API 可能没有 system_prompt
 * 2. VITE_API_BASE_URL（如果设置且不为空字符串）
 * 3. 默认使用本地 Vite 中间件 '/api'（推荐，包含 system_prompt）
 * 
 * 注意：如果使用远程 API，确保远程 API 也包含相同的 system_prompt，
 * 否则编辑方案可能不包含 ////...existing code...//// 占位符
 */
export function getAIApiBaseUrl(): string {
  // 优先使用专门的 AI API URL（但检查是否为空字符串或只是空白）
  const aiApiUrl = import.meta.env.VITE_AI_API_BASE_URL;
  if (aiApiUrl && aiApiUrl.trim() !== '') {
    const url = aiApiUrl.trim();
    console.log('[config] Using VITE_AI_API_BASE_URL:', url);
    console.warn('[config] ⚠️ 使用外部 API，请确保外部接口支持接收 systemPrompt 参数');
    console.warn('[config] ⚠️ 否则编辑方案可能不包含 ////...existing code...//// 占位符');
    return url.endsWith('/') ? url.slice(0, -1) : url;
  }
  
  // 其次使用通用 API URL
  const apiUrl = import.meta.env.VITE_API_BASE_URL;
  if (apiUrl && apiUrl.trim() !== '') {
    const url = apiUrl.trim();
    console.log('[config] Using VITE_API_BASE_URL:', url);
    console.warn('[config] ⚠️ 使用外部 API，请确保外部接口支持接收 systemPrompt 参数');
    return url.endsWith('/') ? url.slice(0, -1) : url;
  }
  
  // 默认：使用本地 Vite 中间件（包含 system_prompt）
  console.log('[config] Using default local Vite middleware: /api');
  console.log('[config] ✅ 本地接口已包含 system_prompt，会生成 ////...existing code...//// 占位符');
  return '/api';
}

/**
 * 获取完整的 AI API 端点 URL
 * @param endpoint API 端点路径，如 '/ai/generate-edit'
 * @returns 完整的 API URL
 */
export function getAIApiUrl(endpoint: string): string {
  const baseUrl = getAIApiBaseUrl();
  // 规范化 endpoint：确保以 / 开头
  const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  
  // 如果 baseUrl 是完整的 URL（包含 http:// 或 https://），直接拼接
  if (baseUrl.startsWith('http://') || baseUrl.startsWith('https://')) {
    return `${baseUrl}${normalizedEndpoint}`;
  }
  
  // 如果是相对路径（如 /api），直接拼接
  return `${baseUrl}${normalizedEndpoint}`;
}

