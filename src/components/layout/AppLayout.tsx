import { Link, useLocation, useNavigate } from 'react-router-dom';
import { PropsWithChildren, useEffect, useMemo, useState } from 'react';
import { loadReports } from '../../lib/reports';
import { loadStrategies } from '../../lib/strategies';
import { loadFactors } from '../../lib/factors';

export function AppLayout({ children }: PropsWithChildren) {
  const location = useLocation();
  const pathname = location.pathname;
  const search = location.search;
  const navigate = useNavigate();

  const reports = useMemo(() => loadReports(), []);
  const strategies = useMemo(() => loadStrategies(), []);
  const factors = useMemo(() => loadFactors(), []);

  const [openKey, setOpenKey] = useState<'reports' | 'strategies' | 'factors' | null>('reports');

  // 当展开某个分组时，导航到对应的默认页面
  useEffect(() => {
    if (openKey === null) return; // 折叠时不自动导航
    const qp = new URLSearchParams(search);
    if (qp.get('new') === '1') return; // new=1 模式下不做自动跳转
    if (openKey === 'reports') {
      const first = reports[0];
      if (first) {
        navigate(`/reports?r=${first.slug}`, { replace: pathname.startsWith('/reports') });
      } else {
        navigate('/reports', { replace: pathname.startsWith('/reports') });
      }
    } else if (openKey === 'strategies') {
      const first = strategies[0];
      if (first) {
        navigate(`/strategies?s=${first.slug}`, { replace: pathname.startsWith('/strategies') });
      } else {
        navigate('/strategies', { replace: pathname.startsWith('/strategies') });
      }
    } else if (openKey === 'factors') {
      const first = factors[0];
      if (first) {
        navigate(`/factors?f=${first.slug}`, { replace: pathname.startsWith('/factors') });
      } else {
        navigate('/factors', { replace: pathname.startsWith('/factors') });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openKey]);

  // 初始进入时，如果没有 r 参数，则默认跳到第一个报告
  useEffect(() => {
    if (pathname.startsWith('/reports')) {
      const params = new URLSearchParams(search);
      const hasR = params.has('r');
      const isNew = params.get('new') === '1';
      if (!isNew && !hasR && reports[0]) {
        navigate(`/reports?r=${reports[0].slug}`, { replace: true });
      }
      setOpenKey('reports');
    } else if (pathname.startsWith('/strategies')) {
      setOpenKey('strategies');
    } else if (pathname.startsWith('/factors')) {
      setOpenKey('factors');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function Chevron({ down }: { down: boolean }) {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ opacity: 0.8 }}
      >
        {down ? (
          // chevron-down
          <polyline points="6 9 12 15 18 9"></polyline>
        ) : (
          // chevron-up
          <polyline points="18 15 12 9 6 15"></polyline>
        )}
      </svg>
    );
  }

  return (
    <div className="app-root layout-side">
      <aside className="side">
        <div className="side-top">
        <div className="logo">AIQuant</div>
          <div className="side-title">导航</div>
          <div style={{ padding: '10px 8px 6px 8px' }}>
            <button
              onClick={() => { setOpenKey('reports'); navigate('/reports?new=1'); }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 14px',
                borderRadius: 999,
                border: 'none',
                background: '#6C63FF',
                color: '#fff',
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(108,99,255,0.3)'
              }}
              title="新增分析"
            >
              <span style={{ fontSize: 18, lineHeight: 0 }}>＋</span>
              <span>新建分析</span>
            </button>
          </div>
          <nav className="side-nav">
            <a
              className={`nav-toggle ${openKey === 'reports' ? 'active' : ''}`}
              href="#"
              onClick={(e) => { e.preventDefault(); setOpenKey(prev => (prev === 'reports' ? null : 'reports')); }}
            >
              <span>01. 量化分析报告</span>
              <Chevron down={openKey === 'reports'} />
            </a>
            {openKey === 'reports' && reports.length > 0 && (
              <div className="side-submenu">
                {reports.map(r => (
                  <Link key={r.slug} className="side-submenu-item" to={`/reports?r=${r.slug}`}>{r.title}</Link>
                ))}
              </div>
            )}
          <a
            className={`nav-toggle ${openKey === 'strategies' ? 'active' : ''}`}
            href="#"
            onClick={(e) => { e.preventDefault(); setOpenKey(prev => (prev === 'strategies' ? null : 'strategies')); }}
          >
            <span>02. 策略与回测</span>
            <Chevron down={openKey === 'strategies'} />
          </a>
          {openKey === 'strategies' && strategies.length > 0 && (
              <div className="side-submenu">
                {strategies.map(s => (
                  <Link key={s.slug} className="side-submenu-item" to={`/strategies?s=${s.slug}`}>{s.title}</Link>
                ))}
              </div>
            )}
          <a
            className={`nav-toggle ${openKey === 'factors' ? 'active' : ''}`}
            href="#"
            onClick={(e) => { e.preventDefault(); setOpenKey(prev => (prev === 'factors' ? null : 'factors')); }}
          >
            <span>03. 因子与评价</span>
            <Chevron down={openKey === 'factors'} />
          </a>
          {openKey === 'factors' && factors.length > 0 && (
              <div className="side-submenu">
                {factors.map(f => (
                  <Link key={f.slug} className="side-submenu-item" to={`/factors?f=${f.slug}`}>{f.title}</Link>
                ))}
              </div>
            )}
          <div className="side-sep" />
          <Link className={pathname.startsWith('/knowledge') ? 'active' : ''} to="/knowledge">量化知识库</Link>
        </nav>
        </div>
        <div className="side-footer">
          <Link to="/settings" className="toolbar-item" data-tip="设置">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 7h-9"></path><path d="M14 17H5"></path><circle cx="17" cy="17" r="3"></circle><circle cx="7" cy="7" r="3"></circle></svg>
          </Link>
          <Link to="/tasks" className="toolbar-item" data-tip="任务">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="none" width="20" height="20"><path d="M13.3574 13.3291C14.6331 12.6198 15.6295 11.5263 16.1923 10.2181C16.7551 8.90992 16.8528 7.46002 16.4704 6.09308C16.0879 4.72614 15.2466 3.51847 14.0768 2.65719C12.907 1.79591 11.474 1.3291 9.9998 1.3291C8.52566 1.3291 7.09266 1.79591 5.92284 2.65719C4.75303 3.51847 3.91171 4.72614 3.52924 6.09308C3.14677 7.46002 3.2445 8.90992 3.8073 10.2181C4.37009 11.5263 5.36653 12.6198 6.64221 13.3291" stroke="currentColor" strokeWidth="1.67" strokeLinecap="round" strokeLinejoin="round"></path><path d="M11.6998 18.7C10.5696 18.8183 9.43005 18.8183 8.2998 18.7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"></path><path d="M12.1998 16.2C10.746 16.4751 9.25357 16.4751 7.7998 16.2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"></path><path d="M10.5388 5.5L9.01779 7.195C8.97045 7.24796 8.93807 7.31258 8.92397 7.3822C8.90987 7.45183 8.91457 7.52395 8.93759 7.59116C8.9606 7.65836 9.0011 7.71823 9.05491 7.7646C9.10873 7.81097 9.17392 7.84217 9.24379 7.855L10.7318 8.126C10.8055 8.13937 10.874 8.17318 10.9295 8.22359C10.9849 8.27399 11.0251 8.33896 11.0454 8.41109C11.0658 8.48322 11.0654 8.55961 11.0444 8.63155C11.0235 8.7035 10.9827 8.7681 10.9268 8.818L9.03879 10.5" stroke="currentColor" strokeWidth="1.67" strokeLinecap="round" strokeLinejoin="round"></path></svg>
          </Link>
          <Link to="/data" className="toolbar-item" data-tip="数据">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"></path><path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path></svg>
          </Link>
          <Link to="/users" className="toolbar-item" data-tip="用户">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><path d="M12 17h.01"></path></svg>
          </Link>
          <Link to="/system" className="toolbar-item" data-tip="系统">
            <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" width="20" height="20"><g><path fillRule="evenodd" clipRule="evenodd" d="M6.80187 0.833985H13.1994C13.6387 0.83397 14.0177 0.833957 14.3298 0.85946C14.6593 0.886378 14.987 0.945808 15.3023 1.10647C15.7727 1.34615 16.1552 1.7286 16.3948 2.19901C16.5555 2.51433 16.6149 2.84201 16.6418 3.17146C16.6673 3.48361 16.6673 3.86259 16.6673 4.30188V15.6994C16.6673 16.1387 16.6673 16.5177 16.6418 16.8298C16.6149 17.1593 16.5555 17.487 16.3948 17.8023C16.1552 18.2727 15.7727 18.6552 15.3023 18.8948C14.987 19.0555 14.6593 19.1149 14.3298 19.1418C14.0177 19.1673 13.6387 19.1673 13.1995 19.1673H6.80185C6.36256 19.1673 5.9836 19.1673 5.67146 19.1418C5.34201 19.1149 5.01433 19.0555 4.69901 18.8948C4.22861 18.6552 3.84615 18.2727 3.60647 17.8023C3.44581 17.487 3.38638 17.1593 3.35946 16.8298C3.33396 16.5177 3.33397 16.1387 3.33399 15.6994V4.30187C3.33397 3.86258 3.33396 3.48361 3.35946 3.17146C3.38638 2.84201 3.44581 2.51433 3.60647 2.19901C3.84615 1.7286 4.2286 1.34615 4.69901 1.10647C5.01433 0.945808 5.34201 0.886378 5.67146 0.85946C5.98361 0.833957 6.36257 0.83397 6.80187 0.833985ZM6.66732 15.834C6.66732 15.3737 7.04042 15.0007 7.50065 15.0007H12.5007C12.9609 15.0007 13.334 15.3737 13.334 15.834C13.334 16.2942 12.9609 16.6673 12.5007 16.6673H7.50065C7.04042 16.6673 6.66732 16.2942 6.66732 15.834Z" fill="currentColor"></path></g></svg>
          </Link>
        </div>
      </aside>
      <main className="app-main">
        {children}
      </main>
    </div>
  );
}


