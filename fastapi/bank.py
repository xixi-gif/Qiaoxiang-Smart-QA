# main.py
from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn
import os
import json
import requests
from typing import List, Dict, Any
from dotenv import load_dotenv

# 加载环境变量
load_dotenv()

app = FastAPI(
    title="成田镇沉浸式研学剧本生成API",
    description="与React前端交互的剧本生成服务",
    version="1.0.0"
)

# 配置CORS，允许前端请求
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 生产环境中应限制为具体域名
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 定义请求数据模型
class GenerateScriptRequest(BaseModel):
    user_prompt: str
    api_key: str = None  # AI API密钥

# 定义响应数据模型
class GenerateScriptResponse(BaseModel):
    script: Dict[str, Any]
    success: bool = True
    error: str = None

# 角色数据模型（与前端data.js保持一致）
class RoleData(BaseModel):
    role_library: List[str]
    role_descriptions: Dict[str, str]
    role_responsibilities: Dict[str, str]
    default_script: Dict[str, Any]

# 角色数据 - 与前端data.js完全一致
ROLE_LIBRARY = [
    "组长", "记录员", "摄影师", "讲解员", "安全员", "物料管理员"
]

ROLE_DESCRIPTIONS = {
    "组长": "负责团队协调和决策，确保任务顺利进行",
    "记录员": "负责记录重要信息和团队讨论内容",
    "摄影师": "负责拍摄活动照片和视频，记录精彩瞬间",
    "讲解员": "负责讲解文化知识和背景信息",
    "安全员": "负责团队成员的安全，提醒注意事项",
    "物料管理员": "负责管理和分发活动所需物料"
}

ROLE_RESPONSIBILITIES = {
    "组长": "组织团队讨论，分配任务，与NPC沟通",
    "记录员": "整理线索，记录任务进度和重要对话",
    "摄影师": "拍摄场景照片，录制视频素材",
    "讲解员": "学习并讲解文化知识，解答团队成员疑问",
    "安全员": "检查活动场地安全，提醒成员注意安全事项",
    "物料管理员": "领取、保管和分发活动物料"
}

