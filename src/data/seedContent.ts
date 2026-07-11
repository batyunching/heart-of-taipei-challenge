import type { ContentPage, InterviewPrompt, Mission } from "../types/mission";

export const contentPages: ContentPage[] = [
  {
    key: "home",
    titleZh: "首頁",
    titleEn: "Home",
    introEn:
      "Taipei is an international city where bilingual signs appear in many public spaces. Today, you will explore the heart of Taipei and learn how English helps people connect across cultures.",
    introZh:
      "臺北是一座國際城市，雙語資訊遍布公共空間。今天你們將探索台北之心，觀察英文如何幫助不同文化的人互相連結。",
  },
  {
    key: "peace_park",
    titleZh: "二二八和平公園",
    titleEn: "2/28 Peace Park",
    introEn:
      "2/28 Peace Park is an important public space in Taipei. Observe how history, memory, and daily life meet in one place.",
    introZh:
      "二二八和平公園是臺北重要的公共空間。走進公園時，請觀察歷史記憶與日常生活如何在同一個場域交會。",
  },
  {
    key: "ntm_main",
    titleZh: "臺博館本館",
    titleEn: "NTM Main Building",
    introEn:
      "The National Taiwan Museum is one of Taiwan's oldest museums. Its exhibitions help visitors learn about Taiwan through nature, culture, and history.",
    introZh:
      "國立臺灣博物館是臺灣歷史悠久的博物館之一。館內展覽透過自然、文化與歷史，引導參觀者認識臺灣。",
  },
  {
    key: "paleontology",
    titleZh: "古生物館",
    titleEn: "Paleontology Hall",
    introEn:
      "In the Paleontology Hall, you can meet fossils and prehistoric animals. Choose one that interests your team and introduce it in English.",
    introZh:
      "在古生物館中，你可以認識化石與史前動物。請選擇你們小組最感興趣的一項，並用英文介紹它。",
  },
  {
    key: "taipei_station",
    titleZh: "臺北車站",
    titleEn: "Taipei Main Station",
    introEn:
      "Taipei Main Station is a busy transportation hub. Look for English signs and think about how they help travelers move safely and easily.",
    introZh:
      "臺北車站是繁忙的交通樞紐。請尋找英文標示，思考它們如何協助旅客安全、順利地移動。",
  },
  {
    key: "world_friend",
    titleZh: "與世界交朋友",
    titleEn: "Connecting with the World",
    introEn:
      "Use polite English to invite an international visitor for a short interview. If the visitor agrees, ask a few questions and request a group photo.",
    introZh:
      "請用有禮貌的英文邀請外國遊客接受簡短訪談。若對方願意，請詢問幾個問題，並徵詢是否可以合照。",
  },
  {
    key: "review_submit",
    titleZh: "成果總覽",
    titleEn: "Review & Submit",
    introEn: "Review your team progress before submitting your final work.",
    introZh: "送出成果前，請檢查你們小組的完成狀態。",
  },
];

