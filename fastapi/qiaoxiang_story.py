from fastapi import FastAPI, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import os
import json
import requests
from pydantic import BaseModel
from typing import List, Dict, Any
from datetime import datetime

# 环境变量配置
API_KEY = os.getenv("KIMI_API_KEY", "sk-KrvvXrBdiT3RxJHxesYyVkfvLtOulO16UzySPXWbVTjEuFOy")  # Kimi API密钥
AI_API_URL = os.getenv("AI_API_URL", "https://api.moonshot.cn/v1/chat/completions")  # AI服务API地址

# 定义数据模型
class StoryRequest(BaseModel):
    query: str

class StoryResponse(BaseModel):
    title: str
    content: str

class APIResponse(BaseModel):
    stories: List[StoryResponse]
    success: bool = True
    message: str = "成功"

# 初始化FastAPI应用
app = FastAPI(
    title="侨乡故事智能问答API",
    description="提供侨乡文化故事的智能问答服务",
    version="1.0.0"
)

# 配置CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup_event():
    """应用启动时的初始化操作"""
    print("侨乡故事智能问答API服务启动中...")
    if not API_KEY or API_KEY == "your_api_key_here":
        print("警告: KIMI_API_KEY环境变量未设置，将使用默认测试密钥")

@app.get("/", tags=["根路径"])
async def read_root():
    """根路径API，返回服务信息"""
    return {
        "服务": "侨乡故事智能问答API",
        "版本": "1.0.0",
        "状态": "运行中",
        "文档": "/docs"
    }

@app.post("/get_story", response_model=APIResponse, tags=["故事获取"])
async def get_story(request: StoryRequest = Body(...)):
    """
    根据用户查询获取相关的侨乡故事
    - **query**: 用户的查询问题
    """
    if not request.query.strip():
        raise HTTPException(status_code=400, detail="查询内容不能为空")
    
    try:
        # 构建AI请求参数
        payload = {
            "model": "moonshot-v1-8k",
            "messages": [
                {
                    "role": "system",
                    "content": "你是专业的侨乡文化讲解员。请根据用户问题生成1个相关故事，故事需包含标题和300字左右的详细内容，内容需包含历史背景、人物细节或建筑特色，语言生动易懂。请严格以JSON数组格式返回，键名为\"title\"和\"content\""
                },
                {
                    "role": "user",
                    "content": request.query.strip()
                }
            ],
            "temperature": 0.7,
            "max_tokens": 1000,
            "n": 1
        }
        
        # 发送请求到AI服务
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {API_KEY}"
        }
        
        response = requests.post(
            AI_API_URL,
            data=json.dumps(payload),
            headers=headers,
            timeout=30
        )
        
        # 处理AI响应
        if response.status_code != 200:
            error_msg = f"AI服务请求失败，状态码: {response.status_code}"
            if response.text:
                try:
                    error_data = response.json()
                    error_msg += f", 错误信息: {error_data.get('error', {}).get('message', '无详细信息')}"
                except:
                    error_msg += f", 原始响应: {response.text[:100]}"
            raise HTTPException(status_code=500, detail=error_msg)
        
        ai_data = response.json()
        if not ai_data.get("choices") or not ai_data["choices"][0].get("message", {}).get("content"):
            raise HTTPException(status_code=500, detail="AI服务返回格式异常，未获取到有效内容")
        
        # 解析AI返回的故事内容
        try:
            story_content = ai_data["choices"][0]["message"]["content"]
            # 处理可能的前缀或后缀（如AI有时会添加说明文字）
            # 这里假设JSON内容被包裹在某个标记中，需要提取
            # 实际使用中可能需要根据实际返回调整解析逻辑
            
            # 简单示例：假设JSON是直接返回的
            stories = json.loads(story_content)
            
            # 确保返回的是数组
            if not isinstance(stories, list):
                stories = [stories]
                
            # 验证每个故事的格式
            validated_stories = []
            for story in stories[:1]:  # 只取第一个故事
                if isinstance(story, dict) and "title" in story and "content" in story:
                    validated_stories.append(StoryResponse(
                        title=story["title"],
                        content=story["content"]
                    ))
            
            if not validated_stories:
                raise HTTPException(status_code=500, detail="AI返回的故事格式不符合要求")
                
            return APIResponse(stories=validated_stories)
            
        except json.JSONDecodeError as e:
            raise HTTPException(status_code=500, detail=f"解析AI响应失败: {str(e)}, 原始内容: {story_content[:200]}")
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"处理AI响应失败: {str(e)}")
            
    except requests.Timeout:
        raise HTTPException(status_code=504, detail="AI服务请求超时")
    except requests.ConnectionError:
        raise HTTPException(status_code=503, detail="无法连接到AI服务")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取故事时发生错误: {str(e)}")

@app.get("/health", tags=["健康检查"])
async def health_check():
    """健康检查API，用于监控服务状态"""
    return {
        "status": "ok",
        "time": datetime.now().isoformat(),
        "api_key_configured": API_KEY != "your_api_key_here"
    }

# 辅助函数：提取关键词
def extract_keywords(text: str) -> List[str]:
    """从文本中提取关键词"""
    import re
    # 去除标点符号
    text = re.sub(r'[^\w\s]', '', text)
    # 分割单词
    words = text.split()
    # 过滤长度小于2的单词，并取前5个
    return [word for word in words if len(word) > 1][:5]

# 主函数：启动服务
if __name__ == "__main__":
    uvicorn.run(
        "qiaoxiang_story:app",
        host=os.getenv("HOST", "0.0.0.0"),
        port=int(os.getenv("PORT", 8000)),
        reload=os.getenv("DEBUG", "false").lower() == "true",
        log_level="debug" if os.getenv("DEBUG", "false").lower() == "true" else "info"
    )    