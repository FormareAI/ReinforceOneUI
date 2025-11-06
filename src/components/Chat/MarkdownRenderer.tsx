import React from 'react';

interface MarkdownRendererProps {
  content: string;
  currentFileDir?: string;
  strictImageSource?: boolean;
}

const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, currentFileDir, strictImageSource = false }) => {
  // 简单的 Markdown 渲染器
  // 可以后续使用 react-markdown 等库来完善
  const renderMarkdown = (text: string) => {
    if (!text) return null;

    // 简单的 Markdown 转 HTML（改进版本，支持代码块语言标识符）
    let html = text;
    
    // 先处理代码块（需要在其他替换之前，避免影响代码内容）
    // 支持带语言标识符的代码块：```python\ncode\n``` 或 ```\ncode\n```
    const codeBlockPlaceholder = '___CODE_BLOCK_PLACEHOLDER___';
    const codeBlocks: string[] = [];
    let codeBlockIndex = 0;
    
    // 匹配代码块：```语言标识符（可选）\n代码内容\n```
    html = html.replace(/```(\w+)?\s*\n([\s\S]*?)```/gim, (match, lang, code) => {
      const language = lang ? lang.trim() : '';
      const codeContent = code.trim();
      // 转义 HTML 特殊字符
      const escapedCode = codeContent
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
      const placeholder = `${codeBlockPlaceholder}${codeBlockIndex}`;
      codeBlocks.push(`<pre><code${language ? ` class="language-${language}" data-lang="${language}"` : ''}>${escapedCode}</code></pre>`);
      codeBlockIndex++;
      return placeholder;
    });
    
    // 处理其他 Markdown 语法
    html = html
      // 标题
      .replace(/^### (.*$)/gim, '<h3>$1</h3>')
      .replace(/^## (.*$)/gim, '<h2>$1</h2>')
      .replace(/^# (.*$)/gim, '<h1>$1</h1>')
      // 粗体
      .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
      // 斜体（避免匹配粗体，使用更简单的模式）
      .replace(/(?:\*)([^*\n]+?)(?:\*)(?!\*)/gim, '<em>$1</em>')
      // 行内代码（避免匹配代码块占位符）
      .replace(/`([^`\n]+)`/gim, '<code>$1</code>')
      // 链接
      .replace(/\[([^\]]+)\]\(([^)]+)\)/gim, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
      // 图片
      .replace(/!\[([^\]]*)\]\(([^)]+)\)/gim, (match, alt, src) => {
        // 处理相对路径
        let imageSrc = src;
        if (currentFileDir && !src.startsWith('http') && !src.startsWith('/')) {
          imageSrc = `${currentFileDir}${src}`;
        }
        return `<img src="${imageSrc}" alt="${alt || ''}" style="max-width: 100%;" />`;
      })
      // 列表（无序列表）
      .replace(/^[\*\-]\s+(.*$)/gim, '<li>$1</li>')
      // 列表（有序列表）
      .replace(/^\d+\.\s+(.*$)/gim, '<li>$1</li>')
      // 换行（但避免在代码块占位符附近替换）
      .replace(/\n/gim, '<br />');
    
    // 包装列表项
    html = html.replace(/(<li>.*?<\/li>)/gim, '<ul>$1</ul>');
    
    // 恢复代码块
    codeBlocks.forEach((codeBlock, index) => {
      html = html.replace(`${codeBlockPlaceholder}${index}`, codeBlock);
    });

    return html;
  };

  // 注入代码块样式（只在客户端执行）
  React.useEffect(() => {
    if (typeof document !== 'undefined') {
      const styleId = 'markdown-renderer-styles';
      if (!document.getElementById(styleId)) {
        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
          .markdown-content pre {
            background: #f5f5f5;
            border: 1px solid #e0e0e0;
            border-radius: 6px;
            padding: 12px 16px;
            overflow-x: auto;
            margin: 16px 0;
            font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
            font-size: 13px;
            line-height: 1.6;
          }
          .markdown-content pre code {
            background: transparent;
            border: none;
            padding: 0;
            font-size: inherit;
            color: #333;
            white-space: pre;
          }
          .markdown-content code {
            background: #f0f0f0;
            border: 1px solid #e0e0e0;
            border-radius: 3px;
            padding: 2px 6px;
            font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
            font-size: 0.9em;
            color: #d63384;
          }
          .markdown-content h1, .markdown-content h2, .markdown-content h3 {
            margin-top: 24px;
            margin-bottom: 12px;
            font-weight: 600;
          }
          .markdown-content h1 { font-size: 24px; }
          .markdown-content h2 { font-size: 20px; }
          .markdown-content h3 { font-size: 18px; }
          .markdown-content ul, .markdown-content ol {
            margin: 6px 0;
            padding-left: 24px;
          }
          .markdown-content li {
            margin: 0;
            line-height: 1.5;
          }
        `;
        document.head.appendChild(style);
      }
    }
  }, []);

  return (
    <div
      className="markdown-content"
      style={{
        fontSize: '14px',
        lineHeight: '1.8',
        color: '#333',
      }}
      dangerouslySetInnerHTML={{ __html: renderMarkdown(content) || '' }}
    />
  );
};

export default MarkdownRenderer;

