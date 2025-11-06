import { Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';
import { ReportsPage } from './features/reports/ReportsPage';
import { StrategiesPage } from './features/strategies/StrategiesPage';
import { FactorsPage } from './features/factors/FactorsPage';
import KnowledgePage from './features/knowledge/KnowledgePage';

export default function App() {
  return (
    <AppLayout>
      <Routes>
        <Route path="/" element={<Navigate to="/reports" replace />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/strategies" element={<StrategiesPage />} />
        <Route path="/factors" element={<FactorsPage />} />
        <Route path="/knowledge" element={<KnowledgePage />} />
        <Route path="*" element={<div style={{ padding: 24 }}>未找到页面</div>} />
      </Routes>
    </AppLayout>
  );
}


