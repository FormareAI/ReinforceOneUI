import React, { useState, useEffect, useCallback, useRef } from 'react';
import { knowledgeAPI } from '../../services/knowledgeAPI';
import MarkdownRenderer from '../../components/Chat/MarkdownRenderer';
import { KnowledgeFile } from '../../types/knowledge';
import './KnowledgePage.css';

const KnowledgePage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [fileList, setFileList] = useState<KnowledgeFile[]>([]);
  const [allFileList, setAllFileList] = useState<KnowledgeFile[]>([]);
  const [displayedFileList, setDisplayedFileList] = useState<KnowledgeFile[]>([]);
  const [total, setTotal] = useState(0);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [currentPath, setCurrentPath] = useState<string>('');
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewTitle, setPreviewTitle] = useState('');
  const [previewContent, setPreviewContent] = useState('');
  const [previewFileDir, setPreviewFileDir] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'warning'; text: string } | null>(null);
  
  const [displayCount, setDisplayCount] = useState(20);
  const [hasMoreFiles, setHasMoreFiles] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const tableContainerRef = useRef<HTMLDivElement>(null);

  // 显示消息提示
  const showMessage = (type: 'success' | 'error' | 'warning', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  // 获取文档列表
  const fetchFileList = useCallback(async (prefix: string = '') => {
    try {
      setLoading(true);
      
      console.log('📂 获取文件列表，prefix:', prefix);
      const response = await knowledgeAPI.getFileList({
        prefix: prefix,
        delimiter: '/',
      });

      console.log('📂 文件列表响应:', response);

      if (response.success && response.data) {
        const files = response.data.files || [];
        const directories = response.data.directories || [];
        
        console.log('📂 文件数量:', files.length, '目录数量:', directories.length);
        
        // 直接使用返回的目录和文件，不需要过滤
        const allItems = [
          ...directories.map(dir => ({
            ...dir,
            size: 0,
            last_modified: 0,
            etag: '',
          })),
          ...files
        ];
        
        setAllFileList(allItems);
        setFileList(allItems);
        setTotal(allItems.length);
        
        const initialDisplayCount = Math.min(displayCount, allItems.length);
        setDisplayedFileList(allItems.slice(0, initialDisplayCount));
        setHasMoreFiles(allItems.length > initialDisplayCount);
      } else {
        console.error('❌ 获取文档列表失败:', response);
        showMessage('error', response.message || '获取文档列表失败');
        setAllFileList([]);
        setFileList([]);
      }
    } catch (error: any) {
      console.error('❌ 获取文档列表失败:', error);
      const errorMsg = error.response?.data?.message || error.message || '获取文档列表失败，请稍后重试';
      showMessage('error', errorMsg);
      setAllFileList([]);
      setFileList([]);
    } finally {
      setLoading(false);
    }
  }, [displayCount]);

  // 加载更多文件
  const loadMoreFiles = useCallback(() => {
    if (loadingMore || !hasMoreFiles) return;

    setLoadingMore(true);
    
    setTimeout(() => {
      const newDisplayCount = displayCount + 20;
      const newDisplayedList = fileList.slice(0, newDisplayCount);
      
      setDisplayedFileList(newDisplayedList);
      setDisplayCount(newDisplayCount);
      setHasMoreFiles(newDisplayedList.length < fileList.length);
      setLoadingMore(false);
    }, 300);
  }, [loadingMore, hasMoreFiles, displayCount, fileList]);

  // 初始加载
  useEffect(() => {
    fetchFileList();
  }, [fetchFileList]);

  // 滚动监听
  useEffect(() => {
    const container = tableContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      if (scrollTop + clientHeight >= scrollHeight - 10) {
        if (hasMoreFiles && !loadingMore) {
          loadMoreFiles();
        }
      }
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [hasMoreFiles, loadingMore, loadMoreFiles]);

  // 搜索处理
  const handleSearch = (value: string) => {
    setSearchKeyword(value);
    
    if (value.trim()) {
      const filtered = allFileList.filter(file => 
        file.key.toLowerCase().includes(value.toLowerCase())
      );
      setFileList(filtered);
      setTotal(filtered.length);
      
      const initialDisplayCount = Math.min(20, filtered.length);
      setDisplayedFileList(filtered.slice(0, initialDisplayCount));
      setDisplayCount(initialDisplayCount);
      setHasMoreFiles(filtered.length > initialDisplayCount);
    } else {
      setFileList(allFileList);
      setTotal(allFileList.length);
      
      const initialDisplayCount = Math.min(20, allFileList.length);
      setDisplayedFileList(allFileList.slice(0, initialDisplayCount));
      setDisplayCount(initialDisplayCount);
      setHasMoreFiles(allFileList.length > initialDisplayCount);
    }
  };

  // 刷新列表
  const handleRefresh = () => {
    fetchFileList(currentPath);
  };

  // 进入目录
  const handleEnterDirectory = (dirKey: string) => {
    const normalizedPath = dirKey.endsWith('/') ? dirKey : dirKey + '/';
    console.log('📁 进入目录:', { dirKey, normalizedPath });
    setCurrentPath(normalizedPath);
    setDisplayCount(20);
    setHasMoreFiles(false);
    setLoadingMore(false);
    fetchFileList(normalizedPath);
  };

  // 返回上一级
  const handleGoBack = () => {
    const pathWithoutTrailingSlash = currentPath.endsWith('/') 
      ? currentPath.slice(0, -1) 
      : currentPath;
    
    const lastSlashIndex = pathWithoutTrailingSlash.lastIndexOf('/');
    
    let newPath = '';
    if (lastSlashIndex >= 0) {
      newPath = pathWithoutTrailingSlash.substring(0, lastSlashIndex + 1);
    }
    
    setCurrentPath(newPath);
    setDisplayCount(20);
    setHasMoreFiles(false);
    setLoadingMore(false);
    fetchFileList(newPath);
  };

  // 导航到指定路径
  const navigateToPath = (path: string) => {
    const normalizedPath = path === '' ? '' : (path.endsWith('/') ? path : path + '/');
    setCurrentPath(normalizedPath);
    setDisplayCount(20);
    setHasMoreFiles(false);
    setLoadingMore(false);
    fetchFileList(normalizedPath);
  };

  // 获取面包屑路径数组
  const getBreadcrumbPaths = () => {
    if (!currentPath) return [];
    return currentPath.split('/').filter(Boolean);
  };

  // 判断是否为目录项
  const isDirectoryItem = (item: KnowledgeFile): boolean => {
    return item.type === 'directory';
  };

  // 删除文档
  const handleDelete = (file: KnowledgeFile) => {
    if (window.confirm(`确定要删除 "${file.key}" 吗？`)) {
      showMessage('warning', '删除功能待后端接口完善');
    }
  };

  // 下载文档
  const handleDownload = async (file: KnowledgeFile) => {
    try {
      setLoading(true);
      console.log('📥 准备下载文件:', { key: file.key, etag: file.etag });
      const response = await knowledgeAPI.downloadFile(file.key, file.etag);
      
      console.log('📥 下载接口响应:', response);
      
      if (response.success && response.data?.download_url) {
        window.open(response.data.download_url, '_blank');
        showMessage('success', '正在下载文件...');
      } else {
        console.error('❌ 获取下载链接失败:', response);
        showMessage('error', response.message || '获取下载链接失败');
      }
    } catch (error: any) {
      console.error('❌ 下载文件失败:', error);
      const errorMsg = error.response?.data?.message || error.message || '下载失败，请稍后重试';
      showMessage('error', errorMsg);
    } finally {
      setLoading(false);
    }
  };

  // 预览 Markdown
  const handlePreview = async (file: KnowledgeFile) => {
    const isMarkdown = file.key.toLowerCase().endsWith('.md');
    if (!isMarkdown) {
      return handleDownload(file);
    }

    try {
      setPreviewLoading(true);
      setPreviewVisible(true);
      const name = file.key.split('/').pop() || file.key;
      setPreviewTitle(name);
      const dir = file.key.includes('/') ? file.key.substring(0, file.key.lastIndexOf('/') + 1) : '';
      setPreviewFileDir(dir);

      const proxyResp = await knowledgeAPI.fetchFileContent({ etag: file.etag, key: file.key });
      if (proxyResp.success && proxyResp.data?.content) {
        setPreviewContent(proxyResp.data.content);
      } else {
        const dl = await knowledgeAPI.downloadFile(file.key, file.etag);
        if (dl.success && dl.data?.download_url) {
          window.open(dl.data.download_url, '_blank');
          setPreviewVisible(false);
        } else {
          showMessage('error', proxyResp.message || dl.message || '获取预览内容失败');
          setPreviewVisible(false);
        }
      }
    } catch (error: any) {
      console.error('❌ 预览失败:', error);
      try {
        const dl = await knowledgeAPI.downloadFile(file.key, file.etag);
        if (dl.success && dl.data?.download_url) {
          window.open(dl.data.download_url, '_blank');
        } else {
          showMessage('error', dl.message || '预览失败，请稍后重试');
        }
      } catch (e: any) {
        showMessage('error', e?.message || '预览失败，请稍后重试');
      }
      setPreviewVisible(false);
    } finally {
      setPreviewLoading(false);
    }
  };

  // 格式化文件大小
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  // 获取显示名称
  const getDisplayName = (fullPath: string, isDirectory: boolean) => {
    if (isDirectory) {
      const cleanPath = fullPath.endsWith('/') ? fullPath.slice(0, -1) : fullPath;
      return cleanPath.split('/').pop() || cleanPath;
    } else {
      const name = fullPath.split('/').pop() || fullPath;
      return name.toLowerCase().endsWith('.md') ? name.slice(0, -3) : name;
    }
  };

  // 获取文件扩展名
  const getFileExtension = (key: string): string => {
    return key.split('.').pop()?.toUpperCase() || '';
  };

  return (
    <div className="knowledge-page">
      {/* 消息提示 */}
      {message && (
        <div className={`message-toast message-${message.type}`}>
          {message.text}
        </div>
      )}

      {/* 标题栏 */}
      <div className="knowledge-header">
        <h2>量化知识库管理</h2>
      </div>

      {/* 搜索和筛选栏 */}
      <div className="knowledge-search">
        <div className="search-input-wrapper">
          <input
            type="text"
            className="search-input"
            placeholder="输入文件名关键词搜索"
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleSearch(searchKeyword);
              }
            }}
          />
          <button
            className="btn btn-primary"
            onClick={() => handleSearch(searchKeyword)}
            disabled={loading}
          >
            {loading ? '搜索中...' : '搜索'}
          </button>
          <button
            className="btn"
            onClick={handleRefresh}
            disabled={loading}
          >
            {loading ? '刷新中...' : '刷新'}
          </button>
          {searchKeyword && (
            <button
              className="btn"
              onClick={() => {
                setSearchKeyword('');
                handleSearch('');
              }}
            >
              清除搜索
            </button>
          )}
        </div>
      </div>

      {/* 路径导航栏 */}
      {!searchKeyword && (
        <div className="knowledge-nav">
          <button
            className="btn btn-small"
            onClick={handleGoBack}
            disabled={!currentPath}
          >
            ← 返回上一级
          </button>
          
          <div className="breadcrumb">
            <span
              className="breadcrumb-item"
              onClick={() => navigateToPath('')}
            >
              🏠 根目录
            </span>
            {getBreadcrumbPaths().map((part, index, arr) => {
              const path = arr.slice(0, index + 1).join('/');
              return (
                <React.Fragment key={index}>
                  <span className="breadcrumb-separator">/</span>
                  <span
                    className="breadcrumb-item"
                    onClick={() => navigateToPath(path)}
                  >
                    📁 {part}
                  </span>
                </React.Fragment>
              );
            })}
          </div>
        </div>
      )}

      {/* 搜索结果提示 */}
      {searchKeyword && (
        <div className="search-result-info">
          搜索结果：共找到 {total} 个匹配"{searchKeyword}"的文件（跨所有目录）
        </div>
      )}

      {/* 文件列表表格 */}
      <div className="knowledge-table-container" ref={tableContainerRef}>
        <table className="knowledge-table">
          <thead>
            <tr>
              <th style={{ width: '40%' }}>名称</th>
              <th style={{ width: '10%', textAlign: 'center' }}>类型</th>
              <th style={{ width: '12%', textAlign: 'right' }}>文件大小</th>
              <th style={{ width: '18%' }}>最后修改时间</th>
              <th style={{ width: '20%', textAlign: 'center' }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {displayedFileList.length === 0 && !loading ? (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', padding: '40px', color: 'var(--muted)' }}>
                  暂无文件
                </td>
              </tr>
            ) : (
              displayedFileList.map((item) => {
                const isDirectory = isDirectoryItem(item);
                const displayName = getDisplayName(item.key, isDirectory);
                
                return (
                  <tr key={item.key} className={isDirectory ? 'directory-row' : ''}>
                    <td>
                      <div
                        className="file-name"
                        onClick={() => isDirectory && handleEnterDirectory(item.key)}
                        style={{ cursor: isDirectory ? 'pointer' : 'default' }}
                      >
                        {isDirectory ? (
                          <>
                            <span className="icon-folder">📁</span>
                            <span className="name-text">{displayName}</span>
                          </>
                        ) : (
                          <>
                            <span className="icon-file">📄</span>
                            <span
                              className="name-text clickable"
                              onClick={(e) => {
                                e.stopPropagation();
                                const isMd = item.key.toLowerCase().endsWith('.md');
                                if (isMd) {
                                  handlePreview(item);
                                } else {
                                  handleDownload(item);
                                }
                              }}
                            >
                              {displayName}
                            </span>
                          </>
                        )}
                      </div>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {isDirectory ? (
                        <span className="tag tag-directory">目录</span>
                      ) : (
                        <span className="tag tag-file">{getFileExtension(item.key)}</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {isDirectory ? (
                        <span style={{ color: '#bfbfbf' }}>-</span>
                      ) : (
                        formatFileSize(item.size)
                      )}
                    </td>
                    <td>
                      {isDirectory ? (
                        <span style={{ color: '#bfbfbf' }}>-</span>
                      ) : (
                        new Date(item.last_modified * 1000).toLocaleString('zh-CN')
                      )}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {isDirectory ? (
                        <span style={{ color: '#bfbfbf' }}>-</span>
                      ) : (
                        <div className="action-buttons">
                          <button
                            className="btn-icon"
                            onClick={() => {
                              const isMd = item.key.toLowerCase().endsWith('.md');
                              if (isMd) {
                                handlePreview(item);
                              } else {
                                handleDownload(item);
                              }
                            }}
                            title="预览/下载"
                          >
                            👁️
                          </button>
                          <button
                            className="btn-icon btn-danger"
                            onClick={() => handleDelete(item)}
                            title="删除"
                          >
                            🗑️
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        {/* 加载更多提示 */}
        {hasMoreFiles && (
          <div className="table-footer">
            {loadingMore ? (
              <div>正在加载更多文件...</div>
            ) : (
              <div>
                显示 {displayedFileList.length} / {total} 个文件
                <br />
                <span style={{ fontSize: '12px' }}>滚动到底部加载更多</span>
              </div>
            )}
          </div>
        )}

        {!hasMoreFiles && displayedFileList.length > 0 && (
          <div className="table-footer">
            已显示全部 {total} 个文件
          </div>
        )}
      </div>

      {/* Markdown 预览弹窗 */}
      {previewVisible && (
        <div className="modal-overlay" onClick={() => setPreviewVisible(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{previewTitle}</h3>
              <button className="btn-icon" onClick={() => setPreviewVisible(false)}>✕</button>
            </div>
            <div className="modal-body">
              {previewLoading ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>加载中...</div>
              ) : (
                <MarkdownRenderer
                  content={previewContent}
                  currentFileDir={previewFileDir}
                  strictImageSource={false}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default KnowledgePage;
