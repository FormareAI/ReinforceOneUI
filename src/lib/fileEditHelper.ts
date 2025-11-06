/**
 * 文件编辑辅助工具
 * 
 * 工作流程：
 * 1. read_file: 读取目标文件的原始内容
 * 2. generate_file: 将原始内容和修改需求发送给智能模型，生成编辑方案（未修改部分用 ////...existing code...//// 代替）
 * 3. optimize_file: 将编辑方案中的占位符 ////...existing code...//// 替换为原始内容
 * 4. apply_file: 将优化后的完整内容覆盖保存到文件
 */

import { getAIApiUrl, getAIApiBaseUrl } from './config';

/**
 * 步骤1: 读取文件内容
 * @param filePath 文件路径（如 workspace/reports/report_1.md）
 * @returns 文件内容的 Promise
 */
export async function read_file(filePath: string): Promise<string> {
  try {
    console.log('[read_file] filePath:', filePath);
    
    // 如果是 workspace 文件，直接使用文件路径（不带 /api/ 前缀）
    // workspace/reports/report_1.md -> /workspace/reports/report_1.md
    if (filePath.startsWith('workspace/')) {
      // 直接使用 /workspace/ 路径，Vite 插件会处理并直接从文件系统读取
      const url = `/${filePath}`;
      
      console.log('[read_file] constructed URL:', url);
      
      // 添加时间戳参数以避免浏览器缓存（使用更精确的时间戳）
      const cacheBuster = `?t=${Date.now()}&_=${Math.random()}`;
      const urlWithCacheBuster = `${url}${cacheBuster}`;
      
      console.log('[read_file] URL with cache buster:', urlWithCacheBuster);
      console.log('[read_file] 时间戳:', Date.now());
      
      const fetchStartTime = Date.now();
      const res = await fetch(urlWithCacheBuster, {
        cache: 'no-store', // 禁用缓存
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'If-None-Match': '*' // 强制服务器返回最新内容
        }
      });
      const fetchEndTime = Date.now();
      console.log('[read_file] fetch 完成，耗时:', fetchEndTime - fetchStartTime, 'ms');
      console.log('[read_file] fetch response status:', res.status, res.statusText);
      
      if (!res.ok) {
        throw new Error(`读取文件失败: ${res.statusText}`);
      }
      
      const text = await res.text();
      console.log('[read_file] file content length:', text.length);
      return text;
    } else {
      // 对于其他文件，可能需要直接读取
      throw new Error(`不支持的文件路径格式: ${filePath}`);
    }
  } catch (error) {
    console.error('[read_file] error:', error);
    throw new Error(
      `读取文件失败: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * 生成新分析内容（不传 originalContent）
 * 用于新建分析场景，调用大模型生成新的量化分析内容
 * 
 * @param askText 用户询问的问题
 * @param systemPrompt 自定义系统提示词（可选）
 * @returns 生成的新内容
 */
export async function generate_new_analysis(
  askText: string,
  systemPrompt?: string
): Promise<string> {
  try {
    const apiUrl = getAIApiUrl('/ai/generate-edit');
    const baseUrl = getAIApiBaseUrl();
    const isRemoteAPI = baseUrl.startsWith('http://') || baseUrl.startsWith('https://');
    
    console.log('[generate_new_analysis] Calling API:', apiUrl);
    console.log('[generate_new_analysis] Is remote API:', isRemoteAPI);
    
    // 默认系统提示词
    const defaultSystemPrompt = '你是一个专业的量化分析师，请结合你的专业量化Quant知识，将用户的问题转化成为量化因子、策略及代码';
    const finalSystemPrompt = systemPrompt || defaultSystemPrompt;
    
    // 明确构建请求体，包含 originalContent 为空字符串（表示新建模式）
    const requestBody: {
      originalContent: string;
      editRequirements: string;
      model: string;
      systemPrompt: string;
    } = {
      originalContent: '', // 新建模式时显式传递空字符串
      editRequirements: askText,
      model: 'anthropic/claude-3.5-sonnet', // 使用 qwen-plus 模型
      systemPrompt: finalSystemPrompt,
    };
    
    // 验证请求体格式
    const requestBodyString = JSON.stringify(requestBody);
    
    console.log('[generate_new_analysis] 请求体检查:', {
      originalContent: requestBody.originalContent,
      originalContentLength: requestBody.originalContent.length,
      model: requestBody.model,
      systemPrompt: !!requestBody.systemPrompt,
      systemPromptPreview: requestBody.systemPrompt?.substring(0, 50),
      askText: askText.substring(0, 50),
      requestBodyKeys: Object.keys(requestBody),
      requestBodyString: requestBodyString.substring(0, 200)
    });
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'accept': 'application/json',
      },
      body: requestBodyString,
    });

    if (!response.ok) {
      throw new Error(`生成新分析失败: HTTP ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    
    // 检查响应格式：{ success, code, message, data: { output_text } }
    if (!result.success || result.code !== 20000) {
      throw new Error(result.message || '生成新分析失败');
    }

    if (!result.data || !result.data.output_text) {
      throw new Error('API 响应格式错误：缺少 output_text 字段');
    }

    const content = result.data.output_text;
    console.log('[generate_new_analysis] Received content length:', content.length);
    console.log('[generate_new_analysis] Content preview:', content.substring(0, 300));
    
    return content;
  } catch (error) {
    throw new Error(
      `生成新分析失败: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * 步骤2: 生成编辑方案
 * 将原始内容和修改需求发送给智能模型，生成修改后的方案
 * 未修改的部分用注释 ////...existing code...//// 代替，以减少上下文占用
 * 
 * @param originalContent 原始文件内容
 * @param editRequirements 修改需求描述
 * @returns 包含编辑方案的 Promise，未修改部分用注释 ////...existing code...//// 代替
 */
export async function generate_file(
  originalContent: string,
  editRequirements: string
): Promise<string> {
  try {
    const apiUrl = getAIApiUrl('/ai/generate-edit');
    const baseUrl = getAIApiBaseUrl();
    const isRemoteAPI = baseUrl.startsWith('http://') || baseUrl.startsWith('https://');
    
    console.log('[generate_file] Calling API:', apiUrl);
    console.log('[generate_file] Is remote API:', isRemoteAPI);
    console.log('[generate_file] Request payload size:', JSON.stringify({
      originalContent,
      editRequirements,
      model: 'anthropic/claude-3.5-sonnet',
    }).length);
    
    // 构建请求体，包含 system_prompt（与本地插件保持一致）
    const systemPrompt = '你是一个专业的内容编辑助手。当你收到原始文件内容和修改需求时，请生成修改后的内容方案。对于未修改的部分，必须使用注释 ////...existing code...//// 来代替，以减少上下文占用和输出内容。请确保只在真正未修改的内容部分使用该注释，需要修改的部分必须完整写出修改后的内容。';
    
    const requestBody: any = {
      originalContent,
      editRequirements,
      model: 'anthropic/claude-3.5-sonnet',
      systemPrompt: systemPrompt, // 传递 system_prompt 到外部接口
    };
    
    console.log('[generate_file] Request includes systemPrompt:', !!requestBody.systemPrompt);
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'accept': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      throw new Error(`生成编辑方案失败: HTTP ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    
    // 检查响应格式：{ success, code, message, data: { output_text } }
    if (!result.success || result.code !== 20000) {
      throw new Error(result.message || '生成编辑方案失败');
    }

    if (!result.data || !result.data.output_text) {
      throw new Error('API 响应格式错误：缺少 output_text 字段');
    }

    const editPlan = result.data.output_text;
    console.log('[generate_file] Received editPlan length:', editPlan.length);
    console.log('[generate_file] EditPlan preview:', editPlan.substring(0, 300));
    
    // 检查是否包含占位符 (格式: ////...existing code...////)
    const hasPlaceholder = /\/\/\/\/\.\.\.\s*existing\s+code\s*\.\.\.\s*\/\/\/\//gi.test(editPlan);
    console.log('[generate_file] Contains placeholder:', hasPlaceholder);
    
    if (!hasPlaceholder) {
      console.warn('[generate_file] WARNING: EditPlan does not contain placeholder! The API may not have system_prompt.');
    }
    
    return editPlan;
  } catch (error) {
    // 如果 API 不可用，返回错误信息
    throw new Error(
      `生成编辑方案失败: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * 步骤3: 优化编辑方案
 * 先读取文件，然后将大模型生成的编辑方案中的注释 ////...existing code...//// 替换为原始内容
 * 
 * @param editPlan 编辑方案（包含 ////...existing code...//// 注释占位符）
 * @param originalContent 原始文件内容
 * @returns 替换注释后的完整代码
 */
export function optimize_file(
  editPlan: string,
  originalContent: string
): string {
  console.log('[optimize_file] editPlan length:', editPlan.length);
  console.log('[optimize_file] originalContent length:', originalContent.length);
  console.log('[optimize_file] editPlan preview:', editPlan.substring(0, 200));
  
  // 查找编辑方案中的注释占位符（格式: ////...existing code...////）
  // 匹配模式: ////...existing code...//// (允许空格和换行符)
  const placeholderPattern = /\/\/\/\/\.\.\.\s*existing\s+code\s*\.\.\.\s*\/\/\/\//gi;
  
  let optimizedPlan = editPlan;
  let foundPlaceholder = false;
  
  // 检查是否包含占位符
  const matches = optimizedPlan.match(placeholderPattern);
  if (matches) {
    foundPlaceholder = true;
    console.log('[optimize_file] Found placeholder matches:', matches.length);
    console.log('[optimize_file] Placeholder preview:', matches[0]?.substring(0, 100));
    
    // 替换所有匹配的占位符为原始代码
    optimizedPlan = optimizedPlan.replace(placeholderPattern, originalContent);
    console.log('[optimize_file] Replaced placeholder, new length:', optimizedPlan.length);
  }
  
  if (!foundPlaceholder) {
    console.warn('[optimize_file] No placeholder found! The editPlan might already be complete.');
    console.warn('[optimize_file] This usually means the remote API does not include system_prompt.');
    console.warn('[optimize_file] Using editPlan as-is (assuming it\'s the complete modified content).');
    // 如果没有找到占位符，说明编辑方案可能已经是完整内容（远程 API 返回了完整的修改后内容）
    // 直接返回编辑方案作为最终内容
    // 注意：这种情况下，editPlan 应该已经包含了所有修改，不需要合并
  }
  
  console.log('[optimize_file] Final optimizedPlan length:', optimizedPlan.length);
  console.log('[optimize_file] Final optimizedPlan preview:', optimizedPlan.substring(0, 200));
  
  return optimizedPlan;
}

/**
 * 步骤4: 应用编辑方案
 * 最终以修改后的完整内容覆盖之前文件内容
 * 
 * @param filePath 文件路径（如 workspace/reports/report_1.md）
 * @param finalContent 最终要保存的内容（已优化的完整内容）
 * @returns 是否成功
 */
export async function apply_file(
  filePath: string,
  finalContent: string
): Promise<boolean> {
  try {
    console.log('[apply_file] filePath:', filePath);
    
    // 如果是 workspace 文件，直接使用文件路径（不带 /api/ 前缀）
    // workspace/reports/report_1.md -> /workspace/reports/report_1.md
    if (filePath.startsWith('workspace/')) {
      // 构建 URL：需要对路径的每一部分进行编码，但保留路径分隔符
      // 例如：workspace/reports/请给出日内模式的技术面逻辑.md
      // -> /workspace/reports/%E8%AF%B7%E7%BB%99%E5%87%BA%E6%97%A5%E5%86%85%E6%A8%A1%E5%BC%8F%E7%9A%84%E6%8A%80%E6%9C%AF%E9%9D%A2%E9%80%BB%E8%BE%91.md
      const pathParts = filePath.split('/');
      const encodedParts = pathParts.map((part, index) => {
        // 第一部分（workspace）不需要编码，其他部分需要编码
        if (index === 0) return part;
        return encodeURIComponent(part);
      });
      const encodedPath = encodedParts.join('/');
      const url = `/${encodedPath}`;
      
      console.log('[apply_file] filePath:', filePath);
      console.log('[apply_file] encoded URL:', url);
      console.log('[apply_file] content to save length:', finalContent.length);
      console.log('[apply_file] content to save preview:', finalContent.substring(0, 200));
      
      console.log('[apply_file] 准备发送 PUT 请求到:', url);
      console.log('[apply_file] 请求的完整 URL:', window.location.origin + url);
      console.log('[apply_file] 请求方法: PUT');
      console.log('[apply_file] 请求体长度:', finalContent.length);
      console.log('[apply_file] 请求体预览:', finalContent.substring(0, 100));
      
      const fetchStartTime = Date.now();
      
      try {
        console.log('[apply_file] 🔵 正在发送 fetch PUT 请求...');
        const res = await fetch(url, {
          method: 'PUT',
          headers: {
            'Content-Type': 'text/plain; charset=utf-8',
          },
          body: finalContent,
        });
        console.log('[apply_file] 🔵 fetch PUT 请求已发送，等待响应...');
      
        const fetchEndTime = Date.now();
        console.log('[apply_file] fetch 完成，耗时:', fetchEndTime - fetchStartTime, 'ms');
        console.log('[apply_file] fetch response status:', res.status, res.statusText);
        console.log('[apply_file] fetch response URL:', res.url);
        console.log('[apply_file] fetch response headers:', Object.fromEntries(res.headers.entries()));
      
        if (!res.ok) {
          const errorText = await res.text().catch(() => '');
          console.error('[apply_file] Error response:', errorText);
          throw new Error(`HTTP ${res.status}: ${errorText}`);
        }
        
        // 读取响应内容以确认保存成功
        let responseText = '';
        try {
          responseText = await res.text();
          console.log('[apply_file] response body (length:', responseText.length, '):', responseText);
          
          // 尝试解析 JSON 响应
          try {
            const responseJson = JSON.parse(responseText);
            console.log('[apply_file] response JSON:', JSON.stringify(responseJson, null, 2));
            if (responseJson.success === false) {
              console.error('[apply_file] 服务端返回失败:', responseJson.error || responseJson.message);
              throw new Error(responseJson.error || '文件保存失败');
            }
            if (responseJson.success === true) {
              console.log('[apply_file] ✅ 服务端确认保存成功，文件路径:', responseJson.path);
            }
          } catch (parseError) {
            // 如果不是 JSON，可能是纯文本响应
            console.log('[apply_file] 响应不是 JSON 格式，原样显示:', responseText.substring(0, 500));
          }
        } catch (error) {
          console.warn('[apply_file] Failed to read response body:', error);
        }
        
        console.log('[apply_file] ✅ file saved successfully (HTTP', res.status + ')');
        return true;
      } catch (fetchError) {
        console.error('[apply_file] ❌ fetch 请求失败:', fetchError);
        console.error('[apply_file] 错误详情:', fetchError instanceof Error ? fetchError.message : String(fetchError));
        throw fetchError;
      }
    } else {
      // 对于其他文件，可能需要不同的处理方式
      throw new Error(`不支持的文件路径格式: ${filePath}`);
    }
  } catch (error) {
    console.error('[apply_file] error:', error);
    throw error;
  }
}

/**
 * 完整的文件更新流程
 * @param filePath 文件路径
 * @param editRequirements 编辑需求描述
 * @returns 是否成功
 */
export async function updateFileWithAI(
  filePath: string,
  editRequirements: string
): Promise<boolean> {
  try {
    // 步骤1: 读取文件
    const originalContent = await read_file(filePath);
    
    // 步骤2: 生成编辑方案
    const editPlan = await generate_file(originalContent, editRequirements);
    
    // 步骤3: 优化编辑方案（将注释替换为原始代码）
    const optimizedPlan = optimize_file(editPlan, originalContent);
    
    // 步骤4: 应用编辑方案
    await apply_file(filePath, optimizedPlan);
    
    return true;
  } catch (error) {
    console.error('文件更新失败:', error);
    throw error;
  }
}

// 向后兼容的导出（已弃用，请使用新函数名）
/** @deprecated 使用 read_file 代替 */
export async function readFileContent(filePath: string): Promise<string> {
  return read_file(filePath);
}

/** @deprecated 使用 generate_file 代替 */
export async function generateEditPlan(originalContent: string, editRequirements: string): Promise<string> {
  return generate_file(originalContent, editRequirements);
}

/** @deprecated 使用 optimize_file 代替 */
export function updateEditPlan(editPlan: string, originalContent: string): string {
  return optimize_file(editPlan, originalContent);
}

/** @deprecated 使用 apply_file 代替 */
export async function editFile(filePath: string, finalContent: string): Promise<boolean> {
  return apply_file(filePath, finalContent);
}


