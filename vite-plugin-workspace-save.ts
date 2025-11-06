import type { Plugin } from 'vite';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as https from 'node:https';

/**
 * Vite插件：支持保存workspace目录下的文件
 * 通过拦截 /api/workspace/* 的 PUT 请求来保存文件
 */
export function workspaceSavePlugin(): Plugin {
  return {
    name: 'workspace-save-plugin',
    configureServer(server) {
      // 在中间件栈的最前面添加我们的处理逻辑
      server.middlewares.use((req, res, next) => {
        const url = req.url || '';
        const method = req.method || '';
        
        // 记录所有 PUT 请求和 workspace 相关请求（用于调试）
        // 但跳过带有 import&raw 或 import&url 的请求，避免日志噪音
        // 注意：需要检查整个查询字符串，因为可能有其他参数（如时间戳）在 import&raw 之前
        const hasImportParams = url.includes('import&raw') || url.includes('import@raw') || 
                                url.includes('import&url') || url.includes('import@url');
        
        if (method === 'PUT') {
          console.log('[workspace-save-plugin] 🔵🔵🔵 拦截到 PUT 请求:', url);
        }
        
        if (url.includes('workspace') && !hasImportParams) {
          console.log('[workspace-save-plugin] 🎯 收到 workspace 请求:', method, url);
        }

        // 处理 /workspace 或 /api/workspace 路径的 GET 请求（读取文件）
        // 支持两种路径格式：/workspace/xxx 和 /api/workspace/xxx
        // 注意：统一处理所有 GET 请求（包括带有 ?import&raw 参数的请求），不记录日志以避免噪音
        if ((url.startsWith('/workspace/') || url.startsWith('/api/workspace/')) && method === 'GET') {
          // 检查是否是 Vite import.meta.glob() 的特殊请求
          // 需要检查整个 URL，因为可能有其他查询参数（如 t=xxx）在 import&raw 之前或之后
          const hasImportUrl = url.includes('import&url') || url.includes('import@url');
          const hasImportRaw = url.includes('import&raw') || url.includes('import@raw');
          
          try {
            // 先分离 URL 和查询参数（在解码前）
            const urlWithoutQuery = url.split('?')[0];
            
            // 解码 URL 编码的文件名（处理中文文件名等）
            let decodedUrl = decodeURIComponent(urlWithoutQuery);
            
            // 将URL路径转换为文件系统路径
            // /workspace/reports/report.md -> workspace/reports/report.md
            // /api/workspace/reports/report.md -> workspace/reports/report.md
            let filePath = decodedUrl.replace(/^\/api\/workspace\//, 'workspace/')
                              .replace(/^\/workspace\//, 'workspace/');

            // 构建完整路径
            const fullPath = path.resolve(process.cwd(), filePath);
            
            // 安全检查：确保路径在项目目录内
            const projectRoot = path.resolve(process.cwd());
            if (!fullPath.startsWith(projectRoot)) {
              throw new Error('路径不安全：不允许访问项目目录外的文件');
            }

            // 检查文件是否存在
            if (!fs.existsSync(fullPath)) {
              // 只对非 import.meta.glob 请求记录错误日志
              if (!hasImportRaw && !hasImportUrl) {
                console.error('[workspace-save-plugin] ❌ 文件不存在:', fullPath);
                console.error('[workspace-save-plugin]   原始 URL:', url);
                console.error('[workspace-save-plugin]   解码后 URL:', decodedUrl);
                console.error('[workspace-save-plugin]   文件路径:', filePath);
              }
              res.writeHead(404, {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
              });
              res.end(JSON.stringify({ 
                success: false, 
                error: '文件不存在'
              }));
              return;
            }

            // 读取文件内容
            const content = fs.readFileSync(fullPath, 'utf-8');
            
            // 只对非 import.meta.glob 请求记录成功日志
            if (!hasImportRaw && !hasImportUrl) {
              console.log('[workspace-save-plugin] ✅ 读取文件成功:', filePath, '长度:', content.length);
            }
            
            // 获取文件信息用于 Last-Modified 头
            const stats = fs.statSync(fullPath);
            const mtime = stats.mtimeMs;

            // 根据请求类型和文件扩展名设置 Content-Type
            const ext = path.extname(fullPath).toLowerCase();
            let contentType: string;
            
            if (hasImportRaw) {
              // 对于 ?import&raw，Vite 期望得到一个 ES 模块，导出字符串
              // 格式应该是：export default "文件内容"
              const escapedContent = JSON.stringify(content);
              const moduleContent = `export default ${escapedContent};`;
              
              // 返回 ES 模块格式的内容
              res.writeHead(200, {
                'Content-Type': 'application/javascript; charset=utf-8',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type'
              });
              res.end(moduleContent);
              return;
            } else {
              // 普通请求或 ?import&url 请求：根据文件扩展名设置
              const contentTypes: Record<string, string> = {
                '.md': 'text/markdown; charset=utf-8',
                '.txt': 'text/plain; charset=utf-8',
                '.py': 'text/plain; charset=utf-8',
                '.ts': 'text/plain; charset=utf-8',
                '.tsx': 'text/plain; charset=utf-8',
                '.js': 'text/javascript; charset=utf-8',
                '.jsx': 'text/javascript; charset=utf-8',
                '.json': 'application/json; charset=utf-8',
              };
              contentType = contentTypes[ext] || 'text/plain; charset=utf-8';
            }

            // 返回文件内容
            res.writeHead(200, {
              'Content-Type': contentType,
              'Last-Modified': new Date(mtime).toUTCString(),
              'ETag': `"${mtime}"`,
              'Access-Control-Allow-Origin': '*',
              'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
              'Access-Control-Allow-Headers': 'Content-Type'
            });
            res.end(content);

          } catch (error) {
            // 只对非 import.meta.glob 请求记录错误日志
            if (!hasImportRaw && !hasImportUrl) {
              console.error('[workspace-save-plugin] 读取文件失败:', error);
            }
            res.writeHead(500, {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*'
            });
            res.end(JSON.stringify({ 
              success: false, 
              error: error instanceof Error ? error.message : String(error) 
            }));
          }
          
          return; // 已处理请求，不再调用 next()
        }

        // 处理 /workspace 或 /api/workspace 路径的 PUT 请求（保存文件）
        // 支持两种路径格式：/workspace/xxx 和 /api/workspace/xxx
        if ((url.startsWith('/workspace/') || url.startsWith('/api/workspace/')) && method === 'PUT') {
          console.log('[workspace-save-plugin] ✅ 确认处理 PUT 请求:', url);
          
          // 收集请求体
          let body = '';
          req.setEncoding('utf8');
          
          req.on('data', (chunk: string | Buffer) => {
            body += typeof chunk === 'string' ? chunk : chunk.toString('utf8');
          });

          req.on('end', () => {
            try {
              console.log('[workspace-save-plugin] PUT 请求体长度:', body.length);
              
              // 先分离 URL 和查询参数（在解码前）
              const urlWithoutQuery = url.split('?')[0];
              
              // 解码 URL 编码的文件名（处理中文文件名等）
              let decodedUrl = decodeURIComponent(urlWithoutQuery);
              
              // 将URL路径转换为文件系统路径
              // /workspace/reports/report.md -> workspace/reports/report.md
              // /api/workspace/reports/report.md -> workspace/reports/report.md
              let filePath = decodedUrl.replace(/^\/api\/workspace\//, 'workspace/')
                                .replace(/^\/workspace\//, 'workspace/');
              
              console.log('[workspace-save-plugin] 原始 URL:', url);
              console.log('[workspace-save-plugin] 解码后的 URL:', decodedUrl);
              console.log('[workspace-save-plugin] 处理后的文件路径:', filePath);
              
              // 构建完整路径
              const fullPath = path.resolve(process.cwd(), filePath);
              console.log('[workspace-save-plugin] Writing file:', fullPath);
              console.log('[workspace-save-plugin] Content length:', body.length);

              // 安全检查：确保路径在项目目录内
              const projectRoot = path.resolve(process.cwd());
              if (!fullPath.startsWith(projectRoot)) {
                throw new Error('路径不安全：不允许访问项目目录外的文件');
              }

              // 确保目录存在
              const dir = path.dirname(fullPath);
              fs.mkdirSync(dir, { recursive: true });

              // 写入文件
              fs.writeFileSync(fullPath, body, 'utf-8');
              console.log('[workspace-save-plugin] ✅ 文件写入成功');

              // 返回成功响应
              res.writeHead(200, {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'PUT, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type'
              });
              res.end(JSON.stringify({ 
                success: true, 
                message: '文件保存成功',
                path: filePath 
              }));

            } catch (error) {
              console.error('[workspace-save-plugin] 保存文件失败:', error);
              res.writeHead(500, {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
              });
              res.end(JSON.stringify({ 
                success: false, 
                error: error instanceof Error ? error.message : String(error) 
              }));
            }
          });
          
          return; // 已处理请求，不再调用 next()
        }

        // 处理 /api/ai/generate-edit 路径的 POST 请求（AI 生成编辑方案）
        if (url === '/api/ai/generate-edit' && method === 'POST') {
          let body = '';
          req.setEncoding('utf8');
          
          req.on('data', (chunk: string) => {
            body += chunk;
          });

          req.on('end', async () => {
            try {
              const requestData = JSON.parse(body);
              
              // 检查 originalContent 是否真的存在于请求中，并且值不为空
              // 如果字段不存在、值为 null、undefined 或空字符串，都视为新建模式
              const hasOriginalContentField = requestData.hasOwnProperty('originalContent');
              const originalContentValue = requestData.originalContent;
              
              // 只有当 originalContent 字段存在且值不为空（非空字符串、非 null、非 undefined）时，才使用它
              const originalContent = (hasOriginalContentField && 
                                      originalContentValue !== null && 
                                      originalContentValue !== undefined && 
                                      originalContentValue !== '') 
                ? originalContentValue 
                : undefined;
              
              const editRequirements = requestData.editRequirements;
              const model = requestData.model;
              const systemPrompt = requestData.systemPrompt;

              // 获取 API key（优先使用 QWEN_API_KEY，如果没有则使用 DASH_SCOPE_API_KEY）
              const apiKey = process.env.QWEN_API_KEY || process.env.DASH_SCOPE_API_KEY;
              
              if (!apiKey) {
                throw new Error('API key 未配置。请设置环境变量 QWEN_API_KEY 或 DASH_SCOPE_API_KEY');
              }

              console.log('[workspace-save-plugin] 请求参数:', {
                hasOriginalContentField,
                originalContentValueType: typeof originalContentValue,
                originalContentValueLength: originalContentValue?.length || 0,
                originalContentAfterFilter: originalContent !== undefined ? 'has value' : 'undefined (new mode)',
                editRequirements: editRequirements?.substring(0, 50),
                hasSystemPrompt: !!systemPrompt,
                systemPromptPreview: systemPrompt?.substring(0, 50)
              });

              // 调用 DashScope API（阿里云通义千问）
              // 如果传入了 systemPrompt，使用自定义的 systemPrompt；否则使用默认的
              const editPlan = await callQwenAPI(apiKey, originalContent, editRequirements, model || 'qwen-plus', systemPrompt);

              // 返回成功响应（格式需匹配 fileEditHelper.ts 的期望）
              res.writeHead(200, {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type'
              });
              res.end(JSON.stringify({ 
                success: true,
                code: 20000,
                message: '编辑生成成功',
                data: {
                  output_text: editPlan
                },
                timestamp: Date.now()
              }));

            } catch (error) {
              console.error('[workspace-save-plugin] AI 生成编辑方案失败:', error);
              const errorMessage = error instanceof Error ? error.message : String(error);
              res.writeHead(500, {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
              });
              res.end(JSON.stringify({ 
                success: false,
                code: 50000,
                message: errorMessage,
                data: null,
                timestamp: Date.now()
              }));
            }
          });
          
          return; // 已处理请求，不再调用 next()
        }

        // 处理 OPTIONS 预检请求
        if ((url.startsWith('/workspace/') || url.startsWith('/api/workspace') || url === '/api/ai/generate-edit') && method === 'OPTIONS') {
          res.writeHead(200, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, PUT, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
          });
          res.end();
          return;
        }

        // 其他请求继续传递
        next();
      });
      
      console.log('[workspace-save-plugin] ✅ 中间件已注册');
    }
  };
}

/**
 * 调用通义千问 API 生成编辑方案或新内容
 * @param apiKey API 密钥
 * @param originalContent 原始文件内容（可选，如果为空则生成新内容）
 * @param editRequirements 编辑需求描述或问题描述
 * @param model 模型名称，默认为 qwen-plus
 * @param systemPrompt 自定义系统提示词（可选）
 * @returns 生成的编辑方案或新内容
 */
async function callQwenAPI(
  apiKey: string,
  originalContent: string | undefined,
  editRequirements: string,
  model: string = 'anthropic/claude-3.5-sonnet',
  systemPrompt?: string
): Promise<string> {
  return new Promise((resolve, reject) => {
    // 判断是编辑模式还是新建模式
    // 只有当 originalContent 明确存在且不为空（非空字符串）时才是编辑模式
    // 如果 originalContent 是 undefined、null 或空字符串，都视为新建模式
    const isEditMode = originalContent !== undefined && 
                       originalContent !== null && 
                       originalContent !== '' && 
                       typeof originalContent === 'string' && 
                       originalContent.trim().length > 0;
    
    console.log('[callQwenAPI] 模式判断:', {
      isEditMode,
      originalContentType: typeof originalContent,
      originalContentValue: originalContent === undefined ? 'undefined' : (originalContent === '' ? 'empty string' : `string(${originalContent.length} chars)`),
      originalContentLength: originalContent?.length || 0,
      hasSystemPrompt: !!systemPrompt
    });
    
    // 构建提示词
    let prompt: string;
    if (isEditMode) {
      // 编辑模式：修改现有文件
      prompt = `请根据以下需求修改代码文件，对于未修改的部分，请用注释 "////...existing code...////" 代替，以减少输出内容。

编辑需求：
${editRequirements}

原始文件内容：
\`\`\`
${originalContent}
\`\`\`

请返回修改后的完整代码，未修改的部分用 "////...existing code...////" 注释标记。`;
    } else {
      // 新建模式：生成新内容
      prompt = editRequirements;
    }

    // 默认系统提示词
    let defaultSystemPrompt: string;
    if (isEditMode) {
      defaultSystemPrompt = '你是一个专业的代码编辑助手。当你收到原始文件内容和修改需求时，请生成修改后的代码方案。对于未修改的部分，必须使用注释 "////...existing code...////" 来代替，以减少上下文占用和输出内容。请确保只在真正未修改的代码部分使用该注释，需要修改的部分必须完整写出修改后的代码。';
    } else {
      defaultSystemPrompt = '你是一个专业的量化分析师，请结合你的专业量化Quant知识，将用户的问题转化成为量化因子、策略及代码。请用Markdown格式输出，支持图片、表格、代码等丰富样式。';
    }

    // 使用传入的 systemPrompt 或默认的 systemPrompt
    const finalSystemPrompt = systemPrompt || defaultSystemPrompt;
    
    console.log('[callQwenAPI] 最终使用的 systemPrompt:', {
      isCustom: !!systemPrompt,
      preview: finalSystemPrompt.substring(0, 100)
    });

    // DashScope API 端点
    const apiUrl = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation';
    
    // 构建请求数据
    const requestData = JSON.stringify({
      model: model,
      input: {
        messages: [
          {
            role: 'system',
            content: finalSystemPrompt
          },
          {
            role: 'user',
            content: prompt
          }
        ]
      },
      parameters: {
        temperature: 0.1,
        max_tokens: 8000,
        result_format: 'message'
      }
    });

    // 解析 URL
    const urlObj = new URL(apiUrl);
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || 443,
      path: urlObj.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'Content-Length': Buffer.byteLength(requestData)
      }
    };

    // 发送 HTTPS 请求
    const req = https.request(options, (res) => {
      let responseData = '';

      res.on('data', (chunk) => {
        responseData += chunk;
      });

      res.on('end', () => {
        try {
          const response = JSON.parse(responseData);
          
          if (response.output && response.output.choices && response.output.choices.length > 0) {
            const content = response.output.choices[0].message?.content;
            if (content) {
              // 提取代码块内容（如果返回的是 markdown 代码块）
              const codeBlockMatch = content.match(/```(?:\w+)?\n([\s\S]*?)\n```|([\s\S]*?)/);
              const editPlan = codeBlockMatch ? (codeBlockMatch[1] || codeBlockMatch[2]) : content;
              resolve(editPlan.trim());
            } else {
              reject(new Error('API 返回格式错误：未找到内容'));
            }
          } else if (response.code) {
            reject(new Error(`API 调用失败: ${response.message || response.code}`));
          } else {
            reject(new Error('API 返回格式错误'));
          }
        } catch (error) {
          reject(new Error(`解析响应失败: ${error instanceof Error ? error.message : String(error)}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(new Error(`请求失败: ${error.message}`));
    });

    req.write(requestData);
    req.end();
  });
}

