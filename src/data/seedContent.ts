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
      "2/28 Peace Park was first developed as Taipei Park during the Japanese colonial period and later became known as New Park. It is one of the oldest modern parks in central Taipei. The park keeps traces from different times: old stone monuments, historic buildings, the National Taiwan Museum, the 2/28 Memorial Monument, and the Taipei 2/28 Memorial Museum. In 1947, the radio station in this area became connected with the spread of news during the 2/28 Incident. When you walk here, notice how a city park can also be a place for remembering history, learning about justice, and thinking about peace.",
    introZh:
      "二二八和平公園位在臺北城的核心地帶，前身是日治時期規劃的臺北公園，後來也被稱為新公園，是臺北早期重要的現代都市公園之一。園內保留了不同時代留下的痕跡，例如石坊、紀念碑、歷史建築、臺博館本館，以及二二八和平紀念碑與臺北二二八紀念館。1947 年二二八事件發生時，園內的廣播設施曾成為消息傳播的重要地點。走進這座公園，不只是看樹木與步道，也是在理解臺灣如何面對歷史傷痛、追求公義，並把記憶轉化為和平教育。對國中生來說，這裡很適合練習把「地點」和「歷史事件」連在一起思考：同一個公共空間，可能同時承載休閒、紀念、學習與反省的功能。",
  },
  {
    key: "ntm_main",
    titleZh: "臺博館本館",
    titleEn: "NTM Main Building",
    introEn:
      "The National Taiwan Museum is one of Taiwan's oldest museums. Its history began in the Japanese colonial period, when exhibitions were used to collect and display Taiwan's natural resources, industries, animals, plants, minerals, and cultures. The main building in 2/28 Peace Park was completed in 1915 and is now an important historic monument. Its classical columns, dome, and grand hall show how public buildings in Taipei were designed more than a hundred years ago. Today, the museum helps visitors understand Taiwan through natural history, anthropology, geology, animals, plants, and cultural collections. It is a good place to ask: what stories can objects tell about Taiwan?",
    introZh:
      "國立臺灣博物館是臺灣歷史最悠久的博物館之一，源頭可追溯到日治時期的物產陳列與博物館制度。現在位於二二八和平公園旁的本館建築於 1915 年完工，曾名為臺灣總督府博物館，今日已是重要的國定古蹟。它的柱廊、圓頂與中央大廳，呈現百年前臺北公共建築的氣派。館內長期保存臺灣自然史、人類學、地質、動物、植物與文化相關典藏。參觀臺博館時，可以思考：博物館為什麼要收藏標本與文物？這些物件又如何幫助我們認識臺灣的環境、族群與歷史？國中生可以特別留意展品標籤、展示分類與建築細節，因為它們會告訴我們，不同時代的人如何理解臺灣，也如何把知識整理成可以被大眾學習的內容。",
  },
  {
    key: "paleontology",
    titleZh: "古生物館",
    titleEn: "Paleontology Hall",
    introEn:
      "The Paleontology Hall is housed in the former Nippon Kangyo Bank Taipei Branch, a historic bank building completed in 1933. After World War II, the building became connected with the Land Bank of Taiwan. Later, it was preserved and reused by the National Taiwan Museum as a branch museum. This makes the building special: it is both a place to learn about prehistoric life and a place to notice financial and architectural history. Inside, visitors can see fossils, dinosaurs, ancient animals, and displays about evolution. As you explore, look at both the exhibits and the building itself. A museum can tell stories not only through objects, but also through the space that holds them.",
    introZh:
      "古生物館所在建築原是日本勸業銀行臺北支店，1933 年落成，戰後與臺灣土地銀行的發展密切相關。後來這棟歷史建築被保存並活化，由國立臺灣博物館作為分館使用，因此它同時具有金融史、建築史與自然史的意義。走進館內，你會看到化石、恐龍、古代生物與演化相關展示；抬頭觀察，也能看見舊銀行空間的挑高感與莊重氣氛。這裡提醒我們：博物館不只是展示物品的地方，建築本身也會說故事。請一邊認識史前生命，一邊想想老建築如何被重新賦予新的教育功能。對國中生而言，這裡最有趣的是「時間尺度」的對比：古生物帶我們看見數千萬年前的地球，而銀行建築則保存近代臺北城市與金融發展的記憶。",
  },
  {
    key: "taipei_station",
    titleZh: "臺北車站",
    titleEn: "Taipei Main Station",
    introEn:
      "Taipei Main Station is the most important transportation hub in northern Taiwan. Railway service in this area began in 1889, and the station has changed names, locations, and buildings as Taipei grew. Today, it connects Taiwan Railways, High Speed Rail, Taipei Metro, buses, taxis, underground malls, and nearby shopping areas. Because many local and international travelers pass through every day, clear bilingual signs are very important. They help people find platforms, exits, ticket counters, restrooms, transfer routes, and safety information. When you observe the station, do not only count signs. Think about how language, design, and public space work together to help a city move.",
    introZh:
      "臺北車站是北臺灣最重要的交通樞紐之一，鐵路服務可追溯到 1889 年。隨著臺北城市發展，車站曾經歷不同名稱、位置與建築形式，今日則成為臺鐵、高鐵、捷運、公車、計程車、地下街與商圈交會的巨大交通節點。每天有大量通勤者、旅客與外國訪客在這裡移動，因此清楚的中英文標示非常重要。它們不只是翻譯文字，而是協助人們找到月台、出口、售票處、廁所、轉乘路線與安全資訊。觀察臺北車站時，請思考一座城市如何透過交通、標示與空間設計，讓不同背景的人都能順利抵達目的地。國中生可以把這裡當成一座會運轉的城市教室：人流、動線、廣播、地圖和英文標示，都是現代城市服務旅客的方式。",
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
      "Photograph five bilingual signs with different functions. Record the English, Chinese, and function of each sign.",
    introZh:
      "請拍攝五種不同功能的雙語指標，例如位置說明、方向引導、機器操作、到站離站資訊、服務或安全提醒，並記錄英文、中文與功能。",
    keywords: [
      "Location information",
      "Direction guidance",
      "Machine operation",
      "Arrival / departure information",
      "Service / safety",
    ],
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
