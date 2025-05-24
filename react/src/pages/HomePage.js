import React from 'react';
import { useNavigate } from 'react-router-dom';

function HomePage() {
  const navigate = useNavigate();

  const handleIntelligentQA = () => {
    navigate('/intelligent-qa');
  };

  const handleRoutePlanner = () => {
    navigate('/route-planner');
  };

  return (
    <div style={{ position: 'relative', minHeight: '100vh' }}>
      {/* 背景图片 */}
      <div style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', zIndex: 0 }}>
        <img 
          src="./home.png" 
          alt="背景" 
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
        <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.1)' }}></div>
      </div>
      
      {/* 内容区域 */}
      <div style={{ 
        position: 'absolute',
        zIndex: 10,
        bottom: '30vh',
        left: '25vw',
        padding: '0 1rem'
      }}>
        <div style={{ 
          display: 'flex',
          flexDirection: 'row',
          justifyContent: 'center',
          gap: '8rem',
          width: '100%',
          maxWidth: '600px'        
        }}>
          <button
            onClick={handleIntelligentQA}
            style={{ 
              backgroundColor: '#FF8B4D', 
              color: 'white', 
              padding: '1.2rem 2.5rem', 
              borderRadius: '0.8rem',
              flex: 'none',
              fontSize: '1.2rem',
              fontWeight: '600',
              transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
              boxShadow: '0 6px 12px rgba(255, 139, 77, 0.2)',
              border: 'none',
              cursor: 'pointer'
            }}
          >
            <span style={{ marginRight: '0.5rem' }}>🤖</span>
            智能问答
          </button>
          
          <button
            onClick={handleRoutePlanner}
            style={{ 
              backgroundColor: 'white', 
              color: '#FF8B4D', 
              padding: '1.2rem 2.5rem', 
              borderRadius: '0.8rem',
              flex: 'none',
              fontSize: '1.2rem',
              fontWeight: '600',
              border: '2px solid #FF8B4D',
              transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
              boxShadow: '0 6px 12px rgba(255, 139, 77, 0.1)',
              cursor: 'pointer'
            }}
          >
            <span style={{ marginRight: '0.5rem' }}>🗺️</span>
            研学剧本设计
          </button>
        </div>
      </div>
    </div>
  );
}

export default HomePage;