export const missions: Mission[] = [
  {
    id: "peace-1",
    pageKey: "peace_park",
    type: "photo_text",
    titleZh: "和平公園景點任務 1",
    titleEn: "Peace Park Spot Mission 1",
    introEn:
      "Take one photo, write one key English word, and write one English sentence about this spot.",
    introZh: "拍一張照片，寫一個核心英文單字，並用英文寫一句對這個景點的觀察。",
    keywords: ["history", "memory", "park"],
    requiredMedia: "photo",
  },
  {
    id: "peace-2",
    pageKey: "peace_park",
    type: "photo_text",
    titleZh: "和平公園景點任務 2",
    titleEn: "Peace Park Spot Mission 2",
    introEn:
      "Find another meaningful place in the park. Take a photo and write one English observation.",
    introZh: "在公園中尋找另一個有意義的地點，拍照並寫下一句英文觀察。",
    keywords: ["monument", "public", "city"],
    requiredMedia: "photo",
  },
  {
    id: "peace-3",
    pageKey: "peace_park",
    type: "photo_text",
    titleZh: "和平公園景點任務 3",
    titleEn: "Peace Park Spot Mission 3",
    introEn:
      "Choose a final spot and explain what your team noticed in English.",
    introZh: "選擇最後一個景點，並用英文說明你們小組觀察到什麼。",
    keywords: ["peace", "observe", "reflection"],
    requiredMedia: "photo",
  },
  {
    id: "ntm-1f",
    pageKey: "ntm_main",
    type: "photo_text",
    titleZh: "一樓指定文物",
    titleEn: "1F Featured Object",
    introEn:
      "Observe the featured object on the first floor. Take a photo, write a keyword, and write one English sentence.",
    introZh: "觀察一樓指定文物，拍照、寫一個關鍵字，並完成一句英文觀察。",
    keywords: ["museum", "object", "exhibition"],
    requiredMedia: "photo",
  },
  {
    id: "ntm-2f",
    pageKey: "ntm_main",
    type: "photo_text",
    titleZh: "二樓指定文物",
    titleEn: "2F Featured Object",
    introEn:
      "Observe the featured object on the second floor and record your finding in English.",
    introZh: "觀察二樓指定文物，並用英文記錄你們的發現。",
    keywords: ["display", "collection", "culture"],
    requiredMedia: "photo",
  },
  {
    id: "ntm-3f",
    pageKey: "ntm_main",
    type: "photo_text",
    titleZh: "三樓指定文物",
    titleEn: "3F Featured Object",
    introEn:
      "Observe the featured object on the third floor and write one English response.",
    introZh: "觀察三樓指定文物，並寫下一句英文回應。",
    keywords: ["history", "visitor", "learn"],
    requiredMedia: "photo",
  },
  {
    id: "museum-english",
    pageKey: "ntm_main",
    type: "info_card",
    titleZh: "博物館英文分類卡",
    titleEn: "Museum English Category Cards",
    introEn:
      "Explore museum English in four categories: Regulatory, Informational, Safety, and Exhibition.",
    introZh: "探索四類博物館英文：規範、資訊、安全與展覽。",
    keywords: ["Regulatory", "Informational", "Safety", "Exhibition"],
    requiredMedia: "none",
  },
  {
    id: "paleo-recording",
    pageKey: "paleontology",
    type: "audio",
    titleZh: "古生物英文介紹",
    titleEn: "Paleontology English Recording",
    introEn:
      "Choose your favorite fossil or prehistoric animal. Complete five fields and record your English introduction.",
    introZh: "選擇最喜歡的化石或史前動物，完成五個欄位，並錄製英文介紹。",
    keywords: ["fossil", "prehistoric", "animal"],
    requiredMedia: "audio",
  },
  {
    id: "station-signs",
    pageKey: "taipei_station",
    type: "station_sign",
    titleZh: "臺北車站英文標示探索",
    titleEn: "Taipei Main Station English Sign Hunt",
    introEn:
      "Find at least six English signs. Record the English, Chinese, purpose, and location.",
    introZh: "尋找至少六個英文標示，記錄英文、中文、用途與位置。",
    keywords: ["Transportation", "Direction", "Service", "Safety"],
    requiredMedia: "photo",
  },
  {
    id: "world-friend",
    pageKey: "world_friend",
    type: "world_friend",
    titleZh: "與世界交朋友",
    titleEn: "Connecting with the World",
    introEn:
      "Use the bilingual interview prompts, complete a short interview, ask for a photo, and enter the visitor's country.",
    introZh: "使用中英訪談句型，完成簡短訪談，徵詢合照，並填寫外國朋友的國家。",
    keywords: ["interview", "country", "photo"],
    requiredMedia: "photo",
  },
];

export const interviewPrompts: InterviewPrompt[] = [
  {
    id: "invite",
    label: "邀請訪談",
    zh: "你好，我們是大觀國中的學生。我們正在進行跟外國人交談的訪談活動。活動大概三到五分鐘，您願意接受我們的訪談嗎？",
    en: "Hello, we are students from Ta-guan Junior High School. We are doing an interview activity to talk with international visitors. It will take about three to five minutes. Would you be willing to answer a few questions?",
  },
  {
    id: "country",
    label: "詢問國家",
    zh: "請問您是從哪一個國家來的？",
    en: "Which country are you from?",
  },
  {
    id: "why-taiwan",
    label: "詢問來臺原因",
    zh: "請問您為什麼會來臺灣？",
    en: "Why did you come to Taiwan?",
  },
  {
    id: "favorite",
    label: "詢問喜歡之處",
    zh: "請問您最喜歡臺灣的哪一件事情？",
    en: "What do you like most about Taiwan?",
  },
  {
    id: "unfamiliar",
    label: "詢問不習慣之處",
    zh: "請問有沒有哪一個點，是您來臺灣最不喜歡或最不習慣的地方？",
    en: "Is there anything you dislike or are not used to in Taiwan?",
  },
  {
    id: "photo",
    label: "徵詢合照",
    zh: "請問我們可以和您一起拍一張合照嗎？",
    en: "May we take a photo with you?",
  },
  {
    id: "declined",
    label: "被拒絕時回應",
    zh: "沒關係。還是非常謝謝您！祝您有美好的一天！",
    en: "No problem. Thank you anyway! Have a nice day!",
  },
  {
    id: "thanks",
    label: "訪談結束感謝",
    zh: "謝謝您接受我們的訪談。祝您在臺灣玩得愉快！",
    en: "Thank you for answering our questions. We hope you have a wonderful time in Taiwan!",
  },
];
