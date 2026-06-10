// app/api/recommend/route.ts

import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  console.error("GEMINI_API_KEY is not set");
}

const genAI = new GoogleGenerativeAI(apiKey || "");

export async function POST(request: Request) {
  try {
    const { weather, username } = await request.json();

    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash",
    });

    const prompt = `
너는 커플들을 위한 대한민국 최신 데이트 트렌드 및 코스 추천 AI 전문가야.

유저 이름은 "${username}"이고,
다가오는 데이트 날씨는 "${weather.condition}",
기온은 "${weather.temp}",
강수확률은 "${weather.pop}"이야.

현재 2026년 최신 데이트 트렌드,
유행하는 음식/카페,
극장가 인기 영화,
성수·한남·신용산 등 핫플레이스 감성을 조합해서
이 날씨에 딱 맞는 센스 있는 데이트 코스를 추천해줘.

반드시 JSON만 반환해.

{
  "recommendation": "추천 문장"
}
`;

    const result = await model.generateContent({
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        responseMimeType: "application/json",
      },
    });

    const responseText = result.response.text();

    console.log("Gemini Response:");
    console.log(responseText);

    let data;

    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      console.error("JSON Parse Error:", parseError);

      data = {
        recommendation: responseText,
      };
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Gemini API Error:", error);

    return NextResponse.json(
      {
        recommendation:
          "선정릉역 인근, 아늑하고 조용한 분위기의 스시 오마카세는 어떠세요? 조용한 대화가 필요할 때 안성맞춤입니다.",
      },
      {
        status: 200,
      }
    );
  }
}