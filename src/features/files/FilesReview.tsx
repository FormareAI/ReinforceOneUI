import { useMemo, useState } from 'react';

type ReviewFile = {
  path: string;
  status: 'pending' | 'accepted' | 'rejected';
};

export function FilesReview() {
  const [files, setFiles] = useState<ReviewFile[]>([
    { path: 'src/components/Button.tsx', status: 'pending' },
    { path: 'src/features/reports/ReportsPage.tsx', status: 'pending' }
  ]);

  function updateStatus(path: string, status: ReviewFile['status']) {
    setFiles(prev => prev.map(f => (f.path === path ? { ...f, status } : f)));
  }

  const counts = useMemo(() => {
    return files.reduce(
      (acc, f) => {
        acc[f.status] += 1;
        return acc;
      },
      { pending: 0, accepted: 0, rejected: 0 }
    );
  }, [files]);

  return (
    <div className="files-page">
      <div className="toolbar">
        <div className="pill-edit" title="工作区操作">
          <div className="icon">
            {/* inline SVG edit icon */}
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
          <div className="text" title="在此接受或拒绝文件">
            <span className="label">工作区</span>
            <span className="path">Accept Files / Reject Files</span>
          </div>
        </div>
        <div>待处理：{counts.pending} 已接受：{counts.accepted} 已拒绝：{counts.rejected}</div>
      </div>
      <div className="files-list">
        {files.map(file => (
          <div key={file.path} className="file-item">
            <div className="path">{file.path}</div>
            <div className="actions">
              <button className="accept" onClick={() => updateStatus(file.path, 'accepted')}>接受</button>
              <button className="reject" onClick={() => updateStatus(file.path, 'rejected')}>拒绝</button>
            </div>
            <div className={`status ${file.status}`}>{file.status}</div>
          </div>
        ))}
      </div>
    </div>
  );
}


