import { Link, useSearchParams } from 'react-router-dom';
import { getFactorBySlug, loadFactors } from '../../lib/factors';
import { useEffect, useMemo, useRef, useState } from 'react';

type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
};

export function FactorsPage() {
  const [sp] = useSearchParams();
  const slug = sp.get('f') ?? undefined;
  const list = useMemo(() => loadFactors(), []);
  const current = useMemo(() => getFactorBySlug(slug), [slug]);

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const listRef = useRef<HTMLDivElement | null>(null);
  const [previewPath, setPreviewPath] = useState<string | undefined>(undefined);
  const [previewContent, setPreviewContent] = useState<string | undefined>(undefined);
  const [previewIsHtml, setPreviewIsHtml] = useState<boolean>(false);
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages]);

  async function send() {
    const text = input.trim();
    if (!text) return;
    const userMessage: Message = { id: crypto.randomUUID(), role: 'user', content: text };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    const assistantMessage: Message = { id: crypto.randomUUID(), role: 'assistant', content: `收到：${text}` };
    setMessages(prev => [...prev, assistantMessage]);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  }

  function onFilesSelected(files: FileList | null) {
    if (!files) return;
    const arr = Array.from(files);
    setUploadFiles(arr);
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

  async function openWorkspaceFile(filename: string, fallbackLine: string) {
    const slugName = current?.slug ?? 'factor';
    // 统一使用 slug 路径结构：/workspace/factors/{slug}/{filename}
    const url = `/workspace/factors/${slugName}/${filename}`;
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

  return (
    <div className="assistant-page assistant-split">
      <div className="work-area">
        {list.length > 0 && (
          <div className="reports-submenu">
            <div className="submenu-title">因子列表</div>
            <div className="submenu-list">
              {list.map(item => (
                <Link key={item.slug} className={`submenu-item ${item.slug === current?.slug ? 'active' : ''}`} to={`/factors?f=${item.slug}`}>{item.title}</Link>
              ))}
            </div>
          </div>
        )}
        {current && (
          <div className="report-view">
            <h3 style={{ marginBottom: 8 }}>{current.title}</h3>
            <div className="report-md">
              {current.content.split(/\r?\n/).map((line, idx) => {
                const isSticker = line.trim().startsWith('正在');
                if (!isSticker) {
                  return (<div key={idx}>{line}</div>);
                }
                const file = extractFilename(line) ?? 'factors.py';
                return (
                  <a key={idx} className="pill-edit" title={line} onClick={(e) => { e.preventDefault(); void openWorkspaceFile(file, line); }} href="#">
                    <div className="icon">
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 18 18" fill="none" style={{ minHeight: 20, minWidth: 20 }}>
                        <g filter="url(#filter0_ii)"><path d="M2 4.7C2 3.20883 3.20883 2 4.7 2H13.3C14.7912 2 16 3.20883 16 4.7V13.3C16 14.7912 14.7912 16 13.3 16H4.7C3.20883 16 2 14.7912 2 13.3V4.7Z" fill="url(#grad0)"></path></g>
                        <path d="M2.42857 4.7C2.42857 3.44552 3.44552 2.42857 4.7 2.42857H13.3C14.5545 2.42857 15.5714 3.44552 15.5714 4.7V13.3C15.5714 14.5545 14.5545 15.5714 13.3 15.5714H4.7C3.44552 15.5714 2.42857 14.5545 2.42857 13.3V4.7Z" stroke="#B9B9B7" strokeWidth="0.857143"></path>
                        <path d="M9.24211 5.70711C9.63264 5.31658 10.2658 5.31658 10.6563 5.70711C11.0468 6.09763 11.0468 6.7308 10.6563 7.12132L7.12079 10.6569H5.70658V9.24264L9.24211 5.70711Z" stroke="#535350" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"></path>
                        <path d="M8 12H12" stroke="#535350" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"></path>
                        <defs>
                          <filter id="filter0_ii" x="1.5" y="1.5" width="15" height="15" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
                            <feFlood floodOpacity="0" result="BackgroundImageFix"></feFlood>
                            <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape"></feBlend>
                            <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha"></feColorMatrix>
                            <feOffset dx="1" dy="1"></feOffset>
                            <feGaussianBlur stdDeviation="0.25"></feGaussianBlur>
                            <feComposite in2="hardAlpha" operator="arithmetic" k2="-1" k3="1"></feComposite>
                            <feColorMatrix type="matrix" values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.6 0"></feColorMatrix>
                            <feBlend mode="normal" in2="shape" result="effect1_innerShadow"></feBlend>
                            <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha2"></feColorMatrix>
                            <feOffset dx="-1" dy="-1"></feOffset>
                            <feGaussianBlur stdDeviation="0.25"></feGaussianBlur>
                            <feComposite in2="hardAlpha2" operator="arithmetic" k2="-1" k3="1"></feComposite>
                            <feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.08 0"></feColorMatrix>
                            <feBlend mode="normal" in2="effect1_innerShadow" result="effect2_innerShadow"></feBlend>
                          </filter>
                          <linearGradient id="grad0" x1="9" y1="2" x2="9" y2="16" gradientUnits="userSpaceOnUse">
                            <stop stopColor="white" stopOpacity="0"></stop>
                            <stop offset="1" stopOpacity="0.16"></stop>
                          </linearGradient>
                        </defs>
                      </svg>
                    </div>
                    <div className="text"><span className="label">{line}</span></div>
                  </a>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="chat-panel">
        {previewPath && (
          <div className="report-view" style={{ margin: 12 }}>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>预览：{previewPath}</div>
            {previewIsHtml ? (
              <div className="report-md" style={{ maxHeight: 220, overflow: 'auto' }} dangerouslySetInnerHTML={{ __html: previewContent ?? '' }} />
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
  );
}


