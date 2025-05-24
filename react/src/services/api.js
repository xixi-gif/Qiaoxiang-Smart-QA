import axios from 'axios';

// 创建API实例
const api = axios.create({
  baseURL: 'http://localhost:8000/api', // FastAPI后端地址
  timeout: 10000,
});

// 智能问答服务
export const getIntelligentAnswer = async (question) => {
  try {
    const response = await api.get('/intelligent-qa', {
      params: { question }
    });
    return response.data;
  } catch (error) {
    console.error('获取智能回答失败', error);
    throw error;
  }
};

// 路线规划服务
export const planRoute = async (origin, destination, duration = 1) => {
  try {
    const response = await api.get('/route-planner', {
      params: { origin, destination, duration }
    });
    return response.data;
  } catch (error) {
    console.error('路线规划失败', error);
    throw error;
  }
};    