# 默认剧本 - 与前端data.js完全一致
DEFAULT_SCRIPT = {
    "title": "成田镇文化探秘之旅",
    "background": "在汕头市成田镇，一场关于潮汕传统文化的探秘之旅即将展开...",
    "mainCharacters": "研学小组（组长、记录员、摄影师、讲解员）",
    "mainQuest": "完成侨批馆探秘、嵌瓷工坊体验、潮剧社互动三大主线任务，揭开成田镇文化密码",
    "scenarios": [
        {
            "sceneName": "成田镇侨批馆",
            "timeSetting": "上午9:00-10:30",
            "role": "研学小组（组长、记录员、摄影师、讲解员），侨批馆管理员",
            "mainTask": "任务1：小组协作完成侨批馆探秘\n任务2：根据角色分工收集线索",
            "props": ["侨批样本、放大镜、笔记本"],
            "clues": ["特殊标记的侨批信件、古老的印章"],
            "dialogues": [
                "组长：大家注意分工，保持团队协作",
                "记录员：我负责记录重要信息",
                "摄影师：这个场景很有特色，我要多拍几张",
                "讲解员：侨批是海外侨胞通过民间渠道寄回国内的家书和汇款凭证"
            ],
            "knowledgePoints": [
                "侨批是潮汕地区特有的文化现象，承载着海外侨胞的家国情怀",
                "成田镇侨批馆收藏了大量珍贵的侨批文物，反映了华侨历史",
                "侨批包含丰富的历史、文化和社会信息，是重要的历史文献"
            ]
        },
        {
            "sceneName": "成田镇嵌瓷工坊",
            "timeSetting": "上午10:45-12:00",
            "role": "研学小组（组长、记录员、摄影师、讲解员），嵌瓷工艺大师",
            "mainTask": "任务1：学习嵌瓷基础知识\n任务2：尝试制作简单的嵌瓷作品",
            "props": ["彩色瓷片、胶水、镊子、图案样本"],
            "clues": ["特殊图案的嵌瓷碎片、工艺大师的提示"],
            "dialogues": [
                "组长：大家小心操作，不要损坏瓷片",
                "记录员：我来记录制作步骤",
                "摄影师：拍摄嵌瓷制作过程",
                "讲解员：嵌瓷是潮汕传统建筑装饰艺术，具有鲜明的地方特色"
            ],
            "knowledgePoints": [
                "嵌瓷是潮汕地区传统建筑装饰艺术，主要用于祠堂、庙宇等建筑",
                "嵌瓷以彩色瓷片为材料，经过切割、拼贴等工艺制成",
                "成田镇嵌瓷工艺历史悠久，技艺精湛，是省级非物质文化遗产"
            ]
        },
        {
            "sceneName": "成田镇潮剧社",
            "timeSetting": "下午14:00-15:30",
            "role": "研学小组（组长、记录员、摄影师、讲解员），潮剧演员",
            "mainTask": "任务1：了解潮剧历史和表演形式\n任务2：尝试简单的潮剧表演",
            "props": ["潮剧服装、头饰、乐器、剧本片段"],
            "clues": ["潮剧剧本中的特殊标记、演员的提示"],
            "dialogues": [
                "组长：我们分工学习不同的表演部分",
                "记录员：记录潮剧知识和表演要点",
                "摄影师：拍摄潮剧表演精彩瞬间",
                "讲解员：潮剧是潮汕地区的传统戏曲，具有独特的艺术风格"
            ],
            "knowledgePoints": [
                "潮剧是潮汕地区的传统戏曲，形成于明代，已有数百年历史",
                "潮剧唱腔优美，表演细腻，具有浓郁的地方特色",
                "潮剧角色分为生、旦、净、末、丑等，每个角色都有独特的表演风格",
                "成田镇潮剧社传承了许多经典剧目，是潮剧艺术的重要传承地"
            ]
        }
    ],
    "conclusion": "通过本次成田镇沉浸式研学活动，研学小组深入了解了潮汕传统文化，特别是侨批文化、嵌瓷工艺和潮剧艺术。小组成员通过合作完成了各项任务，不仅增长了知识，还培养了团队协作能力和探索精神。",
    "wordCount": "约800字"
}

# 从用户提示中提取人数
def extract_participant_count(prompt: str) -> int:
    import re
    match = re.search(r'(\d+)\s*人', prompt)
    return int(match.group(1)) if match else 4

# 生成角色列表
def generate_role_list(count: int) -> str:
    if count <= 0:
        return ""
    if count > len(ROLE_LIBRARY):
        base_roles = ROLE_LIBRARY[:len(ROLE_LIBRARY)]
        extra_roles = [f"成员{i+1}" for i in range(count - len(ROLE_LIBRARY))]
        return "、".join(base_roles + extra_roles)
    return "、".join(ROLE_LIBRARY[:count])

# 构建增强提示词
def build_enhanced_prompt(user_prompt: str, participant_count: int) -> str:
    return f"""
    {user_prompt}。请确保团队规模为{participant_count}人，并为每位成员分配明确角色。
    请生成完整的沉浸式研学剧本，包含以下要素：
    1. 完整剧情：包含背景故事、主要任务、分阶段剧情发展
    2. 详细角色：研学小组各角色及关键NPC的姓名、性格、职责
    3. 丰富对话：至少8组角色间的对话，展现剧情发展
    4. 互动任务：各场景的具体任务和互动环节
    5. 知识讲解：融入潮汕文化知识点，特别是成田镇特色
    6. 线索设计：隐藏线索和最终解密环节
    7. 总字数控制在800字左右，语言生动，适合14-16岁中学生阅读和表演。
    返回格式：严格遵循JSON结构，使用中文标点。
    """

