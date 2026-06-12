import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

export const dynamic = "force-dynamic";

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  console.error("❌ [Gemini API] GEMINI_API_KEY가 .env.local 파일에 설정되지 않았습니다.");
}

const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

export async function POST(request: Request) {
  try {
    if (!ai) {
      return NextResponse.json(
        { recommendation: "AI 연동이 원활하지 않습니다." },
        { status: 200 }
      );
    }

    let body;
    try {
      body = await request.json();
    } catch (e) {
      return NextResponse.json(
        { recommendation: "올바르지 않은 요청 데이터 형식입니다." },
        { status: 400 }
      );
    }

    const { date } = body;

    const fallbackDate = new Date();
    const todayStr = date || `${fallbackDate.getFullYear()}.${String(fallbackDate.getMonth() + 1).padStart(2, '0')}.${String(fallbackDate.getDate()).padStart(2, '0')}`;

    const prompt = `
너는 대한민국 서울/경기권 최신 데이트 트렌드 전문가이자, 연인들을 위한 다정한 조력자야.

[상황 조건]
- 기준 날짜: ${todayStr}
- 장소: 서울 및 경기권 위주

[필수 요구사항]
1. 팩트 기반 추천 (매우 중요): 반드시 구글 검색을 활용하여 해당 날짜 기준으로 '실제로 영업 중인' 유명 핫플레이스 상호명, '실제로 존재하는' 디저트나 메뉴, '현재 개봉 및 상영 중인' 진짜 영화 제목만 추천해. 
2. 환각 금지: 상호명이나 영화 제목을 임의로 지어내면 절대 안 돼.
3. 친절하고 다정한 존댓말: 인사말은 생략하고 본론으로 바로 시작하되, 문장의 끝맺음은 반드시 친절하고 부드러운 존댓말(~해요, ~어떨까요? 등)로 작성해줘.
4. 분량: 읽기 편한 2~3줄 문장으로 요약해.

반드시 아래 지정된 JSON 형식으로만 응답해.
\`\`\`json
{
  "recommendation": "친절하고 다정한 존댓말로 작성된 구체적이고 실존하는 장소, 메뉴, 영화 추천 문장"
}
\`\`\`
`;

    // 💡 툴 설정을 any로 캐스팅하여 TypeScript 빌드 에러를 방지합니다.
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      // @ts-ignore: 타입 라이브러리의 tools 속성 인식 문제 우회
    } as any, { 
      tools: [{ googleSearch: {} }] 
    } as any);

    const responseText = response.text;
    console.log("📥 [Gemini 응답 수신]:", responseText);

    if (!responseText) {
      throw new Error("Gemini에서 빈 응답이 반환되었습니다.");
    }

    let cleanedText = responseText;
    if (cleanedText.includes("```")) {
      cleanedText = cleanedText.replace(/```json/g, "").replace(/```/g, "").trim();
    }

    let data;
    try {
      data = JSON.parse(cleanedText);
    } catch (parseError) {
      console.error("❌ [Error] AI 응답 JSON 최종 파싱 실패:", parseError);
      data = { recommendation: "AI 연동이 원활하지 않습니다." };
    }

    return NextResponse.json(data);

  } catch (error: any) {
    console.error("❌ [Gemini API 최종 통신 실패 원인]:", error);
    return NextResponse.json(
      { recommendation: "AI 연동이 원활하지 않습니다." },
      { status: 200 }
    );
  }
}