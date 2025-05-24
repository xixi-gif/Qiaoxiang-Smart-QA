// ImmersiveStudyScriptPage.jsx
import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { 
  ROLE_LIBRARY, 
  ROLE_DESCRIPTIONS, 
  ROLE_RESPONSIBILITIES,
  DEFAULT_SCRIPT
} from './data';

const ImmersiveStudyScriptPage = () => {
  const [scenarios, setScenarios] = useState([
    {
      role: 'system',
      content: `欢迎来到成田镇沉浸式研学加工厂，快来定制属于你的沉浸式研学剧本吧`
    },
  ]);
  
  const [userPrompt, setUserPrompt] = useState('设计一个适合14-16岁中学生的成田镇沉浸式研学剧本，主人公为4人研学小组，包含侨批馆探秘、嵌瓷工坊体验、潮剧社互动三条主线任务');
  const [isGenerating, setIsGenerating] = useState(false);
  const [scriptError, setScriptError] = useState('');
  const scenariosEndRef = useRef(null);

  const KIMI_API_KEY = process.env.REACT_APP_KIMI_API_KEY || '';

  // 从用户提示中提取人数需求
  const extractParticipantCount = (prompt) => {
    const match = prompt.match(/(\d+)\s*人/);
    return match ? parseInt(match[1]) : 4;
  };

  // 生成角色列表
  const generateRoleList = (count) => {
    if (count <= 0) return '';
    if (count > ROLE_LIBRARY.length) {
      // 超过预设角色库，补充编号角色
      const baseRoles = ROLE_LIBRARY.slice(0, ROLE_LIBRARY.length);
      const extraRoles = Array.from({length: count - ROLE_LIBRARY.length}, (_, i) => `成员${i+1}`);
      return [...baseRoles, ...extraRoles].join('、');
    }
    return ROLE_LIBRARY.slice(0, count).join('、');
  };

  const scrollToEnd = () => {
    scenariosEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  };

  useEffect(scrollToEnd, [scenarios]);

  // 增强提示词，引导AI生成完整剧本
  const buildEnhancedPrompt = (userPrompt) => {
    const participantCount = extractParticipantCount(userPrompt);
    return `
      ${userPrompt}。请确保团队规模为${participantCount}人，并为每位成员分配明确角色。
      请生成完整的沉浸式研学剧本，包含以下要素：
      1. 完整剧情：包含背景故事、主要任务、分阶段剧情发展
      2. 详细角色：研学小组各角色及关键NPC的姓名、性格、职责
      3. 丰富对话：至少8组角色间的对话，展现剧情发展
      4. 互动任务：各场景的具体任务和互动环节
      5. 知识讲解：融入潮汕文化知识点，特别是成田镇特色
      6. 线索设计：隐藏线索和最终解密环节
      7. 总字数控制在800字左右，语言生动，适合14-16岁中学生阅读和表演。
      返回格式：严格遵循JSON结构，使用中文标点。
      `;
  };

  const handleScriptGenerate = async () => {
    if (!userPrompt.trim()) return;

    setIsGenerating(true);
    setScriptError('');
    
    const userMessage = { role: 'user', content: userPrompt };
    setScenarios(prev => [...prev, userMessage]);
    const currentPrompts = [...scenarios, userMessage];
    setUserPrompt('');

    try {
      if (!KIMI_API_KEY) throw new Error('请先配置剧本生成API密钥');

      // 构建增强提示词
      const enhancedPrompt = buildEnhancedPrompt(userPrompt);

      const response = await axios.post(
        'https://api.moonshot.cn/v1/chat/completions',
        {
          model: 'moonshot-v1-8k',
          messages: [...currentPrompts.slice(0, -1), {role: 'user', content: enhancedPrompt}],
          temperature: 0.5, // 降低随机性，提高指令遵循度
          max_tokens: 4000,
          top_p: 0.8,
          frequency_penalty: 0.1,
          presence_penalty: 0.1
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${KIMI_API_KEY}`
          }
        }
      );

      const aiResponse = response.data.choices?.[0]?.message?.content;
      
      if (!aiResponse || !aiResponse.trim()) {
        throw new Error('AI返回内容为空，请调整提示词后重试');
      }

      let parsedScript;
      try {
        parsedScript = JSON.parse(aiResponse);
        
        // 数据校验和修正
        if (!Array.isArray(parsedScript.scenarios) || parsedScript.scenarios.length === 0) {
          throw new Error('无效的剧本结构，缺少场景数据');
        }
        
        // 确保每个场景包含足够的角色信息
        parsedScript.scenarios = parsedScript.scenarios.map(scene => {
          // 检查并补充角色身份
          const participantCount = extractParticipantCount(userPrompt);
          const roleList = generateRoleList(participantCount);
          
          if (!scene.role || !scene.role.includes('研学小组')) {
            scene.role = `研学小组（${roleList}）`;
          }
          
          // 确保核心任务存在且格式正确
          if (!scene.mainTask || typeof scene.mainTask !== 'string') {
            scene.mainTask = `任务1：小组协作完成${scene.sceneName}探索\n任务2：根据角色分工收集线索`;
          }
          
          // 确保对话存在
          if (!scene.dialogues || scene.dialogues.length === 0) {
            scene.dialogues = [
              "组长：大家注意分工，保持团队协作",
              "记录员：我负责记录重要信息",
              "摄影师：这个场景很有特色，我要多拍几张"
            ];
          }
          
          return scene;
        });
        
      } catch (parseError) {
        console.warn('剧本JSON解析失败，使用默认结构', parseError);
        
        // 使用默认剧本结构
        const participantCount = extractParticipantCount(userPrompt);
        const roleList = generateRoleList(participantCount);
        
        // 克隆默认剧本并更新角色信息
        parsedScript = {
          ...DEFAULT_SCRIPT,
          mainCharacters: `研学小组（${roleList}）`,
          scenarios: DEFAULT_SCRIPT.scenarios.map(scene => ({
            ...scene,
            role: `研学小组（${roleList}），${scene.role.split('，')[1]}`
          }))
        };
      }

      setScenarios(prev => [...prev, { 
        role: 'assistant', 
        content: parsedScript
      }]);

    } catch (error) {
      console.error('剧本生成错误:', error);
      const errorMsg = error.response?.data?.error?.message || 
                      '生成失败，请检查提示词是否包含人数/时间/场景等关键信息';
      setScriptError(errorMsg);
      setScenarios(prev => [...prev, { 
        role: 'assistant', 
        content: { scenarios: [{ sceneName: '生成错误', content: errorMsg }] }
      }]);
    } finally {
      setIsGenerating(false);
    }
  };

  // 优化后的剧本格式化函数
  const formatScriptContent = (script) => {
    let formattedContent = '';
    
    // 添加剧本标题和背景
    formattedContent += `# ${script.title}\n\n`;
    
    // 添加角色介绍
    formattedContent += `## 角色介绍\n\n`;
    
    // 提取并解析角色信息
    const roleInfo = script.mainCharacters || script.scenarios[0]?.role || '';
    const roles = roleInfo.replace('研学小组（', '').replace('）', '').split('、');
    
    roles.forEach((role, idx) => {
      formattedContent += `### ${idx + 1}. ${role}\n`;
      formattedContent += `- **角色特点**：${ROLE_DESCRIPTIONS[role] || "积极参与团队活动，发挥重要作用"}\n`;
      formattedContent += `- **主要职责**：${ROLE_RESPONSIBILITIES[role] || "根据团队需要，承担相应工作"}\n\n`;
    });
    
    // 添加故事线引言
    formattedContent += `## 故事线引言\n\n`;
    formattedContent += `${script.background || "在汕头市成田镇，一场关于潮汕传统文化的探秘之旅即将展开..."} \n\n`;
    
    // 添加主要任务
    formattedContent += `### 主要任务\n`;
    formattedContent += `${script.mainQuest || "完成侨批馆探秘、嵌瓷工坊体验、潮剧社互动三大主线任务，揭开成田镇文化密码"}\n\n`;
    
    // 添加每个章节（场景）
    script.scenarios.forEach((scene, index) => {
      formattedContent += `# 第${index + 1}章：${scene.sceneName}\n`;
      formattedContent += `**时间**：${scene.timeSetting}\n\n`;
      
      // 添加场景概述
      formattedContent += `## 场景概述\n`;
      formattedContent += `研学小组来到${scene.sceneName.replace('成田镇', '')}，在这里他们将展开一系列的探索和体验活动...\n\n`;
      
      // 添加核心任务
      formattedContent += `## 核心任务\n`;
      scene.mainTask.split('\n').forEach((task, idx) => {
        formattedContent += `${idx + 1}. ${task.trim()}\n`;
      });
      formattedContent += '\n';
      
      // 添加主要情节发展
      formattedContent += `## 情节发展\n`;
      
      // 从对话中提取关键情节
      const keyEvents = scene.dialogues?.map(dialogue => {
        const parts = dialogue.split('：');
        return `${parts[0]}说："${parts[1]}"`;
      }) || [];
      
      keyEvents.forEach((event, idx) => {
        formattedContent += `${idx + 1}. ${event}\n`;
      });
      formattedContent += '\n';
      
      // 添加发现的线索
      if (scene.clues && scene.clues.length > 0) {
        formattedContent += `## 重要发现\n`;
        scene.clues.forEach((clue, idx) => {
          formattedContent += `${idx + 1}. 发现线索：${clue}\n`;
        });
        formattedContent += '\n';
      }
      
      // 添加知识讲解
      if (scene.knowledgePoints && scene.knowledgePoints.length > 0) {
        formattedContent += `## 文化课堂\n`;
        scene.knowledgePoints.forEach((point, idx) => {
          formattedContent += `${idx + 1}. ${point}\n`;
        });
        formattedContent += '\n';
      }
      
      // 添加章节小结
      formattedContent += `## 章节小结\n`;
      formattedContent += `在${scene.sceneName.replace('成田镇', '')}，研学小组通过合作完成了${scene.mainTask.split('\n').length}个任务，发现了${scene.clues?.length || 0}条重要线索，学习了${scene.knowledgePoints?.length || 0}个潮汕文化知识点。\n\n`;
    });
    
    // 添加结论
    if (script.conclusion) {
      formattedContent += `# 活动总结\n${script.conclusion}\n\n`;
    }
    
    // 添加字数统计
    if (script.wordCount) {
      formattedContent += `**字数统计**：${script.wordCount}字\n`;
    }
    
    return formattedContent;
  };

  return (
    <div 
      style={{
        minHeight: '10vh',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'PingFang SC, sans-serif',
        background: '#fff8f3',
        margin: 0,
        padding: 0
      }}
    >
      <header style={{
        padding: '2rem 3rem',
        background: '#ff7a45',
        color: 'white',
        boxShadow: '0 4px 12px rgba(255, 122, 69, 0.15)',
        position: 'sticky',
        top: 0,
        zIndex: 100
      }}>
        <h1 style={{ 
          fontSize: '1.5rem', 
          margin: 0, 
          display: 'flex', 
          alignItems: 'center', 
          gap: '0.75rem' 
        }}>
          🎭 成田镇沉浸式研学剧本工厂
          {scriptError && (
            <div style={{
              color: '#ffebee',
              fontSize: '0.875rem',
              marginTop: '0.5rem',
              fontWeight: 500
            }}>
              ⚠️ {scriptError}
            </div>
          )}
        </h1>
      </header>

      <main style={{
        flex: 1,
        padding: '3rem 5rem',
        display: 'flex',
        gap: '3rem',
        overflowY: 'auto',
        minHeight: 'calc(100vh - 180px)'
      }}>
        <section style={{
          flex: 3,
          background: 'white',
          borderRadius: '1.5rem',
          padding: '2.5rem',
          boxShadow: '0 12px 24px rgba(255, 122, 69, 0.08)'
        }}>
          {scenarios.map((msg, index) => (
            <div key={index} style={{ marginBottom: '2.5rem' }}>
              {msg.role === 'system' && (
                <div style={{
                  fontSize: '0.9rem',
                  color: '#666',
                  marginBottom: '1.5rem',
                  borderLeft: '3px solid #ff7a45',
                  paddingLeft: '1.25rem',
                  background: '#fff3e0',
                  borderRadius: '0.5rem',
                  padding: '1rem'
                }}>
                  啊顺：{msg.content}
                </div>
              )}
              
              {['user', 'assistant'].includes(msg.role) && (
                <div style={{
                  borderRadius: '1.25rem',
                  padding: '1.5rem',
                  position: 'relative',
                  animation: 'slideIn 0.3s ease-out'
                }}>
                  {msg.role === 'user' && (
                    <div style={{
                      background: '#fff3e0',
                      borderRadius: '1rem',
                      padding: '1.5rem',
                      position: 'relative',
                      border: '1px solid #ffe0b2',
                      boxShadow: '0 4px 8px rgba(255, 122, 69, 0.05)'
                    }}>
                      <span style={{
                        position: 'absolute',
                        top: '-1rem',
                        left: '-1rem',
                        width: '2.5rem',
                        height: '2.5rem',
                        background: '#ff7a45',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white',
                        fontSize: '1.125rem',
                        boxShadow: '0 2px 4px rgba(255, 122, 69, 0.2)'
                      }}>
                        ✍️
                      </span>
                      <p style={{ margin: 0, lineHeight: '1.6' }}>{msg.content}</p>
                    </div>
                  )}

                  {msg.role === 'assistant' && msg.content?.scenarios && (
                    <div style={{
                      background: '#fff8f3',
                      borderRadius: '1rem',
                      padding: '1.5rem',
                      position: 'relative',
                      border: '1px solid #ffe8d6',
                      boxShadow: '0 4px 8px rgba(255, 122, 69, 0.05)'
                    }}>
                      <span style={{
                        position: 'absolute',
                        top: '-1rem',
                        right: '-1rem',
                        width: '2.5rem',
                        height: '2.5rem',
                        background: '#ff7a45',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white',
                        fontSize: '1.125rem',
                        boxShadow: '0 2px 4px rgba(255, 122, 69, 0.2)'
                      }}>
                        🎬
                      </span>
                      
                      <div style={{ marginBottom: '2rem', padding: '1rem', background: '#ff7a4510', borderRadius: '0.75rem' }}>
                        <h3 style={{ fontSize: '1.5rem', margin: '0 0 1rem 0', color: '#ff7a45' }}>
                          🎭 沉浸式研学剧本：{msg.content.title || "成田镇文化探秘"}
                        </h3>
                        <p style={{ margin: '0.5rem 0', color: '#333' }}>
                          <span style={{ fontWeight: 'bold', color: '#ff7a45' }}>主人公：</span>
                          {msg.content.mainCharacters || "研学小组"}
                        </p>
                        <p style={{ margin: '0.5rem 0', color: '#333' }}>
                          <span style={{ fontWeight: 'bold', color: '#ff7a45' }}>背景故事：</span>
                          {msg.content.background || "为了探寻潮汕传统文化的奥秘..."}
                        </p>
                        <p style={{ margin: '0.5rem 0', color: '#333' }}>
                          <span style={{ fontWeight: 'bold', color: '#ff7a45' }}>总任务：</span>
                          {msg.content.mainQuest || "通过三大场景挑战，解开成田镇文化之谜"}
                        </p>
                      </div>

                      {/* 保留原有的场景卡片展示 */}
                      <div style={{ marginTop: '3rem' }}>
                        <h3 style={{
                          fontSize: '1.5rem',
                          margin: '0 0 1.5rem 0',
                          color: '#ff7a45',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.75rem'
                        }}>
                          📜 场景详情
                        </h3>
                        
                        {msg.content.scenarios.map((scene, sceneIdx) => (
                          <div key={sceneIdx} style={{ marginBottom: '2.5rem', border: '1px solid #ffe8d6', borderRadius: '1rem', overflow: 'hidden' }}>
                            <div style={{
                              background: '#ff7a45',
                              color: 'white',
                              padding: '1.25rem 1.5rem',
                              marginBottom: '1rem'
                            }}>
                              <h3 style={{
                                fontSize: '1.25rem',
                                margin: 0,
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.75rem'
                              }}>
                                {sceneIdx + 1}. {scene.sceneName}
                              </h3>
                            </div>

                            <div style={{ padding: '1.5rem' }}>
                              <div style={{ marginBottom: '1.5rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div style={{ background: '#fff3e0', padding: '1rem', borderRadius: '0.75rem' }}>
                                  <h4 style={{ color: '#ff7a45', margin: '0 0 0.5rem 0', fontSize: '1.1rem' }}>时空设定</h4>
                                  <p style={{ margin: 0 }}>{scene.timeSetting}</p>
                                </div>
                                <div style={{ background: '#fff3e0', padding: '1rem', borderRadius: '0.75rem' }}>
                                  <h4 style={{ color: '#ff7a45', margin: '0 0 0.5rem 0', fontSize: '1.1rem' }}>角色身份</h4>
                                  <div style={{ whiteSpace: 'pre-wrap' }}>{scene.role}</div>
                                </div>
                              </div>

                              <div style={{ marginBottom: '1.5rem' }}>
                                <h4 style={{
                                  color: '#ff7a45',
                                  fontSize: '1.125rem',
                                  margin: '0 0 0.75rem 0',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.5rem'
                                }}>
                                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ff7a45' }}></span>
                                  核心任务
                                </h4>
                                <div style={{ background: '#fff3e0', padding: '1rem', borderRadius: '0.75rem' }}>
                                  <ol style={{ paddingLeft: '1.5rem', margin: 0 }}>
                                    {scene.mainTask.split('\n').map((task, idx) => (
                                      <li key={idx} style={{ marginBottom: '0.5rem' }}>{task.trim()}</li>
                                    ))}
                                  </ol>
                                </div>
                              </div>

                              <div style={{ marginBottom: '1.5rem' }}>
                                <h4 style={{
                                  color: '#ff7a45',
                                  fontSize: '1.125rem',
                                  margin: '0 0 0.75rem 0',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.5rem'
                                }}>
                                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ff7a45' }}></span>
                                  互动道具
                                </h4>
                                <div style={{
                                  display: 'flex',
                                  flexWrap: 'wrap',
                                  gap: '0.75rem'
                                }}>
                                  {scene.props?.map((prop, idx) => (
                                    <div key={idx} style={{
                                      background: '#fff3e0',
                                      padding: '0.5rem 1rem',
                                      borderRadius: '0.5rem',
                                      border: '1px solid #ffe0b2',
                                      fontSize: '0.9rem'
                                    }}>
                                      {prop}
                                    </div>
                                  )) || <div style={{ color: '#666', fontStyle: 'italic' }}>无特殊道具</div>}
                                </div>
                              </div>

                              <div>
                                <h4 style={{
                                  color: '#ff7a45',
                                  fontSize: '1.125rem',
                                  margin: '0 0 0.75rem 0',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.5rem'
                                }}>
                                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ff7a45' }}></span>
                                  隐藏线索
                                </h4>
                                <div style={{
                                  display: 'grid',
                                  gridTemplateColumns: '1fr',
                                  gap: '1rem'
                                }}>
                                  {scene.clues?.map((clue, idx) => (
                                    <div key={idx} style={{
                                      background: '#fff3e0',
                                      padding: '1rem',
                                      borderRadius: '0.5rem',
                                      border: '1px solid #ffe0b2',
                                      fontSize: '0.9rem',
                                      position: 'relative',
                                      transition: 'all 0.3s ease',
                                      boxShadow: '0 2px 4px rgba(255, 122, 69, 0.05)'
                                    }}>
                                      <span style={{
                                        position: 'absolute',
                                        top: '0.5rem',
                                        right: '0.5rem',
                                        color: '#ff7a45',
                                        fontSize: '0.75rem'
                                      }}>线索 #{idx + 1}</span>
                                      {clue}
                                    </div>
                                  )) || <div style={{ color: '#666', fontStyle: 'italic' }}>无特殊线索</div>}
                                </div>
                              </div>

                              {/* 新增对话展示区域 */}
                              {scene.dialogues && scene.dialogues.length > 0 && (
                                <div style={{ marginTop: '1.5rem' }}>
                                  <h4 style={{
                                    color: '#ff7a45',
                                    fontSize: '1.125rem',
                                    margin: '0 0 0.75rem 0',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem'
                                  }}>
                                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ff7a45' }}></span>
                                    角色对话
                                  </h4>
                                  <div style={{
                                    background: '#fff3e0',
                                    padding: '1rem',
                                    borderRadius: '0.75rem'
                                  }}>
                                    {scene.dialogues.map((dialogue, idx) => (
                                      <div key={idx} style={{
                                        marginBottom: '1rem',
                                        paddingBottom: '1rem',
                                        borderBottom: idx < scene.dialogues.length - 1 ? '1px dashed #ffe0b2' : 'none'
                                      }}>
                                        <div style={{
                                          color: '#ff7a45',
                                          fontWeight: 'bold',
                                          marginBottom: '0.25rem'
                                        }}>
                                          {dialogue.split('：')[0]}
                                        </div>
                                        <div style={{
                                          paddingLeft: '1rem',
                                          borderLeft: '3px solid #ff7a4530'
                                        }}>
                                          {dialogue.split('：')[1]}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {scene.knowledgePoints && (
                                <div style={{ marginTop: '1.5rem' }}>
                                  <h4 style={{
                                    color: '#ff7a45',
                                    fontSize: '1.125rem',
                                    margin: '0 0 0.75rem 0',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem'
                                  }}>
                                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ff7a45' }}></span>
                                    知识讲解
                                  </h4>
                                  <div style={{
                                    display: 'grid',
                                    gridTemplateColumns: '1fr',
                                    gap: '1rem'
                                  }}>
                                    {scene.knowledgePoints.map((point, idx) => (
                                      <div key={idx} style={{
                                        background: '#fff3e0',
                                        padding: '1rem',
                                        borderRadius: '0.5rem',
                                        border: '1px solid #ffe0b2',
                                        position: 'relative',
                                        overflow: 'hidden'
                                      }}>
                                        <div style={{
                                          position: 'absolute',
                                          top: 0,
                                          left: 0,
                                          width: '4px',
                                          height: '100%',
                                          background: '#ff7a45'
                                        }}></div>
                                        <div style={{ paddingLeft: '0.5rem' }}>
                                          <span style={{
                                            color: '#ff7a45',
                                            fontWeight: 'bold',
                                            fontSize: '0.9rem'
                                          }}>知识点 {idx + 1}：</span>
                                          {point}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}

          <div ref={scenariosEndRef} style={{ height: '2rem' }} />
        </section>

        <aside style={{
          flex: 1,
          background: 'white',
          borderRadius: '1.5rem',
          padding: '2rem',
          boxShadow: '0 12px 24px rgba(255, 122, 69, 0.05)',
          position: 'sticky',
          top: '120px',
          maxHeight: 'calc(100vh - 180px)'
        }}>
          <h3 style={{
            fontSize: '1.25rem',
            color: '#ff7a45',
            marginBottom: '1.5rem',
            borderBottom: '2px solid #ff7a45',
            paddingBottom: '0.5rem'
          }}>剧本设计指南</h3>
          <div style={{
            marginBottom: '1.5rem',
            padding: '1rem',
            background: '#fff3e0',
            borderRadius: '0.75rem'
          }}>
            <p style={{ color: '#333', marginBottom: '1rem' }}>
              输入您的剧本需求，AI将生成围绕汕头市成田镇的沉浸式研学剧本。
            </p>
            <ul style={{
              listStyle: 'none',
              paddingLeft: '1.5rem',
              color: '#333'
            }}>
              <li style={{ marginBottom: '0.5rem', position: 'relative' }}>
                <span style={{ position: 'absolute', left: '-1.5rem', color: '#ff7a45' }}>🎭</span>
                明确指定人数（如"10人团队"）
              </li>
              <li style={{ marginBottom: '0.5rem', position: 'relative' }}>
                <span style={{ position: 'absolute', left: '-1.5rem', color: '#ff7a45' }}>🕵️</span>
                可指定角色（如"包含组长、摄影师2名"）
              </li>
              <li style={{ marginBottom: '0.5rem', position: 'relative' }}>
                <span style={{ position: 'absolute', left: '-1.5rem', color: '#ff7a45' }}>👥</span>
                任务难度可指定年龄段（如"适合12-15岁"）
              </li>
              <li style={{ marginBottom: '0.5rem', position: 'relative' }}>
                <span style={{ position: 'absolute', left: '-1.5rem', color: '#ff7a45' }}>📝</span>
                可指定字数（如"总字数800字左右"）
              </li>
            </ul>
          </div>
          <div style={{
            background: '#ff7a45',
            color: 'white',
            borderRadius: '0.75rem',
            padding: '1rem',
            fontSize: '0.9rem'
          }}>
            <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '1.125rem' }}>提示词示例</h4>
            <p style={{ margin: '0.5rem 0' }}>
              "设计一个适合小学生的成田镇侨批文化探秘剧本，10人团队，包含组长、记录员2名、摄影师2名"
            </p>
            <p style={{ margin: '0.5rem 0' }}>
              "创作一个6人沉浸式潮剧体验剧本，适合中学生，角色包含导演、演员、舞台监督"
            </p>
          </div>
        </aside>
      </main>

      <footer style={{
        padding: '2rem 3rem',
        background: 'white',
        borderTop: '1px solid #ffe8d6',
        display: 'flex',
        gap: '2rem',
        alignItems: 'center',
        boxShadow: '0 -4px 12px rgba(255, 122, 69, 0.03)',
        position: 'sticky',
        bottom: 0
      }}>
        <textarea
          value={userPrompt}
          onChange={(e) => setUserPrompt(e.target.value)}
          style={{
            flex: 1,
            padding: '1.25rem 1.75rem',
            borderRadius: '1.5rem',
            border: '1px solid #ffe0b2',
            fontSize: '1rem',
            minHeight: '1rem',
            maxHeight: '2rem',
            resize: 'vertical',
            outline: 'none',
            transition: 'box-shadow 0.2s ease',
            background: '#fff8f3',
            boxShadow: 'inset 0 2px 4px rgba(255, 122, 69, 0.05)'
          }}
          placeholder="输入剧本主题（例如：设计适合12-15岁的侨批文化探秘剧本，10人团队，包含3个主线任务）"
        />

        <button
          onClick={handleScriptGenerate}
          disabled={isGenerating}
          style={{
            background: '#ff7a45',
            color: 'white',
            padding: '1.25rem 3rem',
            borderRadius: '1.5rem',
            border: 'none',
            fontSize: '1rem',
            fontWeight: 600,
            cursor: isGenerating ? 'not-allowed' : 'pointer',
            boxShadow: isGenerating 
              ? '0 2px 4px rgba(255, 122, 69, 0.1)' 
              : '0 8px 20px rgba(255, 122, 69, 0.3)',
            transition: 'all 0.3s ease',
            minWidth: '180px'
          }}
        >
          {isGenerating 
            ? <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                <div style={{ width: '1rem', height: '1rem', border: '2px solid white', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
                生成中...
              </div>
            : '生成沉浸式剧本'
          }
        </button>
      </footer>
    </div>
  );
};

export default ImmersiveStudyScriptPage;