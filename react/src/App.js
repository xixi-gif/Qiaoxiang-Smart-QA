import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import IntelligentQAPage from './pages/IntelligentQAPage'; 
import RoutePlannerPage from './pages/RoutePlannerPage'; 

function App() {
  return (
    <Router>
      <div>
        {/* 路由配置 */}
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/intelligent-qa" element={<IntelligentQAPage />} />
          <Route path="/route-planner" element={<RoutePlannerPage />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;