import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

import 'tailwindcss/tailwind.css';
import '../App.css'; // 可以添加自定义样式

const IntelligentQA = () => {
  const [query, setQuery] = useState('');
  const [stories, setStories] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [activeStoryIndex, setActiveStoryIndex] = useState(-1);
  const [speechProgress, setSpeechProgress] = useState(0);
  const [voices, setVoices] = useState([]);
  const [hasUserInteraction, setHasUserInteraction] = useState(false);
  const inputRef = useRef(null);
  const navigate = useNavigate();
  const [currentText, setCurrentText] = useState(''); // 当前已渲染的文本
  const [isStreaming, setIsStreaming] = useState(false); // 流式输出状态
  const [streamingIndex, setStreamingIndex] = useState(0); // 当前流式输出的故事索引
  const contentRef = useRef(null); // 内容容器引用
  const typingTimer = useRef(null); // 打字效果定时器

  // 后端API地址，可通过环境变量配置
  const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8001';

  // 初始化语音列表
  useEffect(() => {
    const loadVoices = () => {
      const availableVoices = window.speechSynthesis.getVoices();
      setVoices(availableVoices);
    };
    
    window.speechSynthesis.onvoiceschanged = loadVoices;
    loadVoices();
    
    return () => {
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, []);

  // 处理页面首次交互，触发语音播放
  const handleFirstInteraction = () => {
    if (!hasUserInteraction) {
      setHasUserInteraction(true);
      playWelcomeSpeech();
    }
  };

  // 播放欢迎语音
  const playWelcomeSpeech = () => {
    if (!('speechSynthesis' in window) || !voices.length) return;
    
    try {
      const utterance = new SpeechSynthesisUtterance(
        '你好！我是侨乡文化智能讲解员啊顺，请问你想了解哪些方面的故事呢？'
      );
      utterance.lang = 'zh-CN';
      utterance.rate = 1.1;
      
      const femaleVoice = voices.find(voice => 
        voice.name.includes('Female') || (voice.lang === 'zh-CN' && voice.name.includes('女'))
      );
      
      if (femaleVoice) utterance.voice = femaleVoice;
      
      window.speechSynthesis.speak(utterance);
      inputRef.current.focus();
    } catch (error) {
      setErrorMsg(`语音初始化失败: ${error.message}`);
    }
  };

  // 语音朗读函数
  const handleSpeak = (text, index = -1) => {
    if (!('speechSynthesis' in window)) {
      setErrorMsg('当前浏览器不支持语音功能，请使用Chrome浏览器');
      return;
    }
    
    try {
      window.speechSynthesis.cancel();
      if (index !== -1) setActiveStoryIndex(index);
      
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'zh-CN';
      utterance.rate = 1.1;
      
      const maleVoice = voices.find(voice => 
        voice.name.includes('Male') || (voice.lang === 'zh-CN' && voice.name.includes('男'))
      );
      
      if (maleVoice) utterance.voice = maleVoice;
      else if (voices.length > 0) {
        const chineseVoice = voices.find(voice => voice.lang === 'zh-CN');
        if (chineseVoice) utterance.voice = chineseVoice;
      }
      
      utterance.onboundary = (event) => {
        setSpeechProgress(Math.round((event.charIndex / text.length) * 100));
      };
      
      utterance.onend = () => {
        setActiveStoryIndex(-1);
        setSpeechProgress(0);
      };
      
      utterance.onerror = (event) => {
        setErrorMsg(`语音播放错误: ${event.error}`);
      };
      
      window.speechSynthesis.speak(utterance);
    } catch (error) {
      setErrorMsg(`语音功能初始化失败: ${error.message}`);
    }
  };

  // 停止语音朗读
  const stopSpeaking = () => {
    try {
      window.speechSynthesis.cancel();
      setActiveStoryIndex(-1);
      setSpeechProgress(0);
    } catch (error) {
      console.error('停止语音错误:', error);
    }
  };

  // 提取关键词函数
  const extractKeywords = (text) => {
    return text
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 1)
      .slice(0, 5);
  };

  // 格式化内容函数
  const formatContent = (content) => {
    return content.replace(/([。！？])/g, '$1\n\n');
  };

  // 获取故事集
  const fetchStories = async () => {
    if (!query.trim()) return setErrorMsg('请输入有效问题');
    setIsLoading(true);
    setErrorMsg('');
    setStories([]);
    setCurrentText('');
    setIsStreaming(false);
    setStreamingIndex(0);

    try {
      const response = await axios.post(`${API_BASE_URL}/get_story`, {
        query: query.trim()
      }, {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 30000
      });

      if (!response.data || !response.data.stories || response.data.stories.length === 0) {
        throw new Error('API返回格式异常或未生成有效故事');
      }
      
      setStories(response.data.stories);
      if (response.data.stories.length > 0) {
        // 开始流式输出第一个故事
        startStreaming(response.data.stories[0].content, 0);
      }
      
    } catch (error) {
      let msg = '请求失败，请重试';
      if (error.message.includes('timeout')) msg = '请求超时，请稍后再试';
      else if (error.message.includes('Network Error')) msg = '网络连接失败';
      else if (error.response && error.response.status === 401) msg = 'API认证失败';
      else if (error instanceof SyntaxError) msg = '数据解析错误，请检查提问是否清晰';
      
      setErrorMsg(msg);
      console.error('详细错误:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // 开始流式输出文本
  const startStreaming = (fullText, index = 0) => {
    setIsStreaming(true);
    setStreamingIndex(index);
    setCurrentText('');
    
    // 清除可能存在的旧定时器
    if (typingTimer.current) {
      clearInterval(typingTimer.current);
    }
    
    // 模拟流式输出（实际场景中若API支持流式响应，可在此处理实时数据）
    const textArray = fullText.split('');
    let currentPos = 0;
    
    typingTimer.current = setInterval(() => {
      if (currentPos < textArray.length) {
        currentPos++;
        setCurrentText(prevText => prevText + textArray[currentPos - 1]);
        
        // 滚动到内容底部（如果容器已渲染）
        if (contentRef.current) {
          contentRef.current.scrollTop = contentRef.current.scrollHeight;
        }
      } else {
        clearInterval(typingTimer.current);
        setIsStreaming(false);
        // 流式输出完成后自动朗读
        handleSpeak(fullText, index);
      }
    }, 30); // 控制打字速度（毫秒）
  };

  return (
    <div 
      className="min-h-screen bg-gradient-to-b from-orange-100 to-white p-4 md:p-8"
      onClick={handleFirstInteraction}
    >
      <header className="mb-8 container mx-auto">
        <div className="container mx-auto flex flex-col md:flex-row justify-between items-center">
          <h1 className="text-[clamp(1.2rem,4vw,2rem)] font-bold text-orange-800 mb-4 md:mb-0 flex items-center">
            <i className="fa fa-book-open text-orange-600 mr-4"></i>
            侨乡故事智能问答
          </h1>
          <button
            onClick={() => navigate(-1)}
            className="bg-white border-2 border-orange-600 text-orange-600 px-6 py-3 rounded-lg font-medium transition-all duration-300 hover:bg-orange-50 hover:shadow-md flex items-center"
          >
            <i className="fa fa-arrow-left mr-3"></i> 返回首页
          </button>
        </div>
      </header>

      <main className="container mx-auto grid grid-cols-1 lg:grid-cols-12 gap-10">
        <div className="lg:col-span-4 order-2 lg:order-1 relative">
          <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">
            <div className="relative">
              <img 
                src="/people.png" 
                alt="侨乡文化讲解员啊顺" 
                className="w-full h-80 object-cover rounded-t-3xl"
                onError={(e) => e.target.src="https://source.unsplash.com/random/600x400?people,history"}
              />
              
              {activeStoryIndex >= 0 && (
                <div className="absolute right-6 bottom-6 bg-orange-700 text-white rounded-full p-4 shadow-2xl">
                  <i className="fa fa-pause text-2xl"></i>
                </div>
              )}
            </div>

            <div className="p-8">
              <h3 className="text-2xl font-bold text-orange-800 mb-4">
                侨乡文化智能讲解员
              </h3>
              <p className="text-lg text-gray-700 leading-7 mb-6">
                专注为您呈现侨乡历史脉络、侨胞奋斗足迹、侨批文化密码与侨宅建筑美学，直接提问即可开启探索～
              </p>

              {stories.length > 0 && (
                <div className="mt-8 bg-orange-50 rounded-3xl p-6">
                  <h4 className="text-lg font-semibold text-orange-600 mb-3 flex items-center gap-4">
                    <div className="w-8 h-8 bg-orange-600 rounded-full animate-bounce"></div>
                    当前正在讲解：{stories[activeStoryIndex]?.title || '无'}
                  </h4>
                  
                  <div className="mt-4">
                    <div className="w-full bg-orange-100 rounded-full h-3">
                      <div className="bg-orange-600 h-3 rounded-full" style={{ width: `${speechProgress}%` }}></div>
                    </div>
                    <div className="text-sm text-gray-600 mt-2 flex justify-between">
                      <span>{Math.round(speechProgress)}%</span>
                      <span>剩余时长：{Math.round((1 - speechProgress/100) * stories[activeStoryIndex]?.content.length / 150)}秒</span>
                    </div>
                  </div>

                  <button
                    onClick={stopSpeaking}
                    className="mt-5 bg-orange-100 text-orange-600 px-6 py-3 rounded-3xl hover:bg-orange-200"
                  >
                    <i className="fa fa-stop-circle mr-3"></i> 暂停讲解
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="lg:col-span-8 order-1 lg:order-2">
          <div className="sticky top-16 mb-8 bg-white rounded-3xl shadow-2xl p-8 transform transition-all duration-300 hover:shadow-xl">
            <div className="flex flex-col md:flex-row gap-6">
              <input
                ref={inputRef}
                type="text"
                placeholder="请提问（例如：成田镇的侨乡故事）"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="flex-grow px-6 py-5 rounded-3xl border-2 border-gray-200 focus:border-orange-600 focus:ring-2 focus:ring-orange-200 outline-none text-lg"
              />
              <button
                onClick={fetchStories}
                disabled={isLoading || !query.trim()}
                className="bg-orange-600 hover:bg-orange-700 text-white font-semibold px-8 py-4 rounded-3xl shadow-md hover:shadow-lg transition-all duration-300 disabled:opacity-70"
              >
                {isLoading ? '生成中...' : '获取故事'}
              </button>
            </div>
          </div>

          <div className="bg-white rounded-3xl shadow-2xl p-8 min-h-[400px]">
            {stories.length > 0 ? (
              <>
                <div className="mb-8">
                  <h3 className="text-xl font-bold text-gray-900">为你找到1个相关故事</h3>
                </div>

                <div className="space-y-6">
                  {stories.map((story, index) => (
                    <div
                      key={index}
                      className={`border-b border-gray-100 pb-8 last:pb-0 transform hover:-translate-y-3 hover:shadow-xl transition-all duration-300 ${
                        streamingIndex === index ? 'border-orange-500' : ''
                      }`}
                    >
                      <div className="flex flex-col gap-4">
                        <div className="flex-1">
                          <h4 className="text-lg font-bold text-gray-900 mb-4 flex items-center justify-between">
                            <span>{story.title}</span>
                            <button
                              onClick={() => {
                                if (isStreaming && streamingIndex === index) {
                                  clearInterval(typingTimer.current);
                                  setCurrentText(story.content);
                                  setIsStreaming(false);
                                }
                                handleSpeak(story.content, index);
                              }}
                              className="bg-orange-50 text-orange-600 px-5 py-2 rounded-full flex items-center gap-2"
                            >
                              <i className="fa fa-volume-up"></i> 
                              {isStreaming && streamingIndex === index ? '停止流式' : '朗读'}
                            </button>
                          </h4>
                          <p 
                            ref={contentRef}
                            className="text-lg text-gray-700 leading-8"
                          >
                            {isStreaming && streamingIndex === index 
                              ? currentText 
                              : formatContent(story.content).split('\n').map((p, i) => (
                                  <React.Fragment key={i}>
                                    {p}
                                    {i !== story.content.split('\n').length - 1 && <br />}
                                  </React.Fragment>
                                ))}
                          </p>

                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-24 h-24 mb-6 text-gray-300">
                  <i className="fa fa-book-open text-7xl"></i>
                </div>
                <h3 className="text-2xl font-medium text-gray-500 mb-4">侨乡故事智能问答</h3>
                <p className="text-gray-500 max-w-md text-lg">
                  请输入问题，获取关于侨乡、侨胞、侨批、侨宅的故事
                </p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default IntelligentQA;