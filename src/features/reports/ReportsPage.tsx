import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams, useSearchParams, useLocation, useNavigate } from 'react-router-dom';
import { getReportBySlug, loadReports } from '../../lib/reports';
import { read_file, generate_file, optimize_file, apply_file, generate_new_analysis } from '../../lib/fileEditHelper';
import MarkdownRenderer from '../../components/Chat/MarkdownRenderer';

// UUID 生成函数（兼容性更好）
function generateUUID(): string {
  // 优先使用 crypto.randomUUID（如果可用）
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // 备用方案：使用时间戳和随机数
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}-${Math.random().toString(36).substring(2, 9)}`;
}

type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
};

export function ReportsPage() {
  // reports
  const location = useLocation();
  const [sp] = useSearchParams();
  const slug = sp.get('r') ?? undefined;
  const isNew = sp.get('new') === '1';
  const reports = useMemo(() => loadReports(), []);
  const navigate = useNavigate();
  
  // 优先从已有报告中查找，如果找不到且 URL 中有 r 参数，则构造一个虚拟报告对象
  // 注意：如果 URL 中有 new=1 参数，强制返回 undefined，表示新建模式
  const currentReport = useMemo(() => {
    // 如果 URL 中有 new=1，强制进入新建模式，不返回任何报告
    if (isNew) {
      console.log('[ReportsPage] new=1 模式，强制进入新建分析，currentReport = undefined');
      return undefined;
    }
    
    const found = getReportBySlug(slug);
    if (found) {
      console.log('[ReportsPage] currentReport (found):', found);
      return found;
    }
    
    // 如果找不到且 URL 中有 r 参数，从 URL 路径和参数构造虚拟报告对象
    // 例如：/reports?r=report_1 -> workspace/reports/report_1.md
    if (slug) {
      // 从路径中提取 typeDir（例如：/reports -> reports）
      const pathname = location.pathname;
      const typeDir = pathname.replace(/^\//, '').replace(/\/$/, '') || 'reports';
      
      // slug 已经是解码后的（useSearchParams 会自动解码）
      // slugDir：确保有 .md 后缀
      const slugDir = slug.endsWith('.md') ? slug : `${slug}.md`;
      
      // 构造文件路径：workspace/{typeDir}/{slugDir}（不带前导斜杠）
      // 注意：文件名直接使用中文，不需要编码
      const filename = `workspace/${typeDir}/${slugDir}`;
      
      const report = {
        filename: filename,
        slug: slug,
        title: slug,
        content: '', // 内容将通过 read_file 读取
      };
      
      console.log('[ReportsPage] currentReport (constructed):', {
        slug,
        slugDecoded: slug,
        pathname,
        typeDir,
        slugDir,
        filename,
        report,
      });
      
      return report;
    }
    
    console.log('[ReportsPage] currentReport (undefined)');
    return undefined;
  }, [slug, location.pathname, isNew]);
  // 使用 useRef 来持久化 messages，避免意外丢失
  const messagesRef = useRef<Message[]>([]);
  const [messages, setMessages] = useState<Message[]>(() => {
    // 尝试从 sessionStorage 恢复消息（如果存在）
    try {
      const saved = sessionStorage.getItem(`messages_${slug || 'default'}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        messagesRef.current = parsed;
        return parsed;
      }
    } catch (error) {
      console.error('[ReportsPage] Failed to restore messages from sessionStorage:', error);
    }
    return [];
  });
  
  // 当 slug 变化时，恢复对应的消息记录
  useEffect(() => {
    if (slug !== undefined) {
      try {
        const saved = sessionStorage.getItem(`messages_${slug}`);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed.length > 0 && JSON.stringify(parsed) !== JSON.stringify(messages)) {
            messagesRef.current = parsed;
            setMessages(parsed);
            console.log('[ReportsPage] Restored messages for slug:', slug, 'count:', parsed.length);
          }
        }
      } catch (error) {
        console.error('[ReportsPage] Failed to restore messages for slug:', error);
      }
    }
  }, [slug]); // 只在 slug 变化时执行
  
  // 当 messages 更新时，同步到 ref 和 sessionStorage
  useEffect(() => {
    if (messages.length > 0) {
      messagesRef.current = messages;
      try {
        sessionStorage.setItem(`messages_${slug || 'default'}`, JSON.stringify(messages));
      } catch (error) {
        console.error('[ReportsPage] Failed to save messages to sessionStorage:', error);
      }
    }
  }, [messages, slug]);
  const [input, setInput] = useState('');
  const listRef = useRef<HTMLDivElement | null>(null);
  const [previewPath, setPreviewPath] = useState<string | undefined>(undefined);
  const [previewContent, setPreviewContent] = useState<string | undefined>(undefined);
  const [previewIsHtml, setPreviewIsHtml] = useState<boolean>(false);
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  // 编辑相关状态
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [previewEditing, setPreviewEditing] = useState(false);
  const [previewEditedContent, setPreviewEditedContent] = useState('');
  const [previewSaving, setPreviewSaving] = useState(false);
  // 文件编辑相关状态
  const [editPlan, setEditPlan] = useState<string | null>(null);
  const [originalContent, setOriginalContent] = useState<string | null>(null);
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);
  const [isApplyingEdit, setIsApplyingEdit] = useState(false);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages]);

  // 当进入新建分析模式时，清空所有预览内容和状态
  useEffect(() => {
    if (isNew) {
      setPreviewPath(undefined);
      setPreviewContent(undefined);
      setPreviewIsHtml(false);
      // 清空消息并清除 sessionStorage
      setMessages([]);
      messagesRef.current = [];
      try {
        sessionStorage.removeItem(`messages_${slug || 'default'}`);
      } catch (error) {
        console.error('[ReportsPage] Failed to clear messages from sessionStorage:', error);
      }
      setInput('');
      setUploadFiles([]);
    }
  }, [isNew, slug]);

  // 当currentReport变化时，初始化editedContent
  // 如果 currentReport.content 为空（虚拟对象），则尝试读取文件内容
  useEffect(() => {
    if (currentReport) {
      // 如果 currentReport.content 为空（可能是构造的虚拟对象），尝试读取文件
      if (!currentReport.content || currentReport.content === '') {
        let filePath = currentReport.filename;
        if (filePath.startsWith('/workspace/')) {
          filePath = filePath.replace(/^\//, '');
        } else if (!filePath.startsWith('workspace/')) {
          filePath = `workspace/${filePath}`;
        }
        
        read_file(filePath)
          .then(content => {
            setEditedContent(content);
            console.log('[useEffect] Loaded content for virtual report, length:', content.length);
          })
          .catch(error => {
            console.error('[useEffect] Failed to load content:', error);
            setEditedContent('');
          });
      } else {
        setEditedContent(currentReport.content);
      }
      setIsEditing(false);
    }
  }, [currentReport]);

  // 当预览内容变化时，初始化预览编辑内容
  useEffect(() => {
    if (previewContent !== undefined && !previewIsHtml) {
      setPreviewEditedContent(previewContent);
      setPreviewEditing(false);
    }
  }, [previewContent, previewIsHtml]);

  // 保存主报告内容
  async function saveReport() {
    if (!currentReport) return;
    setIsSaving(true);
    try {
      // 构建文件路径：直接使用 /workspace/ 路径（Vite 插件会处理）
      const filename = currentReport.filename.replace(/^\/workspace\/reports\//, '').replace(/^workspace\/reports\//, '');
      const url = `/workspace/reports/${filename}`;
      console.log('[saveReport] Saving file via Vite:', url);
      const res = await fetch(url, {
        method: 'PUT',
        headers: {
          'Content-Type': 'text/plain; charset=utf-8'
        },
        body: editedContent
      });
      
      if (!res.ok) {
        const errorText = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status}: ${errorText}`);
      }
      
      const result = await res.json().catch(() => ({ success: true }));
      if (result.success !== false) {
        setIsEditing(false);
        // 重新加载页面以显示更新后的内容
        window.location.reload();
      } else {
        throw new Error(result.error || '保存失败');
      }
    } catch (error) {
      alert('保存失败: ' + (error instanceof Error ? error.message : String(error)));
    } finally {
      setIsSaving(false);
    }
  }

  // 保存预览文件内容
  async function savePreviewFile() {
    if (!previewPath || previewIsHtml || !previewPath.startsWith('/workspace/')) return;
    setPreviewSaving(true);
    try {
      // 直接使用 /workspace/ 路径（Vite 插件会处理）
      console.log('[savePreviewFile] Saving preview file via Vite:', previewPath);
      const res = await fetch(previewPath, {
        method: 'PUT',
        headers: {
          'Content-Type': 'text/plain; charset=utf-8'
        },
        body: previewEditedContent
      });
      
      if (!res.ok) {
        const errorText = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status}: ${errorText}`);
      }
      
      const result = await res.json().catch(() => ({ success: true }));
      if (result.success !== false) {
        setPreviewEditing(false);
        setPreviewContent(previewEditedContent);
        alert('保存成功');
      } else {
        throw new Error(result.error || '保存失败');
      }
    } catch (error) {
      alert('保存失败: ' + (error instanceof Error ? error.message : String(error)));
    } finally {
      setPreviewSaving(false);
    }
  }

  async function send() {
    const text = input.trim();
    if (!text) return;

    // 如果 URL 中有 new=1 参数，或者没有当前报告，这是新建分析场景
    if (isNew || !currentReport) {
      console.log('[ReportsPage] 进入新建分析模式:', { isNew, hasCurrentReport: !!currentReport });
      try {
        setIsGeneratingPlan(true);
        
        // 添加用户消息
        const userMessage: Message = { id: generateUUID(), role: 'user', content: text };
        setMessages(prev => [...prev, userMessage]);
        setInput('');

        // 添加生成中的消息
        const generatingMessage: Message = {
          id: generateUUID(),
          role: 'assistant',
          content: '正在生成分析内容，请稍候...'
        };
        setMessages(prev => [...prev, generatingMessage]);

        // 调用大模型生成新分析内容
        console.log('[ReportsPage] 新建分析，调用 generate_new_analysis，askText:', text);
        const generatedContent = await generate_new_analysis(text);

        // 生成文件名：将 ask_text 转换为安全的文件名
        // 移除特殊字符，只保留中文、英文、数字、下划线、中划线
        const safeFilename = text
          .replace(/[^\u4e00-\u9fa5a-zA-Z0-9_\-]/g, '_')
          .replace(/_+/g, '_')
          .replace(/^_|_$/g, '')
          .substring(0, 50); // 限制长度
        const filename = `${safeFilename || 'new_analysis'}.md`;
        const filePath = `workspace/reports/${filename}`;

        // 保存新文件
        console.log('[ReportsPage] 保存新文件:', filePath);
        await apply_file(filePath, generatedContent);

        // 更新消息
        setMessages(prev => prev.map(msg => 
          msg.id === generatingMessage.id 
            ? { ...msg, content: `已生成新分析并保存到 ${filename}` }
            : msg
        ));

        // 导航到新文件
        const slug = filename.replace(/\.md$/, '');
        console.log('[ReportsPage] 导航到新文件，slug:', slug);
        navigate(`/reports?r=${encodeURIComponent(slug)}`, { replace: true });
        
      } catch (error) {
        const errorMessage: Message = {
          id: generateUUID(),
          role: 'assistant',
          content: `生成新分析失败: ${error instanceof Error ? error.message : String(error)}`
        };
        setMessages(prev => {
          // 移除生成中的消息，添加错误消息
          const filtered = prev.filter(msg => msg.content !== '正在生成分析内容，请稍候...');
          return [...filtered, errorMessage];
        });
      } finally {
        setIsGeneratingPlan(false);
      }
      return;
    }

    // 步骤1: 确定文件路径（从 currentReport.filename 中提取）
    // currentReport.filename 格式：workspace/reports/report_1.md
    let filePath = currentReport.filename;
    console.log('[ReportsPage] send() - currentReport.filename:', currentReport.filename);
    
    // 确保路径格式正确：workspace/xxx/xxx.md（不带前导斜杠）
    if (filePath.startsWith('/workspace/')) {
      filePath = filePath.replace(/^\/workspace\//, 'workspace/');
    } else if (!filePath.startsWith('workspace/')) {
      // 如果路径格式不对，尝试构建
      const filename = currentReport.filename.replace(/^\/workspace\/reports\//, '');
      filePath = `workspace/reports/${filename}`;
    }
    
    console.log('[ReportsPage] send() - filePath (normalized):', filePath);

    // 文件编辑流程：读取 -> 生成编辑方案
    try {
      setIsGeneratingPlan(true);
      
      // 添加用户消息
      const userMessage: Message = { 
        id: generateUUID(), 
        role: 'user', 
        content: `修改需求：${text}`
      };
      setMessages(prev => [...prev, userMessage]);
      setInput('');

      // 步骤2: 读取原始内容
      console.log('[ReportsPage] send() - calling read_file with:', filePath);
      const content = await read_file(filePath);
      console.log('[ReportsPage] send() - read_file result length:', content.length);
      setOriginalContent(content);

      // 步骤3: 生成编辑方案
      const plan = await generate_file(content, text);
      setEditPlan(plan);

      // 步骤4: 显示生成的编辑方案和确认按钮
      const assistantMessage: Message = {
        id: generateUUID(),
        role: 'assistant',
        content: `已生成编辑方案。\n\n原始文件：${filePath}\n\n编辑方案预览：\n\`\`\`\n${plan.slice(0, 500)}${plan.length > 500 ? '...' : ''}\n\`\`\`\n\n请点击"确认更新"按钮应用更改。`
      };
      setMessages(prev => [...prev, assistantMessage]);

    } catch (error) {
      const errorMessage: Message = {
        id: generateUUID(),
        role: 'assistant',
        content: `生成编辑方案失败: ${error instanceof Error ? error.message : String(error)}`
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsGeneratingPlan(false);
    }
  }

  // 确认并应用编辑方案
  async function applyEdit() {
    if (!editPlan || !originalContent || !currentReport) return;

    try {
      setIsApplyingEdit(true);

      // 步骤1: 确定文件路径（从 currentReport.filename 中提取）
      let filePath = currentReport.filename;
      if (filePath.startsWith('/workspace/')) {
        filePath = filePath.replace(/^\/workspace\//, 'workspace/');
      } else if (!filePath.startsWith('workspace/')) {
        const filename = currentReport.filename.replace(/^\/workspace\/reports\//, '');
        filePath = `workspace/reports/${filename}`;
      }

      // 步骤2: 优化编辑方案（将注释替换为原始代码）
      console.log('[applyEdit] Before optimize_file:');
      console.log('[applyEdit] editPlan length:', editPlan.length);
      console.log('[applyEdit] originalContent length:', originalContent.length);
      
      const optimizedPlan = optimize_file(editPlan, originalContent);
      
      console.log('[applyEdit] After optimize_file:');
      console.log('[applyEdit] optimizedPlan length:', optimizedPlan.length);
      console.log('[applyEdit] optimizedPlan preview:', optimizedPlan.substring(0, 300));

      // 步骤3: 应用编辑方案
      console.log('[applyEdit] Calling apply_file with path:', filePath);
      await apply_file(filePath, optimizedPlan);
      console.log('[applyEdit] apply_file completed successfully');

      // 步骤4: 等待一小段时间确保文件写入完成，然后重新读取更新后的文件内容
      try {
        // 等待更长时间确保文件写入完成（增加延迟，避免读取到旧内容）
        console.log('[applyEdit] 等待文件写入完成...');
        await new Promise(resolve => setTimeout(resolve, 300)); // 增加到 300ms
        
        console.log('[applyEdit] 开始重新读取文件内容，路径:', filePath);
        const updatedContent = await read_file(filePath);
        
        console.log('[applyEdit] 重新读取的文件内容长度:', updatedContent.length);
        console.log('[applyEdit] 原始 optimizedPlan 长度:', optimizedPlan.length);
        
        // 验证读取的内容是否和保存的内容一致
        if (updatedContent.length !== optimizedPlan.length) {
          console.warn('[applyEdit] ⚠️ 读取的内容长度与保存的内容不一致！');
          console.warn('[applyEdit]   保存长度:', optimizedPlan.length);
          console.warn('[applyEdit]   读取长度:', updatedContent.length);
          console.warn('[applyEdit]   差异:', Math.abs(updatedContent.length - optimizedPlan.length), 'bytes');
          
          // 比较前 200 个字符
          const savedPreview = optimizedPlan.substring(0, 200);
          const readPreview = updatedContent.substring(0, 200);
          if (savedPreview !== readPreview) {
            console.warn('[applyEdit] ⚠️ 内容预览不匹配！');
            console.warn('[applyEdit]   保存的前200字符:', savedPreview);
            console.warn('[applyEdit]   读取的前200字符:', readPreview);
          }
        } else {
          console.log('[applyEdit] ✅ 读取的内容长度与保存的内容一致');
        }
        
        // 更新 editedContent 状态，这样页面会显示更新后的内容
        setEditedContent(updatedContent);
        
        // 强制触发重新渲染
        console.log('[applyEdit] File updated, content refreshed. Length:', updatedContent.length);
        console.log('[applyEdit] Content preview:', updatedContent.substring(0, 200));
      } catch (error) {
        console.error('[applyEdit] Failed to refresh content:', error);
        // 如果重新读取失败，仍然刷新页面
        setTimeout(() => {
          window.location.reload();
        }, 1500);
        return;
      }

      // 添加成功消息
      const successMessage: Message = {
        id: generateUUID(),
        role: 'assistant',
        content: `文件更新成功！文件 ${filePath} 已保存。内容已刷新。`
      };
      setMessages(prev => [...prev, successMessage]);

      // 清空编辑方案状态
      setEditPlan(null);
      setOriginalContent(null);

    } catch (error) {
      const errorMessage: Message = {
        id: generateUUID(),
        role: 'assistant',
        content: `应用编辑方案失败: ${error instanceof Error ? error.message : String(error)}`
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsApplyingEdit(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  }

  function extractFilename(line: string): string | undefined {
    const trimmed = line.trim();
    const lastSpace = trimmed.lastIndexOf(' ');
    let token = lastSpace >= 0 ? trimmed.slice(lastSpace + 1).trim() : trimmed;
    token = token.replace(/^['"“”‘’\(\[]+/, '').replace(/['"“”‘’\)\]]+$/, '');
    
    return token || undefined;
  }

  function loadMammoth(): Promise<any> {
    if ((window as any).mammoth) return Promise.resolve((window as any).mammoth);
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/mammoth/mammoth.browser.min.js';
      script.async = true;
      script.onload = () => resolve((window as any).mammoth);
      script.onerror = () => reject(new Error('mammoth 加载失败'));
      document.head.appendChild(script);
    });
  }

  function onFilesSelected(files: FileList | null) {
    if (!files) return;
    const arr = Array.from(files);
    setUploadFiles(arr);
    // 自动预览第一个文件
    if (arr.length > 0) {
      previewFile(arr[0]);
    }
  }

  async function previewFile(file: File) {
    try {
      if (/\.docx$/i.test(file.name)) {
        const mammoth = await loadMammoth();
        const buffer = await file.arrayBuffer();
        const result = await mammoth.convertToHtml({ arrayBuffer: buffer });
        setPreviewPath(file.name);
        setPreviewContent(result.value as string);
        setPreviewIsHtml(true);
      } else if (/\.(md|txt)$/i.test(file.name)) {
        const text = await file.text();
        setPreviewPath(file.name);
        setPreviewContent(text);
        setPreviewIsHtml(false);
      } else {
        setPreviewPath(file.name);
        setPreviewContent('已选择文件，暂不支持预览该格式');
        setPreviewIsHtml(false);
      }
    } catch (error) {
      setPreviewPath(file.name);
      setPreviewContent('文件预览失败');
      setPreviewIsHtml(false);
    }
  }

  async function openWorkspaceFile(filename: string, fallbackLine: string) {
    // 根据当前页面路径确定 workspace 路径和默认 slug
    const pathname = window.location.pathname;
    let workspacePath = 'reports';
    let defaultSlug = 'report';
    
    if (pathname.startsWith('/strategies')) {
      workspacePath = 'strategies';
      defaultSlug = 'strategy';
    } else if (pathname.startsWith('/factors')) {
      workspacePath = 'factors';
      defaultSlug = 'factor';
    }
    
    const slug = currentReport?.slug ?? defaultSlug;
    // 统一使用 slug 路径结构：/workspace/{path}/{slug}/{filename}
    const url = `/workspace/${workspacePath}/${slug}/${filename}`;
    try {
      if (!/\./.test(filename)) {
        setPreviewPath(`文本`);
        setPreviewContent(fallbackLine);
        setPreviewIsHtml(false);
        return;
      }
      if (/\.docx$/i.test(filename)) {
        const res = await fetch(url);
        if (!res.ok) {
          setPreviewPath(`文本`);
          setPreviewContent(fallbackLine);
          setPreviewIsHtml(false);
          return;
        }
        const buffer = await res.arrayBuffer();
        const mammoth = await loadMammoth();
        const result = await mammoth.convertToHtml({ arrayBuffer: buffer });
        setPreviewPath(url);
        setPreviewContent(result.value as string);
        setPreviewIsHtml(true);
      } else {
        const res = await fetch(url);
        if (!res.ok) {
          setPreviewPath(`文本`);
          setPreviewContent(fallbackLine);
          setPreviewIsHtml(false);
          return;
        }
        const ct = res.headers.get('content-type') || '';
        if (ct.includes('text/html')) {
          // dev 服务器 SPA 兜底，判定为找不到文件
          setPreviewPath(`文本`);
          setPreviewContent(fallbackLine);
          setPreviewIsHtml(false);
          return;
        }
        const text = await res.text();
        setPreviewPath(url);
        setPreviewContent(text);
        setPreviewIsHtml(false);
      }
    } catch (e) {
      setPreviewPath(`文本`);
      setPreviewContent(fallbackLine);
      setPreviewIsHtml(false);
    }
  }

  if (isNew) {
    return (
      <div className="assistant-page assistant-split">
        <div className="work-area" style={{ width: '100%' }}>
          <div className="report-view" style={{ display: 'flex', flexDirection: 'column', height: '100%', alignItems: 'center' }}>
            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: 'calc(66vh - 240px)' }}>
              <div style={{ textAlign: 'center', padding: '0 24px 20px 24px' }}>
                <div style={{ fontSize: 28, fontWeight: 800, color: '#6C63FF', marginBottom: 6 }}>欢迎使用AI量化分析师小Q助手</div>
                <div style={{ color: '#8A8A8A' }}>我可以分析研报，新闻舆情，情绪，主题，行业等生成策略和因子分析</div>
              </div>

              <div style={{ width: 'min(900px, 92%)', margin: '0 auto' }}>
                {previewPath && (
                  <div style={{ marginBottom: 16, border: '1px solid #ECECF3', borderRadius: 12, background: '#fff', padding: 12 }}>
                    <div style={{ fontWeight: 600, marginBottom: 8, color: '#6C63FF' }}>预览：{previewPath}</div>
                    {previewIsHtml ? (
                      <div style={{ maxHeight: 300, overflow: 'auto', fontSize: 14, lineHeight: 1.5 }} dangerouslySetInnerHTML={{ __html: previewContent ?? '' }} />
                    ) : (
                      <pre style={{ maxHeight: 300, overflow: 'auto', fontSize: 14, lineHeight: 1.5, whiteSpace: 'pre-wrap', margin: 0 }}>{previewContent}</pre>
                    )}
                  </div>
                )}
                <div
                  style={{
                    border: '1px solid #ECECF3',
                    borderRadius: 16,
                    background: '#fff',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                    padding: 6
                  }}
                >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px 6px 10px' }}>
                  <textarea
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={onKeyDown}
                    placeholder={'问问 小Q分析师'}
                    style={{ flex: 1, height: 40, border: 'none', outline: 'none', fontSize: 14, resize: 'none', paddingTop: 10 }}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 10px 8px 10px' }}>
                  <label
                    title="添加文件"
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 14,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: '#F4F4FF',
                      color: '#6C63FF',
                      cursor: 'pointer'
                    }}
                  >
                    <input type="file" onChange={e => onFilesSelected(e.target.files)} style={{ display: 'none' }} multiple />
                    <span style={{ fontSize: 18, lineHeight: 1 }}>＋</span>
                  </label>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#6B7280', fontSize: 14 }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M4 6h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                      <circle cx="12" cy="6" r="2" stroke="currentColor" strokeWidth="2" fill="white"/>
                      <path d="M14 12h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                      <circle cx="12" cy="12" r="2" stroke="currentColor" strokeWidth="2" fill="white"/>
                      <path d="M4 18h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                      <circle cx="12" cy="18" r="2" stroke="currentColor" strokeWidth="2" fill="white"/>
                    </svg>
                    <span>工具</span>
                  </div>
                  <div style={{ flex: 1 }} />
                  <button onClick={() => void send()} style={{ padding: '8px 12px', borderRadius: 10, border: 'none', background: '#6C63FF', color: '#fff', cursor: 'pointer' }}>发送</button>
                </div>
              </div>
                {uploadFiles.length > 0 && (
                  <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {uploadFiles.map(f => (
                      <div key={f.name} style={{ padding: '6px 10px', borderRadius: 999, background: '#F0F1FE', color: '#4E4EB7' }}>{f.name}</div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="assistant-page assistant-split">
      <div className="work-area">
        {reports.length > 0 && (
          <div className="reports-submenu">
            <div className="submenu-title">报告列表</div>
            <div className="submenu-list">
              {reports.map(r => (
                <Link key={r.slug} className={`submenu-item ${r.slug === currentReport?.slug ? 'active' : ''}`} to={`/reports?r=${r.slug}`}>{r.title}</Link>
              ))}
            </div>
          </div>
        )}
        {currentReport && (
          <div className="report-view" style={isEditing ? { display: 'flex', flexDirection: 'column', height: 'calc(100vh - 200px)', minHeight: '500px' } : {}}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, flexShrink: 0 }}>
              <h3 style={{ margin: 0 }}>{currentReport.title}</h3>
              {!isEditing ? (
                <button
                  onClick={() => setIsEditing(true)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 8,
                    border: '1px solid #ECECF3',
                    background: '#fff',
                    color: '#6C63FF',
                    cursor: 'pointer',
                    fontSize: 14
                  }}
                >
                  编辑
                </button>
              ) : (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => {
                      setIsEditing(false);
                      setEditedContent(currentReport.content);
                    }}
                    style={{
                      padding: '6px 12px',
                      borderRadius: 8,
                      border: '1px solid #ECECF3',
                      background: '#fff',
                      color: '#6b7280',
                      cursor: 'pointer',
                      fontSize: 14
                    }}
                  >
                    取消
                  </button>
                  <button
                    onClick={() => void saveReport()}
                    disabled={isSaving}
                    style={{
                      padding: '6px 12px',
                      borderRadius: 8,
                      border: 'none',
                      background: '#6C63FF',
                      color: '#fff',
                      cursor: isSaving ? 'wait' : 'pointer',
                      fontSize: 14,
                      opacity: isSaving ? 0.6 : 1
                    }}
                  >
                    {isSaving ? '保存中...' : '保存'}
                  </button>
                </div>
              )}
            </div>
            {isEditing ? (
              <textarea
                value={editedContent}
                onChange={(e) => setEditedContent(e.target.value)}
                style={{
                  width: '100%',
                  flex: 1,
                  minHeight: '400px',
                  padding: '12px',
                  border: '1px solid #ECECF3',
                  borderRadius: 8,
                  fontFamily: 'ui-monospace, monospace',
                  fontSize: 14,
                  lineHeight: 1.6,
                  resize: 'none',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
                placeholder="在此编辑markdown内容..."
              />
            ) : (
              <div className="report-md" style={{ padding: '16px', lineHeight: '1.8' }}>
                <MarkdownRenderer
                  content={editedContent && editedContent.trim() !== '' ? editedContent : (currentReport?.content || '')}
                  currentFileDir={currentReport?.filename ? currentReport.filename.substring(0, currentReport.filename.lastIndexOf('/') + 1) : undefined}
                  strictImageSource={false}
                />
              </div>
            )}
          </div>
        )}
      </div>

      <div className="chat-panel">
        {previewPath && (
          <div className="report-view" style={{ margin: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <div style={{ fontWeight: 600 }}>预览：{previewPath}</div>
              {!previewIsHtml && previewPath.startsWith('/workspace/') && (
                !previewEditing ? (
                  <button
                    onClick={() => setPreviewEditing(true)}
                    style={{
                      padding: '4px 10px',
                      borderRadius: 6,
                      border: '1px solid #ECECF3',
                      background: '#fff',
                      color: '#6C63FF',
                      cursor: 'pointer',
                      fontSize: 12
                    }}
                  >
                    编辑
                  </button>
                ) : (
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      onClick={() => {
                        setPreviewEditing(false);
                        setPreviewEditedContent(previewContent ?? '');
                      }}
                      style={{
                        padding: '4px 10px',
                        borderRadius: 6,
                        border: '1px solid #ECECF3',
                        background: '#fff',
                        color: '#6b7280',
                        cursor: 'pointer',
                        fontSize: 12
                      }}
                    >
                      取消
                    </button>
                    <button
                      onClick={() => void savePreviewFile()}
                      disabled={previewSaving}
                      style={{
                        padding: '4px 10px',
                        borderRadius: 6,
                        border: 'none',
                        background: '#6C63FF',
                        color: '#fff',
                        cursor: previewSaving ? 'wait' : 'pointer',
                        fontSize: 12,
                        opacity: previewSaving ? 0.6 : 1
                      }}
                    >
                      {previewSaving ? '保存中...' : '保存'}
                    </button>
                  </div>
                )
              )}
            </div>
            {previewIsHtml ? (
              <div className="report-md" style={{ maxHeight: 220, overflow: 'auto' }} dangerouslySetInnerHTML={{ __html: previewContent ?? '' }} />
            ) : previewEditing ? (
              <textarea
                value={previewEditedContent}
                onChange={(e) => setPreviewEditedContent(e.target.value)}
                style={{
                  width: '100%',
                  minHeight: '200px',
                  maxHeight: '400px',
                  padding: '12px',
                  border: '1px solid #ECECF3',
                  borderRadius: 8,
                  fontFamily: 'ui-monospace, monospace',
                  fontSize: 13,
                  lineHeight: 1.5,
                  resize: 'vertical',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
                placeholder="在此编辑文件内容..."
              />
            ) : (
              <pre className="report-md" style={{ maxHeight: 220, overflow: 'auto' }}>{previewContent}</pre>
            )}
          </div>
        )}
        <div className="messages" ref={listRef}>
          {messages.map(m => (
            <div key={m.id} className={`msg ${m.role}`}>
              <div className="bubble">{m.content}</div>
            </div>
          ))}
          {isGeneratingPlan && (
            <div className="msg assistant">
              <div className="bubble">正在生成编辑方案...</div>
            </div>
          )}
          {editPlan && originalContent && (
            <div className="msg assistant" style={{ marginTop: 12 }}>
              <div className="bubble" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>编辑方案已生成，是否确认应用？</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => {
                      setEditPlan(null);
                      setOriginalContent(null);
                    }}
                    style={{
                      padding: '6px 12px',
                      borderRadius: 6,
                      border: '1px solid #ECECF3',
                      background: '#fff',
                      color: '#6b7280',
                      cursor: 'pointer',
                      fontSize: 14
                    }}
                  >
                    取消
                  </button>
                  <button
                    onClick={() => void applyEdit()}
                    disabled={isApplyingEdit}
                    style={{
                      padding: '6px 12px',
                      borderRadius: 6,
                      border: 'none',
                      background: '#6C63FF',
                      color: '#fff',
                      cursor: isApplyingEdit ? 'wait' : 'pointer',
                      fontSize: 14,
                      opacity: isApplyingEdit ? 0.6 : 1
                    }}
                  >
                    {isApplyingEdit ? '应用中...' : '确认更新'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
        <div style={{ padding: '0 12px 12px 12px' }}>
          <div
            style={{
              border: '1px solid #ECECF3',
              borderRadius: 16,
              background: '#fff',
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
              padding: 6
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px 6px 10px' }}>
              <textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder={'问问 小Q分析师'}
                style={{ flex: 1, height: 40, border: 'none', outline: 'none', fontSize: 14, resize: 'none', paddingTop: 10 }}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 10px 8px 10px' }}>
              <label
                title="添加文件"
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 14,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: '#F4F4FF',
                  color: '#6C63FF',
                  cursor: 'pointer'
                }}
              >
                <input type="file" onChange={e => onFilesSelected(e.target.files)} style={{ display: 'none' }} multiple />
                <span style={{ fontSize: 18, lineHeight: 1 }}>＋</span>
              </label>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#6B7280', fontSize: 14 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M4 6h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  <circle cx="12" cy="6" r="2" stroke="currentColor" strokeWidth="2" fill="white"/>
                  <path d="M14 12h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  <circle cx="12" cy="12" r="2" stroke="currentColor" strokeWidth="2" fill="white"/>
                  <path d="M4 18h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  <circle cx="12" cy="18" r="2" stroke="currentColor" strokeWidth="2" fill="white"/>
                </svg>
                <span>工具</span>
              </div>
              <div style={{ flex: 1 }} />
              <button 
                onClick={() => void send()} 
                disabled={isGeneratingPlan}
                style={{ 
                  padding: '8px 12px', 
                  borderRadius: 10, 
                  border: 'none', 
                  background: '#6C63FF', 
                  color: '#fff', 
                  cursor: isGeneratingPlan ? 'wait' : 'pointer',
                  opacity: isGeneratingPlan ? 0.6 : 1
                }}
              >
                {isGeneratingPlan ? '生成中...' : '发送'}
              </button>
            </div>
          </div>
          {uploadFiles.length > 0 && (
            <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {uploadFiles.map(f => (
                <div key={f.name} style={{ padding: '6px 10px', borderRadius: 999, background: '#F0F1FE', color: '#4E4EB7' }}>{f.name}</div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