# 调用AI生成剧本
def generate_script_with_ai(prompt: str, api_key: str) -> Dict[str, Any]:
    try:
        participant_count = extract_participant_count(prompt)
        enhanced_prompt = build_enhanced_prompt(prompt, participant_count)
        
        # AI API配置（示例API，需替换为实际服务）
        api_url = "https://api.moonshot.cn/v1/chat/completions"
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}"
        }
        payload = {
            "model": "moonshot-v1-8k",
            "messages": [
                {"role": "system", "content": "你是专业的沉浸式研学剧本生成器，生成适合中学生的剧本"},
                {"role": "user", "content": enhanced_prompt}
            ],
            "temperature": 0.5,
            "max_tokens": 4000,
            "top_p": 0.8,
            "frequency_penalty": 0.1,
            "presence_penalty": 0.1
        }
        
        response = requests.post(api_url, headers=headers, json=payload)
        response.raise_for_status()
        
        ai_response = response.json().get("choices", [{}])[0].get("message", {}).get("content", "")
        if not ai_response:
            raise ValueError("AI返回内容为空")
            
        try:
            parsed_script = json.loads(ai_response)
        except json.JSONDecodeError:
            print("剧本解析失败，使用默认剧本")
            role_list = generate_role_list(participant_count)
            parsed_script = {
                **DEFAULT_SCRIPT,
                "mainCharacters": f"研学小组（{role_list}）",
                "scenarios": [
                    {
                        **scene,
                        "role": f"研学小组（{role_list}），{scene['role'].split('，')[1]}"
                    }
                    for scene in DEFAULT_SCRIPT["scenarios"]
                ]
            }
            
        return parsed_script
        
    except Exception as e:
        print(f"AI调用错误: {e}")
        participant_count = extract_participant_count(prompt)
        role_list = generate_role_list(participant_count)
        return {
            **DEFAULT_SCRIPT,
            "mainCharacters": f"研学小组（{role_list}）",
            "error": str(e)
        }

# 数据校验
def validate_script(script: Dict[str, Any]) -> Dict[str, Any]:
    if not script.get("scenarios") or len(script["scenarios"]) == 0:
        script["scenarios"] = DEFAULT_SCRIPT["scenarios"].copy()
    
    for scene in script["scenarios"]:
        if not scene.get("role") or "研学小组" not in scene.get("role", ""):
            participant_count = extract_participant_count(script.get("mainQuest", "")) or 4
            role_list = generate_role_list(participant_count)
            scene["role"] = f"研学小组（{role_list}）"
        
        if not scene.get("mainTask"):
            scene["mainTask"] = "任务1：小组协作完成探索\n任务2：根据角色分工收集线索"
        
        if not scene.get("dialogues") or len(scene["dialogues"]) == 0:
            scene["dialogues"] = [
                "组长：大家注意分工，保持团队协作",
                "记录员：我负责记录重要信息",
                "摄影师：这个场景很有特色，我要多拍几张"
            ]
        
        if not scene.get("knowledgePoints") or len(scene["knowledgePoints"]) == 0:
            scene["knowledgePoints"] = ["此处将插入与场景相关的文化知识点"]
    
    return script

# API路由：获取角色数据（与前端同步）
@app.get("/api/roles", response_model=RoleData)
def get_role_data():
    """提供前端所需的角色数据，与前端data.js保持一致"""
    return {
        "role_library": ROLE_LIBRARY,
        "role_descriptions": ROLE_DESCRIPTIONS,
        "role_responsibilities": ROLE_RESPONSIBILITIES,
        "default_script": DEFAULT_SCRIPT
    }

# API路由：生成剧本
@app.post("/api/generate-script", response_model=GenerateScriptResponse)
def generate_script(request: GenerateScriptRequest):
    """接收用户提示，调用AI生成剧本并返回"""
    try:
        api_key = request.api_key or os.getenv("KIMI_API_KEY")
        if not api_key:
            raise HTTPException(status_code=400, detail="缺少API密钥")
            
        script = generate_script_with_ai(request.user_prompt, api_key)
        validated_script = validate_script(script)
        
        return {
            "script": validated_script,
            "success": True
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"生成错误: {e}")
        return {
            "script": DEFAULT_SCRIPT,
            "success": False,
            "error": str(e)
        }

# 根路由
@app.get("/")
def read_root():
    return {
        "message": "成田镇沉浸式研学剧本生成API服务",
        "version": "1.0.0",
        "docs": "/docs"
    }

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)